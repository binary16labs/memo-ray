const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { syncClaude } = require('./parsers/claudeParser');
const { syncAntigravity } = require('./parsers/antigravityParser');
const store = require('./lib/entity_store');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: localhost origins only. This server exposes the operator's agent
// memory AND an OS file-open endpoint — a wildcard origin would let any
// website the operator visits read their lineage and trigger file opens
// (classic drive-by against localhost services). Same-machine UIs (the Vite
// client, prime-silo's site dashboard) are all localhost, so nothing else
// needs in.
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true); // same-origin / curl
        try {
            const { hostname } = new URL(origin);
            return callback(null, LOCAL_HOSTNAMES.has(hostname));
        } catch {
            return callback(null, false);
        }
    }
}));
app.use(express.json());
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('[Server] JSON Parsing Error:', err.message);
        return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    next();
});

const ENTITIES_DIR = store.ENTITIES_DIR;
const DATA_DIR = store.DATA_DIR;

// Ensure dirs
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ENTITIES_DIR)) fs.mkdirSync(ENTITIES_DIR, { recursive: true });

// Boot Sync
async function performSync() {
    try {
        await syncClaude();
        await syncAntigravity();
        store.invalidate();
        console.log('[Server] Delta sync completed successfully.');
    } catch (e) {
        console.error('[Server] Delta sync failed:', e);
    }
}

// ─── ROUTES ──────────────────────────────────────────────

app.get('/api/sync', async (req, res) => {
    await performSync();
    res.json({ status: 'ok', message: 'Delta sync completed.' });
});

app.get('/api/sessions', (req, res) => {
    const { entities, index } = store.load();
    const sessions = (index.sessions || [])
        .map(id => entities.get(id))
        .filter(Boolean);

    // Sort newest first
    sessions.sort((a, b) => b.timestamp - a.timestamp);
    res.json(sessions);
});

// Overview Manifest — summary stats for the ecosystem dashboard
app.get('/api/ecosystem/manifest', (req, res) => {
    const { entities, index } = store.load();

    let claudeStats = { sessions: 0, models: new Set(), nodeCount: 0, tokens: 0, projects: {} };
    let antiStats = { sessions: 0, models: new Set(), nodeCount: 0, tokens: 0, projects: {} };
    let nodeTypes = { 'User Input': 0, 'Thought': 0, 'Message': 0, 'Tool Call': 0, 'Tool Result': 0, 'Artifact': 0 };

    for (const e of entities.values()) {
        if (e.type !== 'Session') {
            nodeTypes[e.type] = (nodeTypes[e.type] || 0) + 1;
        }
    }

    (index.sessions || []).forEach(id => {
        const session = entities.get(id);
        if (!session) return;
        const childCount = (session.children_ids || []).length;

        const target = session.agent === 'Claude' ? claudeStats : antiStats;
        target.sessions++;
        target.nodeCount += childCount;
        target.tokens += (session.metadata?.tokens || 0);

        const proj = session.metadata?.project || 'Unknown';
        if (!target.projects[proj]) {
            target.projects[proj] = { count: 0, sessions: [] };
        }
        target.projects[proj].count++;
        target.projects[proj].sessions.push({
            id: session.id,
            title: session.content || 'Untitled',
            tokens: session.metadata?.tokens || 0,
            nodes: childCount,
            taskType: session.metadata?.taskType || 'Co-work',
            timestamp: session.timestamp
        });

        if (session.metadata?.model) target.models.add(session.metadata.model);
    });

    res.json({
        claude: { ...claudeStats, models: Array.from(claudeStats.models) },
        antigravity: { ...antiStats, models: Array.from(antiStats.models) },
        nodeTypes,
        totalNodes: entities.size,
        lastSync: index.claude_last_sync_timestamp || index.antigravity_last_sync_timestamp || null
    });
});

// Get unique files touched across all sessions and their read/write timelines
app.get('/api/files', (req, res) => {
    const { entities } = store.load();

    // Helper to traverse parent chain in-memory
    function findSessionRoot(entityId) {
        let currentId = entityId;
        const visited = new Set();
        while (currentId) {
            if (visited.has(currentId)) break;
            visited.add(currentId);
            const entity = entities.get(currentId);
            if (!entity) break;
            if (entity.type === 'Session') return entity;
            currentId = entity.parent_id;
        }
        return null;
    }

    const fileMap = new Map();
    const writeTools = ['Write', 'Edit', 'write_to_file', 'replace_file_content', 'str_replace_editor', 'edit_file', 'write_file', 'edit_file_multi', 'patch_file', 'save_file'];

    for (const e of entities.values()) {
        if (e.metadata?.filePath) {
            const pathKey = e.metadata.filePath.toLowerCase();
            const sessionRoot = findSessionRoot(e.parent_id || e.id);

            const interaction = {
                nodeId: e.id,
                sessionId: sessionRoot ? sessionRoot.id : 'unknown',
                sessionTitle: sessionRoot ? (sessionRoot.content || 'Untitled Session') : 'Unknown Session',
                agent: e.agent || 'Unknown',
                type: (e.type === 'Artifact' || writeTools.includes(e.metadata.toolName)) ? 'write' : 'read',
                toolName: e.metadata.toolName || (e.type === 'Artifact' ? 'Artifact creation' : 'Tool Call'),
                timestamp: e.timestamp || Date.now()
            };

            if (!fileMap.has(pathKey)) {
                fileMap.set(pathKey, {
                    fileName: e.metadata.fileName || path.basename(e.metadata.filePath.replace(/\\/g, '/')),
                    filePath: e.metadata.filePath,
                    lastModified: e.timestamp || Date.now(),
                    agent: e.agent || 'Unknown',
                    primaryNodeId: e.id,
                    primarySessionId: interaction.sessionId,
                    interactions: []
                });
            }

            const fileObj = fileMap.get(pathKey);
            fileObj.interactions.push(interaction);

            if (e.timestamp > fileObj.lastModified) {
                fileObj.lastModified = e.timestamp;
                fileObj.agent = e.agent || 'Unknown';
                fileObj.primaryNodeId = e.id;
                fileObj.primarySessionId = interaction.sessionId;
            }
        }
    }

    const result = Array.from(fileMap.values());
    for (const f of result) {
        f.interactions.sort((a, b) => b.timestamp - a.timestamp);
    }
    result.sort((a, b) => b.lastModified - a.lastModified);
    res.json(result);
});

// Open a file locally via the OS default application.
//
// Hardened: only paths that appear in the indexed lineage may be opened —
// an arbitrary path from a request body is refused (403). The handler also
// uses execFile (argument vector, no shell) so quotes/metacharacters in a
// path can never become command injection.
function osOpenFile(filePath) {
    if (process.platform === 'win32') {
        const winPath = filePath.replace(/\//g, '\\');
        execFile('explorer.exe', [winPath], () => { /* explorer exit codes are unreliable */ });
    } else if (process.platform === 'darwin') {
        execFile('open', [filePath], () => {});
    } else {
        execFile('xdg-open', [filePath], () => {});
    }
}

app.post('/api/files/open', (req, res) => {
    const { filePath } = req.body || {};
    if (typeof filePath !== 'string' || !filePath.trim()) {
        return res.status(400).json({ error: 'filePath is required.' });
    }

    const normalized = path.normalize(filePath).toLowerCase();
    if (!store.knownFilePaths().has(normalized)) {
        return res.status(403).json({ error: 'Path is not part of the indexed lineage.' });
    }
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found locally' });
    }

    osOpenFile(filePath);
    res.json({ status: 'ok' });
});

// Single entity lookup
app.get('/api/entities/:id', (req, res) => {
    const { entities } = store.load();
    const entity = entities.get(req.params.id);
    if (entity) {
        res.json(entity);
    } else {
        res.status(404).json({ error: 'Entity not found' });
    }
});

// Recursive graph fetch with depth limit for performance and dynamic file node insertion
app.get('/api/graph/:id', (req, res) => {
    const rootId = req.params.id;
    const maxNodes = parseInt(req.query.limit) || 500;
    const { entities } = store.load();
    const nodes = [];
    const links = [];
    const visited = new Set();

    // 1. Gather all session-related entities
    const rawEntities = [];
    function traverse(nodeId) {
        if (visited.has(nodeId) || rawEntities.length >= maxNodes) return;
        visited.add(nodeId);

        const entity = entities.get(nodeId);
        if (!entity) return;
        rawEntities.push(entity);

        if (entity.children_ids) {
            for (const childId of entity.children_ids) {
                traverse(childId);
            }
        }
    }

    traverse(rootId);

    // 2. Map of existing real Artifact nodes to avoid duplicates
    const fileRepresentations = new Map(); // pathKey -> nodeId

    // Add all raw entities to nodes, registering real Artifact file paths
    for (const entity of rawEntities) {
        const truncContent = (entity.content || '').substring(0, 300);
        nodes.push({
            id: entity.id,
            type: entity.type,
            agent: entity.agent,
            timestamp: entity.timestamp,
            content: truncContent,
            label: deriveLabel(entity),
            metadata: {
                model: entity.metadata?.model,
                toolName: entity.metadata?.toolName,
                fileName: entity.metadata?.fileName,
                filePath: entity.metadata?.filePath
            },
            val: entity.type === 'Session' ? 24 :
                 entity.type === 'Artifact' ? 16 :
                 entity.type === 'User Input' ? 10 :
                 entity.type === 'Tool Call' ? 8 : 6
        });

        // Register real Artifact nodes
        if (entity.type === 'Artifact' && entity.metadata?.filePath) {
            fileRepresentations.set(entity.metadata.filePath.toLowerCase(), entity.id);
        }

        // Add standard parent-child layout links
        if (entity.parent_id && visited.has(entity.parent_id)) {
            links.push({ source: entity.parent_id, target: entity.id });
        }
    }

    // 3. Scan tool calls for file interactions and dynamically append virtual file nodes
    const crypto = require('crypto');
    const linkKeys = new Set(links.map(l => `${l.source}_${l.target}`));

    for (const entity of rawEntities) {
        if (entity.metadata?.filePath && entity.type !== 'Artifact') {
            const filePath = entity.metadata.filePath;
            const fileName = entity.metadata.fileName || path.basename(filePath.replace(/\\/g, '/'));
            const pathKey = filePath.toLowerCase();

            let targetNodeId;

            // If a real Artifact exists, connect directly to it. Otherwise, construct a virtual file node.
            if (fileRepresentations.has(pathKey)) {
                targetNodeId = fileRepresentations.get(pathKey);
            } else {
                // Generate a deterministic virtual node ID for this file in this session
                const virtualId = crypto.createHash('md5').update(rootId + '_virtual_' + pathKey).digest('hex');
                targetNodeId = virtualId;

                // Create the virtual file node if not already created
                if (!nodes.some(n => n.id === virtualId)) {
                    nodes.push({
                        id: virtualId,
                        type: 'Artifact', // visually render as an Artifact/File (rectangular style)
                        agent: entity.agent,
                        timestamp: entity.timestamp,
                        content: `Virtual file reference to ${filePath}`,
                        label: fileName,
                        metadata: {
                            fileName,
                            filePath,
                            isVirtual: true
                        },
                        val: 16
                    });
                    fileRepresentations.set(pathKey, virtualId);
                }
            }

            // Link the Tool Call to the representative file node
            const linkKey = `${entity.id}_${targetNodeId}`;
            if (!linkKeys.has(linkKey) && entity.id !== targetNodeId) {
                links.push({ source: entity.id, target: targetNodeId });
                linkKeys.add(linkKey);
            }
        }
    }

    res.json({ nodes, links });
});

function deriveLabel(entity) {
    if (entity.type === 'Session') {
        return entity.content || 'Session';
    }
    if (entity.type === 'Tool Call') {
        try {
            const parsed = JSON.parse(entity.content);
            const name = parsed.name || 'Tool';
            return entity.metadata?.fileName ? `${name} (${entity.metadata.fileName})` : name;
        } catch { return 'Tool'; }
    }
    if (entity.type === 'Artifact') {
        return entity.metadata?.fileName || 'Artifact';
    }
    if (entity.type === 'User Input') {
        return (entity.content || '').substring(0, 40) + '…';
    }
    return entity.type;
}

// ─── START ───────────────────────────────────────────────

app.listen(PORT, async () => {
    console.log(`[Server] Memo-Ray running on http://localhost:${PORT}`);
    await performSync();
});

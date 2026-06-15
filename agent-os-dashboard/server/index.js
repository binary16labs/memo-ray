const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const si = require('systeminformation');

// Load central configuration contract
const { config, configPath } = require('./lib/config');
const { detectPaths } = require('./lib/detector');

const { syncClaude, getActiveSessions } = require('./parsers/claudeParser');
const { syncAntigravity } = require('./parsers/antigravityParser');
const store = require('./lib/entity_store');

const app = express();
const PORT = process.env.PORT || config.PORT || 3030;

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
let isSyncing = false;
async function performSync() {
    if (isSyncing) return;
    isSyncing = true;
    try {
        await syncClaude();
        await syncAntigravity();
        store.invalidate();
        console.log('[Server] Delta sync completed successfully.');
    } catch (e) {
        console.error('[Server] Delta sync failed:', e);
    } finally {
        isSyncing = false;
    }
}

// ─── ROUTES ──────────────────────────────────────────────

app.get('/api/sync', async (req, res) => {
    await performSync();
    res.json({ status: 'ok', message: 'Delta sync completed.' });
});

// Config Endpoints
app.get('/api/config', (req, res) => {
    // Send the current config object
    res.json(config);
});

app.post('/api/config', (req, res) => {
    try {
        const newConfig = req.body;
        let fileContent = fs.readFileSync(configPath, 'utf8');

        // Regex replacements to safely update strings in the JS file without destroying comments
        const updates = {
            'CLAUDE_SESSIONS_DIR': newConfig.CLAUDE_SESSIONS_DIR,
            'CLAUDE_WORKTREES_PATH': newConfig.CLAUDE_WORKTREES_PATH,
            'CLAUDE_CONFIG_PATH': newConfig.CLAUDE_CONFIG_PATH,
            'GEMINI_CONFIG_DIR': newConfig.GEMINI_CONFIG_DIR
        };

        for (const [key, val] of Object.entries(updates)) {
            if (val) {
                const regex = new RegExp(`(${key}\\s*:\\s*)([^,\\n]+)(,?)(?=\\s*\\n|\\s*//|$)`, 'g');
                fileContent = fileContent.replace(regex, `$1${JSON.stringify(val)}$3`);
            }
        }
        
        const arrayUpdates = {
            'CLAUDE_LOG_DIRS': newConfig.CLAUDE_LOG_DIRS,
            'ANTIGRAVITY_BRAIN_DIRS': newConfig.ANTIGRAVITY_BRAIN_DIRS
        };

        for (const [key, val] of Object.entries(arrayUpdates)) {
            if (Array.isArray(val)) {
                const regex = new RegExp(`(${key}\\s*:\\s*\\[)([^\\]]+)(\\])`, 'g');
                const arrayString = val.map(v => JSON.stringify(v)).join(',\n        ');
                fileContent = fileContent.replace(regex, `$1\n        ${arrayString}\n    $3`);
            }
        }

        fs.writeFileSync(configPath, fileContent, 'utf8');
        
        // Reload config in-memory dynamically
        const configModule = require('./lib/config');
        configModule.reloadConfig();

        res.json({ status: 'ok', message: 'Config saved and reloaded successfully.' });
    } catch (e) {
        console.error('[Server] Config save failed:', e);
        res.status(500).json({ error: 'Failed to save config' });
    }
});

// Setup & Cascade Detection Endpoints
app.get('/api/setup/status', (req, res) => {
    try {
        const report = detectPaths(config);
        const { configPath, dataDir } = require('./lib/config');
        report.memoray = {
            configPath,
            dataDir,
            configExists: fs.existsSync(configPath),
            dataExists: fs.existsSync(dataDir)
        };
        res.json(report);
    } catch (e) {
        console.error('[Server] Setup status failed:', e);
        res.status(500).json({ error: 'Failed to get setup status' });
    }
});

app.post('/api/setup/save', (req, res) => {
    try {
        const newConfig = req.body;
        const formatValue = (val) => {
            if (Array.isArray(val)) {
                return '[\n' + val.map(p => `        ${JSON.stringify(p)}`).join(',\n') + '\n    ]';
            }
            return JSON.stringify(val);
        };

        const content = `// ============================================================================
// MEMO-RAY CONFIGURATION CONTRACT
// ============================================================================
// This configuration was updated by the Memo-Ray setup wizard.
// You can edit these paths below directly or use the Mission Control configuration.
// ============================================================================

module.exports = {
    CLAUDE_SESSIONS_DIR: ${formatValue(newConfig.CLAUDE_SESSIONS_DIR)},
    CLAUDE_LOG_DIRS: ${formatValue(newConfig.CLAUDE_LOG_DIRS)},
    CLAUDE_WORKTREES_PATH: ${formatValue(newConfig.CLAUDE_WORKTREES_PATH)},
    CLAUDE_CONFIG_PATH: ${formatValue(newConfig.CLAUDE_CONFIG_PATH)},
    ANTIGRAVITY_BRAIN_DIRS: ${formatValue(newConfig.ANTIGRAVITY_BRAIN_DIRS)},
    GEMINI_CONFIG_DIR: ${formatValue(newConfig.GEMINI_CONFIG_DIR)}
};
`;
        fs.writeFileSync(configPath, content, 'utf8');

        // Reload config in-memory dynamically
        const configModule = require('./lib/config');
        configModule.reloadConfig();

        console.log('[Setup] Saved new configuration and reloaded in-memory state.');
        res.json({ status: 'ok', message: 'Configuration saved and reloaded.' });
    } catch (e) {
        console.error('[Server] Setup save failed:', e);
        res.status(500).json({ error: 'Failed to save configuration: ' + e.message });
    }
});

// Active Claude Code sessions — cross-references ~/.claude/sessions/ PIDs
// with running processes to show which sessions are live right now.
app.get('/api/active-sessions', (req, res) => {
    res.json(getActiveSessions());
});

app.post('/api/open-folder', (req, res) => {
    const { path: dirPath } = req.body;
    if (!dirPath || !fs.existsSync(dirPath)) {
        return res.status(400).json({ error: 'Invalid or missing directory path' });
    }
    
    try {
        osOpenFile(dirPath);
        res.json({ status: 'ok', message: 'Folder opened successfully' });
    } catch (error) {
        console.error('[Server] Failed to open folder:', error);
        res.status(500).json({ error: 'Failed to open folder: ' + error.message });
    }
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

const util = require('util');
const execFileAsync = util.promisify(execFile);

app.get('/api/lifelog', async (req, res) => {
    const { entities, index } = store.load();
    const lifelog = [];
    const uniqueWorkspaces = new Map();

    // Helper to traverse parent chain
    function findSessionRootLocal(entityId) {
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

    // Extract Sessions
    for (const id of (index.sessions || [])) {
        const session = entities.get(id);
        if (!session) continue;
        const proj = session.metadata?.project || 'Unknown';
        
        if (session.metadata?.cwd) {
            uniqueWorkspaces.set(session.metadata.cwd, proj);
        }

        lifelog.push({
            id: session.id,
            type: 'session',
            agent: session.agent,
            project: proj,
            timestamp: session.timestamp,
            content: `Started session: ${session.content}`,
        });
    }

    // Extract Artifacts
    for (const e of entities.values()) {
        if (e.type === 'Artifact') {
            const sessionRoot = findSessionRootLocal(e.parent_id || e.id);
            const proj = sessionRoot ? (sessionRoot.metadata?.project || 'Unknown') : 'Unknown';
            lifelog.push({
                id: e.id,
                sessionId: sessionRoot ? sessionRoot.id : null,
                type: 'artifact',
                agent: e.agent,
                project: proj,
                timestamp: e.timestamp || Date.now(),
                content: `Created artifact: ${e.metadata?.fileName || 'Unknown File'}`,
                metadata: e.metadata
            });
        }
    }

    // Always ensure the memo-ray root and prime-silo are checked if not present
    uniqueWorkspaces.set(path.resolve(__dirname, '..', '..', 'memo-ray'), 'memo-ray');
    uniqueWorkspaces.set(path.resolve(__dirname, '..', '..', 'prime-silo'), 'prime-silo');

    // Fetch Git Commits from all unique workspace paths
    const gitPromises = Array.from(uniqueWorkspaces.entries()).map(async ([wsPath, projName]) => {
        try {
            const { stdout } = await execFileAsync('git', ['log', '-n', '50', '--pretty=format:%H|%an|%at|%s'], { cwd: wsPath, timeout: 5000, windowsHide: true });
            if (stdout) {
                const lines = stdout.split('\n');
                lines.forEach(line => {
                    const [hash, author, ts, msg] = line.split('|');
                    if (hash && author && ts && msg) {
                        lifelog.push({
                            id: hash,
                            type: 'commit',
                            agent: author.toLowerCase().includes('claude') || author.toLowerCase().includes('antigravity') ? 'Agent' : 'Developer',
                            author: author,
                            project: projName,
                            timestamp: parseInt(ts, 10) * 1000,
                            content: msg
                        });
                    }
                });
            }
        } catch (err) {
            // Ignore folders without git or permission issues
        }
    });

    await Promise.all(gitPromises);

    // Deduplicate
    const uniqueLog = Array.from(new Map(lifelog.map(e => [e.id, e])).values());

    // Sort descending
    uniqueLog.sort((a, b) => b.timestamp - a.timestamp);
    
    res.json(uniqueLog.slice(0, 200));
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

// ─── BETA API: Mission Control ──────────────────────────

// Aggregated project-level overview with worktree status
app.get('/api/beta/overview', (req, res) => {
    const { entities, index } = store.load();

    const projects = {};
    const agentSummary = { claude: { sessions: 0, nodes: 0, tokens: 0, files: 0 }, antigravity: { sessions: 0, nodes: 0, tokens: 0, files: 0 } };
    const fileEditCounts = new Map();

    // Build file interaction map
    for (const e of entities.values()) {
        if (e.metadata?.filePath) {
            const pathKey = e.metadata.filePath.toLowerCase();
            if (!fileEditCounts.has(pathKey)) {
                fileEditCounts.set(pathKey, {
                    fileName: e.metadata.fileName || path.basename(e.metadata.filePath.replace(/\\/g, '/')),
                    filePath: e.metadata.filePath,
                    agent: e.agent || 'Unknown',
                    count: 0,
                    lastTimestamp: 0,
                    lastTool: ''
                });
            }
            const fObj = fileEditCounts.get(pathKey);
            fObj.count++;
            if (e.timestamp > fObj.lastTimestamp) {
                fObj.lastTimestamp = e.timestamp;
                fObj.agent = e.agent || 'Unknown';
                fObj.lastTool = e.metadata.toolName || e.type;
            }
        }
    }

    // 14-day histogram helper — returns an array of 14 daily counts
    const DAY_MS = 86400000;
    const now = Date.now();
    const fourteenDaysAgo = now - 14 * DAY_MS;
    function dayBucket(ts) {
        return Math.floor((ts - fourteenDaysAgo) / DAY_MS);
    }

    // Collect all sessions with enriched metadata
    const allSessionNodes = []; // { session, agentKey, childCount, proj, tokens }

    (index.sessions || []).forEach(id => {
        const session = entities.get(id);
        if (!session) return;
        const agentKey = (session.agent || '').toLowerCase();
        const childCount = (session.children_ids || []).length;
        const proj = session.metadata?.project || 'Unknown';
        const tokens = session.metadata?.tokens || 0;

        // Agent summary
        if (agentSummary[agentKey]) {
            agentSummary[agentKey].sessions++;
            agentSummary[agentKey].nodes += childCount;
            agentSummary[agentKey].tokens += tokens;
        }

        // Project grouping
        if (!projects[proj]) {
            projects[proj] = {
                name: proj, agents: {}, totalSessions: 0, totalNodes: 0,
                totalTokens: 0, lastActivity: 0, files: new Set(),
                dailyNodes: new Array(14).fill(0),
                dailyTokens: new Array(14).fill(0),
                hasActive: false
            };
        }
        const p = projects[proj];
        p.totalSessions++;
        p.totalNodes += childCount;
        p.totalTokens += tokens;
        if (session.timestamp > p.lastActivity) p.lastActivity = session.timestamp;

        // Daily histogram — attribute nodes to the session's day
        const bucket = dayBucket(session.timestamp);
        if (bucket >= 0 && bucket < 14) {
            p.dailyNodes[bucket] += childCount;
            p.dailyTokens[bucket] += tokens;
        }

        // Track active status
        const isActive = session.metadata?.isActive || false;
        if (isActive) p.hasActive = true;

        if (!p.agents[agentKey]) {
            p.agents[agentKey] = { sessions: [] };
        }
        p.agents[agentKey].sessions.push({
            id: session.id,
            title: session.content || 'Untitled',
            timestamp: session.timestamp,
            nodes: childCount,
            tokens: tokens,
            taskType: session.metadata?.taskType || 'Chat',
            cwd: session.metadata?.cwd || null,
            gitBranch: session.metadata?.gitBranch || null,
            entrypoint: session.metadata?.entrypoint || null,
            version: session.metadata?.version || null,
            isActive: isActive
        });

        // Count files per project (scan children)
        for (const childId of (session.children_ids || [])) {
            const child = entities.get(childId);
            if (child?.metadata?.filePath) {
                p.files.add(child.metadata.filePath.toLowerCase());
            }
        }

        allSessionNodes.push({ session, agentKey, childCount, proj, tokens });
    });

    // Serialize project data (Sets -> counts, arrays stay)
    const projectList = Object.values(projects).map(p => ({
        ...p,
        fileCount: p.files.size,
        files: undefined, // drop the Set
        agents: Object.fromEntries(
            Object.entries(p.agents).map(([k, v]) => [k, {
                ...v,
                sessions: v.sessions.sort((a, b) => b.timestamp - a.timestamp)
            }])
        )
    })).sort((a, b) => b.lastActivity - a.lastActivity);

    // Worktrees — enriched with cross-referenced session data
    let worktrees = [];
    try {
        const wtFile = config.CLAUDE_WORKTREES_PATH;
        if (fs.existsSync(wtFile)) {
            const wtData = JSON.parse(fs.readFileSync(wtFile, 'utf-8'));
            worktrees = Object.values(wtData.worktrees || {}).map(wt => {
                // Find sessions that ran inside this worktree
                const wtPathLower = (wt.path || '').toLowerCase().replace(/\\/g, '/');
                const matchedSessions = [];
                let wtNodes = 0;
                let wtTokens = 0;

                for (const { session, childCount, tokens } of allSessionNodes) {
                    const sessionCwd = (session.metadata?.cwd || '').toLowerCase().replace(/\\/g, '/');
                    if (sessionCwd && sessionCwd.includes(wt.name)) {
                        matchedSessions.push({
                            id: session.id,
                            title: session.content || 'Untitled',
                            timestamp: session.timestamp,
                            nodes: childCount,
                            tokens: tokens,
                            isActive: session.metadata?.isActive || false
                        });
                        wtNodes += childCount;
                        wtTokens += tokens;
                    }
                }

                // Check if worktree directory still exists on disk
                let existsOnDisk = false;
                try { existsOnDisk = fs.existsSync(wt.path); } catch { /* ignore */ }

                const ageMs = wt.createdAt ? now - wt.createdAt : 0;
                const ageDays = Math.floor(ageMs / DAY_MS);

                return {
                    name: wt.name,
                    path: wt.path,
                    baseRepo: wt.baseRepo,
                    project: wt.baseRepo ? path.basename(wt.baseRepo.replace(/\\/g, '/')) : 'Unknown',
                    branch: wt.branch,
                    sourceBranch: wt.sourceBranch,
                    createdAt: wt.createdAt,
                    leasedBy: wt.leasedBy,
                    existsOnDisk,
                    ageDays,
                    sessions: matchedSessions.sort((a, b) => b.timestamp - a.timestamp),
                    sessionCount: matchedSessions.length,
                    totalNodes: wtNodes,
                    totalTokens: wtTokens,
                    hasActive: matchedSessions.some(s => s.isActive)
                };
            }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        }
    } catch { /* ignore */ }

    // Attach worktrees to their projects
    for (const p of projectList) {
        p.worktrees = worktrees.filter(wt => wt.project === p.name);
    }

    // Hot files (top 15 most-touched)
    const hotFiles = Array.from(fileEditCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)
        .map(f => ({ ...f }));

    // Count unique files per agent
    const claudeFiles = new Set();
    const antiFiles = new Set();
    for (const e of entities.values()) {
        if (e.metadata?.filePath) {
            const key = e.metadata.filePath.toLowerCase();
            if (e.agent === 'Claude') claudeFiles.add(key);
            else if (e.agent === 'Antigravity') antiFiles.add(key);
        }
    }
    agentSummary.claude.files = claudeFiles.size;
    agentSummary.antigravity.files = antiFiles.size;

    // Active sessions from Claude Code
    const activeSessions = getActiveSessions();

    res.json({
        projects: projectList,
        agents: agentSummary,
        worktrees,
        hotFiles,
        activeSessions,
        totalSessions: (index.sessions || []).length,
        totalNodes: entities.size,
        totalFiles: fileEditCounts.size,
        totalTokens: agentSummary.claude.tokens + agentSummary.antigravity.tokens,
        lastSync: index.claude_last_sync_timestamp || index.antigravity_last_sync_timestamp || null
    });
});

// Cross-session activity timeline
app.get('/api/beta/timeline', (req, res) => {
    const { entities, index } = store.load();
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const projectFilter = req.query.project || null;
    const agentFilter = req.query.agent || null;
    const typeFilter = req.query.type || null;

    // Build session lookup for quick access
    const sessionLookup = new Map();
    for (const sid of (index.sessions || [])) {
        const s = entities.get(sid);
        if (s) sessionLookup.set(sid, s);
    }

    // Find the session root for an entity
    function findSessionId(entityId) {
        let currentId = entityId;
        const visited = new Set();
        while (currentId) {
            if (visited.has(currentId)) break;
            visited.add(currentId);
            if (sessionLookup.has(currentId)) return currentId;
            const entity = entities.get(currentId);
            if (!entity) break;
            currentId = entity.parent_id;
        }
        return null;
    }

    // Collect actionable entities (not sessions, with timestamps)
    const actions = [];
    for (const e of entities.values()) {
        if (e.type === 'Session') continue;
        if (!e.timestamp) continue;

        // Agent filter
        if (agentFilter && e.agent?.toLowerCase() !== agentFilter.toLowerCase()) continue;
        // Type filter
        if (typeFilter) {
            const typeNorm = e.type.toLowerCase().replace(/\s+/g, '-');
            if (typeNorm !== typeFilter.toLowerCase()) continue;
        }

        const sessionId = findSessionId(e.parent_id || e.id);
        const session = sessionId ? sessionLookup.get(sessionId) : null;

        // Project filter
        const sessionProj = session?.metadata?.project || 'Unknown';
        if (projectFilter && sessionProj !== projectFilter) continue;

        actions.push({
            id: e.id,
            type: e.type,
            agent: e.agent,
            timestamp: e.timestamp,
            toolName: e.metadata?.toolName || null,
            fileName: e.metadata?.fileName || null,
            filePath: e.metadata?.filePath || null,
            contentSnippet: (e.content || '').substring(0, 200),
            sessionId: sessionId,
            sessionTitle: session?.content || 'Unknown Session',
            project: session?.metadata?.project || 'Unknown',
            gitBranch: session?.metadata?.gitBranch || null
        });
    }

    // Sort by timestamp descending, take limit
    actions.sort((a, b) => b.timestamp - a.timestamp);
    res.json(actions.slice(0, limit));
});

// Universal search
app.get('/api/beta/search', (req, res) => {
    const q = (req.query.q || '').toLowerCase().trim();
    if (!q || q.length < 2) return res.json({ sessions: [], files: [], actions: [] });

    const { entities, index } = store.load();
    const results = { sessions: [], files: [], actions: [] };
    const MAX_RESULTS = 30;

    // Search sessions
    for (const sid of (index.sessions || [])) {
        const s = entities.get(sid);
        if (!s) continue;
        if ((s.content || '').toLowerCase().includes(q) ||
            (s.metadata?.project || '').toLowerCase().includes(q) ||
            (s.metadata?.gitBranch || '').toLowerCase().includes(q)) {
            results.sessions.push({
                id: s.id,
                title: s.content || 'Untitled',
                agent: s.agent,
                project: s.metadata?.project || 'Unknown',
                timestamp: s.timestamp,
                nodes: (s.children_ids || []).length,
                taskType: s.metadata?.taskType || 'Chat'
            });
            if (results.sessions.length >= MAX_RESULTS) break;
        }
    }

    // Search files
    const fileMatches = new Set();
    for (const e of entities.values()) {
        if (e.metadata?.filePath && !fileMatches.has(e.metadata.filePath.toLowerCase())) {
            if ((e.metadata.fileName || '').toLowerCase().includes(q) ||
                (e.metadata.filePath || '').toLowerCase().includes(q)) {
                fileMatches.add(e.metadata.filePath.toLowerCase());
                results.files.push({
                    fileName: e.metadata.fileName || path.basename(e.metadata.filePath),
                    filePath: e.metadata.filePath,
                    agent: e.agent
                });
                if (results.files.length >= MAX_RESULTS) break;
            }
        }
    }

    // Search actions by content
    let actionCount = 0;
    for (const e of entities.values()) {
        if (e.type === 'Session') continue;
        if (actionCount >= MAX_RESULTS) break;
        if ((e.content || '').toLowerCase().includes(q) ||
            (e.metadata?.toolName || '').toLowerCase().includes(q)) {
            results.actions.push({
                id: e.id,
                type: e.type,
                agent: e.agent,
                timestamp: e.timestamp,
                toolName: e.metadata?.toolName || null,
                contentSnippet: (e.content || '').substring(0, 150)
            });
            actionCount++;
        }
    }

    res.json(results);
});

// ─── SYSTEM METRICS (OverviewGrid) ───────────────────────

app.get('/api/system/metrics', async (req, res) => {
    try {
        const [cpuLoad, mem, network, processes] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.networkStats(),
            si.processes()
        ]);

        // Aggregate network traffic (sum across all active interfaces)
        let rxSec = 0;
        let txSec = 0;
        for (const net of network) {
            rxSec += net.rx_sec || 0;
            txSec += net.tx_sec || 0;
        }

        // Top 5 heaviest processes by CPU
        const topProcs = (processes.list || [])
            .sort((a, b) => b.cpu - a.cpu)
            .slice(0, 5)
            .map(p => ({
                name: p.name,
                cpu: p.cpu.toFixed(1),
                mem: (p.memRss / 1024 / 1024).toFixed(1) // MB
            }));

        res.json({
            cpu: cpuLoad.currentLoad.toFixed(1),
            ram: {
                used: mem.active,
                total: mem.total,
                percent: ((mem.active / mem.total) * 100).toFixed(1)
            },
            network: {
                rxSec,
                txSec
            },
            processes: topProcs
        });
    } catch (err) {
        console.error('System metrics error:', err);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

// ─── CAPABILITIES & TOOLS (OverviewGrid) ──────────────────

app.get('/api/system/capabilities', async (req, res) => {
    try {
        const capabilities = {
            claude: {
                maxContextTokens: 200000,
                mcpServers: []
            },
            antigravity: {
                maxContextTokens: 2000000,
                plugins: [],
                permissions: []
            }
        };

        // 1. Read Claude MCP Servers
        const claudeConfigPath = config.CLAUDE_CONFIG_PATH;
        try {
            if (fs.existsSync(claudeConfigPath)) {
                const claudeConfig = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'));
                if (claudeConfig.mcpServers) {
                    capabilities.claude.mcpServers = Object.keys(claudeConfig.mcpServers).map(name => ({
                        name,
                        command: claudeConfig.mcpServers[name].command
                    }));
                }
            }
        } catch (e) {
            console.error('Failed to parse Claude MCP config:', e.message);
        }

        // 2. Read Antigravity Plugins/Skills & Permissions
        const geminiConfigDir = config.GEMINI_CONFIG_DIR;
        try {
            const pluginsPath = path.join(geminiConfigDir, 'plugins');
            if (fs.existsSync(pluginsPath)) {
                const dirs = fs.readdirSync(pluginsPath, { withFileTypes: true });
                capabilities.antigravity.plugins = dirs
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
            }

            const configPath = path.join(geminiConfigDir, 'config.json');
            if (fs.existsSync(configPath)) {
                const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (configData?.userSettings?.globalPermissionGrants?.allow) {
                    capabilities.antigravity.permissions = configData.userSettings.globalPermissionGrants.allow;
                }
            }
        } catch (e) {
            console.error('Failed to parse Antigravity config:', e.message);
        }

        res.json(capabilities);
    } catch (err) {
        console.error('Capabilities error:', err);
        res.status(500).json({ error: 'Failed to fetch capabilities' });
    }
});

// Serve static client assets in production
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));
app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        next();
    }
});

// ─── START ───────────────────────────────────────────────

function openBrowser(url) {
    const { isPackaged } = require('./lib/config');
    
    // In production/packaged mode (or by default on Windows/Mac if browsers exist), launch like an app
    if (isPackaged || process.env.NODE_ENV === 'production' || process.env.APP_MODE === 'true') {
        if (process.platform === 'win32') {
            const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
            const chromePaths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
            ];
            
            let browserPath = null;
            for (const p of chromePaths) {
                if (fs.existsSync(p)) {
                    browserPath = p;
                    break;
                }
            }
            if (!browserPath && fs.existsSync(edgePath)) {
                browserPath = edgePath;
            }
            
            if (browserPath) {
                execFile(browserPath, [`--app=${url}`], (err) => {
                    if (err) {
                        console.error('[Server] Failed to open in app mode, falling back to default:', err);
                        openDefaultBrowser(url);
                    }
                });
                return;
            }
        } else if (process.platform === 'darwin') {
            const chromePathMac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            if (fs.existsSync(chromePathMac)) {
                execFile(chromePathMac, [`--app=${url}`], (err) => {
                    if (err) openDefaultBrowser(url);
                });
                return;
            }
        }
    }
    
    openDefaultBrowser(url);
}

function openDefaultBrowser(url) {
    if (process.platform === 'win32') {
        execFile('cmd.exe', ['/c', 'start', '', url], { windowsHide: true }, (err) => {
            if (err) console.error('[Server] Failed to open browser:', err);
        });
    } else if (process.platform === 'darwin') {
        execFile('open', [url], () => {});
    } else {
        execFile('xdg-open', [url], () => {});
    }
}

let serverInstance = null;
let syncInterval = null;

function startServer(portOverride = null) {
    if (serverInstance) return;
    
    const portToUse = portOverride || PORT;
    serverInstance = app.listen(portToUse, async () => {
        console.log(`[Server] Memo-Ray running on http://localhost:${portToUse}`);
        
        // Automatically open browser in packaged/production mode
        const { isPackaged } = require('./lib/config');
        if (isPackaged || process.env.NODE_ENV === 'production') {
            openBrowser(`http://localhost:${portToUse}`);
        }

        await performSync();

        // Background sync every 30 seconds
        syncInterval = setInterval(performSync, 30000);
    });
    return serverInstance;
}

function stopServer() {
    if (serverInstance) {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }
        serverInstance.close();
        serverInstance = null;
        console.log('[Server] Memo-Ray stopped.');
    }
}

// Export for tray or other programmatic usage
module.exports = { app, startServer, stopServer, openBrowser, PORT };

// If this is the main module (not required by another file), start automatically
if (require.main === module) {
    const { isPackaged } = require('./lib/config');
    
    // Windows Background Spawning to hide the console shell window
    if (isPackaged && process.platform === 'win32' && !process.argv.includes('--background')) {
        const { spawn } = require('child_process');
        const child = spawn(process.argv[0], [...process.argv.slice(1), '--background'], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });
        child.unref();
        process.exit(0);
    }

    startServer();
    try {
        const { initTray } = require('./tray');
        initTray();
    } catch (e) {
        console.error('[Tray] Failed to init tray:', e);
    }
}

const fs = require('fs');
const path = require('path');

const DATA_DIR = 'C:\\Users\\nsdha\\.memoray\\data';
const ENTITIES_DIR = path.join(DATA_DIR, 'entities');

const sessionId = '095dbb17802a7a92bc991df50631b24b';

// 1. Load entities
const entities = new Map();
if (fs.existsSync(ENTITIES_DIR)) {
    for (const file of fs.readdirSync(ENTITIES_DIR)) {
        if (!file.endsWith('.json')) continue;
        try {
            const entity = JSON.parse(fs.readFileSync(path.join(ENTITIES_DIR, file), 'utf-8'));
            if (entity && entity.id) entities.set(entity.id, entity);
        } catch {}
    }
}

// 2. Build graph nodes
const nodes = [];
const visited = new Set();
function traverse(nodeId) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const entity = entities.get(nodeId);
    if (!entity) return;
    nodes.push(entity);

    if (entity.children_ids) {
        for (const childId of entity.children_ids) {
            traverse(childId);
        }
    }
}
traverse(sessionId);

console.log('--- Graph Nodes ---');
console.log('Count:', nodes.length);
const graphNodeIds = nodes.map(n => n.id);

// 3. Build timeline actions
const actions = [];
for (const e of entities.values()) {
    if (e.type === 'Session') continue;
    if (!e.timestamp) continue;

    // find session ID
    let currentId = e.parent_id || e.id;
    let foundSessionId = null;
    const pathVisited = new Set();
    while (currentId) {
        if (pathVisited.has(currentId)) break;
        pathVisited.add(currentId);
        const entity = entities.get(currentId);
        if (entity && entity.type === 'Session') {
            foundSessionId = entity.id;
            break;
        }
        if (!entity) break;
        currentId = entity.parent_id;
    }

    if (foundSessionId === sessionId) {
        actions.push(e);
    }
}

console.log('--- Timeline Actions ---');
console.log('Count:', actions.length);
const actionIds = actions.map(a => a.id);

// Compare
const missingInGraph = actionIds.filter(id => !graphNodeIds.includes(id));
const missingInTimeline = graphNodeIds.filter(id => id !== sessionId && !actionIds.includes(id));

console.log('Missing in Graph count:', missingInGraph.length);
if (missingInGraph.length > 0) {
    console.log('First few missing in Graph:', missingInGraph.slice(0, 5).map(id => {
        const ent = entities.get(id);
        return { id, type: ent?.type, parent_id: ent?.parent_id };
    }));
}

console.log('Missing in Timeline count:', missingInTimeline.length);
if (missingInTimeline.length > 0) {
    console.log('First few missing in Timeline:', missingInTimeline.slice(0, 5).map(id => {
        const ent = entities.get(id);
        return { id, type: ent?.type, parent_id: ent?.parent_id };
    }));
}

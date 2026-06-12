import React, { useEffect, useState } from 'react';

const API = 'http://localhost:3001/api';

export default function EcosystemDashboard({ onSelectSession }) {
    const [manifest, setManifest] = useState(null);
    const [error, setError] = useState(null);
    const [activeLayer, setActiveLayer] = useState(null); // 'claude', 'antigravity', or null
    const [expandedProject, setExpandedProject] = useState(null);

    useEffect(() => {
        fetch(`${API}/ecosystem/manifest`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => setManifest(data))
            .catch(err => {
                console.error('Manifest fetch failed:', err);
                setError(err.message);
            });
    }, []);

    if (error) {
        return (
            <div className="loading-state">
                <div style={{ color: 'var(--rust)', fontSize: '0.9rem' }}>
                    Backend not responding — start the server on port 3001
                </div>
            </div>
        );
    }

    if (!manifest) {
        return (
            <div className="loading-state blueprint-loading">
                <div className="blueprint-spinner" />
                <span>Calibrating Ecosystem Matrix…</span>
            </div>
        );
    }

    const lastSyncDate = manifest.lastSync ? new Date(manifest.lastSync).toLocaleString() : 'Never';

    const handleLayerClick = (layer) => {
        if (activeLayer !== layer) {
            setActiveLayer(layer);
            setExpandedProject(null);
        }
    };

    const renderProjects = (agentData, agentKey) => {
        if (activeLayer !== agentKey) {
            return (
                <div className="bp-projects">
                    <h4>Project Vector Clusters</h4>
                    <div className="bp-project-tags">
                        {Object.entries(agentData.projects || {}).map(([proj, data]) => (
                            <span key={proj} className="bp-tag">{proj} <span className="bp-tag-count">{data.count}</span></span>
                        ))}
                    </div>
                </div>
            );
        }

        // Expanded interactive view
        return (
            <div className="bp-projects expanded-projects">
                <h4>Interactive Vector Clusters</h4>
                <div className="project-accordion">
                    {Object.entries(agentData.projects || {}).map(([proj, data]) => {
                        const isExpanded = expandedProject === proj;
                        return (
                            <div key={proj} className={`project-group ${isExpanded ? 'open' : ''}`}>
                                <div 
                                    className="project-header" 
                                    onClick={(e) => { e.stopPropagation(); setExpandedProject(isExpanded ? null : proj); }}
                                >
                                    <span className="proj-name">{proj}</span>
                                    <span className="proj-count">{data.count} Sessions</span>
                                </div>
                                {isExpanded && (
                                    <div className="project-sessions">
                                        {data.sessions.sort((a,b) => b.timestamp - a.timestamp).map(s => (
                                            <div 
                                                key={s.id} 
                                                className="session-row"
                                                onClick={(e) => { e.stopPropagation(); onSelectSession(s.id); }}
                                            >
                                                <div className="s-title">{s.title}</div>
                                                <div className="s-meta">
                                                    <span>{s.nodes} nodes</span>
                                                    <span>{s.tokens.toLocaleString()} tokens</span>
                                                    {s.taskType && <span className="s-task-badge">{s.taskType}</span>}
                                                    <span>{new Date(s.timestamp).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="blueprint-overview">
            <div className="blueprint-header">
                <h1>ECOSYSTEM_MANIFEST.sys</h1>
                <p>Live topology of parallel agent processes · Tokens: {(manifest.claude.tokens + manifest.antigravity.tokens).toLocaleString()} · Last sync: {lastSyncDate}</p>
                {activeLayer && (
                    <button className="blueprint-btn-reset" onClick={() => setActiveLayer(null)}>
                        ↤ Return to Core Topography
                    </button>
                )}
            </div>

            <div className={`isometric-canvas ${activeLayer ? 'drilled-down' : ''}`}>
                
                {/* BASE LAYER: Node Type Distribution */}
                <div className="iso-layer base-layer">
                    <div className="blueprint-card raw-data-card">
                        <h3>Entity Substrate</h3>
                        <div className="node-type-grid">
                            {Object.entries(manifest.nodeTypes).map(([type, count]) => (
                                <div key={type} className="node-type-bar-container">
                                    <div className="node-type-label">{type}</div>
                                    <div className="node-type-bar">
                                        <div className="node-type-fill" style={{ width: `${Math.max(2, (count / Math.max(1, manifest.totalNodes)) * 100)}%` }} />
                                    </div>
                                    <div className="node-type-count">{count.toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                        <div className="total-memory">
                            <span className="neo-label">Total Synaptic Nodes:</span> 
                            <span className="neo-value">{manifest.totalNodes.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* LAYER 1: CLAUDE */}
                <div 
                    className={`iso-layer agent-layer claude ${activeLayer === 'claude' ? 'focus' : activeLayer ? 'dimmed' : ''}`}
                    onClick={() => handleLayerClick('claude')}
                >
                    <div className="blueprint-card">
                        <div className="card-glint" />
                        <div className="blueprint-card-header">
                            <div className="bp-icon">C</div>
                            <h2>Claude Directive</h2>
                        </div>
                        <div className="bp-stats-grid">
                            <div className="bp-stat">
                                <span className="bp-label">SESSIONS</span>
                                <span className="bp-value">{manifest.claude.sessions}</span>
                            </div>
                            <div className="bp-stat">
                                <span className="bp-label">NODES</span>
                                <span className="bp-value">{manifest.claude.nodeCount.toLocaleString()}</span>
                            </div>
                            <div className="bp-stat">
                                <span className="bp-label">TOKENS</span>
                                <span className="bp-value">{manifest.claude.tokens.toLocaleString()}</span>
                            </div>
                        </div>

                        {renderProjects(manifest.claude, 'claude')}
                    </div>
                </div>

                {/* LAYER 2: ANTIGRAVITY */}
                <div 
                    className={`iso-layer agent-layer antigravity ${activeLayer === 'antigravity' ? 'focus' : activeLayer ? 'dimmed' : ''}`}
                    onClick={() => handleLayerClick('antigravity')}
                >
                    <div className="blueprint-card">
                        <div className="card-glint" />
                        <div className="blueprint-card-header">
                            <div className="bp-icon">A</div>
                            <h2>Antigravity Core</h2>
                        </div>
                        <div className="bp-stats-grid">
                            <div className="bp-stat">
                                <span className="bp-label">SESSIONS</span>
                                <span className="bp-value">{manifest.antigravity.sessions}</span>
                            </div>
                            <div className="bp-stat">
                                <span className="bp-label">NODES</span>
                                <span className="bp-value">{manifest.antigravity.nodeCount.toLocaleString()}</span>
                            </div>
                            <div className="bp-stat">
                                <span className="bp-label">TOKENS</span>
                                <span className="bp-value">{manifest.antigravity.tokens.toLocaleString()}</span>
                            </div>
                        </div>

                        {renderProjects(manifest.antigravity, 'antigravity')}
                    </div>
                </div>

            </div>
        </div>
    );
}

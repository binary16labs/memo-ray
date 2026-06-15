import React, { useState, useEffect } from 'react';

const API = import.meta.env.DEV
  ? `${import.meta.env.VITE_MEMORAY_API || 'http://localhost:3030'}/api`
  : '/api';

export default function AgentLifelog({ onTeleport }) {
    const [lifelog, setLifelog] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API}/lifelog`)
            .then(res => res.json())
            .then(data => {
                setLifelog(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="zen-dashboard">
                <div className="zen-title" style={{ textAlign: 'center', marginTop: '10%' }}>Gathering Lifelog...</div>
            </div>
        );
    }

    return (
        <div className="lifelog-dashboard">
            <div className="lifelog-header">
                <h1>Agent Lifelog</h1>
                <p>A unified timeline of Git commits and Agent actions across all workspaces.</p>
            </div>
            
            <div className="lifelog-feed">
                {lifelog.map(item => {
                    const isTeleportable = item.type === 'session' || (item.type === 'artifact' && item.sessionId);
                    return (
                    <div 
                        key={item.id} 
                        className={`lifelog-post ${item.type} ${isTeleportable ? 'teleportable' : ''}`}
                        onClick={() => {
                            if (isTeleportable && onTeleport) {
                                onTeleport({
                                    sessionId: item.type === 'session' ? item.id : item.sessionId,
                                    nodeId: item.type === 'artifact' ? item.id : null,
                                    project: item.project
                                });
                            }
                        }}
                        style={{ cursor: isTeleportable ? 'pointer' : 'default' }}
                    >
                        <div className="lifelog-avatar">
                            {item.type === 'commit' && <span className="avatar-icon">📦</span>}
                            {item.agent === 'Claude' && <span className="avatar-icon claude">C</span>}
                            {item.agent === 'Antigravity' && <span className="avatar-icon antigravity">A</span>}
                            {item.type === 'artifact' && <span className="avatar-icon artifact">📄</span>}
                        </div>
                        <div className="lifelog-content">
                            <div className="lifelog-meta">
                                <span className="lifelog-agent">
                                    {item.type === 'commit' ? item.author : item.agent}
                                </span>
                                <span className="lifelog-project">{item.project}</span>
                                <span className="lifelog-time">{new Date(item.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="lifelog-body">
                                {item.content}
                            </div>
                        </div>
                    </div>
                    );
                })}
                
                {lifelog.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: '2rem' }}>
                        No lifelog events found.
                    </div>
                )}
            </div>
        </div>
    );
}

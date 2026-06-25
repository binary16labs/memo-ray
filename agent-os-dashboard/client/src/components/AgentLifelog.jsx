import React, { useState, useEffect } from 'react';
import HeatmapRadar from './HeatmapRadar';

const API = import.meta.env.DEV
  ? `${import.meta.env.VITE_MEMORAY_API || 'http://localhost:3030'}/api`
  : '/api';

export default function AgentLifelog({ onTeleport }) {
    const [lifelog, setLifelog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [heatmapDateFilter, setHeatmapDateFilter] = useState(null);

    useEffect(() => {
        const loadLifelog = () => {
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
        };

        loadLifelog();

        const interval = setInterval(loadLifelog, 10000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="zen-dashboard">
                <div className="zen-title" style={{ textAlign: 'center', marginTop: '10%' }}>Gathering Lifelog...</div>
            </div>
        );
    }

    const filteredLifelog = lifelog.filter(item => {
        if (!heatmapDateFilter) return true;
        const dLocal = new Date(item.timestamp - new Date().getTimezoneOffset() * 60000);
        return dLocal.toISOString().split('T')[0] === heatmapDateFilter;
    });

    return (
        <div className="lifelog-dashboard">
            <div className="lifelog-header">
                <h1>Agent Lifelog</h1>
                <p>A unified timeline of Git commits and Agent actions across all workspaces.</p>
            </div>
            
            <div style={{ padding: '0 2rem' }}>
                <HeatmapRadar 
                    selectedDate={heatmapDateFilter} 
                    onDateSelect={setHeatmapDateFilter} 
                />
            </div>

            <div className="lifelog-feed">
                {filteredLifelog.map(item => {
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
                
                {filteredLifelog.length === 0 && !loading && (
                    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: '2rem' }}>
                        No lifelog events found for this filter.
                    </div>
                )}
            </div>
        </div>
    );
}

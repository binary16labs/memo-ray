import React, { useEffect, useState } from 'react';
import OrganicGraph from './OrganicGraph';

export default function ClaudeView() {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://localhost:3001/api/claude/sessions')
            .then(res => res.json())
            .then(sessions => {
                const nodes = [];
                const links = [];
                
                // Central Claude Node
                nodes.push({ id: 'claude-root', name: 'Claude Core', group: 'system', val: 20 });
                
                sessions.forEach((session, i) => {
                    const sessionId = session.id || `session-${i}`;
                    
                    // Session Node
                    nodes.push({
                        id: sessionId,
                        name: session.title || 'Untitled Session',
                        group: 'user',
                        val: 10 + (session.completedTurns || 1), // Size based on turns
                        model: session.model,
                        cwd: session.cwd
                    });
                    
                    // Link to Core
                    links.push({
                        source: 'claude-root',
                        target: sessionId,
                        value: session.completedTurns || 1
                    });
                });

                setGraphData({ nodes, links });
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    return (
        <>
            <header className="header" style={{pointerEvents: 'none'}}>
                <div>
                    <h1>Claude Memory Map</h1>
                    <h2>Visualizing active and past sessions</h2>
                </div>
            </header>
            
            {loading ? (
                <div className="content-area" style={{padding: '2rem'}}><div className="loading-indicator"></div> Reading Claude Memory...</div>
            ) : (
                <OrganicGraph data={graphData} />
            )}
        </>
    );
}

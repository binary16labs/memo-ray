import React, { useEffect, useState } from 'react';
import OrganicGraph from './OrganicGraph';

export default function AntigravityView() {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://localhost:3001/api/antigravity/transcripts')
            .then(res => res.json())
            .then(transcripts => {
                const nodes = [];
                const links = [];
                
                // Central Antigravity Node
                nodes.push({ id: 'ag-root', name: 'Antigravity Core', group: 'system', val: 20 });
                
                transcripts.forEach((transcript) => {
                    const convId = transcript.conversationId;
                    
                    // Conversation Root
                    nodes.push({
                        id: convId,
                        name: `Conversation ${convId.substring(0,6)}`,
                        group: 'system',
                        val: 15
                    });
                    
                    links.push({ source: 'ag-root', target: convId, value: 5 });
                    
                    // Map steps to nodes
                    let previousNodeId = convId;
                    transcript.nodes.forEach((step) => {
                        let group = 'system';
                        let val = 5;
                        
                        if (step.type === 'USER_INPUT') {
                            group = 'user';
                            val = 12;
                        } else if (step.tool_calls && step.tool_calls.length > 0) {
                            group = 'tool';
                            val = 8 + step.tool_calls.length * 2;
                        }
                        
                        nodes.push({
                            id: step.id,
                            name: step.type === 'USER_INPUT' ? 'User Input' : (step.tool_calls.length > 0 ? 'Tool Call' : 'Thought'),
                            group,
                            val,
                            content: step.contentPreview
                        });
                        
                        links.push({
                            source: previousNodeId,
                            target: step.id,
                            value: 2
                        });
                        
                        previousNodeId = step.id;
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
                    <h1>Antigravity Brain Map</h1>
                    <h2>Sequential representation of agent decisions and tool usages</h2>
                </div>
            </header>
            
            {loading ? (
                <div className="content-area" style={{padding: '2rem'}}><div className="loading-indicator"></div> Loading Brain Synapses...</div>
            ) : (
                <OrganicGraph data={graphData} />
            )}
        </>
    );
}

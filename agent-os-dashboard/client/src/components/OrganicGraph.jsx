import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const PALETTE = {
  'User Input': '#b8a898',
  'Thought':    '#8b9c8b',
  'Message':    '#8b9c8b',
  'Tool Call':  '#6a8a6a',
  'Tool Result':'#6a8a6a',
  'Artifact':   '#8a9aa4',
  'Session':    '#c4a882',
  'System Init':'#5a6a5e',
  'Error':      '#c47a6a',
};

export default function OrganicGraph({ data, filters, onNodeHover, onNodeClick, highlightNodeId }) {
    const fgRef = useRef();
    const containerRef = useRef();
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    // Measure actual container
    useEffect(() => {
        const measure = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setDimensions({ width: rect.width, height: rect.height });
            }
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    // Filter data
    const graphData = useMemo(() => {
        if (!data?.nodes) return { nodes: [], links: [] };
        
        const filteredNodes = data.nodes.filter(node => {
            if (node.type === 'User Input' && !filters.showUser) return false;
            if ((node.type === 'Thought' || node.type === 'Message') && !filters.showAgent) return false;
            if ((node.type === 'Tool Call' || node.type === 'Tool Result') && !filters.showTools) return false;
            if (node.type === 'Artifact' && !filters.showArtifacts) return false;
            return true;
        });
        
        const nodeIds = new Set(filteredNodes.map(n => n.id));
        const filteredLinks = data.links.filter(l => {
            const src = typeof l.source === 'object' ? l.source.id : l.source;
            const tgt = typeof l.target === 'object' ? l.target.id : l.target;
            return nodeIds.has(src) && nodeIds.has(tgt);
        });
        
        return { nodes: filteredNodes, links: filteredLinks };
    }, [data, filters]);

    const paintNode = useCallback((node, ctx, globalScale) => {
        const isHighlighted = node.id === highlightNodeId;
        const color = isHighlighted ? '#00ffff' : (PALETTE[node.type] || '#5a6a5e');
        const size = (node.val || 6) * (isHighlighted ? 1.6 : 1);
        const label = node.label || node.type;

        ctx.save();

        // Glow for Session, Artifact, and highlighted nodes
        if (node.type === 'Session' || node.type === 'Artifact' || isHighlighted) {
            ctx.shadowColor = isHighlighted ? '#00ffff' : color;
            ctx.shadowBlur = isHighlighted ? 24 : 12;
        }

        ctx.beginPath();
        if (node.type === 'Artifact') {
            // Rounded rectangle
            const r = size * 0.4;
            const x = node.x - size;
            const y = node.y - size;
            const w = size * 2;
            const h = size * 2;
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
        } else {
            ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
        }

        ctx.fillStyle = color;
        ctx.globalAlpha = isHighlighted ? 1.0 : 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Membrane
        ctx.lineWidth = Math.max(size * 0.12, 0.5);
        ctx.strokeStyle = isHighlighted ? 'rgba(0, 255, 255, 0.8)' : `rgba(232,236,233,${node.type === 'Session' ? 0.4 : 0.15})`;
        ctx.stroke();

        ctx.restore();

        // Labels at zoom or if highlighted
        if (globalScale > 1.2 || isHighlighted) {
            const fontSize = Math.max(10 / globalScale, 5);
            ctx.font = isHighlighted ? `bold ${fontSize + 1}px Inter, system-ui` : `500 ${fontSize}px Inter, system-ui`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = isHighlighted ? '#00ffff' : 'rgba(232,236,233,0.7)';
            const maxChars = Math.floor(20 * Math.min(globalScale / 2, 1.5));
            const text = label.length > maxChars ? label.substring(0, maxChars) + '…' : label;
            ctx.fillText(text, node.x, node.y + size + 2);
        }
    }, [highlightNodeId]);

    useEffect(() => {
        if (fgRef.current && graphData.nodes.length > 0) {
            fgRef.current.d3Force('charge').strength(-300);
            fgRef.current.d3Force('link').distance(50);
            // Zoom to fit after initial settle
            setTimeout(() => {
                if (fgRef.current) fgRef.current.zoomToFit(400, 60);
            }, 500);
        }
    }, [graphData]);

    return (
        <div className="graph-container" ref={containerRef}>
            <ForceGraph2D
                ref={fgRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                nodeCanvasObject={paintNode}
                onNodeHover={onNodeHover}
                onNodeClick={onNodeClick}
                nodePointerAreaPaint={(node, color, ctx) => {
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, (node.val || 6) * 1.5, 0, 2 * Math.PI);
                    ctx.fill();
                }}
                linkColor={() => 'rgba(138,154,164,0.12)'}
                linkWidth={1}
                linkDirectionalParticles={1}
                linkDirectionalParticleWidth={2}
                linkDirectionalParticleSpeed={0.004}
                linkDirectionalParticleColor={() => 'rgba(139,156,139,0.5)'}
                d3VelocityDecay={0.25}
                warmupTicks={50}
                cooldownTime={3000}
                backgroundColor="transparent"
                enableZoomInteraction={true}
                enablePanInteraction={true}
            />
        </div>
    );
}

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// Zoom level the trace-follow animates to so a highlighted node is clearly
// visible (above the 1.2 threshold where node labels render).
const TRACE_ZOOM = 2.5;

// Above this many nodes we switch from a force-simulated organic layout (which
// settles slowly and renders poorly past a couple thousand nodes) to a stable
// windowed layout: every node gets a deterministic position and only a window
// around the current step is fed to the renderer. All nodes stay loaded and
// auditable (step anywhere, the window follows) and the minimap shows them all.
const WINDOW_THRESHOLD = 500;
const RENDER_WINDOW = 140;   // nodes rendered on each side of the focused step
const NODE_GAP = 70;         // horizontal spacing between consecutive steps
const TYPE_LANES = {
    'User Input': -2, 'Session': 0, 'Thought': 1, 'Message': 1,
    'Tool Call': 2, 'Tool Result': 3, 'Artifact': -1, 'Error': 4, 'System Init': 0,
};

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

export default function OrganicGraph({ data, filters = { showUser: true, showAgent: true, showTools: true, showArtifacts: true }, onNodeHover, onNodeClick, onBackgroundClick, highlightNodeIds = [], highlightNodeId = null, layout = 'organic', trackingMode = true, locked = false }) {
    const fgRef = useRef();
    const containerRef = useRef();
    const minimapRef = useRef();
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    const prevSessionIdRef = useRef(null);
    const prevLayoutRef = useRef(layout);
    const prevNodesCountRef = useRef(0);
    const hasSettleZoomedRef = useRef(false);
    const hasInitializedForces = useRef(false);

    const activeHighlightIds = useMemo(() => {
        if (Array.isArray(highlightNodeIds)) return highlightNodeIds.filter(Boolean);
        if (highlightNodeIds) return [highlightNodeIds];
        if (highlightNodeId) return [highlightNodeId];
        return [];
    }, [highlightNodeIds, highlightNodeId]);

    // For big sessions, switch to the windowed/deterministic strategy.
    const useWindow = (data?.nodes?.length || 0) > WINDOW_THRESHOLD;

    // Stable chronological ordering of the WHOLE graph. When windowing, every
    // node also gets a fixed (fx, fy) so positions never drift as the window
    // slides — the renderer just shows/hides nodes at their permanent spots.
    const ordered = useMemo(() => {
        if (!data?.nodes) return [];
        const arr = [...data.nodes].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        if (useWindow) {
            const total = arr.length;
            arr.forEach((n, i) => {
                n.__idx = i;
                n.fx = (i - total / 2) * NODE_GAP;
                n.fy = (TYPE_LANES[n.type] ?? 0) * 55;
            });
        }
        return arr;
    }, [data, useWindow]);

    // Measure actual container. A ResizeObserver tracks the element's real size
    // after every layout pass — important for fullscreen/maximize, where a plain
    // window-resize handler can read the old height before reflow finishes and
    // leave the canvas filling only part of the screen.
    useEffect(() => {
        const measure = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    setDimensions({ width: rect.width, height: rect.height });
                }
            }
        };
        measure();

        let ro;
        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
            ro = new ResizeObserver(() => measure());
            ro.observe(containerRef.current);
        }
        // Re-measure on the next frame too, so we catch the post-fullscreen layout.
        const onResize = () => { measure(); requestAnimationFrame(measure); };
        window.addEventListener('resize', onResize);
        document.addEventListener('fullscreenchange', onResize);
        return () => {
            if (ro) ro.disconnect();
            window.removeEventListener('resize', onResize);
            document.removeEventListener('fullscreenchange', onResize);
        };
    }, []);

    // Handle organic vs chronological layout
    useEffect(() => {
        if (!data?.nodes || data.nodes.length === 0) return;
        // Windowed mode uses fixed deterministic positions — no force layout,
        // no reheat, no fit (the trace camera handles framing). Skip all of it.
        if (useWindow) return;

        const sessionNode = data.nodes.find(n => n.type === 'Session');
        const sessionId = sessionNode ? sessionNode.id : null;

        const sessionChanged = prevSessionIdRef.current !== sessionId;
        const layoutChanged = prevLayoutRef.current !== layout;
        const nodesCountChanged = prevNodesCountRef.current !== data.nodes.length;

        prevSessionIdRef.current = sessionId;
        prevLayoutRef.current = layout;
        prevNodesCountRef.current = data.nodes.length;

        if (layout === 'chronological') {
            // Sort nodes chronologically
            const sortedNodes = [...data.nodes].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            const total = sortedNodes.length;

            sortedNodes.forEach((node, index) => {
                // Position nodes horizontally based on chronological index
                node.fx = (index - total / 2) * 80;
                
                // Keep the root Session node strictly at y=0, let other nodes spread out vertically
                if (node.type === 'Session') {
                    node.fy = 0;
                } else {
                    node.fy = undefined;
                }
            });
        } else if (layoutChanged || sessionChanged) {
            // Clear fixed coordinates so the force simulation can arrange organically
            data.nodes.forEach(node => {
                node.fx = undefined;
                node.fy = undefined;
            });
        }

        if (fgRef.current) {
            // Only reheat simulation if the layout, session, or node count changed
            if (layoutChanged || sessionChanged || nodesCountChanged) {
                fgRef.current.d3ReheatSimulation();
            }

            // Only zoom to fit when the session changes, layout changes, or on initial load
            if (sessionChanged || layoutChanged || !hasSettleZoomedRef.current) {
                hasSettleZoomedRef.current = true;
                setTimeout(() => {
                    if (fgRef.current) fgRef.current.zoomToFit(400, 60);
                }, 300);
            }
        }
    }, [layout, data, useWindow]);

    const passesFilter = useCallback((node) => {
        if (node.type === 'User Input' && !filters.showUser) return false;
        if ((node.type === 'Thought' || node.type === 'Message') && !filters.showAgent) return false;
        if ((node.type === 'Tool Call' || node.type === 'Tool Result') && !filters.showTools) return false;
        if (node.type === 'Artifact' && !filters.showArtifacts) return false;
        return true;
    }, [filters]);

    // Filtered data fed to the renderer. In windowed mode this is only the slice
    // of nodes around the focused step (everything else stays loaded for the
    // minimap + stepping); otherwise it's the whole filtered graph.
    const graphData = useMemo(() => {
        if (!data?.nodes) return { nodes: [], links: [] };

        let candidateNodes;
        if (useWindow) {
            const focusId = activeHighlightIds[0];
            let fi = focusId ? ordered.findIndex(n => n.id === focusId) : -1;
            if (fi < 0) fi = ordered.length - 1;
            const lo = Math.max(0, fi - RENDER_WINDOW);
            const hi = Math.min(ordered.length, fi + RENDER_WINDOW + 1);
            candidateNodes = ordered.slice(lo, hi);
        } else {
            candidateNodes = data.nodes;
        }

        const filteredNodes = candidateNodes.filter(passesFilter);
        const nodeIds = new Set(filteredNodes.map(n => n.id));
        const filteredLinks = (data.links || []).filter(l => {
            const src = typeof l.source === 'object' ? l.source.id : l.source;
            const tgt = typeof l.target === 'object' ? l.target.id : l.target;
            return nodeIds.has(src) && nodeIds.has(tgt);
        });

        return { nodes: filteredNodes, links: filteredLinks };
    }, [data, passesFilter, useWindow, ordered, activeHighlightIds]);

    // Note: changing activeHighlightIds gives paintNode (nodeCanvasObject) a new
    // identity, which makes ForceGraph2D redraw the canvas on its own. There is no
    // imperative refresh() method on the react-force-graph-2d ref, so we must not
    // call one here — doing so throws and unmounts the whole graph.

    // Trace follow: in TRACKING mode, pan/zoom the camera to the active node so
    // stepping (or playback) moves the spotlight onto the current node. In FREE
    // ROAM mode we never touch the camera, so the user can compose cinematic
    // shots / pan freely while playback runs. Node positions (x/y) are only
    // available after the force sim has ticked, so we retry briefly if needed.
    useEffect(() => {
        if (!trackingMode) return;
        if (!fgRef.current || activeHighlightIds.length === 0) return;
        const targetId = activeHighlightIds[0];
        let cancelled = false;
        let attempts = 0;

        const focus = () => {
            if (cancelled || !fgRef.current) return false;
            const node = graphData.nodes.find(n => n.id === targetId);
            const px = node && (node.x ?? node.fx);
            const py = node && (node.y ?? node.fy);
            if (typeof px === 'number' && typeof py === 'number') {
                // Center the camera on the focused node and zoom to a readable
                // level. We do this INSTANTLY (0ms) rather than animated: when the
                // render window slides each step the graph re-inits and resets the
                // camera, and an animated centerAt loses that race. Instant + a few
                // re-applies below reliably lands the spotlight on the node.
                if (fgRef.current.zoom() < TRACE_ZOOM) fgRef.current.zoom(TRACE_ZOOM, 0);
                fgRef.current.centerAt(px, py, 0);
                // Windowed only: nudge a repaint after the camera move (a cooled
                // canvas may not redraw on a programmatic pan). Safe because every
                // node is pinned, so reheating moves nothing. Organic mode already
                // repaints via the paintNode identity change on highlight.
                if (useWindow) fgRef.current.d3ReheatSimulation();
                return true;
            }
            return false;
        };

        // Apply immediately, then re-apply across the next few frames to override
        // any camera reset triggered by the window's graphData changing.
        const positioned = focus();
        const timers = [60, 180, 320, 500].map(d => setTimeout(focus, d));
        if (!positioned) {
            // Node not placed yet — keep trying a little longer.
            const timer = setInterval(() => {
                attempts += 1;
                if (focus() || attempts >= 8) clearInterval(timer);
            }, 250);
            timers.push(timer);
        }
        return () => { cancelled = true; timers.forEach(t => { clearTimeout(t); clearInterval(t); }); };
    }, [activeHighlightIds, graphData, trackingMode, useWindow]);

    // Graph lock: freeze node positions so the layout stops drifting/wiggling
    // when idle. Toggling the lock ON pins every node where it currently sits;
    // toggling OFF releases them and re-runs the force layout so the user can
    // rearrange. (New layouts are also pinned once they settle — see
    // handleEngineStop below — which keeps the trace-follow camera stable.)
    useEffect(() => {
        const fg = fgRef.current;
        if (!fg || !data?.nodes || useWindow) return; // windowed = already fixed positions
        if (locked) {
            data.nodes.forEach(n => {
                if (typeof n.x === 'number') { n.fx = n.x; n.fy = n.y; }
            });
        } else if (layout !== 'chronological') {
            data.nodes.forEach(n => { n.fx = undefined; n.fy = undefined; });
            fg.d3ReheatSimulation();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locked]);

    // Once a fresh layout settles, pin it in place if the graph is locked so it
    // never drifts again (and the followed node stays put under the camera).
    const handleEngineStop = useCallback(() => {
        if (!locked || !data?.nodes || useWindow) return;
        data.nodes.forEach(n => {
            if (typeof n.x === 'number') { n.fx = n.x; n.fy = n.y; }
        });
    }, [locked, data, useWindow]);

    // Minimap: in tracking mode, draw a downscaled overview of the WHOLE graph
    // (every node, no cap) with the current node highlighted and a rectangle for
    // the visible viewport — so the user keeps full spatial awareness of where
    // the close-up camera is within the complete session.
    useEffect(() => {
        if (!trackingMode) return;
        const draw = () => {
            const cv = minimapRef.current;
            if (!cv) return;
            const ctx = cv.getContext('2d');
            const W = cv.width, H = cv.height;
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = 'rgba(18,22,20,0.82)';
            ctx.fillRect(0, 0, W, H);

            // Windowed mode: show ALL nodes (deterministic fx/fy) for full
            // awareness. Organic mode: show the simulated nodes (x/y).
            const source = useWindow ? ordered : graphData.nodes;
            const posX = n => (typeof n.x === 'number' ? n.x : n.fx);
            const posY = n => (typeof n.y === 'number' ? n.y : n.fy);
            const nodes = source.filter(n => typeof posX(n) === 'number' && typeof posY(n) === 'number');
            if (!nodes.length) return;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const n of nodes) {
                const x = posX(n), y = posY(n);
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
            const pad = 6, gw = (maxX - minX) || 1, gh = (maxY - minY) || 1;
            const scale = Math.min((W - 2 * pad) / gw, (H - 2 * pad) / gh);
            const ox = (W - gw * scale) / 2, oy = (H - gh * scale) / 2;
            const tx = x => ox + (x - minX) * scale;
            const ty = y => oy + (y - minY) * scale;

            for (const n of nodes) {
                const hl = activeHighlightIds.includes(n.id);
                ctx.beginPath();
                ctx.arc(tx(posX(n)), ty(posY(n)), hl ? 3 : 1, 0, 2 * Math.PI);
                ctx.fillStyle = hl ? '#db533f' : (PALETTE[n.type] || '#5a6a5e');
                ctx.fill();
            }

            // Viewport rectangle (where the main camera is looking)
            if (fgRef.current) {
                try {
                    const c = fgRef.current.centerAt();
                    const k = fgRef.current.zoom();
                    if (c && k) {
                        const vw = dimensions.width / k, vh = dimensions.height / k;
                        ctx.strokeStyle = 'rgba(232,236,233,0.55)';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(tx(c.x - vw / 2), ty(c.y - vh / 2), vw * scale, vh * scale);
                    }
                } catch { /* center/zoom not ready */ }
            }
        };
        draw();
        const iv = setInterval(draw, 300);
        return () => clearInterval(iv);
    }, [trackingMode, graphData, ordered, useWindow, activeHighlightIds, dimensions]);

    const paintNode = useCallback((node, ctx, globalScale) => {
        const isHighlighted = activeHighlightIds.includes(node.id);
        const color = isHighlighted ? '#db533f' : (PALETTE[node.type] || '#5a6a5e'); // Rust red highlight
        const size = (node.val || 6) * (isHighlighted ? 2.2 : 1); // Enlarged when in active scope
        const label = node.label || node.type;

        ctx.save();

        // Glow for Session, Artifact, and highlighted nodes
        if (node.type === 'Session' || node.type === 'Artifact' || isHighlighted) {
            ctx.shadowColor = isHighlighted ? '#db533f' : color;
            ctx.shadowBlur = isHighlighted ? 36 : 12; // Much larger blur for highlights
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
        ctx.strokeStyle = isHighlighted ? 'rgba(255, 255, 255, 0.9)' : `rgba(232,236,233,${node.type === 'Session' ? 0.4 : 0.15})`;
        ctx.stroke();

        ctx.restore();

        // Extra targeting ring for highlighted nodes to make them SUPER obvious
        if (isHighlighted) {
            ctx.save();
            ctx.beginPath();
            const pulse = Math.sin(Date.now() / 250) * 0.5 + 0.5; // slow pulse between 0 and 1
            const pulseRadius = size * (1.2 + pulse * 0.5); // Radiates outwards from size*1.2 to size*1.7
            ctx.arc(node.x, node.y, pulseRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#db533f';
            ctx.lineWidth = 1.5 / globalScale; // Keep stroke thin even when zoomed in
            ctx.globalAlpha = 0.6 - pulse * 0.45; // fade out as it radiates outward
            ctx.stroke();
            ctx.restore();
        }

        // Labels at zoom or if highlighted
        if (globalScale > 1.2 || isHighlighted) {
            const fontSize = Math.max(10 / globalScale, 5);
            ctx.font = isHighlighted ? `bold ${fontSize + 1}px Inter, system-ui` : `500 ${fontSize}px Inter, system-ui`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = isHighlighted ? '#db533f' : 'rgba(232,236,233,0.7)';
            const maxChars = Math.floor(20 * Math.min(globalScale / 2, 1.5));
            const text = label.length > maxChars ? label.substring(0, maxChars) + '…' : label;
            ctx.fillText(text, node.x, node.y + size + 2);
        }
    }, [activeHighlightIds]);

    useEffect(() => {
        if (fgRef.current && graphData.nodes.length > 0 && !hasInitializedForces.current) {
            hasInitializedForces.current = true;
            fgRef.current.d3Force('charge')?.strength(-300);
            fgRef.current.d3Force('link')?.distance(50);
        }
    }, [graphData]);

    return (
        <div className="graph-container" ref={containerRef}>
            <ForceGraph2D
                ref={fgRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                onEngineStop={handleEngineStop}
                nodeCanvasObject={paintNode}
                onNodeHover={onNodeHover}
                onNodeClick={onNodeClick}
                onBackgroundClick={onBackgroundClick}
                nodePointerAreaPaint={(node, color, ctx) => {
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, (node.val || 6) * 1.5, 0, 2 * Math.PI);
                    ctx.fill();
                }}
                linkColor={link => {
                    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
                    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
                    const isSourceHighlighted = activeHighlightIds.includes(srcId);
                    const isTargetHighlighted = activeHighlightIds.includes(tgtId);
                    if (isSourceHighlighted && isTargetHighlighted) {
                        return 'rgba(219, 83, 63, 0.95)'; // bright rust red between active nodes
                    }
                    if (isSourceHighlighted || isTargetHighlighted) {
                        return 'rgba(219, 83, 63, 0.4)'; // glowing rust red
                    }
                    return 'rgba(138,154,164,0.12)';
                }}
                linkWidth={link => {
                    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
                    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
                    const isSourceHighlighted = activeHighlightIds.includes(srcId);
                    const isTargetHighlighted = activeHighlightIds.includes(tgtId);
                    return (isSourceHighlighted || isTargetHighlighted) ? 3 : 1;
                }}
                linkDirectionalParticles={link => {
                    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
                    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
                    const isSourceHighlighted = activeHighlightIds.includes(srcId);
                    const isTargetHighlighted = activeHighlightIds.includes(tgtId);
                    // Only the active trace path animates. Giving every link a
                    // particle kept the canvas redrawing forever (no idle frame),
                    // which tanked performance on large graphs and pinned the CPU.
                    return (isSourceHighlighted || isTargetHighlighted) ? 4 : 0;
                }}
                linkDirectionalParticleWidth={link => {
                    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
                    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
                    const isSourceHighlighted = activeHighlightIds.includes(srcId);
                    const isTargetHighlighted = activeHighlightIds.includes(tgtId);
                    return (isSourceHighlighted || isTargetHighlighted) ? 4 : 2;
                }}
                linkDirectionalParticleSpeed={link => {
                    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
                    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
                    const isSourceHighlighted = activeHighlightIds.includes(srcId);
                    const isTargetHighlighted = activeHighlightIds.includes(tgtId);
                    return (isSourceHighlighted || isTargetHighlighted) ? 0.015 : 0.004;
                }}
                linkDirectionalParticleColor={link => {
                    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
                    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
                    const isSourceHighlighted = activeHighlightIds.includes(srcId);
                    const isTargetHighlighted = activeHighlightIds.includes(tgtId);
                    return (isSourceHighlighted || isTargetHighlighted) ? 'rgba(219, 83, 63, 0.85)' : 'rgba(139,156,139,0.5)';
                }}
                d3VelocityDecay={0.25}
                warmupTicks={50}
                cooldownTime={3000}
                backgroundColor="transparent"
                enableZoomInteraction={true}
                enablePanInteraction={true}
            />

            {/* Full-graph minimap (tracking mode only) — keeps spatial awareness
                of the whole session while the main camera is zoomed in. */}
            {trackingMode && (
                <div style={{
                    position: 'absolute', bottom: 12, right: 12, zIndex: 10,
                    border: '1px solid rgba(232,236,233,0.18)', borderRadius: 6,
                    overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
                    pointerEvents: 'none'
                }}>
                    <canvas ref={minimapRef} width={210} height={140} style={{ display: 'block' }} />
                    <div style={{
                        position: 'absolute', top: 4, left: 6, fontSize: 9,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: 'rgba(232,236,233,0.55)', fontFamily: 'Inter, system-ui'
                    }}>Map</div>
                </div>
            )}
        </div>
    );
}

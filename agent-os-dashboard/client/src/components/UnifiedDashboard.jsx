import React, { useState, useEffect, useCallback, useMemo } from 'react';
import OrganicGraph from './OrganicGraph';
import GraphErrorBoundary from './GraphErrorBoundary';
import OverviewGrid from './OverviewGrid';
import bennyLogo from '../assets/benny.png';

const API = import.meta.env.DEV
  ? `${import.meta.env.VITE_MEMORAY_API || 'http://localhost:3030'}/api`
  : '/api';

export default function UnifiedDashboard({ initialSessionId, onSessionLoaded }) {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [agentFilter, setAgentFilter] = useState('all'); // all | claude | antigravity

  const [filters, setFilters] = useState({
    showUser: true,
    showAgent: true,
    showTools: true,
    showArtifacts: true
  });

  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [inspectedNode, setInspectedNode] = useState(null);
  const [fullNodeContent, setFullNodeContent] = useState(null);

  // File Explorer specific states
  const [sidebarView, setSidebarView] = useState('sessions'); // sessions | files
  const [files, setFiles] = useState([]);
  const [fileSearch, setFileSearch] = useState('');
  const [fileAgentFilter, setFileAgentFilter] = useState('all'); // all | claude | antigravity
  const [highlightNodeId, setHighlightNodeId] = useState(null);
  const [openFileAccordions, setOpenFileAccordions] = useState({});

  // Timeline Sequence State
  const [sliderIndex, setSliderIndex] = useState(-1);

  // Load sessions
  useEffect(() => {
    const loadSessions = () => {
      fetch(`${API}/sessions`)
        .then(r => r.json())
        .then(data => setSessions(Array.isArray(data) ? data : []))
        .catch(err => console.error('Session fetch failed:', err));
    };

    loadSessions();

    const interval = setInterval(loadSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  // Cross-tab navigation: auto-load session from Beta
  useEffect(() => {
    if (initialSessionId && initialSessionId !== selectedSessionId) {
      loadSession(initialSessionId);
      onSessionLoaded?.();
    }
  }, [initialSessionId]);

  // Poll selected session graph data if selected and active
  useEffect(() => {
    if (!selectedSessionId) return;

    // Check if the session is active
    const sessionObj = sessions.find(s => s.id === selectedSessionId);
    const isActive = sessionObj?.metadata?.isActive;
    if (!isActive) return;

    const interval = setInterval(() => {
      fetch(`${API}/graph/${selectedSessionId}?limit=500`)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(data => {
          setSessionData(data);
        })
        .catch(err => console.error('Graph poll failed:', err));
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedSessionId, sessions]);

  // Load files when switching to files view
  useEffect(() => {
    if (sidebarView === 'files') {
      fetch(`${API}/files`)
        .then(r => r.json())
        .then(data => setFiles(Array.isArray(data) ? data : []))
        .catch(err => console.error('Files fetch failed:', err));
    }
  }, [sidebarView]);

  // Filter sessions by agent
  const filteredSessions = useMemo(() => {
    if (agentFilter === 'all') return sessions;
    return sessions.filter(s => s.agent?.toLowerCase() === agentFilter);
  }, [sessions, agentFilter]);

  // Filter files by agent and search query
  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesAgent = fileAgentFilter === 'all' || f.agent.toLowerCase() === fileAgentFilter;
      const matchesSearch = !fileSearch || 
        f.fileName.toLowerCase().includes(fileSearch.toLowerCase()) || 
        f.filePath.toLowerCase().includes(fileSearch.toLowerCase());
      return matchesAgent && matchesSearch;
    });
  }, [files, fileAgentFilter, fileSearch]);

  const toggleFileAccordion = (filePath) => {
    setOpenFileAccordions(prev => ({ ...prev, [filePath]: !prev[filePath] }));
  };

  // Load graph for a session
  const loadSession = useCallback(async (sessionId) => {
    if (sessionId === selectedSessionId) return;
    setSelectedSessionId(sessionId);
    setSessionData(null);
    setLoading(true);
    setInspectedNode(null);
    setFullNodeContent(null);
    setHighlightNodeId(null); // Reset highlight when changing sessions manually
    try {
      const res = await fetch(`${API}/graph/${sessionId}?limit=500`);
      if (!res.ok) throw new Error(`Graph fetch failed: ${res.status}`);
      const data = await res.json();
      setSessionData(data);
    } catch (e) {
      console.error('Graph load failed:', e);
    }
    setLoading(false);
  }, [selectedSessionId]);

  // Handle selecting a file interaction in the timeline
  const handleSelectFileInteraction = async (interaction, filePath) => {
    // 1. Trigger OS default app to open the file
    fetch(`${API}/files/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    }).catch(err => console.error('OS open file failed:', err));

    // 2. Load the session graph if it's different from current
    if (interaction.sessionId !== selectedSessionId) {
      setSelectedSessionId(interaction.sessionId);
      setSessionData(null);
      setLoading(true);
      setInspectedNode(null);
      setFullNodeContent(null);
      setHighlightNodeId(interaction.nodeId);
      try {
        const res = await fetch(`${API}/graph/${interaction.sessionId}?limit=500`);
        if (!res.ok) throw new Error(`Graph fetch failed: ${res.status}`);
        const data = await res.json();
        setSessionData(data);
        
        // Inspect the file interaction node
        const node = data.nodes.find(n => n.id === interaction.nodeId);
        if (node) {
          setInspectedNode(node);
          setIsInspectOpen(true);
          fetch(`${API}/entities/${node.id}`)
            .then(r => r.json())
            .then(d => setFullNodeContent(d))
            .catch(() => setFullNodeContent(null));
        }
      } catch (e) {
        console.error('Graph load failed:', e);
      }
      setLoading(false);
    } else {
      // If already in the correct session, just highlight and inspect
      setHighlightNodeId(interaction.nodeId);
      if (sessionData?.nodes) {
        const node = sessionData.nodes.find(n => n.id === interaction.nodeId);
        if (node) {
          setInspectedNode(node);
          setIsInspectOpen(true);
          fetch(`${API}/entities/${node.id}`)
            .then(r => r.json())
            .then(d => setFullNodeContent(d))
            .catch(() => setFullNodeContent(null));
        }
      }
    }
  };

  // When hovering a node, fetch full content
  const handleNodeHover = useCallback((node) => {
    // If a node is currently selected/locked, ignore hover events so the inspector doesn't jitter
    if (highlightNodeId) return;

    if (!node) { setInspectedNode(null); return; }
    setInspectedNode(node);
    fetch(`${API}/entities/${node.id}`)
      .then(r => r.json())
      .then(data => setFullNodeContent(data))
      .catch(() => setFullNodeContent(null));
  }, [highlightNodeId]);

  // Chronological nodes for slider
  const chronologicalNodes = useMemo(() => {
    if (!sessionData?.nodes) return [];
    return [...sessionData.nodes].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [sessionData]);

  const handleNodeClick = useCallback((node) => {
    setHighlightNodeId(node.id);
    setInspectedNode(node);
    setIsInspectOpen(true);
    fetch(`${API}/entities/${node.id}`)
      .then(r => r.json())
      .then(data => setFullNodeContent(data))
      .catch(() => setFullNodeContent(null));
      
    // Update slider index if possible
    if (chronologicalNodes) {
      const idx = chronologicalNodes.findIndex(n => n.id === node.id);
      if (idx !== -1) setSliderIndex(idx);
    }
  }, [chronologicalNodes]);

  const handleBackgroundClick = useCallback(() => {
    setHighlightNodeId(null);
    setSliderIndex(-1);
    setInspectedNode(null);
    setFullNodeContent(null);
  }, []);

  const goHome = () => {
    setSelectedSessionId(null);
    setSessionData(null);
    setIsInspectOpen(false);
    setInspectedNode(null);
    setFullNodeContent(null);
    setHighlightNodeId(null);
  };

  const toggleFilter = (key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

  // Handle Step through sequence
  const handleStep = useCallback((index) => {
    if (!chronologicalNodes || index < 0 || index >= chronologicalNodes.length) return;
    const node = chronologicalNodes[index];
    setSliderIndex(index);
    setHighlightNodeId(node.id);
    setInspectedNode(node);
    setIsInspectOpen(true);
    fetch(`${API}/entities/${node.id}`)
      .then(r => r.json())
      .then(data => setFullNodeContent(data))
      .catch(() => setFullNodeContent(null));
  }, [chronologicalNodes]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedSessionId || chronologicalNodes.length === 0) return;
      if (e.key === 'ArrowRight') {
        handleStep(sliderIndex < chronologicalNodes.length - 1 ? sliderIndex + 1 : sliderIndex);
      } else if (e.key === 'ArrowLeft') {
        handleStep(sliderIndex > 0 ? sliderIndex - 1 : 0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSessionId, chronologicalNodes, sliderIndex, handleStep]);

  // Compute graph stats
  const graphStats = useMemo(() => {
    if (!sessionData?.nodes) return null;
    const counts = {};
    sessionData.nodes.forEach(n => { counts[n.type] = (counts[n.type] || 0) + 1; });
    return counts;
  }, [sessionData]);

  return (
    <div className="unified-app">
      {/* ─── LEFT SIDEBAR ─── */}
      <aside className="left-sidebar" style={{ background: 'var(--bg-base)', borderRight: '1px solid var(--border-subtle)', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-header" style={{ marginBottom: '2rem' }}>
          <div className="sidebar-logo" style={{ overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            <img src={bennyLogo} alt="Benny" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h2 onClick={goHome} style={{ cursor: 'pointer', color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 500 }}>Memo-Ray</h2>
        </div>

        {/* View Toggle tabs: Sessions Explorer vs Files Explorer */}
        <div className="view-toggle-tabs" style={{ marginBottom: '1rem', background: 'var(--bg-deep)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
          <button 
            className={`view-toggle-btn ${sidebarView === 'sessions' ? 'active' : ''}`}
            onClick={() => setSidebarView('sessions')}
          >
            Sessions
          </button>
          <button 
            className={`view-toggle-btn ${sidebarView === 'files' ? 'active' : ''}`}
            onClick={() => setSidebarView('files')}
          >
            Files
          </button>
        </div>

        {sidebarView === 'sessions' ? (
          <>
            <div className="agent-tabs">
              {['all', 'claude', 'antigravity'].map(tab => (
                <button
                  key={tab}
                  className={`agent-tab ${agentFilter === tab ? 'active' : ''}`}
                  onClick={() => setAgentFilter(tab)}
                >
                  {tab === 'all' ? 'All' : tab === 'claude' ? 'Claude' : 'Antigravity'}
                </button>
              ))}
            </div>

            <div className="session-list">
              {filteredSessions.length === 0 && (
                <div style={{ padding: '2rem 1rem', color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center' }}>
                  No sessions found
                </div>
              )}
              {filteredSessions.map(s => (
                <div
                  key={s.id}
                  className={`session-item ${selectedSessionId === s.id ? 'active' : ''} ${(s.agent || '').toLowerCase()}`}
                  onClick={() => loadSession(s.id)}
                >
                  <div className="session-agent-badge">
                    {s.agent === 'Claude' ? 'C' : 'A'}
                  </div>
                  <div className="session-info">
                    <div className="session-title">{s.content || 'Untitled Session'}</div>
                    <div className="session-meta">
                      <span className="session-date">{new Date(s.timestamp).toLocaleDateString()}</span>
                      {s.children_ids && (
                        <span className="session-node-count">{s.children_ids.length} nodes</span>
                      )}
                      {s.metadata?.taskType && (
                        <span className="s-task-badge">{s.metadata.taskType}</span>
                      )}
                    </div>
                    {(s.metadata?.cwd || s.metadata?.gitBranch) && (
                      <div className="session-path-info">
                        {s.metadata?.cwd && <span className="s-cwd" title={s.metadata.cwd}>📂 {s.metadata.cwd.split('\\').pop()?.split('/').pop()}</span>}
                        {s.metadata?.gitBranch && <span className="s-branch">🌿 {s.metadata.gitBranch}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="agent-tabs">
              {['all', 'claude', 'antigravity'].map(tab => (
                <button
                  key={tab}
                  className={`agent-tab ${fileAgentFilter === tab ? 'active' : ''}`}
                  onClick={() => setFileAgentFilter(tab)}
                >
                  {tab === 'all' ? 'All' : tab === 'claude' ? 'Claude' : 'Antigravity'}
                </button>
              ))}
            </div>

            <div className="file-search-container">
              <input 
                type="text" 
                placeholder="Search file name or path..."
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                className="file-search-input"
              />
            </div>

            <div className="session-list file-explorer-list">
              {filteredFiles.length === 0 && (
                <div style={{ padding: '2rem 1rem', color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center' }}>
                  No files found
                </div>
              )}
              {filteredFiles.map(f => {
                const isAccordionOpen = !!openFileAccordions[f.filePath];
                const isActiveFile = selectedSessionId === f.primarySessionId;
                return (
                  <div key={f.filePath} className={`file-item-group ${isActiveFile ? 'active-group' : ''}`}>
                    <div 
                      className={`session-item file-item ${isActiveFile ? 'active' : ''} ${f.agent.toLowerCase()}`}
                      onClick={() => toggleFileAccordion(f.filePath)}
                    >
                      <div className="session-agent-badge">
                        {f.agent === 'Claude' ? 'C' : 'A'}
                      </div>
                      <div className="session-info" style={{ overflow: 'hidden' }}>
                        <div className="session-title file-name">{f.fileName}</div>
                        <div className="session-meta file-path-desc" title={f.filePath}>{f.filePath}</div>
                      </div>
                      <button 
                        className="btn-open-os"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          fetch(`${API}/files/open`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ filePath: f.filePath })
                          }).catch(err => console.error('OS open file failed:', err));
                        }}
                        title="Open file via default OS application"
                      >
                        ↗
                      </button>
                    </div>
                    {isAccordionOpen && (
                      <div className="file-timeline">
                        {f.interactions.map((inter, idx) => (
                          <div 
                            key={idx} 
                            className={`timeline-item ${highlightNodeId === inter.nodeId ? 'selected' : ''}`}
                            onClick={() => handleSelectFileInteraction(inter, f.filePath)}
                          >
                            <div className="timeline-dot-wrapper">
                              <div className="timeline-dot" style={{
                                background: inter.type === 'write' ? 'var(--slate)' : 'var(--moss)'
                              }} />
                              {idx < f.interactions.length - 1 && <div className="timeline-line" />}
                            </div>
                            <div className="timeline-content">
                              <div className="timeline-action">
                                <span className={`action-badge ${inter.type}`}>{inter.type}</span>
                                <span className="action-tool">{inter.toolName}</span>
                              </div>
                              <div className="timeline-session">Session: {inter.sessionTitle}</div>
                              <div className="timeline-time">{new Date(inter.timestamp).toLocaleTimeString()} · {new Date(inter.timestamp).toLocaleDateString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main className="graph-canvas">
        {loading ? (
          <div className="loading-state">
            <div className="loading-pulse" />
            <span>Loading session lineage…</span>
          </div>
        ) : sessionData ? (
          <>
            {/* Graph Toolbar */}
            <div className="graph-toolbar">
              {[
                { key: 'showUser', label: 'User', color: 'var(--taupe)' },
                { key: 'showAgent', label: 'Thoughts', color: 'var(--sage)' },
                { key: 'showTools', label: 'Tools', color: 'var(--moss)' },
                { key: 'showArtifacts', label: 'Files', color: 'var(--slate)' },
              ].map(f => (
                <button
                  key={f.key}
                  className={`toolbar-btn ${filters[f.key] ? 'active' : ''}`}
                  onClick={() => toggleFilter(f.key)}
                  style={{ borderBottom: filters[f.key] ? `2px solid ${f.color}` : '2px solid transparent' }}
                >
                  {f.label}
                </button>
              ))}
              <div className="toolbar-divider" />
              <button className="toolbar-btn" onClick={() => setIsInspectOpen(!isInspectOpen)}>
                Inspect
              </button>
            </div>

            <GraphErrorBoundary resetKey={selectedSessionId}>
              <OrganicGraph
                data={sessionData}
                filters={filters}
                onNodeHover={handleNodeHover}
                onNodeClick={handleNodeClick}
                onBackgroundClick={handleBackgroundClick}
                highlightNodeIds={highlightNodeId ? [highlightNodeId] : []}
              />
            </GraphErrorBoundary>

            {/* Sequence Scrub Slider */}
            {chronologicalNodes.length > 0 && (
              <div style={{ padding: '1rem 2rem', background: 'var(--bg-base)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Timeline Sequence:</span>
                <input 
                  type="range" 
                  min="0" 
                  max={chronologicalNodes.length - 1} 
                  value={sliderIndex === -1 ? 0 : sliderIndex} 
                  onChange={(e) => handleStep(parseInt(e.target.value))}
                  style={{ flex: 1, cursor: 'pointer' }}
                />
                <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', width: '80px', textAlign: 'right' }}>
                  {sliderIndex + 1} / {chronologicalNodes.length}
                </span>
              </div>
            )}

            {/* Bottom stats */}
            {graphStats && (
              <div className="graph-stats">
                {Object.entries(graphStats).map(([type, count]) => (
                  <div key={type} className="graph-stat">
                    <div className="graph-stat-dot" style={{
                      background: type === 'User Input' ? 'var(--taupe)' :
                                  type === 'Thought' ? 'var(--sage)' :
                                  type === 'Tool Call' ? 'var(--moss)' :
                                  type === 'Artifact' ? 'var(--slate)' :
                                  type === 'Session' ? 'var(--golden)' : 'var(--text-tertiary)'
                    }} />
                    {count} {type === 'Artifact' ? 'File' : type}{count !== 1 ? (type === 'Artifact' ? 's' : 's') : ''}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <OverviewGrid onSelectSession={loadSession} />
        )}
      </main>

      {/* ─── RIGHT SIDEBAR ─── */}
      <aside className={`right-sidebar ${isInspectOpen ? 'open' : 'closed'}`}>
        <button className="sidebar-close-btn" onClick={() => setIsInspectOpen(false)}>✕</button>

        <div className="filter-section">
          <h3>Lineage Filters</h3>
          <div className="filter-grid">
            {[
              { key: 'showUser', label: 'User Inputs', color: 'var(--taupe)' },
              { key: 'showAgent', label: 'Thoughts', color: 'var(--sage)' },
              { key: 'showTools', label: 'Tool Calls', color: 'var(--moss)' },
              { key: 'showArtifacts', label: 'Files', color: 'var(--slate)' },
            ].map(f => (
              <label key={f.key} className={`filter-chip ${filters[f.key] ? '' : 'off'}`} style={{ color: filters[f.key] ? f.color : undefined }}>
                <input type="checkbox" checked={filters[f.key]} onChange={() => toggleFilter(f.key)} />
                <div className="filter-dot" style={{ background: f.color }} />
                {f.label}
              </label>
            ))}
          </div>
        </div>

        <div className="inspection-section">
          <h3>Node Inspection</h3>
          {inspectedNode ? (
            <div className="inspection-card">
              <div className="inspect-header">
                <span className={`type-badge ${inspectedNode.type.toLowerCase().replace(/\s+/g, '-')}`}>
                  {inspectedNode.type}
                </span>
                <span className="inspect-agent">{inspectedNode.agent}</span>
              </div>
              {inspectedNode.label && (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {inspectedNode.label}
                </div>
              )}
              <div className="inspect-time">
                {new Date(inspectedNode.timestamp).toLocaleString()}
              </div>
              <div className="inspect-content">
                <pre>{fullNodeContent?.content || inspectedNode.content || '(empty)'}</pre>
              </div>
            </div>
          ) : (
            <p className="hint">Click or hover over a node in the graph to inspect its full content, metadata, and lineage context.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

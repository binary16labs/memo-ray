import React, { useState, useEffect, useCallback, useMemo } from 'react';

const API = `${import.meta.env.VITE_MEMORAY_API || 'http://localhost:3001'}/api`;

export default function BetaDashboard({ onNavigateToSession }) {
  const [overview, setOverview] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [agentFilter, setAgentFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedAgents, setExpandedAgents] = useState({});
  const [selectedAction, setSelectedAction] = useState(null);
  const [fullEntity, setFullEntity] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchDebounce, setSearchDebounce] = useState(null);

  // Load overview
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/beta/overview`)
      .then(r => r.json())
      .then(data => { setOverview(data); setLoading(false); })
      .catch(err => { console.error('Beta overview failed:', err); setLoading(false); });
  }, []);

  // Load timeline
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('limit', '200');
    if (projectFilter) params.set('project', projectFilter);
    if (agentFilter !== 'all') params.set('agent', agentFilter);
    if (typeFilter) params.set('type', typeFilter);

    fetch(`${API}/beta/timeline?${params}`)
      .then(r => r.json())
      .then(data => setTimeline(Array.isArray(data) ? data : []))
      .catch(err => console.error('Beta timeline failed:', err));
  }, [projectFilter, agentFilter, typeFilter]);

  // Debounced search
  useEffect(() => {
    if (searchDebounce) clearTimeout(searchDebounce);
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`${API}/beta/search?q=${encodeURIComponent(searchQuery)}`)
        .then(r => r.json())
        .then(data => setSearchResults(data))
        .catch(() => setSearchResults(null));
    }, 300);
    setSearchDebounce(timer);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch full entity for audit inspector
  const inspectAction = useCallback((action) => {
    setSelectedAction(action);
    setFullEntity(null);
    fetch(`${API}/entities/${action.id}`)
      .then(r => r.json())
      .then(data => setFullEntity(data))
      .catch(() => setFullEntity(null));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(`${API}/sync`);
      const res = await fetch(`${API}/beta/overview`);
      setOverview(await res.json());
    } catch (e) { console.error('Sync failed:', e); }
    setSyncing(false);
  };

  const toggleProject = (name) => {
    setExpandedProjects(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleAgent = (key) => {
    setExpandedAgents(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const openFileInOS = (filePath) => {
    fetch(`${API}/files/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    }).catch(err => console.error('OS open failed:', err));
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString();
  };

  const formatTokens = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  };

  const typeBadgeClass = (type) => {
    return (type || '').toLowerCase().replace(/\s+/g, '-');
  };

  const hasSearchResults = searchResults &&
    (searchResults.sessions?.length > 0 || searchResults.files?.length > 0 || searchResults.actions?.length > 0);

  if (loading) {
    return (
      <div className="beta-dashboard">
        <div className="loading-state blueprint-loading">
          <div className="blueprint-spinner" />
          <span>Initializing Mission Control…</span>
        </div>
      </div>
    );
  }

  const maxHotFileCount = overview?.hotFiles?.[0]?.count || 1;

  return (
    <div className="beta-dashboard">
      {/* ─── COMMAND BAR ─── */}
      <div className="beta-command-bar">
        <div className="beta-command-left">
          <div className="beta-search-wrapper">
            <span className="beta-search-icon">⌕</span>
            <input
              type="text"
              className="beta-search-input"
              placeholder="Search sessions, files, tools…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="beta-search-clear" onClick={() => { setSearchQuery(''); setSearchResults(null); }}>✕</button>
            )}
          </div>
        </div>

        <div className="beta-command-center">
          <div className="beta-stat">
            <span className="stat-value">{overview?.totalSessions || 0}</span>
            <span className="stat-label">Sessions</span>
          </div>
          <div className="beta-stat">
            <span className="stat-value">{formatTokens(overview?.totalNodes || 0)}</span>
            <span className="stat-label">Nodes</span>
          </div>
          <div className="beta-stat">
            <span className="stat-value">{formatTokens(overview?.totalTokens || 0)}</span>
            <span className="stat-label">Tokens</span>
          </div>
          <div className="beta-stat">
            <span className="stat-value">{overview?.totalFiles || 0}</span>
            <span className="stat-label">Files</span>
          </div>
        </div>

        <div className="beta-command-right">
          <div className="beta-agent-filter">
            {['all', 'claude', 'antigravity'].map(a => (
              <button
                key={a}
                className={`beta-agent-chip ${agentFilter === a ? 'active' : ''}`}
                onClick={() => setAgentFilter(a)}
              >
                {a === 'all' ? 'All' : a === 'claude' ? 'C' : 'A'}
              </button>
            ))}
          </div>
          <button className={`beta-sync-btn ${syncing ? 'syncing' : ''}`} onClick={handleSync} disabled={syncing}>
            ↻
          </button>
        </div>
      </div>

      {/* ─── SEARCH RESULTS OVERLAY ─── */}
      {hasSearchResults && (
        <div className="beta-search-results">
          {searchResults.sessions?.length > 0 && (
            <div className="beta-search-group">
              <h4>Sessions ({searchResults.sessions.length})</h4>
              {searchResults.sessions.map(s => (
                <div key={s.id} className="beta-search-item" onClick={() => onNavigateToSession?.(s.id)}>
                  <span className={`beta-tl-agent ${s.agent?.toLowerCase()}`}>{s.agent === 'Claude' ? 'C' : 'A'}</span>
                  <div>
                    <div className="beta-search-title">{s.title}</div>
                    <div className="beta-search-meta">{s.project} · {s.nodes} nodes · {formatDate(s.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {searchResults.files?.length > 0 && (
            <div className="beta-search-group">
              <h4>Files ({searchResults.files.length})</h4>
              {searchResults.files.map((f, i) => (
                <div key={i} className="beta-search-item" onClick={() => openFileInOS(f.filePath)}>
                  <span className="beta-search-file-icon">📄</span>
                  <div>
                    <div className="beta-search-title">{f.fileName}</div>
                    <div className="beta-search-meta">{f.filePath}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {searchResults.actions?.length > 0 && (
            <div className="beta-search-group">
              <h4>Actions ({searchResults.actions.length})</h4>
              {searchResults.actions.map(a => (
                <div key={a.id} className="beta-search-item" onClick={() => inspectAction(a)}>
                  <span className={`beta-tl-type-badge ${typeBadgeClass(a.type)}`}>{a.type}</span>
                  <div>
                    <div className="beta-search-title">{a.toolName || a.type}</div>
                    <div className="beta-search-meta">{a.contentSnippet?.substring(0, 80)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button className="beta-search-dismiss" onClick={() => { setSearchQuery(''); setSearchResults(null); }}>
            Dismiss Results
          </button>
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <div className="beta-content">
        {/* ─── LEFT COLUMN ─── */}
        <div className="beta-left-col">
          {/* Project Tree */}
          <div className="beta-section">
            <div className="beta-section-header">
              <span>📊 Projects</span>
              {projectFilter && (
                <button className="beta-filter-clear" onClick={() => setProjectFilter(null)}>Clear filter</button>
              )}
            </div>
            <div className="beta-project-tree">
              {(overview?.projects || []).map(proj => {
                const isExpanded = !!expandedProjects[proj.name];
                const isFiltered = projectFilter === proj.name;
                return (
                  <div key={proj.name} className={`beta-project ${isExpanded ? 'expanded' : ''} ${isFiltered ? 'filtered' : ''}`}>
                    <div className="beta-project-header" onClick={() => toggleProject(proj.name)}>
                      <span className="beta-expand-icon">{isExpanded ? '▾' : '▸'}</span>
                      <span className="beta-project-name">{proj.name}</span>
                      <div className="beta-project-stats">
                        <span>{proj.totalSessions}s</span>
                        <span>{formatTokens(proj.totalTokens)}t</span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="beta-project-body">
                        <button
                          className={`beta-project-filter-btn ${isFiltered ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); setProjectFilter(isFiltered ? null : proj.name); }}
                        >
                          {isFiltered ? '⊘ Remove filter' : '⊕ Filter timeline'}
                        </button>
                        {Object.entries(proj.agents).map(([agentKey, agentData]) => {
                          const agentGroupKey = `${proj.name}_${agentKey}`;
                          const isAgentExpanded = expandedAgents[agentGroupKey] !== false; // default open
                          return (
                            <div key={agentKey} className="beta-agent-group">
                              <div className="beta-agent-group-header" onClick={() => toggleAgent(agentGroupKey)}>
                                <span className={`beta-tl-agent ${agentKey}`}>
                                  {agentKey === 'claude' ? 'C' : 'A'}
                                </span>
                                <span>{agentKey === 'claude' ? 'Claude' : 'Antigravity'}</span>
                                <span className="beta-agent-session-count">{agentData.sessions.length}</span>
                              </div>
                              {isAgentExpanded && agentData.sessions.map(s => (
                                <div
                                  key={s.id}
                                  className="beta-session-item"
                                  onClick={() => onNavigateToSession?.(s.id)}
                                >
                                  <div className="beta-session-title">{s.title}</div>
                                  <div className="beta-session-meta">
                                    <span>{formatDate(s.timestamp)}</span>
                                    <span>{s.nodes} nodes</span>
                                    <span className="s-task-badge">{s.taskType}</span>
                                  </div>
                                  {s.gitBranch && (
                                    <div className="beta-session-branch">🌿 {s.gitBranch}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Worktree Status Board */}
          {overview?.worktrees?.length > 0 && (
            <div className="beta-section">
              <div className="beta-section-header">
                <span>🌿 Worktrees</span>
                <span className="beta-wt-count">{overview.worktrees.length}</span>
              </div>
              <div className="beta-worktree-grid">
                {overview.worktrees.map(wt => (
                  <div key={wt.name} className="beta-worktree-card">
                    <div className="beta-wt-name">{wt.name}</div>
                    <div className="beta-wt-branch">{wt.branch}</div>
                    <div className="beta-wt-meta">
                      <span className="beta-wt-repo">{wt.baseRepo?.split('\\').pop()?.split('/').pop()}</span>
                      <span className="beta-wt-date">{formatDate(wt.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hot Files */}
          <div className="beta-section">
            <div className="beta-section-header">
              <span>🔥 Hot Files</span>
            </div>
            <div className="beta-hot-files">
              {(overview?.hotFiles || []).slice(0, 10).map((f, i) => (
                <div key={i} className="beta-hot-file" onClick={() => openFileInOS(f.filePath)}>
                  <div className="beta-hot-file-row">
                    <span className="beta-hot-file-name" title={f.filePath}>{f.fileName}</span>
                    <span className="beta-hot-file-count">{f.count}</span>
                  </div>
                  <div className="beta-hot-file-bar">
                    <div
                      className="beta-hot-file-bar-fill"
                      style={{ width: `${Math.max(4, (f.count / maxHotFileCount) * 100)}%` }}
                    />
                  </div>
                  <div className="beta-hot-file-meta">
                    <span className={`beta-hot-file-agent ${f.agent?.toLowerCase()}`}>{f.agent}</span>
                    <span className="beta-hot-file-tool">{f.lastTool}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div className="beta-right-col">
          {/* Activity Timeline */}
          <div className="beta-section beta-timeline-section">
            <div className="beta-section-header">
              <span><span className="live-dot" /> Activity Timeline</span>
              <span className="beta-tl-count">{timeline.length} actions</span>
            </div>

            <div className="beta-timeline-filters">
              {['all', 'tool-call', 'user-input', 'artifact', 'thought', 'tool-result'].map(t => (
                <button
                  key={t}
                  className={`beta-tl-filter-btn ${(typeFilter || 'all') === (t === 'all' ? null : t) || (t === 'all' && !typeFilter) ? 'active' : ''}`}
                  onClick={() => setTypeFilter(t === 'all' ? null : t)}
                >
                  {t === 'all' ? 'All' : t.replace('-', ' ')}
                </button>
              ))}
            </div>

            <div className="beta-timeline">
              {timeline.length === 0 && (
                <div className="beta-tl-empty">No actions match the current filters.</div>
              )}
              {timeline.map((action, idx) => (
                <div
                  key={action.id}
                  className={`beta-tl-item ${selectedAction?.id === action.id ? 'selected' : ''}`}
                  onClick={() => inspectAction(action)}
                  style={{ animationDelay: `${Math.min(idx * 0.02, 0.5)}s` }}
                >
                  <div className="beta-tl-time">{formatTime(action.timestamp)}</div>
                  <span className={`beta-tl-agent ${action.agent?.toLowerCase()}`}>
                    {action.agent === 'Claude' ? 'C' : 'A'}
                  </span>
                  <div className="beta-tl-body">
                    <div className="beta-tl-action">
                      <span className={`beta-tl-type-badge ${typeBadgeClass(action.type)}`}>
                        {action.type}
                      </span>
                      {action.toolName && <span className="beta-tl-tool-name">{action.toolName}</span>}
                    </div>
                    {action.fileName && (
                      <div className="beta-tl-file" title={action.filePath}>📄 {action.fileName}</div>
                    )}
                    <div className="beta-tl-context">
                      {action.project} › {action.sessionTitle?.substring(0, 40)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Inspector */}
          <div className="beta-section beta-audit-section">
            <div className="beta-section-header">
              <span>🔍 Audit Inspector</span>
            </div>
            {selectedAction ? (
              <div className="beta-audit">
                <div className="beta-audit-header">
                  <span className={`beta-tl-type-badge ${typeBadgeClass(selectedAction.type)}`}>
                    {selectedAction.type}
                  </span>
                  <span className={`beta-tl-agent ${selectedAction.agent?.toLowerCase()}`}>
                    {selectedAction.agent === 'Claude' ? 'C' : 'A'}
                  </span>
                  <span className="beta-audit-agent-name">{selectedAction.agent}</span>
                </div>

                <div className="beta-audit-fields">
                  {selectedAction.toolName && (
                    <div className="beta-audit-field">
                      <span className="field-label">Tool</span>
                      <span className="field-value">{selectedAction.toolName}</span>
                    </div>
                  )}
                  {selectedAction.fileName && (
                    <div className="beta-audit-field">
                      <span className="field-label">File</span>
                      <span className="field-value clickable" onClick={() => openFileInOS(selectedAction.filePath)}>
                        {selectedAction.fileName} ↗
                      </span>
                    </div>
                  )}
                  <div className="beta-audit-field">
                    <span className="field-label">Session</span>
                    <span
                      className="field-value clickable"
                      onClick={() => onNavigateToSession?.(selectedAction.sessionId)}
                    >
                      {selectedAction.sessionTitle?.substring(0, 60)} →
                    </span>
                  </div>
                  <div className="beta-audit-field">
                    <span className="field-label">Project</span>
                    <span className="field-value">{selectedAction.project}</span>
                  </div>
                  {selectedAction.gitBranch && (
                    <div className="beta-audit-field">
                      <span className="field-label">Branch</span>
                      <span className="field-value">🌿 {selectedAction.gitBranch}</span>
                    </div>
                  )}
                  <div className="beta-audit-field">
                    <span className="field-label">Timestamp</span>
                    <span className="field-value">{new Date(selectedAction.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div className="beta-audit-content">
                  <pre>{fullEntity?.content || selectedAction.contentSnippet || '(loading…)'}</pre>
                </div>
              </div>
            ) : (
              <div className="beta-audit-empty">
                <p>Click any action in the timeline to inspect its full audit trail.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

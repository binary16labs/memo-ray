import React, { useState, useEffect, useMemo } from 'react';
import '../zen.css';

const API = import.meta.env.DEV
  ? `${import.meta.env.VITE_MEMORAY_API || 'http://localhost:3030'}/api`
  : '/api';

export default function OverviewGrid({ onSelectSession }) {
  const [overview, setOverview] = useState(null);
  const [sysMetrics, setSysMetrics] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  // Load backend overview and capabilities data
  useEffect(() => {
    Promise.all([
      fetch(`${API}/beta/overview`).then(r => r.json()),
      fetch(`${API}/system/capabilities`).then(r => r.json())
    ])
    .then(([overviewData, capsData]) => {
      setOverview(overviewData);
      setCapabilities(capsData);
    })
    .catch(e => console.error('Overview/Capabilities fetch failed:', e));
  }, []);

  // Poll system metrics every 3 seconds
  useEffect(() => {
    const fetchMetrics = () => {
      if (document.visibilityState === 'hidden') return; // don't burn CPU for a hidden tab
      fetch(`${API}/system/metrics`)
        .then(r => r.json())
        .then(data => setSysMetrics(data))
        .catch(e => console.error('Metrics fetch failed:', e));
    };

    fetchMetrics(); // initial
    const interval = setInterval(fetchMetrics, 5000);
    document.addEventListener('visibilitychange', fetchMetrics);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', fetchMetrics);
    };
  }, []);

  // Debounced Search Omnibar
  useEffect(() => {
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
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getRecentSessions = () => {
    if (!overview) return [];
    let allSessions = [];
    overview.projects.forEach(p => {
      Object.values(p.agents).forEach(agent => {
        allSessions = allSessions.concat(agent.sessions.map(s => ({ ...s, projectName: p.name })));
      });
    });
    return allSessions.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  };

  const recentSessions = useMemo(getRecentSessions, [overview]);

  if (!overview) {
    return (
      <div className="zen-dashboard" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <h1 className="zen-title">Initializing Command Center...</h1>
      </div>
    );
  }

  // Token velocity pseudo-calc (avg over active sessions)
  // Since we don't have historical tokens tracked per minute backend-side yet,
  // we can display total tokens and a "Live" generic status, or just total for now.
  const totalTokens = overview.totalTokens;

  return (
    <div className="zen-dashboard" style={{ padding: '2rem 3rem', overflowY: 'auto' }}>
      
      {/* OMNIBAR SEARCH */}
      <div style={{ marginBottom: '3rem', position: 'relative' }}>
        <input 
          type="text" 
          placeholder="Omnibar: Search sessions, files, or intents..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '1.5rem 2rem',
            fontSize: '1.5rem',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-emphasis)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-primary)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            outline: 'none'
          }}
        />
        {searchResults && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-emphasis)',
            borderRadius: 'var(--radius-md)', padding: '1rem', marginTop: '0.5rem', zIndex: 100,
            maxHeight: '400px', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <h4 style={{ color: 'var(--text-tertiary)', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase' }}>Sessions</h4>
            {searchResults.sessions?.map(s => (
              <div 
                key={s.id} 
                onClick={() => onSelectSession(s.id)}
                style={{ padding: '0.8rem', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                {s.title || 'Untitled'} <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>({s.nodes} nodes)</span>
              </div>
            ))}
            {searchResults.sessions?.length === 0 && <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No sessions found.</div>}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
        
        {/* WIDGET: SYSTEM RESOURCES */}
        <div className="zen-project-card" style={{ flexDirection: 'column', alignItems: 'flex-start', cursor: 'default' }}>
          <h3 style={{ color: 'var(--text-tertiary)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>System Resources</h3>
          {sysMetrics ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>CPU Load</span>
                  <span style={{ color: 'var(--sage)' }}>{sysMetrics.cpu}%</span>
                </div>
                <div style={{ background: 'var(--bg-deep)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--sage)', height: '100%', width: `${sysMetrics.cpu}%`, transition: 'width 0.3s' }}></div>
                </div>
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>Memory (RAM)</span>
                  <span style={{ color: 'var(--taupe)' }}>{formatBytes(sysMetrics.ram.used)} / {formatBytes(sysMetrics.ram.total)}</span>
                </div>
                <div style={{ background: 'var(--bg-deep)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--taupe)', height: '100%', width: `${sysMetrics.ram.percent}%`, transition: 'width 0.3s' }}></div>
                </div>
              </div>

              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <h4 style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: '1rem' }}>Network Traffic</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>↓ RX:</span> <strong style={{ color: 'var(--text-primary)' }}>{formatBytes(sysMetrics.network.rxSec)}/s</strong></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>↑ TX:</span> <strong style={{ color: 'var(--text-primary)' }}>{formatBytes(sysMetrics.network.txSec)}/s</strong></div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)' }}>Loading sensors...</div>
          )}
        </div>

        {/* WIDGET: TOP PROCESSES */}
        <div className="zen-project-card" style={{ flexDirection: 'column', alignItems: 'flex-start', cursor: 'default' }}>
          <h3 style={{ color: 'var(--text-tertiary)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Top Processes</h3>
          {sysMetrics?.processes ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {sysMetrics.processes.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-deep)', padding: '0.8rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{p.name}</span>
                  <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <span>{p.cpu}% CPU</span>
                    <span>{p.mem} MB</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)' }}>Loading process table...</div>
          )}
        </div>

        {/* WIDGET: AGENT HEALTH & WORKSPACES */}
        <div className="zen-project-card" style={{ flexDirection: 'column', alignItems: 'flex-start', cursor: 'default' }}>
          <h3 style={{ color: 'var(--text-tertiary)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Workspace Ecosystem</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Active Worktrees</span>
              <span style={{ fontSize: '2rem', color: 'var(--text-primary)', fontWeight: '300' }}>{overview.worktrees?.length || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Total Sessions</span>
              <span style={{ fontSize: '2rem', color: 'var(--text-primary)', fontWeight: '300' }}>{overview.totalSessions}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Total Tokens Burned</span>
              <span style={{ fontSize: '2rem', color: 'var(--golden)', fontWeight: '300' }}>{totalTokens.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* WIDGET: AGENT CONTEXT LIMITS */}
        <div className="zen-project-card" style={{ flexDirection: 'column', alignItems: 'flex-start', cursor: 'default' }}>
          <h3 style={{ color: 'var(--text-tertiary)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Agent Context Limits</h3>
          
          {capabilities ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--golden)', fontSize: '1.1rem' }}>Claude 3.5 (Sonnet)</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{capabilities.claude.maxContextTokens.toLocaleString()} max</span>
                </div>
                <div style={{ background: 'var(--bg-deep)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                  {/* Mocking a 15% load for visualization since we don't have live per-session token counts streamed yet */}
                  <div style={{ background: 'var(--golden)', height: '100%', width: `15%` }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--slate)', fontSize: '1.1rem' }}>Antigravity (Gemini 1.5)</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{capabilities.antigravity.maxContextTokens.toLocaleString()} max</span>
                </div>
                <div style={{ background: 'var(--bg-deep)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ background: 'var(--slate)', height: '100%', width: `5%` }}></div>
                </div>
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)', marginTop: '-0.5rem' }}>
                Bars simulate recent session context window saturation.
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)' }}>Loading limits...</div>
          )}
        </div>

        {/* WIDGET: SKILLS & TOOLS REGISTRY */}
        <div className="zen-project-card" style={{ flexDirection: 'column', alignItems: 'flex-start', cursor: 'default', gridColumn: '1 / -1' }}>
          <h3 style={{ color: 'var(--text-tertiary)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>System Capabilities (Skills & Tools)</h3>
          
          {capabilities ? (
            <div style={{ display: 'flex', width: '100%', gap: '3rem' }}>
              
              {/* Antigravity Plugins */}
              <div style={{ flex: 1 }}>
                <h4 style={{ color: 'var(--slate)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ background: 'rgba(138, 154, 164, 0.1)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>Antigravity Plugins</span>
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {capabilities.antigravity.plugins.length > 0 ? capabilities.antigravity.plugins.map(p => (
                    <span key={p} style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      {p}
                    </span>
                  )) : <span style={{ color: 'var(--text-tertiary)' }}>No custom plugins loaded.</span>}
                </div>
              </div>

              {/* Claude MCP Servers */}
              <div style={{ flex: 1 }}>
                <h4 style={{ color: 'var(--golden)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ background: 'rgba(196, 168, 130, 0.1)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>Claude MCP Servers</span>
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {capabilities.claude.mcpServers.length > 0 ? capabilities.claude.mcpServers.map(mcp => (
                    <div key={mcp.name} style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column' }}>
                      <strong>{mcp.name}</strong>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontFamily: 'monospace' }}>{mcp.command}</span>
                    </div>
                  )) : <span style={{ color: 'var(--text-tertiary)' }}>No MCP servers configured.</span>}
                </div>
              </div>

              {/* Antigravity Permissions */}
              <div style={{ flex: 1 }}>
                <h4 style={{ color: 'var(--rust)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ background: 'rgba(196, 122, 106, 0.1)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>Security Scopes</span>
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {capabilities.antigravity.permissions?.length > 0 ? capabilities.antigravity.permissions.map(perm => {
                    const isCmd = perm.startsWith('command');
                    return (
                      <div key={perm} style={{ background: 'var(--bg-deep)', border: `1px solid ${isCmd ? 'var(--moss)' : 'var(--slate)'}`, padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: isCmd ? 'var(--moss)' : 'var(--slate)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                          {isCmd ? 'EXECUTE' : 'READ/WRITE'}
                        </span>
                        <span style={{ fontFamily: 'monospace' }}>{perm.replace(/^(command|read_file|write_file)\(|\)$/g, '')}</span>
                      </div>
                    );
                  }) : <span style={{ color: 'var(--text-tertiary)' }}>No global permissions granted.</span>}
                </div>
              </div>

              {/* opencode capabilities & permission audit */}
              <div style={{ flex: 1 }}>
                <h4 style={{ color: 'var(--moss)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ background: 'rgba(120, 148, 110, 0.12)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>opencode (local)</span>
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.8rem' }}>
                  {capabilities.opencode?.models?.length > 0 ? capabilities.opencode.models.map(m => (
                    <div key={`${m.provider}:${m.id}`} style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column' }}>
                      <strong>{m.name}</strong>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                        {m.provider}{m.contextLimit ? ` · ${(m.contextLimit / 1000).toFixed(0)}k ctx` : ''}
                      </span>
                    </div>
                  )) : <span style={{ color: 'var(--text-tertiary)' }}>opencode not configured.</span>}
                </div>
                {/* MCP servers (if any) */}
                {capabilities.opencode?.mcpServers?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.8rem' }}>
                    {capabilities.opencode.mcpServers.map(mcp => (
                      <span key={mcp.name} style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.75rem' }}>MCP: {mcp.name}</span>
                    ))}
                  </div>
                )}
                {/* Permission grants — the "what is it allowed to do" audit */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {capabilities.opencode && Object.keys(capabilities.opencode.permissions || {}).length > 0
                    ? Object.entries(capabilities.opencode.permissions).map(([action, grant]) => {
                        const g = typeof grant === 'string' ? grant : 'configured';
                        const color = g === 'deny' ? 'var(--rust)' : g === 'ask' ? 'var(--golden)' : 'var(--moss)';
                        return (
                          <div key={action} style={{ background: 'var(--bg-deep)', border: `1px solid ${color}`, padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color, fontSize: '0.65rem', textTransform: 'uppercase' }}>{g}</span>
                            <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{action}</span>
                          </div>
                        );
                      })
                    : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>Default permissions (no explicit grants).</span>}
                </div>
              </div>

              {/* open-notebook capabilities & AI-operation audit */}
              <div style={{ flex: 1 }}>
                <h4 style={{ color: 'var(--taupe)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ background: 'rgba(170, 150, 130, 0.12)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                    open-notebook {capabilities.openNotebook?.reachable ? '' : '(offline)'}
                  </span>
                </h4>
                {/* AI operations it can run against your documents */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.8rem' }}>
                  {capabilities.openNotebook?.transformations?.length > 0 ? capabilities.openNotebook.transformations.map(t => (
                    <span key={t.name} title={t.applyDefault ? 'Runs by default' : ''} style={{ background: 'var(--bg-deep)', border: `1px solid ${t.applyDefault ? 'var(--moss)' : 'var(--border-subtle)'}`, padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.78rem' }}>
                      {t.title}{t.applyDefault ? ' ★' : ''}
                    </span>
                  )) : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>{capabilities.openNotebook?.reachable ? 'No AI operations.' : 'Service not reachable.'}</span>}
                </div>
                {/* Provider / credential status */}
                {capabilities.openNotebook?.reachable && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    Models: <strong style={{ color: 'var(--text-primary)' }}>{capabilities.openNotebook.models?.length || 0}</strong>
                    {' · '}Providers configured: <strong style={{ color: capabilities.openNotebook.providersConfigured?.length ? 'var(--moss)' : 'var(--text-primary)' }}>
                      {capabilities.openNotebook.providersConfigured?.length || 0}
                    </strong>
                    {' · '}Encryption: <strong style={{ color: capabilities.openNotebook.encryptionConfigured ? 'var(--moss)' : 'var(--rust)' }}>
                      {capabilities.openNotebook.encryptionConfigured ? 'on' : 'off'}
                    </strong>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)' }}>Scanning registries...</div>
          )}
        </div>

        {/* WIDGET: LIVE WORKTREES */}
        <div className="zen-project-card" style={{ flexDirection: 'column', alignItems: 'flex-start', cursor: 'default', gridColumn: '1 / 2' }}>
          <h3 style={{ color: 'var(--text-tertiary)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Git Worktrees</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {overview.worktrees?.length > 0 ? overview.worktrees.map(wt => (
              <div key={wt.name} style={{ background: 'var(--bg-deep)', padding: '1rem', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--golden)' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: '500', marginBottom: '0.2rem' }}>{wt.branch}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Repo: {(wt.baseRepo || 'Unknown').split(/[\\/]/).pop()}</div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{new Date(wt.createdAt).toLocaleDateString()}</span>
                  <span style={{ fontFamily: 'monospace' }}>{(wt.name || '').split('-').pop()}</span>
                </div>
              </div>
            )) : <span style={{ color: 'var(--text-tertiary)' }}>No active isolated environments.</span>}
          </div>
        </div>

        {/* WIDGET: FILE HEATMAP */}
        <div className="zen-project-card" style={{ flexDirection: 'column', alignItems: 'flex-start', cursor: 'default', gridColumn: '2 / -1' }}>
          <h3 style={{ color: 'var(--text-tertiary)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>File Memory Heatmap</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
            {overview.hotFiles?.length > 0 ? overview.hotFiles.slice(0, 10).map((file, idx) => {
              const maxCount = overview.hotFiles[0].count;
              const heatPct = (file.count / maxCount) * 100;
              const isClaude = file.agent?.toLowerCase() === 'claude';
              return (
                <div key={file.filePath || idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '20px', color: 'var(--text-tertiary)', fontSize: '0.8rem', textAlign: 'right' }}>#{idx + 1}</div>
                  <div style={{ flex: 1, position: 'relative', background: 'var(--bg-deep)', height: '28px', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${heatPct}%`, background: isClaude ? 'rgba(196, 168, 130, 0.2)' : 'rgba(138, 154, 164, 0.2)', transition: 'width 1s ease-out' }}></div>
                    <span style={{ position: 'relative', zIndex: 1, paddingLeft: '0.8rem', color: 'var(--text-primary)', fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {(file?.fileName || file?.filePath || 'Unknown File').split(/[\\/]/).pop()}
                    </span>
                  </div>
                  <div style={{ width: '40px', color: isClaude ? 'var(--golden)' : 'var(--slate)', fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'right' }}>
                    {file.count}x
                  </div>
                </div>
              );
            }) : <span style={{ color: 'var(--text-tertiary)' }}>No file memory compiled yet.</span>}
          </div>
        </div>

        {/* WIDGET: RECENT SESSIONS */}
        <div className="zen-project-card" style={{ flexDirection: 'column', alignItems: 'flex-start', cursor: 'default', gridColumn: '1 / -1' }}>
          <h3 style={{ color: 'var(--text-tertiary)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Recent Agent Activity</h3>
          
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentSessions.map(s => (
              <div 
                key={s.id} 
                onClick={() => onSelectSession(s.id)}
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  background: 'var(--bg-deep)', padding: '1.2rem', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--sage)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'transparent'}
              >
                <div>
                  <div style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '0.3rem' }}>{s.title || 'Untitled Session'}</div>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>Project: {s.projectName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{new Date(s.timestamp).toLocaleString()}</div>
                  <div style={{ color: 'var(--golden)', fontSize: '0.9rem' }}>{s.nodes} steps</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

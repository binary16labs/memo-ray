import React, { useState, useEffect, useMemo } from 'react';
import '../zen.css';

const API = `${import.meta.env.VITE_MEMORAY_API || 'http://localhost:3001'}/api`;

export default function OverviewGrid({ onSelectSession }) {
  const [overview, setOverview] = useState(null);
  const [sysMetrics, setSysMetrics] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  // Load backend overview data
  useEffect(() => {
    fetch(`${API}/beta/overview`)
      .then(r => r.json())
      .then(data => setOverview(data))
      .catch(e => console.error('Overview fetch failed:', e));
  }, []);

  // Poll system metrics every 3 seconds
  useEffect(() => {
    const fetchMetrics = () => {
      fetch(`${API}/system/metrics`)
        .then(r => r.json())
        .then(data => setSysMetrics(data))
        .catch(e => console.error('Metrics fetch failed:', e));
    };
    
    fetchMetrics(); // initial
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
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

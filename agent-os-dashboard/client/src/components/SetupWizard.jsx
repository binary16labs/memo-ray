import React, { useState, useEffect } from 'react';
import '../zen.css';
import bennyLogo from '../assets/benny.png';

export default function SetupWizard({ API, onComplete }) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [form, setForm] = useState({
    CLAUDE_SESSIONS_DIR: '',
    CLAUDE_LOG_DIRS: '',
    CLAUDE_WORKTREES_PATH: '',
    CLAUDE_CONFIG_PATH: '',
    ANTIGRAVITY_BRAIN_DIRS: '',
    GEMINI_CONFIG_DIR: ''
  });
  const [saving, setSaving] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState({});

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = () => {
    setLoading(true);
    fetch(`${API}/setup/status`)
      .then(r => r.json())
      .then(data => {
        setReport(data);
        
        // Populate form fields
        // Arrays are converted to one path per line in textareas
        setForm({
          CLAUDE_SESSIONS_DIR: data.results.CLAUDE_SESSIONS_DIR.value || '',
          CLAUDE_LOG_DIRS: Array.isArray(data.results.CLAUDE_LOG_DIRS.value)
            ? data.results.CLAUDE_LOG_DIRS.value.join('\n')
            : data.results.CLAUDE_LOG_DIRS.value || '',
          CLAUDE_WORKTREES_PATH: data.results.CLAUDE_WORKTREES_PATH.value || '',
          CLAUDE_CONFIG_PATH: data.results.CLAUDE_CONFIG_PATH.value || '',
          ANTIGRAVITY_BRAIN_DIRS: Array.isArray(data.results.ANTIGRAVITY_BRAIN_DIRS.value)
            ? data.results.ANTIGRAVITY_BRAIN_DIRS.value.join('\n')
            : data.results.ANTIGRAVITY_BRAIN_DIRS.value || '',
          GEMINI_CONFIG_DIR: data.results.GEMINI_CONFIG_DIR.value || ''
        });
        setLoading(false);
      })
      .catch(e => {
        console.error('Failed to fetch setup status', e);
        setLoading(false);
      });
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSaving(true);

    // Parse array inputs back to arrays by splitting lines and filtering out empty lines
    const payload = {
      CLAUDE_SESSIONS_DIR: form.CLAUDE_SESSIONS_DIR.trim(),
      CLAUDE_LOG_DIRS: form.CLAUDE_LOG_DIRS.split('\n').map(p => p.trim()).filter(Boolean),
      CLAUDE_WORKTREES_PATH: form.CLAUDE_WORKTREES_PATH.trim(),
      CLAUDE_CONFIG_PATH: form.CLAUDE_CONFIG_PATH.trim(),
      ANTIGRAVITY_BRAIN_DIRS: form.ANTIGRAVITY_BRAIN_DIRS.split('\n').map(p => p.trim()).filter(Boolean),
      GEMINI_CONFIG_DIR: form.GEMINI_CONFIG_DIR.trim()
    };

    fetch(`${API}/setup/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(res => {
        setSaving(false);
        if (res.status === 'ok') {
          onComplete();
        } else {
          alert('Save failed: ' + res.error);
        }
      })
      .catch(err => {
        console.error('Failed to save configuration', err);
        setSaving(false);
        alert('Failed to connect to the backend server.');
      });
  };

  const handleOpenPath = (pathVal) => {
    if (!pathVal) return;
    fetch(`${API}/open-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathVal })
    })
      .then(r => r.json())
      .then(res => {
        if (res.error) {
          alert('Failed to open path: ' + res.error);
        }
      })
      .catch(err => {
        console.error('Failed to open path', err);
      });
  };

  const getSourceBadge = (source) => {
    switch (source) {
      case 'saved_config':
        return <span className="setup-badge source-saved" title="Loaded from memoray.config.js">Saved Config</span>;
      case 'auto_detected':
        return <span className="setup-badge source-detected" title="Automatically resolved on your machine">Auto-Detected</span>;
      case 'default_guess':
      default:
        return <span className="setup-badge source-guess" title="Not found; displaying recommended default location">Default Guess</span>;
    }
  };

  const toggleTroubleshoot = (key) => {
    setShowTroubleshoot(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="setup-wizard-fullscreen">
        <div className="setup-loading-container">
          <div className="setup-pulse-glow" />
          <h2 className="setup-title">Analyzing Workspace Lineage...</h2>
          <p className="setup-subtitle">Probing directories for Claude Code and Antigravity logs.</p>
        </div>
      </div>
    );
  }

  const keys = [
    { key: 'CLAUDE_SESSIONS_DIR', label: 'Claude Sessions Directory', isArray: false },
    { key: 'CLAUDE_LOG_DIRS', label: 'Claude Code Log Directories', isArray: true },
    { key: 'CLAUDE_WORKTREES_PATH', label: 'Claude Worktrees Track File', isArray: false },
    { key: 'CLAUDE_CONFIG_PATH', label: 'Claude Desktop Configuration File', isArray: false },
    { key: 'ANTIGRAVITY_BRAIN_DIRS', label: 'Antigravity IDE Brain Directories', isArray: true },
    { key: 'GEMINI_CONFIG_DIR', label: 'Gemini Agent Config Directory', isArray: false }
  ];

  return (
    <div className="setup-wizard-fullscreen">
      <div className="setup-card-container">
        <div className="setup-header">
          <div className="setup-logo" style={{ overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            <img src={bennyLogo} alt="Benny" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h1 className="setup-main-title">Memo-Ray Mission Control Setup</h1>
          <p className="setup-subtitle">
            Configure where Memo-Ray scans for agent activities. Verify paths below to unlock your workspace dashboard.
          </p>
        </div>

        <form onSubmit={handleSave} className="setup-form">
          <div className="setup-grid">
            {keys.map(({ key, label, isArray }) => {
              const info = report.results[key];
              const isOk = info.exists;
              return (
                <div key={key} className={`setup-field-card ${isOk ? 'is-valid' : 'is-invalid'}`}>
                  <div className="setup-field-header">
                    <label className="setup-field-label">{label}</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {getSourceBadge(info.source)}
                      {isOk ? (
                        <span className="setup-status-badge status-ok">✓ Folder Found</span>
                      ) : (
                        <span className="setup-status-badge status-missing">⚠ Not Found</span>
                      )}
                    </div>
                  </div>

                  <p className="setup-field-desc">{info.guide}</p>

                  <div className="setup-input-wrapper">
                    {isArray ? (
                      <>
                        <textarea
                          value={form[key]}
                          onChange={e => setForm({ ...form, [key]: e.target.value })}
                          className="setup-textarea"
                          placeholder="One path per line..."
                          rows={2}
                        />
                        <div className="setup-array-open-list" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {form[key].split('\n').map(p => p.trim()).filter(Boolean).map((p, idx) => {
                            const pathExists = info.probed.find(pr => pr.path === p)?.exists;
                            return (
                              <div key={idx} className="setup-array-path-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.35rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%', opacity: 0.8 }} title={p}>{p}</span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenPath(p)}
                                  className="setup-open-btn-small"
                                  disabled={!pathExists}
                                  style={{ 
                                    padding: '2px 8px', 
                                    fontSize: '0.75rem', 
                                    background: pathExists ? '#3b82f6' : 'rgba(255,255,255,0.05)', 
                                    border: 'none', 
                                    borderRadius: '3px', 
                                    color: pathExists ? '#fff' : 'rgba(255,255,255,0.2)', 
                                    cursor: pathExists ? 'pointer' : 'not-allowed' 
                                  }}
                                >
                                  📂 Open
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          value={form[key]}
                          onChange={e => setForm({ ...form, [key]: e.target.value })}
                          className="setup-input"
                          placeholder="Absolute directory path..."
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => handleOpenPath(form[key])}
                          className="setup-open-btn"
                          disabled={!isOk}
                          title="Open in File Explorer"
                        >
                          📂 Open
                        </button>
                      </div>
                    )}
                  </div>

                  {!isOk && (
                    <div className="setup-troubleshoot-area">
                      <button
                        type="button"
                        onClick={() => toggleTroubleshoot(key)}
                        className="setup-troubleshoot-toggle"
                      >
                        {showTroubleshoot[key] ? 'Hide Probing Info ▲' : 'Show Probing Info ▼'}
                      </button>
                      
                      {showTroubleshoot[key] && (
                        <div className="setup-troubleshoot-logs">
                          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Paths checked during startup:</p>
                          {info.probed.map((prob, i) => (
                            <div key={i} className="setup-probed-item">
                              <span className={`probed-dot ${prob.exists ? 'found' : 'missing'}`} />
                              <span className="probed-path" title={prob.path}>{prob.path}</span>
                              <span className="probed-result">{prob.exists ? '(found)' : '(not found)'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {report && report.memoray && (
            <div className="setup-field-card is-valid" style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', marginTop: '1rem' }}>
              <div className="setup-field-header">
                <label className="setup-field-label">Memo-Ray System Storage</label>
                <span className="setup-status-badge status-ok">✓ Active</span>
              </div>
              <p className="setup-field-desc">Internal settings configuration file and sync database directory for the Memo-Ray dashboard itself.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.85rem', opacity: 0.7, fontFamily: 'monospace' }}>Config: {report.memoray.configPath}</span>
                  {report.memoray.configExists && (
                    <button
                      type="button"
                      onClick={() => handleOpenPath(report.memoray.configPath)}
                      className="setup-open-btn"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                    >
                      📂 Open File
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.85rem', opacity: 0.7, fontFamily: 'monospace' }}>Database: {report.memoray.dataDir}</span>
                  {report.memoray.dataExists && (
                    <button
                      type="button"
                      onClick={() => handleOpenPath(report.memoray.dataDir)}
                      className="setup-open-btn"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                    >
                      📂 Open Folder
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="setup-actions">
            <button
              type="button"
              onClick={fetchStatus}
              className="setup-btn-secondary"
              disabled={saving}
            >
              🔄 Rescan System
            </button>
            <button
              type="submit"
              className="setup-btn-primary"
              disabled={saving}
            >
              {saving ? 'Launching...' : '🚀 Launch Mission Control'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

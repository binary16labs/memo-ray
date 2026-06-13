import React, { useState, useEffect, useCallback, useRef } from 'react';
import OrganicGraph from './OrganicGraph';
import '../zen.css';

const API = `${import.meta.env.VITE_MEMORAY_API || 'http://localhost:3001'}/api`;

// Helper for Smart Grouping
const READ_TOOLS = ['grep_search', 'list_dir', 'view_file', 'search_web', 'read_url_content', 'read_file'];

function groupTimeline(rawActions) {
  const grouped = [];
  let currentGroup = null;

  for (const action of rawActions) {
    const isReadOnly = action.type === 'Tool Call' && READ_TOOLS.includes(action.toolName);
    
    if (isReadOnly) {
      if (!currentGroup) {
        currentGroup = {
          isGroup: true,
          type: 'Tool Group',
          agent: action.agent,
          timestamp: action.timestamp,
          items: [action],
          id: `group-${action.id}`
        };
        grouped.push(currentGroup);
      } else {
        currentGroup.items.push(action);
        // Update timestamp to the latest
        currentGroup.timestamp = action.timestamp;
      }
    } else {
      currentGroup = null;
      grouped.push(action);
    }
  }
  return grouped;
}

// Generate plain English explanation for actions
function getActionHeroText(action) {
  if (!action) return '';
  const agentName = action.agent === 'Claude' ? 'Claude' : 'Antigravity';
  
  if (action.isGroup) {
    return `${agentName} spent ${action.items.length} steps researching and reading files.`;
  }

  if (action.type === 'Tool Call') {
    if (action.toolName === 'replace_file_content' || action.toolName === 'write_to_file' || action.toolName === 'multi_replace_file_content') {
      return `${agentName} edited ${action.fileName || 'a file'}.`;
    }
    if (action.toolName === 'run_command') {
      return `${agentName} ran a terminal command.`;
    }
    return `${agentName} used the ${action.toolName} tool.`;
  }
  
  if (action.type === 'User Input') {
    return `You provided new instructions to ${agentName}.`;
  }
  
  if (action.type === 'Thought' || action.type === 'PLANNER_RESPONSE') {
    return `${agentName} stopped to think and plan the next move.`;
  }

  if (action.type === 'Tool Result') {
    return `${agentName} received the results of the tool execution.`;
  }

  if (action.type === 'Artifact') {
    return `${agentName} created an artifact: ${action.fileName || 'Untitled'}.`;
  }

  return `${agentName} performed an action (${action.type}).`;
}

// Check if an action is a milestone
function isMilestone(action) {
  if (action.isGroup) return false;
  if (action.type === 'User Input' || action.type === 'Artifact') return true;
  if (action.type === 'Tool Call' && action.toolName === 'run_command') {
    const snippet = action.contentSnippet || '';
    if (snippet.includes('git commit') || snippet.includes('npm run build')) return true;
  }
  return false;
}

// Simple Diff Renderer
function renderDiff(contentStr) {
  try {
    const parsed = JSON.parse(contentStr);
    
    // For replace_file_content
    if (parsed.TargetContent && parsed.ReplacementContent) {
      return (
        <div className="zen-diff">
          <div className="zen-diff-chunk">
            {parsed.TargetContent.split('\n').map((line, i) => (
              <div key={`old-${i}`} className="zen-diff-line removed">- {line}</div>
            ))}
            {parsed.ReplacementContent.split('\n').map((line, i) => (
              <div key={`new-${i}`} className="zen-diff-line added">+ {line}</div>
            ))}
          </div>
        </div>
      );
    }

    // For multi_replace_file_content
    if (parsed.ReplacementChunks && Array.isArray(parsed.ReplacementChunks)) {
      return (
        <div className="zen-diff">
          {parsed.ReplacementChunks.map((chunk, ci) => (
            <div key={`chunk-${ci}`} className="zen-diff-chunk">
              {(chunk.TargetContent || '').split('\n').map((line, i) => (
                <div key={`old-${ci}-${i}`} className="zen-diff-line removed">- {line}</div>
              ))}
              {(chunk.ReplacementContent || '').split('\n').map((line, i) => (
                <div key={`new-${ci}-${i}`} className="zen-diff-line added">+ {line}</div>
              ))}
            </div>
          ))}
        </div>
      );
    }
    
    return <pre>{JSON.stringify(parsed, null, 2)}</pre>;
  } catch (e) {
    return <pre>{contentStr}</pre>;
  }
}

export default function BetaDashboard({ onNavigateToSession }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLiveSyncing, setIsLiveSyncing] = useState(false);
  
  // Phase state: 'projects' -> 'sessions' -> 'step-through'
  const [phase, setPhase] = useState('projects');
  
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Timeline state for step-through
  const [timeline, setTimeline] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [fullEntity, setFullEntity] = useState(null);

  // Graph state for step-through
  const [showGraph, setShowGraph] = useState(false);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const graphRef = useRef();

  // Features state
  const [narratorEnabled, setNarratorEnabled] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [whyText, setWhyText] = useState('');

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [configData, setConfigData] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Refs for Gamepad polling
  const requestRef = useRef();
  const lastGamepadState = useRef({});

  // Initial Load & Background Auto-Sync
  useEffect(() => {
    // Initial fetch
    setLoading(true);
    fetch(`${API}/beta/overview`)
      .then(r => r.json())
      .then(data => { setOverview(data); setLoading(false); })
      .catch(err => { console.error('Overview failed:', err); setLoading(false); });

    // Background polling (every 10 seconds)
    const interval = setInterval(() => {
      setIsLiveSyncing(true);
      fetch(`${API}/sync`)
        .then(() => fetch(`${API}/beta/overview`))
        .then(r => r.json())
        .then(data => {
          setOverview(data);
          
          // If we are looking at a specific project, optionally update selectedProject stats
          // but we rely on rendering from `overview` where possible to keep it simple.
          
          setTimeout(() => setIsLiveSyncing(false), 800); // give the pulse time to show
        })
        .catch(() => setIsLiveSyncing(false));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Load timeline when session is selected
  useEffect(() => {
    if (phase === 'step-through' && selectedSession) {
      setLoading(true);
      fetch(`${API}/beta/timeline?limit=2000&project=${encodeURIComponent(selectedSession.project)}`)
        .then(r => r.json())
        .then(data => {
          // Filter to this session, reverse for chronological order
          const sessionActions = (data || [])
            .filter(a => a.sessionId === selectedSession.id)
            .reverse();
          
          // Apply smart grouping
          const grouped = groupTimeline(sessionActions);
          setTimeline(grouped);
          setCurrentStepIndex(0);
          setShowWhy(false);
          setLoading(false);
        })
        .catch(err => { console.error('Timeline failed:', err); setLoading(false); });
    } else {
      // Cancel speech if leaving phase
      window.speechSynthesis.cancel();
    }
  }, [phase, selectedSession]);

  // Load full entity for the current step
  useEffect(() => {
    if (phase === 'step-through' && timeline.length > 0) {
      const currentAction = timeline[currentStepIndex];
      setShowWhy(false); // Reset why text on new step
      
      // Handle "Why" calculation (find previous thought)
      let foundWhy = "No specific thought log found immediately preceding this action.";
      for (let i = currentStepIndex - 1; i >= 0; i--) {
        const past = timeline[i];
        if (!past.isGroup && (past.type === 'Thought' || past.type === 'PLANNER_RESPONSE') && past.agent === currentAction.agent) {
          // Extract first sentence loosely
          const snippet = past.contentSnippet || '';
          foundWhy = snippet.split(/[.?\n]/)[0] + '.';
          break;
        }
      }
      setWhyText(foundWhy);

      if (currentAction.isGroup) {
        setFullEntity(null);
      } else {
        setFullEntity(null);
        fetch(`${API}/entities/${currentAction.id}`)
          .then(r => r.json())
          .then(data => setFullEntity(data))
          .catch(() => setFullEntity(null));
      }

      // Trigger Narrator
      if (narratorEnabled) {
        window.speechSynthesis.cancel();
        const text = getActionHeroText(currentAction);
        const msg = new SpeechSynthesisUtterance(text);
        // Try to pick a softer voice if available
        const voices = window.speechSynthesis.getVoices();
        const softVoice = voices.find(v => v.name.includes('Samantha') || v.name.includes('Google US English'));
        if (softVoice) msg.voice = softVoice;
        msg.rate = 0.9;
        window.speechSynthesis.speak(msg);
      }
    }
  }, [currentStepIndex, timeline, phase, narratorEnabled]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (phase !== 'step-through') return;
      if (e.key === 'ArrowRight') {
        setCurrentStepIndex(prev => Math.min(prev + 1, timeline.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStepIndex(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, timeline.length]);

  // Gamepad polling
  const pollGamepads = useCallback(() => {
    if (phase === 'step-through') {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;

        // Bumper Right (Next)
        const rbPressed = gp.buttons[5]?.pressed;
        // Bumper Left (Prev)
        const lbPressed = gp.buttons[4]?.pressed;
        // D-Pad Right
        const rightPressed = gp.buttons[15]?.pressed;
        // D-Pad Left
        const leftPressed = gp.buttons[14]?.pressed;

        const nextTrigger = rbPressed || rightPressed;
        const prevTrigger = lbPressed || leftPressed;

        const stateKey = `gp-${gp.index}`;
        const prevState = lastGamepadState.current[stateKey] || {};

        if (nextTrigger && !prevState.next) {
          setCurrentStepIndex(prev => Math.min(prev + 1, timeline.length - 1));
        }
        if (prevTrigger && !prevState.prev) {
          setCurrentStepIndex(prev => Math.max(prev - 1, 0));
        }

        lastGamepadState.current[stateKey] = { next: nextTrigger, prev: prevTrigger };
      }
    }
    requestRef.current = requestAnimationFrame(pollGamepads);
  }, [phase, timeline.length]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(pollGamepads);
    return () => cancelAnimationFrame(requestRef.current);
  }, [pollGamepads]);

  const handleProjectSelect = (proj) => {
    setSelectedProject(proj);
    setPhase('sessions');
  };

  const handleSessionSelect = (session, projName) => {
    setSelectedSession({ ...session, project: projName });
    setLoading(true);
    setPhase('step-through');
    
    // Fetch timeline
    fetch(`${API}/timeline/${session.id}`)
      .then(r => r.json())
      .then(data => {
        const sorted = data.sort((a, b) => a.timestamp - b.timestamp);
        const grouped = groupTimeline(sorted);
        setTimeline(grouped);
        setCurrentStepIndex(0);
        setLoading(false);
      })
      .catch(err => {
        console.error('Timeline fetch failed', err);
        setLoading(false);
      });

    // Fetch graph data independently
    fetch(`${API}/graph/${session.id}?limit=200`)
      .then(r => r.json())
      .then(data => {
        setGraphData(data);
      })
      .catch(err => console.error('Graph fetch failed', err));
  };

  if (loading && phase === 'projects') {
    return (
      <div className="zen-dashboard">
        <div className="zen-project-phase">
          <div className="zen-title">Waking up agents...</div>
        </div>
      </div>
    );
  }

  const toggleNarrator = () => {
    if (narratorEnabled) window.speechSynthesis.cancel();
    setNarratorEnabled(!narratorEnabled);
  };

  const currentAction = timeline[currentStepIndex];

  // Sparkline Component
  const Sparkline = ({ data }) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data, 1); // Avoid division by zero
    return (
      <div className="zen-sparkline-container" title="14-day activity">
        {data.map((val, i) => (
          <div 
            key={i} 
            className="zen-spark-bar" 
            style={{ height: `${(val / max) * 100}%` }}
            title={`${val} nodes`}
          />
        ))}
      </div>
    );
  };

  // Settings Handlers
  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
    setSettingsLoading(true);
    fetch(`${API}/config`)
      .then(r => r.json())
      .then(data => {
        setConfigData(data);
        setSettingsLoading(false);
      })
      .catch(e => {
        console.error('Failed to load config', e);
        setSettingsLoading(false);
      });
  };

  const handleSaveSettings = () => {
    setSettingsLoading(true);
    fetch(`${API}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData)
    })
    .then(r => r.json())
    .then(res => {
      alert(res.message);
      setIsSettingsOpen(false);
      setSettingsLoading(false);
    })
    .catch(e => {
      console.error('Save failed', e);
      alert('Failed to save config.');
      setSettingsLoading(false);
    });
  };

  const handleForceSync = () => {
    setIsLiveSyncing(true);
    fetch(`${API}/sync`)
      .then(() => fetch(`${API}/beta/overview`))
      .then(r => r.json())
      .then(data => {
        setOverview(data);
        setIsLiveSyncing(false);
        setIsSettingsOpen(false); // optionally close settings
      })
      .catch(() => setIsLiveSyncing(false));
  };

  const handleOpenFolder = (e, projPath) => {
    e.stopPropagation();
    if (!projPath) return;
    fetch(`${API}/open-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projPath })
    }).catch(err => console.error('Failed to open folder', err));
  };

  return (
    <div className="zen-dashboard">
      
      {/* Persistent Breadcrumb Navigation Bar */}
      <div className="zen-breadcrumb-bar">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div 
            className={`zen-breadcrumb-segment ${phase === 'projects' ? 'active' : ''}`}
            onClick={() => { setPhase('projects'); setSelectedProject(null); setSelectedSession(null); setSearchQuery(''); }}
          >
            🏠 Projects
          </div>
          
          {selectedProject && (
            <>
              <span className="zen-breadcrumb-separator">/</span>
              <div 
                className={`zen-breadcrumb-segment ${phase === 'sessions' ? 'active' : ''}`}
                onClick={() => { setPhase('sessions'); setSelectedSession(null); }}
              >
                {selectedProject.name}
              </div>
            </>
          )}
          
          {selectedSession && (
            <>
              <span className="zen-breadcrumb-separator">/</span>
              <div className={`zen-breadcrumb-segment ${phase === 'step-through' ? 'active' : ''}`}>
                {selectedSession.title || 'Session'}
              </div>
            </>
          )}
        </div>
        
        {/* Live Sync Indicator & Settings Cog */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="zen-live-sync" title="Auto-syncing every 10 seconds">
            <span className={`zen-sync-dot ${isLiveSyncing ? 'syncing' : ''}`}></span>
            Live Sync
          </div>
          <button className="zen-settings-btn" onClick={handleOpenSettings} title="Settings">
            ⚙️
          </button>
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="zen-modal-overlay">
          <div className="zen-modal-content">
            <div className="zen-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="zen-title" style={{ margin: 0, fontSize: '1.5rem' }}>Configuration</h2>
              <button onClick={() => setIsSettingsOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-tertiary)' }}>×</button>
            </div>
            
            <div style={{ marginBottom: '2rem', padding: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)' }}>Manual Synchronization</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Force the server to parse all logs right now.</span>
              </div>
              <button 
                className="zen-btn" 
                onClick={handleForceSync}
                disabled={isLiveSyncing}
                style={{ background: 'var(--sage)', color: 'var(--bg-base)' }}
              >
                {isLiveSyncing ? 'Syncing...' : 'Force Sync'}
              </button>
            </div>

            {settingsLoading ? (
              <div>Loading config...</div>
            ) : configData ? (
              <div className="zen-settings-form">
                <div className="zen-form-group">
                  <label>Claude Sessions Directory (PIDs)</label>
                  <input type="text" value={configData.CLAUDE_SESSIONS_DIR} onChange={e => setConfigData({...configData, CLAUDE_SESSIONS_DIR: e.target.value})} className="zen-search-input" style={{ width: '100%' }} />
                </div>
                <div className="zen-form-group">
                  <label>Claude Worktrees File</label>
                  <input type="text" value={configData.CLAUDE_WORKTREES_PATH} onChange={e => setConfigData({...configData, CLAUDE_WORKTREES_PATH: e.target.value})} className="zen-search-input" style={{ width: '100%' }} />
                </div>
                <div className="zen-form-group">
                  <label>Claude Desktop Config</label>
                  <input type="text" value={configData.CLAUDE_CONFIG_PATH} onChange={e => setConfigData({...configData, CLAUDE_CONFIG_PATH: e.target.value})} className="zen-search-input" style={{ width: '100%' }} />
                </div>
                <div className="zen-form-group">
                  <label>Gemini Config Directory</label>
                  <input type="text" value={configData.GEMINI_CONFIG_DIR} onChange={e => setConfigData({...configData, GEMINI_CONFIG_DIR: e.target.value})} className="zen-search-input" style={{ width: '100%' }} />
                </div>
                
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '1rem' }}>
                  Note: Editing these will write directly to <code>memoray.config.js</code>. The server requires a restart after saving. Array paths (like CLAUDE_LOG_DIRS) must currently be edited in the file manually.
                </p>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                  <button className="zen-btn" onClick={() => setIsSettingsOpen(false)} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Cancel</button>
                  <button className="zen-btn" onClick={handleSaveSettings} style={{ background: 'var(--sage)', color: 'var(--bg-base)' }}>Save Changes</button>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--danger)' }}>Failed to load configuration.</div>
            )}
          </div>
        </div>
      )}

      {/* PHASE 1: Project Selection */}
      {phase === 'projects' && (
        <div className="zen-project-phase" style={{ flexDirection: 'row', alignItems: 'flex-start', padding: '4rem', gap: '4rem' }}>
          
          <div style={{ flex: 1 }}>
            <h1 className="zen-title">Mission Control</h1>
            <p className="zen-subtitle">Select a workspace to review its agent activity.</p>
            <div className="zen-project-list">
              {(overview?.projects || []).map(proj => (
                <div key={proj.name} className="zen-project-card" onClick={() => handleProjectSelect(proj)}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                    <div className="zen-project-name" title={proj.name}>
                      {proj.hasActive && <span className="zen-active-badge" title="Active session running"></span>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{proj.name}</span>
                      
                      {/* Determine an actual path for the project: try worktrees first */}
                      {(proj.worktrees && proj.worktrees.length > 0 && proj.worktrees[0].baseRepo) && (
                        <button 
                          className="zen-open-folder-btn" 
                          onClick={(e) => handleOpenFolder(e, proj.worktrees[0].baseRepo)}
                          title="Open in File Explorer"
                        >
                          📂
                        </button>
                      )}
                    </div>
                    
                    <div className="zen-agent-indicator">
                      {proj.agents.claude && <><span className="zen-agent-dot claude" title="Claude Code"></span> {proj.agents.claude.sessions.length}</>}
                      {proj.agents.claude && proj.agents.antigravity && <span style={{ opacity: 0.3 }}>|</span>}
                      {proj.agents.antigravity && <><span className="zen-agent-dot antigravity" title="Antigravity IDE"></span> {proj.agents.antigravity.sessions.length}</>}
                    </div>
                    <div className="zen-project-meta" style={{ marginTop: '0.5rem' }}>
                      <span>{proj.totalSessions} Sessions</span>
                      <span>{proj.fileCount} Files</span>
                      <span>
                        {proj.totalTokens > 0 ? 
                          `${(proj.totalTokens / 1000000).toFixed(2)}M Tokens (~$${((proj.totalTokens / 1000000) * 5.0).toFixed(2)})` : 
                          ''}
                      </span>
                    </div>
                    {proj.worktrees && proj.worktrees.length > 0 && (
                      <div className="zen-worktree-pills">
                        {proj.worktrees.slice(0, 3).map(wt => (
                          <span key={wt.name} className="zen-worktree-pill" title={`Branch: ${wt.branch}`}>
                            🌲 {wt.name}
                          </span>
                        ))}
                        {proj.worktrees.length > 3 && (
                          <span className="zen-worktree-pill">+{proj.worktrees.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <Sparkline data={proj.dailyNodes} />
                </div>
              ))}
            </div>
          </div>

          {/* Hot Files Radar Sidebar */}
          {overview?.hotFiles && overview.hotFiles.length > 0 && (
            <div className="zen-hotspots-sidebar">
              <h2 className="zen-section-title">🔥 Code Hotspots</h2>
              <p className="zen-subtitle" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>Files heavily edited across all agents.</p>
              <div className="zen-hot-files-list">
                {overview.hotFiles.map(hf => (
                  <div key={hf.filePath} className="zen-hot-file-item">
                    <div className="zen-hot-file-name" title={hf.filePath}>{hf.fileName}</div>
                    <div className="zen-hot-file-count">{hf.count} edits</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
        </div>
      )}

      {/* PHASE 2: Session Selection & Worktree Detail */}
      {phase === 'sessions' && selectedProject && (
        <div className="zen-project-phase" style={{ paddingTop: '2rem' }}>
          
          <h1 className="zen-title">
            {selectedProject.hasActive && <span className="zen-active-badge"></span>}
            {selectedProject.name}
          </h1>
          <p className="zen-subtitle">Review worktrees and recent agent sessions.</p>
          
          {/* Worktrees Section */}
          {selectedProject.worktrees && selectedProject.worktrees.length > 0 && (
            <div className="zen-worktrees-section">
              <div className="zen-section-title">Active Worktrees ({selectedProject.worktrees.length})</div>
              <div className="zen-worktree-cards">
                {selectedProject.worktrees.map(wt => (
                  <div key={wt.name} className="zen-worktree-card">
                    <div className="zen-worktree-title">
                      <span>{wt.name}</span>
                      {wt.hasActive && <span className="zen-active-badge"></span>}
                    </div>
                    <div className="zen-worktree-meta">
                      <span>Branch: <strong>{wt.branch?.replace('claude/', '')}</strong></span>
                      <span>Created: {wt.ageDays} days ago</span>
                      <span>Sessions: {wt.sessionCount}</span>
                      <span className={`zen-disk-status ${wt.existsOnDisk ? 'exists' : 'missing'}`}>
                        {wt.existsOnDisk ? '✅ On disk' : '❌ Removed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sessions Section */}
          <div className="zen-session-list">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <div className="zen-section-title" style={{ border: 'none', margin: 0, padding: 0 }}>All Sessions</div>
              <input 
                type="text" 
                className="zen-search-input" 
                placeholder="Search sessions, branches, entrypoints..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            {Object.entries(selectedProject.agents).map(([agentKey, agentData]) => {
              // Apply search filter
              const sq = searchQuery.toLowerCase();
              const filteredSessions = agentData.sessions.filter(s => 
                !sq || 
                (s.title || '').toLowerCase().includes(sq) || 
                (s.gitBranch || '').toLowerCase().includes(sq) ||
                (s.entrypoint || '').toLowerCase().includes(sq)
              );

              if (filteredSessions.length === 0) return null;
              return (
                <div key={agentKey}>
                  <div className={`zen-agent-group-header ${agentKey}`}>
                    {agentKey === 'claude' ? 'Claude' : 'Antigravity'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredSessions.map(s => (
                      <div key={s.id} className="zen-session-card" onClick={() => handleSessionSelect(s, selectedProject.name)}>
                        <div className="zen-session-title">
                          {s.isActive && <span className="zen-active-badge" title="Currently Active"></span>}
                          {s.title || 'Untitled Session'}
                        </div>
                        <div className="zen-session-date" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span>{new Date(s.timestamp).toLocaleString()}</span>
                          <span>·</span>
                          <span>{s.nodes} steps</span>
                          {s.entrypoint && (
                            <>
                              <span>·</span>
                              <span className="zen-entrypoint-badge">{s.entrypoint}</span>
                            </>
                          )}
                          {s.gitBranch && (
                            <>
                              <span>·</span>
                              <span className="zen-worktree-pill" style={{ padding: '0 0.4rem', fontSize: '0.75rem' }}>
                                🌿 {s.gitBranch.replace('claude/', '')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PHASE 3: Step-Through Audit */}
      {phase === 'step-through' && (
        <div className="zen-step-phase">
          <div className="zen-step-header">
            <div className="zen-step-header-top">
              <button className="zen-back-btn" style={{ margin: 0 }} onClick={() => setPhase('sessions')}>
                ← Exit
              </button>
              
              <div className="zen-controls-group">
                <button className={`zen-toggle-btn ${narratorEnabled ? 'active' : ''}`} onClick={toggleNarrator}>
                  {narratorEnabled ? '🔊 Narrator On' : '🔈 Narrator Off'}
                </button>
                <button className={`zen-toggle-btn ${showGraph ? 'active' : ''}`} onClick={() => setShowGraph(!showGraph)}>
                  {showGraph ? '🗺️ Hide Map' : '🗺️ Show Map'}
                </button>
                <div className="zen-step-progress">
                  Step {timeline.length > 0 ? currentStepIndex + 1 : 0} of {timeline.length}
                </div>
              </div>

              <div className="zen-step-nav">
                <button className="zen-nav-btn" onClick={() => setCurrentStepIndex(prev => Math.max(prev - 1, 0))} disabled={currentStepIndex === 0 || timeline.length === 0}>
                  ← Previous
                </button>
                <button className="zen-nav-btn" onClick={() => setCurrentStepIndex(prev => Math.min(prev + 1, timeline.length - 1))} disabled={currentStepIndex >= timeline.length - 1 || timeline.length === 0}>
                  Next →
                </button>
              </div>
            </div>

            {/* Milestones Bar */}
            <div className="zen-milestones-bar">
              {timeline.map((act, idx) => {
                const milestone = isMilestone(act);
                const past = idx <= currentStepIndex;
                const active = idx === currentStepIndex;
                return (
                  <div 
                    key={act.id} 
                    onClick={() => setCurrentStepIndex(idx)}
                    className={`zen-milestone-segment ${milestone ? 'is-milestone' : ''} ${past ? 'past' : ''} ${active ? 'active' : ''}`}
                    title={milestone ? getActionHeroText(act) : ''}
                  />
                );
              })}
            </div>
          </div>

          <div className="zen-step-content" style={{ display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box' }}>
            {loading ? (
              <div className="zen-title">Loading timeline...</div>
            ) : timeline.length === 0 ? (
              <div className="zen-title">No actions found for this session.</div>
            ) : (
              <>
              <div style={{ position: 'relative', width: '100%', height: showGraph ? '600px' : 'auto', display: 'flex' }}>
                
                {/* Explain Pane / Action Card */}
                <div 
                  className="zen-action-card" 
                  style={{ 
                    width: showGraph ? '400px' : '100%',
                    position: showGraph ? 'absolute' : 'relative',
                    top: showGraph ? '1rem' : '0',
                    left: showGraph ? '1rem' : '0',
                    zIndex: 20,
                    maxHeight: showGraph ? '560px' : 'none',
                    overflowY: 'auto',
                    backgroundColor: showGraph ? 'rgba(34, 38, 36, 0.95)' : 'var(--bg-surface)',
                    backdropFilter: showGraph ? 'blur(12px)' : 'none',
                    boxShadow: showGraph ? '0 8px 32px rgba(0,0,0,0.5)' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div className="zen-action-hero">
                    {getActionHeroText(currentAction)}
                  </div>
                  
                  <div className="zen-action-meta">
                    <span className={`zen-action-agent ${currentAction.agent?.toLowerCase()}`}>
                      {currentAction.agent}
                    </span>
                    <span>{new Date(currentAction.timestamp).toLocaleTimeString()}</span>
                    {currentAction.fileName && (
                      <span>📄 {currentAction.fileName}</span>
                    )}
                    {currentAction.toolName && (
                      <span>🔧 {currentAction.toolName}</span>
                    )}
                    
                    {/* The Why Button */}
                    {!currentAction.isGroup && (
                      <button className="zen-toggle-btn" onClick={() => setShowWhy(!showWhy)}>
                        {showWhy ? 'Hide Intent' : '🤔 Why?'}
                      </button>
                    )}
                  </div>

                  {showWhy && (
                    <div className="zen-why-box">
                      <strong>Intent:</strong> {whyText}
                    </div>
                  )}

                  {/* Content Viewer (Raw, Diff, or Group Info) */}
                  <div className="zen-file-viewer">
                    {currentAction.isGroup ? (
                      <div style={{ color: 'var(--text-tertiary)', textAlign: 'center' }}>
                        <p>Grouped {currentAction.items.length} read operations to reduce noise.</p>
                        <p style={{ fontSize: '0.9em', marginTop: '1rem' }}>
                          Includes: {Array.from(new Set(currentAction.items.map(i => i.toolName))).join(', ')}
                        </p>
                      </div>
                    ) : (
                      currentAction.toolName === 'replace_file_content' || currentAction.toolName === 'multi_replace_file_content' ? (
                        renderDiff(fullEntity?.content || '')
                      ) : (
                        <pre>
                          {fullEntity?.content || currentAction.contentSnippet || '(Loading content...)'}
                        </pre>
                      )
                    )}
                  </div>
                </div>

                {/* Full Width Graph Map Panel */}
                {showGraph && graphData.nodes.length > 0 && (
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', overflow: 'hidden' }}>
                    <OrganicGraph 
                      data={graphData} 
                      highlightNodeIds={currentAction?.isGroup ? currentAction.items.map(i => i.id) : [currentAction?.id]}
                      onNodeClick={(node) => {
                        // Attempt to find this node in the timeline
                        const index = timeline.findIndex(step => {
                          if (step.isGroup) {
                            return step.items.some(i => i.id === node.id);
                          }
                          return step.id === node.id;
                        });
                        if (index !== -1) {
                          setCurrentStepIndex(index);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

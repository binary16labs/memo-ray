import React, { useState, useEffect, useCallback } from 'react';
import '../zen.css';

const API = `${import.meta.env.VITE_MEMORAY_API || 'http://localhost:3001'}/api`;

export default function BetaDashboard({ onNavigateToSession }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Phase state: 'projects' -> 'sessions' -> 'step-through'
  const [phase, setPhase] = useState('projects');
  
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  
  // Timeline state for step-through
  const [timeline, setTimeline] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [fullEntity, setFullEntity] = useState(null);

  // Load overview
  useEffect(() => {
    setLoading(true);
    fetch(`${API}/beta/overview`)
      .then(r => r.json())
      .then(data => { setOverview(data); setLoading(false); })
      .catch(err => { console.error('Overview failed:', err); setLoading(false); });
  }, []);

  // Load timeline when session is selected
  useEffect(() => {
    if (phase === 'step-through' && selectedSession) {
      setLoading(true);
      fetch(`${API}/beta/timeline?limit=500&project=${encodeURIComponent(selectedSession.project)}`)
        .then(r => r.json())
        .then(data => {
          // Filter to just this session's actions, reverse to get chronological order (oldest first)
          const sessionActions = (data || [])
            .filter(a => a.sessionId === selectedSession.id)
            .reverse();
          setTimeline(sessionActions);
          setCurrentStepIndex(0);
          setLoading(false);
        })
        .catch(err => { console.error('Timeline failed:', err); setLoading(false); });
    }
  }, [phase, selectedSession]);

  // Load full entity for the current step
  useEffect(() => {
    if (phase === 'step-through' && timeline.length > 0) {
      const currentAction = timeline[currentStepIndex];
      setFullEntity(null);
      fetch(`${API}/entities/${currentAction.id}`)
        .then(r => r.json())
        .then(data => setFullEntity(data))
        .catch(() => setFullEntity(null));
    }
  }, [currentStepIndex, timeline, phase]);

  const handleProjectSelect = (proj) => {
    setSelectedProject(proj);
    setPhase('sessions');
  };

  const handleSessionSelect = (session, projName) => {
    setSelectedSession({ ...session, project: projName });
    setPhase('step-through');
  };

  const handleNext = () => {
    if (currentStepIndex < timeline.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
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

  // Generate plain English explanation for actions
  const getActionHeroText = (action) => {
    if (!action) return '';
    const agentName = action.agent === 'Claude' ? 'Claude' : 'Antigravity';
    
    if (action.type === 'Tool Call') {
      if (action.toolName === 'replace_file_content' || action.toolName === 'write_to_file' || action.toolName === 'multi_replace_file_content') {
        return `${agentName} edited ${action.fileName || 'a file'}.`;
      }
      if (action.toolName === 'run_command') {
        return `${agentName} ran a terminal command.`;
      }
      if (action.toolName === 'grep_search' || action.toolName === 'search_web') {
        return `${agentName} searched for information.`;
      }
      if (action.toolName === 'view_file' || action.toolName === 'list_dir') {
        return `${agentName} reviewed ${action.fileName || 'a directory'}.`;
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

    return `${agentName} performed an action (${action.type}).`;
  };

  return (
    <div className="zen-dashboard">
      
      {/* PHASE 1: Project Selection */}
      {phase === 'projects' && (
        <div className="zen-project-phase">
          <h1 className="zen-title">Select a Project</h1>
          <p className="zen-subtitle">Choose a workspace to review its agent activity.</p>
          <div className="zen-project-list">
            {(overview?.projects || []).map(proj => (
              <div key={proj.name} className="zen-project-card" onClick={() => handleProjectSelect(proj)}>
                <div className="zen-project-name">{proj.name}</div>
                <div className="zen-project-meta">
                  <span>{proj.totalSessions} Sessions</span>
                  <span>{proj.fileCount} Files</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PHASE 2: Session Selection */}
      {phase === 'sessions' && selectedProject && (
        <div className="zen-project-phase">
          <button className="zen-back-btn" onClick={() => setPhase('projects')}>← Back to Projects</button>
          <h1 className="zen-title">{selectedProject.name} Sessions</h1>
          <p className="zen-subtitle">Select a specific session to step through the audit.</p>
          
          <div className="zen-session-list">
            {Object.entries(selectedProject.agents).map(([agentKey, agentData]) => (
              agentData.sessions.map(s => (
                <div key={s.id} className="zen-session-card" onClick={() => handleSessionSelect(s, selectedProject.name)}>
                  <div className="zen-session-title">{s.title || 'Untitled Session'}</div>
                  <div className="zen-session-date">
                    {new Date(s.timestamp).toLocaleString()} · {agentKey === 'claude' ? 'Claude' : 'Antigravity'} · {s.nodes} steps
                  </div>
                </div>
              ))
            ))}
          </div>
        </div>
      )}

      {/* PHASE 3: Step-Through Audit */}
      {phase === 'step-through' && (
        <div className="zen-step-phase">
          <div className="zen-step-header">
            <button className="zen-back-btn" style={{ margin: 0 }} onClick={() => setPhase('sessions')}>
              ← Exit
            </button>
            <div className="zen-step-progress">
              Step {timeline.length > 0 ? currentStepIndex + 1 : 0} of {timeline.length}
            </div>
            <div className="zen-step-nav">
              <button className="zen-nav-btn" onClick={handlePrev} disabled={currentStepIndex === 0 || timeline.length === 0}>
                ← Previous
              </button>
              <button className="zen-nav-btn" onClick={handleNext} disabled={currentStepIndex >= timeline.length - 1 || timeline.length === 0}>
                Next →
              </button>
            </div>
          </div>

          <div className="zen-step-content">
            {loading ? (
              <div className="zen-title">Loading timeline...</div>
            ) : timeline.length === 0 ? (
              <div className="zen-title">No actions found for this session.</div>
            ) : (
              <div className="zen-action-card" key={currentStepIndex}>
                <div className="zen-action-hero">
                  {getActionHeroText(timeline[currentStepIndex])}
                </div>
                
                <div className="zen-action-meta">
                  <span className={`zen-action-agent ${timeline[currentStepIndex].agent?.toLowerCase()}`}>
                    {timeline[currentStepIndex].agent}
                  </span>
                  <span>{new Date(timeline[currentStepIndex].timestamp).toLocaleTimeString()}</span>
                  {timeline[currentStepIndex].fileName && (
                    <span>📄 {timeline[currentStepIndex].fileName}</span>
                  )}
                  {timeline[currentStepIndex].toolName && (
                    <span>🔧 {timeline[currentStepIndex].toolName}</span>
                  )}
                </div>

                <div className="zen-file-viewer">
                  <pre>
                    {fullEntity?.content || timeline[currentStepIndex].contentSnippet || '(Loading content...)'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

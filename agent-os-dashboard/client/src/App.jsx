import React, { useState, useEffect, useCallback } from 'react';
import UnifiedDashboard from './components/UnifiedDashboard';
import BetaDashboard from './components/BetaDashboard';
import AgentLifelog from './components/AgentLifelog';
import SetupWizard from './components/SetupWizard';
import './index.css';

const API = import.meta.env.DEV
  ? 'http://localhost:3030/api'
  : '/api';

function App() {
  const [activeTab, setActiveTab] = useState('beta');
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);

  // When Beta tab navigates to a session, switch to Original and load it
  const [pendingSessionId, setPendingSessionId] = useState(null);

  // When Lifelog wants to teleport to Beta Dashboard
  const [pendingTeleport, setPendingTeleport] = useState(null);

  useEffect(() => {
    fetch(`${API}/setup/status`)
      .then(r => r.json())
      .then(data => {
        setIsSetupComplete(data.isComplete);
        setSetupLoading(false);
      })
      .catch(e => {
        console.error('Setup status check failed', e);
        setSetupLoading(false);
      });
  }, []);

  const handleNavigateToSession = useCallback((sessionId) => {
    setPendingSessionId(sessionId);
    setActiveTab('original');
  }, []);

  const handleTeleport = useCallback((teleportData) => {
    setPendingTeleport(teleportData);
    setActiveTab('beta');
  }, []);

  if (setupLoading) {
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

  if (!isSetupComplete) {
    return (
      <SetupWizard 
        API={API} 
        onComplete={() => setIsSetupComplete(true)} 
      />
    );
  }

  return (
    <div className="app-root">
      <div className="app-tabs">
        <button
          className={`app-tab ${activeTab === 'beta' ? 'active' : ''}`}
          onClick={() => setActiveTab('beta')}
        >
          <span className="tab-badge">β</span> Mission Control
        </button>
        <button
          className={`app-tab ${activeTab === 'lifelog' ? 'active' : ''}`}
          onClick={() => setActiveTab('lifelog')}
        >
          Agent Lifelog
        </button>
        <button
          className={`app-tab ${activeTab === 'original' ? 'active' : ''}`}
          onClick={() => setActiveTab('original')}
        >
          Session Graph
        </button>
      </div>
      <div className="app-content">
        {activeTab === 'beta' && (
          <BetaDashboard 
            onNavigateToSession={handleNavigateToSession} 
            pendingTeleport={pendingTeleport} 
            onTeleportConsumed={() => setPendingTeleport(null)} 
            onOpenSetup={() => setIsSetupComplete(false)}
          />
        )}
        {activeTab === 'lifelog' && (
          <AgentLifelog onTeleport={handleTeleport} />
        )}
        {activeTab === 'original' && (
          <UnifiedDashboard initialSessionId={pendingSessionId} onSessionLoaded={() => setPendingSessionId(null)} />
        )}
      </div>
    </div>
  );
}

export default App;

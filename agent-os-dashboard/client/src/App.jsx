import React, { useState, useCallback } from 'react';
import UnifiedDashboard from './components/UnifiedDashboard';
import BetaDashboard from './components/BetaDashboard';
import AgentLifelog from './components/AgentLifelog';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('beta');

  // When Beta tab navigates to a session, switch to Original and load it
  const [pendingSessionId, setPendingSessionId] = useState(null);

  // When Lifelog wants to teleport to Beta Dashboard
  const [pendingTeleport, setPendingTeleport] = useState(null);

  const handleNavigateToSession = useCallback((sessionId) => {
    setPendingSessionId(sessionId);
    setActiveTab('original');
  }, []);

  const handleTeleport = useCallback((teleportData) => {
    setPendingTeleport(teleportData);
    setActiveTab('beta');
  }, []);

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
          <BetaDashboard onNavigateToSession={handleNavigateToSession} pendingTeleport={pendingTeleport} onTeleportConsumed={() => setPendingTeleport(null)} />
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

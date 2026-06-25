import React, { useState, useEffect } from 'react';

const formatNum = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

export default function HeatmapRadar({ onDateSelect, selectedDate }) {
  const [data, setData] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  
  useEffect(() => {
    fetch('http://localhost:3030/api/heatmap-stats')
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) return <div className="zen-heatmap-loading">Loading radar...</div>;

  const { days, stats } = data;

  const today = new Date();
  const calendar = [];
  
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);
  
  for (let i = 0; i <= 364; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    const dayStr = dLocal.toISOString().split('T')[0];
    
    calendar.push({
      date: dayStr,
      count: days[dayStr]?.count || 0,
      nodes: days[dayStr]?.nodes || 0,
      tokens: days[dayStr]?.tokens || 0
    });
  }

  const getIntensityClass = (count) => {
    if (count === 0) return 'level-0';
    if (count <= 2) return 'level-1';
    if (count <= 5) return 'level-2';
    if (count <= 10) return 'level-3';
    return 'level-4';
  };

  return (
    <div className="zen-heatmap-radar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: collapsed ? '0' : '1rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Activity Radar</h2>
        <button 
          onClick={() => setCollapsed(!collapsed)}
          style={{ background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', padding: '0.2rem 0.6rem' }}
        >
          {collapsed ? 'Show Radar' : 'Hide Radar'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="zen-heatmap-stats">
        <div className="zen-stat-card">
          <div className="zen-stat-label">Sessions</div>
          <div className="zen-stat-value">{formatNum(stats.totalSessions)}</div>
        </div>
        <div className="zen-stat-card">
          <div className="zen-stat-label">Messages</div>
          <div className="zen-stat-value">{formatNum(stats.totalMessages)}</div>
        </div>
        <div className="zen-stat-card">
          <div className="zen-stat-label">Total tokens</div>
          <div className="zen-stat-value">{formatNum(stats.totalTokens)}</div>
        </div>
        <div className="zen-stat-card">
          <div className="zen-stat-label">Active days</div>
          <div className="zen-stat-value">{stats.activeDays}</div>
        </div>
        <div className="zen-stat-card">
          <div className="zen-stat-label">Current streak</div>
          <div className="zen-stat-value">{stats.currentStreak}d</div>
        </div>
        <div className="zen-stat-card">
          <div className="zen-stat-label">Longest streak</div>
          <div className="zen-stat-value">{stats.longestStreak}d</div>
        </div>
        <div className="zen-stat-card">
          <div className="zen-stat-label">Peak hour</div>
          <div className="zen-stat-value">{stats.peakHour}</div>
        </div>
        <div className="zen-stat-card">
          <div className="zen-stat-label">Favorite model</div>
          <div className="zen-stat-value" style={{ fontSize: '1rem', marginTop: '0.2rem' }}>{stats.favoriteModel.replace('claude-', '').replace('models/', '')}</div>
        </div>
      </div>
      
      <div className="zen-heatmap-grid-container">
        <div className="zen-heatmap-grid">
          {calendar.map(day => (
            <div 
              key={day.date} 
              className={`zen-heatmap-cell ${getIntensityClass(day.count)} ${selectedDate === day.date ? 'selected' : ''}`}
              title={`${day.date}: ${day.count} sessions, ${day.nodes} nodes, ${formatNum(day.tokens)} tokens`}
              onClick={() => onDateSelect && onDateSelect(day.date === selectedDate ? null : day.date)}
            ></div>
          ))}
        </div>
        {selectedDate && (
          <div className="zen-heatmap-filter-pill">
            Filtering by: {selectedDate} 
            <span onClick={() => onDateSelect && onDateSelect(null)}>×</span>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

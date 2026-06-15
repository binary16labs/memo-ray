import React from 'react';

// Isolates graph rendering failures so a crash in the force-graph canvas
// can never blank out the entire Mission Control / Session Graph page.
export default class GraphErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || String(error) };
  }

  componentDidCatch(error, info) {
    console.error('[GraphErrorBoundary] Graph render crashed:', error, info?.componentStack);
  }

  // Allow the parent to recover (e.g. when the user changes session/layout)
  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '0.75rem', height: '100%', minHeight: '300px', padding: '2rem',
          color: 'var(--text-secondary, #b8b0a4)', textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.1rem', color: 'var(--text-primary, #e8ece9)' }}>
            The graph couldn’t be drawn for this session.
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.7, maxWidth: 520, wordBreak: 'break-word' }}>
            {this.state.message}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

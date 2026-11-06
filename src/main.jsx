import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Custom QR encountered an error.', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-screen">
          <div className="fatal-card">
            <h1>Something went wrong.</h1>
            <p>Your workspace couldn’t be opened. Refresh the page to try again.</p>
            <button className="button button-primary" onClick={() => window.location.reload()}>Refresh workspace</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root'));
root.render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);

if (import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const protocol = window.location.protocol;
  const isWeb = protocol === 'http:' || protocol === 'https:';
  const isDesktop = /Electron/i.test(navigator.userAgent) || Boolean(window.Capacitor);
  if (isWeb && !isDesktop) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Offline support is an enhancement; the studio remains usable if registration fails.
      });
    }, { once: true });
  }
}

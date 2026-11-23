import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));

// The admin console is Cloudflare Access protected and always deploys fresh.
// Registering a service worker here causes stale bundles after deployments.
serviceWorkerRegistration.unregister();

root.render(
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      color: '#475569',
      fontSize: '14px',
    }}
  >
    Loading admin console…
  </div>
);

const bootstrap = async () => {
  try {
    // Public Firebase identifiers are served at runtime so builds never need
    // committed API keys or build-time environment injection.
    const response = await fetch('/api/firebase-config', { cache: 'no-store' });
    if (response.ok) {
      window.__FIREBASE_CONFIG__ = await response.json();
    } else {
      const details = await response.json().catch(() => ({}));
      console.warn('Firebase runtime config unavailable:', details.error || response.status);
    }
  } catch (error) {
    console.warn('Could not load Firebase runtime config:', error);
  }

  const { default: App } = await import('./App');
  root.render(<App />);
  reportWebVitals();
};

bootstrap();

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
);

// The admin console is Cloudflare Access protected and always deploys fresh.
// Registering a service worker here causes stale bundles after deployments.
serviceWorkerRegistration.unregister();

reportWebVitals();

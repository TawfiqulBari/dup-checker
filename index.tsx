
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (window.desktopAPI?.smokeTest) {
  import('./services/desktopSmoke').then(module => module.runDesktopSmoke()).then(result => window.desktopAPI!.reportSmoke(result)).catch(error => window.desktopAPI!.reportSmoke({ ok: false, error: String(error) }));
}

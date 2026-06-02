import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App, { ErrorBoundary } from './App.tsx';
import './index.css';

console.log('App booting...');

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

// Terminate simulated loading screen and complete PWA boot indication
if (typeof (window as any).completeAppBoot === 'function') {
  (window as any).completeAppBoot();
}

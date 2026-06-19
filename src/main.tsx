import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Service worker registration
if (import.meta.env.DEV) {
  // Unregister service workers in dev to avoid stale cache issues
  navigator.serviceWorker?.getRegistrations().then((regs) =>
    regs.forEach((r) => r.unregister())
  );
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        reg.update();
      })
      .catch(() => {});
  });
}

// Mount React app
createRoot(document.getElementById('root')!).render(<App />);

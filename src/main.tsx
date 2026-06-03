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
        console.log('SW registered, scope:', reg.scope);
        // Check for updates every time the app loads
        reg.update();
      })
      .catch((err) => console.error('SW registration failed:', err));
  });
}

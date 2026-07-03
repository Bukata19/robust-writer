import { useEffect, useState } from 'react';

/**
 * Tracks the browser's online/offline state.
 * Returns `true` when online, `false` when offline.
 *
 * Seeds from navigator.onLine and updates via the window online/offline
 * events. SSR-safe: assumes online when navigator is unavailable.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // Re-sync in case the state changed between render and effect.
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

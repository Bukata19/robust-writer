import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Always-mounted status badge. Renders nothing while online; shows a small
 * "Offline" pill when the browser goes offline. Token-only styling so it
 * works across every theme.
 */
const OfflineBadge: React.FC = () => {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      title="You're offline — reading and export still work"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
    >
      <WifiOff className="h-3 w-3" aria-hidden="true" />
      Offline
    </span>
  );
};

export default OfflineBadge;

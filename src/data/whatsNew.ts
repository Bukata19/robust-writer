// Hand-maintained "What's New" feed, newest first. Shipping an update =
// prepend one entry here; the settings-gear dot re-arms for every user
// automatically because the seen-state stores the newest entry's id.
//
// Keep entries user-facing and honest — describe what actually shipped, in
// plain language (no internal jargon).

export interface WhatsNewEntry {
  /** Stable unique id — the seen-state keys off the newest one. */
  id: string;
  /** ISO date (YYYY-MM-DD) the feature shipped. */
  date: string;
  title: string;
  description: string;
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: 'home-library-tabs',
    date: '2026-07-07',
    title: 'New Home and Library tabs',
    description:
      'The dashboard is now split in two: Home for starting and continuing your writing, Library for browsing, searching, and sorting all your documents — with bottom tabs on mobile and a top switcher on desktop.',
  },
  {
    id: 'signout-sweep',
    date: '2026-07-07',
    title: 'Cleaner sign-out on shared devices',
    description:
      'Signing out now clears your onboarding and tour progress, so the next person to use the same browser starts fresh instead of inheriting your flags.',
  },
  {
    id: 'ai-detector-stable',
    date: '2026-07-04',
    title: 'More consistent AI detection',
    description:
      'The AI detector now returns a stable score whose highlights and explanations always match — re-running it on the same text gives the same result every time.',
  },
  {
    id: 'offline-access',
    date: '2026-07-03',
    title: 'Keep working offline',
    description:
      'An always-visible connection badge plus offline caching let you open and read your most recent document without a connection; AI tools pause until you are back online.',
  },
  {
    id: 'local-backup',
    date: '2026-07-03',
    title: 'Automatic local backup',
    description:
      'Your edits are mirrored to this browser as a safety net, so an interrupted save or refresh no longer loses recent work.',
  },
];

// ── Seen-state ──────────────────────────────────────────────────────────────
// App-release-level, NOT per-user: deliberately outside the signOut sweep so
// a shared browser doesn't re-flag every account after each sign-out.

const SEEN_KEY = 'rb_whatsnew_seen';

/** True when the newest entry hasn't been seen on this browser. */
export function hasUnseenUpdate(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== WHATS_NEW[0]?.id;
  } catch {
    // Storage unavailable — fail open and show the dot; marking seen will
    // no-op, which is harmless.
    return true;
  }
}

/** Record the newest entry as seen, clearing the dot. */
export function markUpdatesSeen(): void {
  try {
    if (WHATS_NEW[0]) localStorage.setItem(SEEN_KEY, WHATS_NEW[0].id);
  } catch {
    // ignore — best-effort
  }
}

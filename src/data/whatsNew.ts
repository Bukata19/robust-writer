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
    id: 'decoder-smarter',
    date: '2026-07-20',
    title: 'A sharper Assignment Decoder',
    description:
      'The decoder now reads the actual command words in your question (discuss, evaluate, compare...) to shape its outline, keeps sections consistent with each other, and scales word counts to match stated mark allocations.',
  },
  {
    id: 'tools-tab',
    date: '2026-07-17',
    title: 'Humanizer without opening a document',
    description:
      'A new Tools tab on your dashboard lets you paste text and humanize it directly — no document required.',
  },
  {
    id: 'landing-page',
    date: '2026-07-12',
    title: 'A real front door',
    description:
      'RobAssister now has a proper landing page for new visitors, with a quick look at every document template before you sign up.',
  },
  {
    id: 'personalization',
    date: '2026-07-11',
    title: 'Make it yours',
    description:
      'Tell RobAssister your name, academic level, field of study, and preferred writing tone during a quick one-time setup, and the AI chat assistant adapts to you.',
  },
  {
    id: 'writing-coach',
    date: '2026-07-09',
    title: 'Meet your Writing Coach',
    description:
      'The AI detector has been replaced by a live Writing Coach. Pause while writing and it offers one tip at a time — passive voice, wordy phrasing, weak openers and more — tuned to your level. Open its panel to pick focus areas, set the mode, track your trends, and export a progress report.',
  },
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

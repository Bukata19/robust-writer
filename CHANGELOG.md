# Changelog

All notable changes to RobAssister.

This entry covers **2026-06-07 → 2026-06-26**.

## [1.4.0] — 2026-06-26

### Added
- **AI Detector** — replaced the old plagiarism panel with an AI-source detection engine that highlights AI-favoured words, formulaic phrases, model-flagged passages and structural signals directly in the editor, with category filters and click-to-act fixes.
- **Assignment Decoder** — paste an assignment prompt to generate a structured outline with per-section guidance tips and optional AI drafting.
- **Editor typography controls** — font family and font-size selectors, line-spacing presets, and A4/full canvas-width options.
- **Continuous paged canvas** — a single flowing sheet with faint "Page N" dividers at each A4 interval (now shown on mobile as well as desktop).
- **Auth overhaul** — password-strength guidance and validation, "remember me", and a full password-reset flow.
- **Settings drawer** — section navigation rail, search, System (OS-following) theme mode, and reset-to-defaults.
- **Per-user rate limiting** on the chat, humanizer and plagiarism edge functions.
- **Error boundary** around the app so an uncaught render error shows a recovery screen instead of a blank page.
- **New RobAssister logo** — custom "RA" monogram with an Orbitron wordmark.
- **Refreshed onboarding tours** for the dashboard and editor, with clearer AI Detector copy, precise element targeting, and a Settings step.

### Changed
- **UI visual refinement pass** — unified spacing scale, type hierarchy, single card treatment and consistent focus states across Auth, Dashboard and Editor; balanced desktop layouts.
- **Editor toolbar consolidation (desktop)** — removed the separate left formatting strip and merged all format controls into one top bar; widened the right-hand AI-tools rail.
- **Theme-driven editor surfaces** — the desk, page and page-text colors are now design tokens that adapt across all 8 themes (4 dark, 4 light); proper dark-mode class toggling.
- **Dashboard** — revamped document cards with distinct template icons, due-date picker, and per-document word counts.
- **Save reliability** — de-duplicated autosave snapshots, optimistic-concurrency checks, and atomic rate-limit accounting.

### Fixed
- Resolved a Temporal-Dead-Zone crash that blanked the editor on desktop, and activated previously-dead dark-mode styles.
- Fixed a black-screen-on-load issue by restoring Supabase environment configuration.
- Corrected the FontFamily extension import and switched the editor style selector from `.tiptap` to `.ProseMirror`.
- Removed a duplicate `plagiarismReport` state declaration and cleaned up lint regressions.

### Security
- Stopped tracking `.env` in git and tightened environment-variable handling.
- Pre-production audit hardening: robust JWT token extraction, explicit API-key error responses, and ReactMarkdown XSS hardening in AI chat output.
- Gated debug `console` logging behind development builds.

### Accessibility
- Added ARIA labels and semantic attributes to the detection panel and icon-only buttons (rename/confirm/cancel, dismiss, close), and `aria-expanded`/`aria-controls` to the Detection Signals card.

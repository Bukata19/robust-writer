# RobAssister 1.4

_Released 2026-06-26_

This release turns RobAssister into a sharper, more trustworthy writing
companion — a smarter AI Detector, a guided Assignment Decoder, a redesigned
editor and dashboard, and a round of security and reliability hardening.

## Highlights

### 🛰️ AI Detector
The plagiarism panel has been rebuilt as a true **AI Detector**. It scans your
writing and highlights AI-favoured words, formulaic phrases, model-flagged
passages and structural tells **right in the editor** — colour-coded by type.
Filter by category, click any highlight to see why it was flagged, and fix it in
place (swap a buzzword or humanize a passage).

### 🧭 Assignment Decoder
Paste your assignment prompt and RobAssister breaks it into a **structured
outline** with per-section guidance tips — and can draft each section for you to
review and approve.

### ✍️ A better writing surface
- New **font family, font size and line-spacing** controls, plus A4 or
  full-width canvas.
- A **continuous paged sheet** with subtle "Page N" dividers, now on mobile too.
- On desktop, all formatting lives in **one consolidated top toolbar**; the
  AI-tools rail on the right has been tidied up.

### 🎨 A more cohesive look
A full visual refinement pass brings a consistent spacing scale, type hierarchy,
card style and focus states across Auth, Dashboard and Editor. Editor surfaces
(the desk, the page, the text) now adapt cleanly across all **8 themes** — four
dark, four light — with proper dark-mode support.

### 🔐 Accounts & onboarding
- Overhauled **sign-in / sign-up** with password-strength guidance, validation,
  "remember me", and a complete **password-reset** flow.
- A redesigned **Settings** drawer with a section rail, search, a System
  (OS-following) theme mode, and reset-to-defaults.
- Refreshed **onboarding tours** for the dashboard and editor.
- A new **RobAssister logo**.

## Reliability & Security
- Per-user **rate limiting** on the AI features (chat, humanizer, detector).
- More dependable saving: de-duplicated autosave snapshots and
  optimistic-concurrency protection against overwrites.
- Security hardening from a pre-production audit — robust auth-token handling,
  clearer error responses, and XSS protection on AI chat output.
- An app-wide **error boundary** so an unexpected error shows a recovery screen
  instead of a blank page.

## Fixes
- Fixed a crash that could blank the editor on desktop and a black-screen issue
  on load.
- Activated previously-inert dark-mode styling.
- Various editor and dashboard polish fixes.

## Accessibility
- Added ARIA labels and semantic attributes across the detection panel and
  icon-only buttons for better screen-reader and keyboard support.

---

_See [CHANGELOG.md](./CHANGELOG.md) for the full commit-level detail._

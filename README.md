# RobAssister

AI-powered writing assistant built for students. Decode assignments, write with real-time coaching, humanize your text, and check originality — all in one place.

[![Live App](https://img.shields.io/badge/Open%20App-robobuddy--writer.lovable.app-00d4b8?style=flat-square)](https://robobuddy-writer.lovable.app)

---

## What it does

**Assignment Decoder** — Paste your assignment question and get a structured outline tailored to it. The AI breaks down what the question is actually asking, assigns word counts per section, and can draft each section one at a time. You preview and approve before anything goes into your document.

**Writing Coach** — Watches as you write and drops a short, specific tip below the paragraph you're in every time you pause. Not a chatbot, not a popup — just a quiet nudge when you need it.

**Text Humanizer** — Select any text and humanize it at three intensity levels (Subtle, Moderate, Full). Built to reduce AI detection scores on tools like ZeroGPT, with sentence-level reconstruction and anti-pattern enforcement baked into the prompt system.

**Plagiarism Checker** — Pre-analysis calculates burstiness, AI signature word density, transition density, and coherence uniformity before the AI even sees your text. Returns an originality score, per-passage confidence ratings, a signal breakdown, and a paragraph-level risk map.

**Writing Polish** — Clarity Check scans the whole document for weak sentences, passive voice, and wordy phrases. Smart Rewrite gives you three alternative versions of any selected text.

**Rich-Text Editor** — TipTap-based, multi-page canvas with pre-structured templates (Essay, Research Paper, Report, General), smart placeholders, font controls, version history, focus mode, and PDF/DOCX export.

---

## Stack

React 18 · TypeScript · Vite · TipTap · Tailwind CSS · shadcn/ui · Supabase (Auth + PostgreSQL + Edge Functions) · Anthropic Claude (via AI gateway)

---

## Running locally

```bash
git clone https://github.com/Bukata19/robust-writer.git
cd robust-writer
npm install
```

Create a `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

Add your AI key to Supabase Edge Function secrets:

```
ANTHROPIC_API_KEY=your-key
```

```bash
npm run dev
```

---

## Built by

**Sashi** — a student building tools for students.

> *Write smarter. Feel smarter.*

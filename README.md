# RobAssister — AI-Powered Writing Assistant

> The comprehensive writing platform for students. Decode assignments, receive real-time coaching, polish your prose, and submit with confidence—all in one distraction-free workspace.

[![Live App](https://img.shields.io/badge/Live%20App-robobuddy--writer.lovable.app-00d4b8?style=flat-square&logo=vercel)](https://robobuddy-writer.lovable.app)
[![Built with React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38BDF8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)

---

## Overview

RobAssister transforms how students approach academic writing. Built on a modern, fast tech stack, it combines an intuitive rich-text editor with intelligent AI tools to help you understand assignments, refine your writing in real time, eliminate plagiarism concerns, and export polished documents. Whether you're tackling an essay, research paper, or report, RobAssister guides you from concept to completion.

---

## Core Features

### Assignment Decoder
Break down complex assignment prompts with AI-powered analysis. Paste your assignment brief and receive:
- Key requirements and objectives extracted automatically
- Writing guidelines and formatting expectations clarified
- Personalized context that fuels the Writing Coach for better in-line suggestions
- Active section tracking as you write

### AI Writing Coach
Your always-on collaborative partner. The Writing Coach:
- Watches as you write and offers one focused, actionable tip when you pause
- Draws context from your assignment decoder session for tailored guidance
- Appears as an inline bubble in your document—never disruptive, always helpful
- Learns your writing patterns and adapts suggestions accordingly
- Tracks tip history so you never forget key advice

### Writing Polish Tool
A dual-panel utility for final refinement:
- **Clarity Checker** — Scans for complex phrasing, passive constructions, and jargon; suggests simpler alternatives
- **Context Rewriter** — Restructures sentences and paragraphs while preserving your voice; adjust intensity to suit your needs
- Side-by-side preview of changes before applying
- One-click apply or discard changes

### Multi-Page Editor Canvas
Write seamlessly across multiple pages with a professional, distraction-free layout:
- Document pages render with realistic spacing and margins
- Automatic page breaks as content grows
- Configurable canvas width: A4 or full-width
- Live word count and reading time display
- Floating formatting toolbar with smart, context-aware options

### Rich-Text Editor
Built for academic writing, powered by TipTap:
- Bold, Italic, Underline, Headings (H1/H2), and list formatting
- Pre-structured templates for Essays, Research Papers, Reports, and General documents
- Smart inline placeholders that guide each section
- Full font family and size customization
- Text alignment controls

### Text Humanizer
Transform robotic or AI-sounding prose into natural, human writing:
- Three intensity levels: **Subtle**, **Moderate**, **Full**
- Target word count modes: Unchanged, Preset (250–2000), or Custom
- Side-by-side comparison before applying changes
- One-click accept or reject humanized text

### Plagiarism Checker
AI-powered originality analysis to give you peace of mind:
- Overall originality score (0–100 scale)
- Flagged passages with concern types: common phrasing, formulaic structure, AI-generated text, uncited claims, and style inconsistencies
- Severity ratings (Low / Medium / High) per flagged item
- Actionable fix suggestions for each concern
- Originality strengths summary
- Animated score gauge with intuitive visual feedback
- Plagiarism scores persist across sessions and appear on dashboard cards

### Document Types & Templates
Professionally structured templates for:
- **Essay** — Introduction, Body Paragraphs (×3), Conclusion
- **Research Paper** — Abstract, Introduction, Literature Review, Methodology, Results, Discussion, Conclusion, References
- **Report** — Executive Summary, Introduction, Findings, Recommendations, Conclusion
- **General** — Blank canvas for flexible writing

### Dashboard & Document Management
- Clean document grid with instant search and filtering by type
- Plagiarism score badges on each card (Clean / Warning / High Risk)
- One-click document creation by type
- Safe delete with confirmation
- **Streamlined Import** — Quick-access import button to add files directly from your workspace

### Save & Export
- Autosave with configurable intervals (30s / 1min / 2min)
- Export to **PDF**, **DOCX**, or **TXT** formats
- Plagiarism scores and document metadata persist
- Version history snapshots on every save

### Version History
- Browse all saved versions of your document
- Restore any previous version with one click
- View version timestamps and content previews

### Settings Drawer
Fine-tune every aspect of your experience:

| Section | Options |
|---|---|
| **Appearance** | Colour theme (Deep Dark / Midnight Blue / Forest Dark / Crimson Dark), Font size, Card density |
| **Editor Defaults** | Default doc type, Humanizer intensity, Canvas width, Line spacing |
| **Behaviour** | Autosave toggle & interval, Default export format, Chat panel default state |
| **Accessibility** | Reduce motion toggle, High contrast mode |
| **Account** | Display name, Reset onboarding tour, Sign out |

### Interactive Onboarding Tour
- Step-by-step guided tour powered by Intro.js
- Visually prominent, teal-accented tour popups
- Reset anytime from Settings > Account

### Authentication & Security
- Email/password sign up and sign in via Supabase Auth
- Protected routes—all pages require authentication
- Row-Level Security (RLS) on all database tables—users only access their own documents

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript 5, Vite 5 |
| **Styling** | Tailwind CSS 3, shadcn/ui, Radix UI |
| **Routing** | React Router v6 |
| **State / Data** | TanStack Query v5 |
| **Backend** | Supabase (Auth, PostgreSQL, Edge Functions) |
| **AI** | Gemini API via Supabase Edge Functions |
| **Editor** | TipTap rich-text framework |
| **Export** | html2pdf.js (PDF), docx (DOCX) |
| **Notifications** | Sonner |
| **Onboarding** | Intro.js |
| **Testing** | Vitest, Playwright |
| **Build** | Vite, lovable-tagger |

---

## Database Schema

```sql
-- Document types
CREATE TYPE public.doc_type AS ENUM (
  'essay', 'research_paper', 'report', 'general'
);

-- Documents table
CREATE TABLE public.documents (
  id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT      NOT NULL DEFAULT 'Untitled Document',
  content         JSONB,
  plagiarism_score INTEGER  DEFAULT 0,
  plagiarism_data JSONB,
  doc_type        doc_type  NOT NULL DEFAULT 'general',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security enabled — users access only their own documents
```

---

## Supabase Edge Functions

| Function | Endpoint | Description |
|---|---|---|
| `chat` | `/functions/v1/chat` | Proxies Gemini API for the AI writing assistant |
| `humanizer` | `/functions/v1/humanizer` | Rewrites text at selected intensity using Gemini |
| `plagiarism` | `/functions/v1/plagiarism` | Analyses originality and returns structured JSON report |

All functions require a valid Supabase Bearer token. Rate limiting and credit error handling are included.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) 18+ or [Bun](https://bun.sh)
- A [Supabase](https://supabase.com) project
- A Gemini API key (via Gemini or Lovable AI gateway)

### 1. Clone the Repository

```bash
git clone https://github.com/Bukata19/robust-writer.git
cd robust-writer
```

### 2. Install Dependencies

```bash
npm install
# or
bun install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Set the following secret in your Supabase Edge Functions dashboard:

```
LOVABLE_API_KEY=your-ai-gateway-key
```

### 4. Apply Database Migrations

```bash
supabase db push
```

### 5. Deploy Edge Functions

```bash
supabase functions deploy chat
supabase functions deploy humanizer
supabase functions deploy plagiarism
```

### 6. Run the Development Server

```bash
npm run dev
# or
bun dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser and sign up to get started.

---

## Project Structure

```
robust-writer/
├── public/                    # Static assets
├── src/
│   ├── components/
│   │   ├── ui/                # shadcn/ui component library
│   │   ├── EditorPage.tsx     # Editor wrapper component
│   │   ├── PolishPanel.tsx    # Writing Polish tool (Clarity + Rewriter)
│   │   ├── AssignmentDecoder/ # Assignment Decoder components
│   │   ├── VersionHistoryPanel.tsx
│   │   ├── PlagiarismPanel.tsx
│   │   └── PagedCanvas.tsx    # Multi-page editor canvas
│   ├── contexts/
│   │   ├── AuthContext.tsx    # Global auth state
│   │   └── SettingsContext.tsx
│   ├── hooks/
│   │   ├── use-mobile.tsx     # Mobile breakpoint hook
│   │   ├── use-toast.ts       # Toast notification hook
│   │   ├── useAssignmentDecoder.ts
│   │   └── useInlineAiSuggestion.ts
│   ├── integrations/
│   │   └── supabase/          # Supabase client & generated types
│   ├── lib/
│   │   └── utils.ts           # Utility helpers
│   ├── pages/
│   │   ├── AuthPage.tsx       # Login / Sign up page
│   │   ├── Dashboard.tsx      # Document management & import
│   │   ├── EditorPage.tsx     # Main editor (rich-text + AI tools)
│   │   ├── Index.tsx          # Root redirect
│   │   └── NotFound.tsx       # 404 page
│   ├── App.tsx                # Router, providers, protected routes
│   ├── main.tsx               # React entry point
│   └── index.css              # Global styles & Tailwind base
├── supabase/
│   ├── functions/
│   │   ├── chat/              # AI chat Edge Function
│   │   ├── humanizer/         # Text humanizer Edge Function
│   │   └── plagiarism/        # Plagiarism checker Edge Function
│   └── migrations/            # SQL migration files
├── .env                       # Environment variables (not committed)
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

## Design System

RobAssister uses a cohesive **Deep Dark** theme throughout with a modern, approachable aesthetic:

| Token | Value | Usage |
|---|---|---|
| Deep Black | `#080a0c` | Page background |
| Slate Gray | `#1a2030` | Card backgrounds |
| Teal | `#00d4b8` | Primary accent, CTAs, focus rings |
| Red | `#e05252` | Destructive actions, high-risk badges |
| Foreground | `#e8edf5` | Primary text |
| Muted | `#7a8599` | Secondary text |

Additional themes available: **Midnight Blue**, **Forest Dark**, **Crimson Dark**.

---

## Running Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# End-to-end tests (Playwright)
npx playwright test
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests with Vitest |

---

## Roadmap

- [ ] Citation generator (APA / MLA / Harvard)
- [ ] Document collaboration (real-time multiplayer)
- [ ] AI outline and full-document generation
- [ ] Mobile-optimised bottom sheet panels
- [ ] Dark/light theme toggle
- [ ] Advanced plagiarism source detection

---

## Contributing

Contributions are welcome! Please open an issue first to discuss any changes you'd like to make.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

This project is private and proprietary. All rights reserved.

---

## Author

Built by **Sashi** — a student building practical AI tools for students.

> *"Write Smarter. Feel Smarter."*

[![Open RobAssister](https://img.shields.io/badge/Open%20RobAssister-00d4b8?style=for-the-badge)](https://robobuddy-writer.lovable.app)

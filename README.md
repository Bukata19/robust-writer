# 🤖 RobAssister — AI-Powered Writing Assistant

> A smart, distraction-free writing platform for students. Write, humanize, check plagiarism, and export — all in one place.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-robobuddy--writer.lovable.app-00d4b8?style=flat-square&logo=vercel)](https://robobuddy-writer.lovable.app)
[![Built with React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38BDF8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)

---

## 📸 Overview

RobAssister is a full-stack AI writing assistant built for students who need to produce high-quality academic documents. It combines a rich-text editor with three powerful AI tools — an intelligent chat assistant, a text humanizer, and a plagiarism checker — all wrapped in a sleek Deep Dark interface.

---

## ✨ Features

### 📝 Rich-Text Editor
- Distraction-free writing environment with a floating formatting toolbar
- Support for Bold, Italic, Underline, Headings (H1/H2), and ordered/unordered lists
- A4 and full-width canvas modes
- Live word count and reading time display
- Inline placeholder guidance for each document section

### 🧠 AI Writing Assistant
- Real-time AI chat panel powered by Gemini 3.1 Pro (via Supabase Edge Functions)
- Context-aware suggestions based on your current document content
- Ask questions, brainstorm ideas, request rewrites, or get outline help
- Full conversation history maintained per session

### 🧬 Text Humanizer
- Transforms AI-generated or robotic-sounding text into natural, human writing
- Three intensity levels: **Subtle**, **Moderate**, **Full**
- Side-by-side original vs. humanized comparison before applying changes
- One-click apply or dismiss

### 🛡️ Plagiarism Checker
- AI-powered originality scoring (0–100 scale)
- Flags specific passages with concern types: `common_phrasing`, `formulaic_structure`, `ai_generated`, `uncited_claim`, `style_inconsistency`
- Severity rating per flagged passage (Low / Medium / High)
- Actionable fix suggestions per flagged item
- Originality strengths summary
- Animated circular score gauge with teal → yellow → red colour gradient
- Plagiarism score stored per document and displayed on dashboard cards

### 📄 Document Types & Templates
Pre-built structured templates for:
- **Essay** — Introduction, Body Paragraphs, Conclusion
- **Research Paper** — Abstract, Introduction, Literature Review, Methodology, Results, Discussion, References
- **Report** — Executive Summary, Findings, Recommendations, Conclusion
- **General** — Blank canvas

### 💾 Save & Export
- Autosave with configurable intervals (30s / 1min / 2min)
- Export to **PDF**, **DOCX**, and **TXT**
- Saved plagiarism scores persist across sessions

### 📊 Dashboard
- Document grid with search and filter by document type
- Plagiarism score badges on each document card (Clean / Warning / High Risk)
- One-click document creation by type
- Delete with confirmation dialog

### ⚙️ Settings Drawer
Accessible from the Dashboard header:

| Section | Options |
|---|---|
| **Appearance** | Colour theme (Deep Dark / Midnight Blue / Forest Dark / Crimson Dark), Font size, Card density |
| **Editor Defaults** | Default doc type, Humanizer intensity, Canvas width, Line spacing |
| **Behaviour** | Autosave toggle & interval, Default export format, Chat panel default state |
| **Accessibility** | Reduce motion toggle, High contrast mode |
| **Account** | Display name, Reset onboarding tour, Sign out |

### 🎓 Onboarding Tour
- Interactive step-by-step guided tour powered by Intro.js
- Enlarged, teal-accented tour popups for visibility
- Reset tour at any time from Settings > Account

### 🔐 Authentication & Security
- Email/password sign up and sign in via Supabase Auth
- Protected routes — all pages behind authentication
- Row-Level Security (RLS) on all database tables — users can only access their own documents

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript 5, Vite 5 |
| **Styling** | Tailwind CSS 3, shadcn/ui, Radix UI |
| **Routing** | React Router v6 |
| **State / Data** | TanStack Query v5 |
| **Backend** | Supabase (Auth, PostgreSQL, Edge Functions) |
| **AI** | Claude API via Supabase Edge Functions |
| **Export** | html2pdf.js (PDF), docx (DOCX) |
| **Notifications** | Sonner |
| **Onboarding** | Intro.js |
| **Testing** | Vitest, Playwright |
| **Build** | Vite, lovable-tagger |

---

## 🗄️ Database Schema

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

## ☁️ Supabase Edge Functions

| Function | Endpoint | Description |
|---|---|---|
| `chat` | `/functions/v1/chat` | Proxies Claude API for the AI writing assistant |
| `humanizer` | `/functions/v1/humanizer` | Rewrites text at selected intensity using Claude |
| `plagiarism` | `/functions/v1/plagiarism` | Analyses originality and returns structured JSON report |

All functions require a valid Supabase Bearer token. Rate limiting and credit error handling are included.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) 18+ or [Bun](https://bun.sh)
- A [Supabase](https://supabase.com) project
- A Claude API key (via Anthropic or Lovable AI gateway)

### 1. Clone the repository

```bash
git clone https://github.com/Bukata19/robobuddy-writer.git
cd robobuddy-writer
```

### 2. Install dependencies

```bash
npm install
# or
bun install
```

### 3. Configure environment variables

Create a `.env` file in the root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Set the following secrets in your Supabase Edge Functions dashboard:

```
LOVABLE_API_KEY=your-ai-gateway-key
```

### 4. Apply database migrations

```bash
supabase db push
```

### 5. Deploy Edge Functions

```bash
supabase functions deploy chat
supabase functions deploy humanizer
supabase functions deploy plagiarism
```

### 6. Run the development server

```bash
npm run dev
# or
bun dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 📁 Project Structure

```
robobuddy-writer/
├── public/                    # Static assets
├── src/
│   ├── components/
│   │   ├── ui/                # shadcn/ui component library
│   │   ├── EditorPage.tsx     # Editor wrapper component
│   │   └── NavLink.tsx        # Navigation link component
│   ├── contexts/
│   │   └── AuthContext.tsx    # Global auth state
│   ├── hooks/
│   │   ├── use-mobile.tsx     # Mobile breakpoint hook
│   │   └── use-toast.ts       # Toast notification hook
│   ├── integrations/
│   │   └── supabase/          # Supabase client & generated types
│   ├── lib/
│   │   └── utils.ts           # Utility helpers (cn, etc.)
│   ├── pages/
│   │   ├── AuthPage.tsx       # Login / Sign up page
│   │   ├── Dashboard.tsx      # Document management dashboard
│   │   ├── EditorPage.tsx     # Main rich-text editor (41KB)
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

## 🎨 Design System

RobAssister uses a **Deep Dark** colour theme throughout:

| Token | Value | Usage |
|---|---|---|
| Deep Black | `#080a0c` | Page background |
| Slate Gray | `#1a2030` | Card backgrounds |
| Teal | `#00d4b8` | Primary accent, CTAs, focus rings |
| Red | `#e05252` | Destructive actions, high-risk badges |
| Foreground | `#e8edf5` | Primary text |
| Muted | `#7a8599` | Secondary text |

Additional themes available via Settings: **Midnight Blue**, **Forest Dark**, **Crimson Dark**.

---

## 🧪 Running Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# End-to-end tests (Playwright)
npx playwright test
```

---

## 📦 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests with Vitest |

---

## 🔮 Planned Upgrades

- [ ] TipTap rich-text editor integration
- [ ] Real-time collaborative editing (Liveblocks)
- [ ] Citation generator (APA / MLA / Harvard)
- [ ] Document version history
- [ ] Mobile-optimised bottom sheet panels
- [ ] Dark/light theme toggle
- [ ] Zambian Kwacha pricing tiers (Free / Pro / Premium)

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss any changes you'd like to make.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is private and proprietary. All rights reserved.

---

## 👤 Author

Built by **Sashi** — a student developer building practical AI tools for students.

> *"Write smarter. Sound human. Stay original."*

[![Live App](https://img.shields.io/badge/Open%20RobAssister-00d4b8?style=for-the-badge)](https://robobuddy-writer.lovable.app)

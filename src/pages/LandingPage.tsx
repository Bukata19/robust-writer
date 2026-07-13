import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Wand2, Target, LayoutTemplate, Save, Lock,
  PenLine, FlaskConical, BarChart3, File, ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import './LandingPage.css';

// Detected once at module load — a custom cursor is meaningless on touch, and
// could interfere with taps, so we skip it entirely on coarse pointers.
const IS_COARSE_POINTER =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(pointer: coarse)').matches;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains('reduce-motion'));

// One "featured" card (spans two columns) + smaller siblings — deliberately
// asymmetric so the Features section doesn't read like a generic 3×2 grid.
const FEATURES: { num: string; icon: LucideIcon; title: string; desc: string; featured?: boolean }[] = [
  { num: '01', icon: Bot, title: 'AI Writing Assistant', desc: 'Ask questions, get suggestions, brainstorm ideas — a personal tutor inside the editor, always one keystroke away.', featured: true },
  { num: '02', icon: Wand2, title: 'Text Humanizer', desc: 'Turn stiff AI text into natural writing. Subtle, Moderate, or Full intensity.' },
  { num: '03', icon: Target, title: 'Writing Coach', desc: 'Live feedback on passive voice, wordy phrasing, and weak openers — tuned to your level.' },
  { num: '04', icon: LayoutTemplate, title: 'Smart Templates', desc: 'Essays, research papers, reports, general docs — pre-scaffolded to skip the blank page.' },
  { num: '05', icon: Save, title: 'Autosave & Export', desc: 'Autosaved as you type. Export to PDF, DOCX, or TXT in one click.' },
  { num: '06', icon: Lock, title: 'Secure & Private', desc: 'Row-level security. Your documents belong to you.' },
];

// Action-first labels (no "Step 1 / Step 2" filler).
const STEPS = [
  { num: '01', title: 'Pick your document type', desc: 'Choose essay, research paper, report, or general. A smart template loads instantly so you start writing, not formatting.' },
  { num: '02', title: 'Write with AI beside you', desc: 'Rich-text editor plus AI chat, humanizer, and a live coach. Highlight anything to rewrite or improve on the spot.' },
  { num: '03', title: 'Polish and export', desc: 'Let the coach and polish tools tighten the draft, then export as PDF, DOCX, or TXT.' },
];

// Kept in sync manually with `templates` in src/pages/EditorPage.tsx.
// If those templates change, update the heading lists here to match.
type PreviewKey = 'essay' | 'research_paper' | 'report' | 'general';
const TEMPLATE_PREVIEW: Record<PreviewKey, { label: string; icon: LucideIcon; title: string; sections: string[] }> = {
  essay: {
    label: 'Essay', icon: PenLine, title: 'Essay Title',
    sections: ['Introduction', 'Body Paragraph 1', 'Body Paragraph 2', 'Body Paragraph 3', 'Conclusion'],
  },
  research_paper: {
    label: 'Research Paper', icon: FlaskConical, title: 'Research Paper Title',
    sections: ['Abstract', 'Introduction', 'Literature Review', 'Methodology', 'Results', 'Discussion', 'Conclusion', 'References'],
  },
  report: {
    label: 'Report', icon: BarChart3, title: 'Report Title',
    sections: ['Executive Summary', 'Introduction', 'Findings', 'Recommendations', 'Conclusion'],
  },
  general: {
    label: 'General', icon: File, title: 'Document Title',
    sections: ['Start writing…'],
  },
};
const PREVIEW_ORDER: PreviewKey[] = ['essay', 'research_paper', 'report', 'general'];

const STATS = [
  { target: 3, suffix: '+', label: 'AI-Powered Tools' },
  { target: 4, suffix: '+', label: 'Document Types' },
  { target: 100, suffix: '%', label: 'Free to Start' },
];

const NAV_LINKS = [
  { href: '#lp-features', label: 'Features', desc: 'The tools inside the editor' },
  { href: '#lp-how', label: 'How It Works', desc: 'From blank page to draft in three moves' },
  { href: '#lp-templates', label: 'Document Types', desc: 'Preview the real templates you get' },
];

const LandingPage: React.FC = () => {
  usePageTitle(
    'AI Writing Assistant for Students',
    'Write essays, research papers and reports with AI chat, humanizing, plagiarism checking and smart assignment guidance — free for students.'
  );

  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, user, navigate]);

  const rootRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const launch = () => navigate(user ? '/dashboard' : '/auth');

  // ── Dropdown state (mouse + keyboard) ──
  const [navOpen, setNavOpen] = useState(false);
  const navTriggerRef = useRef<HTMLButtonElement>(null);
  const navPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!navOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!navTriggerRef.current?.contains(t) && !navPanelRef.current?.contains(t)) setNavOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setNavOpen(false); navTriggerRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [navOpen]);

  // ── Template preview tabs ──
  const [previewKey, setPreviewKey] = useState<PreviewKey>('essay');
  const preview = TEMPLATE_PREVIEW[previewKey];

  // Try to pass a doc-type hint through the URL. Dashboard currently ignores it,
  // so this behaves as a plain launch until Dashboard is extended to read it —
  // per the brief, we don't touch Dashboard/App here.
  const launchWithTemplate = useCallback((key: PreviewKey) => {
    if (user) navigate(`/dashboard?new=${key}`);
    else navigate(`/auth?next=${encodeURIComponent(`/dashboard?new=${key}`)}`);
  }, [navigate, user]);

  // ── Custom cursor (desktop only) ──
  useEffect(() => {
    if (IS_COARSE_POINTER) return;
    const root = rootRef.current;
    const dot = cursorRef.current;
    const ring = ringRef.current;
    if (!root || !dot || !ring) return;

    root.classList.add('lp-has-cursor');
    let mx = 0, my = 0, rx = 0, ry = 0, raf = 0;
    const onMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = `${mx}px`; dot.style.top = `${my}px`;
    };
    const loop = () => {
      rx += (mx - rx) * 0.15; ry += (my - ry) * 0.15;
      ring.style.left = `${rx}px`; ring.style.top = `${ry}px`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(loop);

    const enter = () => { dot.style.transform = 'translate(-50%,-50%) scale(2.4)'; ring.style.opacity = '0.2'; };
    const leave = () => { dot.style.transform = 'translate(-50%,-50%) scale(1)'; ring.style.opacity = '0.5'; };
    const interactive = Array.from(root.querySelectorAll('a, button'));
    interactive.forEach((el) => { el.addEventListener('mouseenter', enter); el.addEventListener('mouseleave', leave); });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      interactive.forEach((el) => { el.removeEventListener('mouseenter', enter); el.removeEventListener('mouseleave', leave); });
      root.classList.remove('lp-has-cursor');
    };
  }, []);

  // ── Scroll reveal + stat counters (IntersectionObserver) ──
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = prefersReducedMotion();

    const timeouts: number[] = [];
    const intervals: number[] = [];

    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const delay = Number((e.target as HTMLElement).dataset.delay || 0);
          timeouts.push(window.setTimeout(() => e.target.classList.add('lp-visible'), reduce ? 0 : delay));
          reveal.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });

    const targets = Array.from(root.querySelectorAll<HTMLElement>('.lp-stat-item, .lp-feature-card, .lp-step, .lp-preview-shell'));
    targets.forEach((el) => reveal.observe(el));

    const strip = root.querySelector('.lp-stats-strip');
    const counters = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.querySelectorAll<HTMLElement>('[data-target]').forEach((el) => {
          const target = Number(el.dataset.target || 0);
          const suffix = el.dataset.suffix || '';
          if (reduce) { el.textContent = `${target}${suffix}`; return; }
          let val = 0;
          const stepAmt = Math.max(1, Math.ceil(target / 40));
          const timer = window.setInterval(() => {
            val = Math.min(val + stepAmt, target);
            el.textContent = `${val}${suffix}`;
            if (val >= target) window.clearInterval(timer);
          }, 35);
          intervals.push(timer);
        });
        counters.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    if (strip) counters.observe(strip);

    return () => {
      reveal.disconnect();
      counters.disconnect();
      timeouts.forEach((t) => window.clearTimeout(t));
      intervals.forEach((i) => window.clearInterval(i));
    };
  }, []);

  return (
    <div className="lp-root" ref={rootRef}>
      {!IS_COARSE_POINTER && (
        <>
          <div className="lp-cursor" ref={cursorRef} aria-hidden="true" />
          <div className="lp-cursor-ring" ref={ringRef} aria-hidden="true" />
        </>
      )}

      {/* NAV — single line, condenses to a hamburger on mobile */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <button type="button" className="lp-nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="lp-nav-logo-icon">RA</span>
            <span className="lp-nav-logo-text">RobAssister</span>
          </button>

          <div className="lp-nav-mid">
            <div className="lp-nav-dropdown">
              <button
                ref={navTriggerRef}
                type="button"
                className="lp-nav-link lp-nav-trigger"
                aria-haspopup="true"
                aria-expanded={navOpen}
                onClick={() => setNavOpen((v) => !v)}
              >
                Explore <ChevronDown size={14} strokeWidth={2} className={`lp-chev ${navOpen ? 'lp-chev-open' : ''}`} />
              </button>
              {navOpen && (
                <div ref={navPanelRef} className="lp-nav-panel" role="menu">
                  {NAV_LINKS.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      role="menuitem"
                      className="lp-nav-panel-item"
                      onClick={() => setNavOpen(false)}
                    >
                      <span className="lp-nav-panel-label">{l.label}</span>
                      <span className="lp-nav-panel-desc">{l.desc}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button type="button" className="lp-nav-cta" onClick={launch} disabled={loading}>
            Launch App ↗
          </button>
        </div>
      </nav>

      {/* HERO — lightweight CSS-only background (no canvas, no rAF loop) */}
      <section className="lp-hero">
        <div className="lp-hero-bg" aria-hidden="true">
          <div className="lp-hero-orb lp-hero-orb-a" />
          <div className="lp-hero-orb lp-hero-orb-b" />
          <div className="lp-hero-grid" />
        </div>
        <div className="lp-hero-content">
          <div className="lp-hero-badge">
            <span className="lp-badge-dot" />
            AI-POWERED WRITING ASSISTANT
          </div>
          <h1 className="lp-hero-title">
            Write Smarter.<br />
            <span className="lp-line-teal">Sound Human.</span><br />
            <span className="lp-line-dim">Stay Original.</span>
          </h1>
          <p className="lp-hero-sub">
            RobAssister is your intelligent writing co-pilot — humanize your text, get live coaching as you write, and AI-guided feedback on essays, research papers, and reports.
          </p>
          <div className="lp-hero-actions">
            <button type="button" className="lp-btn-primary" onClick={launch} disabled={loading}>
              Start Writing Free →
            </button>
            <a href="#lp-templates" className="lp-btn-ghost">Preview Templates</a>
          </div>
        </div>
        <div className="lp-scroll-hint">
          <span className="lp-scroll-line" />
          SCROLL TO EXPLORE
        </div>
        <div className="lp-hero-border-line" />
      </section>

      {/* STATS */}
      <div className="lp-stats-strip">
        <div className="lp-stats-inner">
          {STATS.map((s) => (
            <div className="lp-stat-item" key={s.label}>
              <div className="lp-stat-num" data-target={s.target} data-suffix={s.suffix}>0</div>
              <div className="lp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES — asymmetric 2-col with one featured card */}
      <section className="lp-section" id="lp-features">
        <div className="lp-section-inner">
          <div className="lp-section-tag">Core Features</div>
          <h2 className="lp-section-title">Everything You Need<br />to Write with Confidence</h2>
          <p className="lp-section-sub">Built for students who need results. Powerful AI tools inside one clean, distraction-free writing environment.</p>
          <div className="lp-features-asym">
            {FEATURES.map((f) => (
              <div className={`lp-feature-card ${f.featured ? 'lp-feature-featured' : ''}`} key={f.num}>
                <span className="lp-feature-num">{f.num}</span>
                <div className="lp-feature-icon"><f.icon size={22} strokeWidth={1.8} /></div>
                <div className="lp-feature-title">{f.title}</div>
                <div className="lp-feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEMPLATES PREVIEW — interactive, static, zero-network */}
      <section className="lp-section lp-templates" id="lp-templates">
        <div className="lp-section-inner">
          <div className="lp-section-tag">Document Types</div>
          <h2 className="lp-section-title">Preview the Real<br />Templates You'll Get</h2>
          <p className="lp-section-sub">Every document type opens with a pre-built structure. This is the exact scaffold you land in — not a marketing mockup.</p>

          <div className="lp-preview-shell">
            <div className="lp-preview-tabs" role="tablist" aria-label="Document templates">
              {PREVIEW_ORDER.map((key) => {
                const t = TEMPLATE_PREVIEW[key];
                const active = key === previewKey;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`lp-preview-tab ${active ? 'lp-preview-tab-active' : ''}`}
                    onClick={() => setPreviewKey(key)}
                  >
                    <t.icon size={16} strokeWidth={2} aria-hidden="true" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="lp-preview-page" key={previewKey /* re-mounts to retrigger CSS transition */}>
              <div className="lp-preview-page-title">{preview.title}</div>
              <div className="lp-preview-page-rule" />
              {preview.sections.map((s) => (
                <div className="lp-preview-section" key={s}>
                  <div className="lp-preview-h2">{s}</div>
                  <div className="lp-preview-lines">
                    <span /><span /><span className="lp-line-short" />
                  </div>
                </div>
              ))}
            </div>

            <div className="lp-preview-cta-row">
              <button type="button" className="lp-btn-primary" onClick={() => launchWithTemplate(previewKey)} disabled={loading}>
                Start writing with this template →
              </button>
              <span className="lp-preview-hint">No account? You'll sign in first — the {preview.label.toLowerCase()} template is one click away.</span>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — action-labeled steps */}
      <section className="lp-section lp-how" id="lp-how">
        <div className="lp-section-inner">
          <div className="lp-section-tag">How It Works</div>
          <h2 className="lp-section-title">From Blank Page<br />to Polished Draft</h2>
          <p className="lp-section-sub">Three moves. No learning curve. Just open, write, and let RobAssister do the heavy lifting.</p>
          <div className="lp-steps-list">
            {STEPS.map((s) => (
              <div className="lp-step" key={s.num}>
                <div className="lp-step-num">{s.num}</div>
                <div className="lp-step-title">{s.title}</div>
                <div className="lp-step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-section lp-cta">
        <div className="lp-cta-glow" />
        <div className="lp-cta-inner">
          <div className="lp-cta-label">// START TODAY</div>
          <h2 className="lp-cta-title">Your Writing,<br />Upgraded.</h2>
          <p className="lp-cta-sub">Join students already using RobAssister to write faster, sound more human, and submit with confidence. Free to get started.</p>
          <div className="lp-cta-actions">
            <button type="button" className="lp-btn-primary" onClick={launch} disabled={loading}>
              Open RobAssister →
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <span className="lp-footer-logo">ROBASSISTER</span>
          <span className="lp-footer-note">Built for students. Powered by AI.</span>
          <a href="https://robobuddy-writer.lovable.app" target="_blank" rel="noopener noreferrer" className="lp-footer-link">
            robobuddy-writer.lovable.app ↗
          </a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Wand2, Target, LayoutTemplate, Save, Lock,
  PenLine, FlaskConical, BarChart3, File, FileDown, FileType, FileText,
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

const FEATURES: { num: string; icon: LucideIcon; title: string; desc: string }[] = [
  { num: '01', icon: Bot, title: 'AI Writing Assistant', desc: 'Ask questions, get suggestions, brainstorm ideas — your personal tutor lives inside the editor, always ready to help you write better.' },
  { num: '02', icon: Wand2, title: 'Text Humanizer', desc: 'Transform stiff AI-generated text into natural, human-sounding writing. Choose from Subtle, Moderate, or Full intensity levels.' },
  { num: '03', icon: Target, title: 'Writing Coach', desc: 'A live coach that watches how you write — spotting passive voice, wordy phrasing, and weak openers, and nudging you with tips tuned to your level.' },
  { num: '04', icon: LayoutTemplate, title: 'Smart Templates', desc: 'Start any document with a structured template. Essays, research papers, reports, and general documents — all pre-scaffolded for you.' },
  { num: '05', icon: Save, title: 'Autosave & Export', desc: "Your work saves automatically. Export to PDF, DOCX, or TXT in one click when you're done. No lost work, ever." },
  { num: '06', icon: Lock, title: 'Secure & Private', desc: 'Powered by Supabase. Your documents belong to you, protected by email authentication and row-level security.' },
];

const STEPS = [
  { num: '01', title: 'Create Your Document', desc: 'Sign in and pick your document type — essay, research paper, report, or general. RobAssister loads a smart template to get you started immediately.' },
  { num: '02', title: 'Write & Get AI Help', desc: 'Use the rich-text editor to write. Open the AI chat panel any time for instant suggestions, outline help, or rewrites. Humanize any section with one click.' },
  { num: '03', title: 'Polish & Export', desc: 'Let the coach and polish tools tighten your draft, then export your final document in the format you need.' },
];

const DOC_TYPES: { icon: LucideIcon; label: string }[] = [
  { icon: PenLine, label: 'Essay' },
  { icon: FlaskConical, label: 'Research Paper' },
  { icon: BarChart3, label: 'Report' },
  { icon: File, label: 'General Document' },
  { icon: FileDown, label: 'PDF Export' },
  { icon: FileType, label: 'DOCX Export' },
  { icon: FileText, label: 'TXT Export' },
];

const STATS = [
  { target: 3, suffix: '+', label: 'AI-Powered Tools' },
  { target: 4, suffix: '+', label: 'Document Types' },
  { target: 100, suffix: '%', label: 'Free to Start' },
];

const LandingPage: React.FC = () => {
  usePageTitle(
    'AI Writing Assistant for Students',
    'Write essays, research papers and reports with AI chat, humanizing, plagiarism checking and smart assignment guidance — free for students.'
  );

  // A returning logged-in user (web or the installed APK) should skip the
  // marketing page entirely and land straight in their documents. Only a
  // signed-out visitor should ever see the landing page below.
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, user, navigate]);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  // Auth-aware CTA target. While auth is still resolving, don't guess — the
  // handler re-reads live values at click time so it can never send a
  // logged-in user to /auth by mistake.
  const launch = () => navigate(user ? '/dashboard' : '/auth');

  // ── Hero background: native 2D canvas (no external engine). Drifting teal
  //    particle field with connective lines, two rotating ring outlines, and
  //    mouse parallax. Reduced motion → one static frame, no rAF. ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = rootRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0, h = 0, dpr = 1;
    let particles: { x: number; y: number; vx: number; vy: number }[] = [];
    let mx = 0.5, my = 0.5; // normalized mouse for parallax
    const reduce = prefersReducedMotion();

    const seed = () => {
      const count = Math.min(90, Math.round((w * h) / 16000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      }));
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = Math.max(rect.height, window.innerHeight);
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // reset+scale after resize
      seed();
      if (reduce) draw(0); // repaint the static frame at the new size
    };

    // Ring outlines + glow, weighted to the right (echoing the original 3D cluster).
    const drawRings = (t: number) => {
      const cx = w * 0.78 + (mx - 0.5) * 40;
      const cy = h * 0.42 + (my - 0.5) * 30;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 320);
      glow.addColorStop(0, 'rgba(0,212,184,0.10)');
      glow.addColorStop(1, 'rgba(0,212,184,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2; i++) {
        const r = 150 + i * 60;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * (i ? -0.15 : 0.2) + i);
        ctx.scale(1, 0.42);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,212,184,${0.18 - i * 0.07})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      drawRings(t);
      // particles + short connective lines
      for (const p of particles) {
        if (!reduce) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,212,184,0.55)';
        ctx.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 120 * 120) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(0,212,184,${0.12 * (1 - Math.sqrt(d2) / 120)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    };

    const onMove = (e: MouseEvent) => {
      mx = e.clientX / window.innerWidth;
      my = e.clientY / window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);
    if (reduce) {
      draw(0); // single static frame; no animation loop
    } else {
      window.addEventListener('mousemove', onMove);
      let t = 0;
      const loop = () => { t += 0.005; draw(t); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

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

    // Timers started inside the observer callbacks outlive the observers, so
    // track their handles and clear them on unmount — disconnect() only stops
    // future intersections, not a pending reveal delay or a ticking counter.
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

    const targets = Array.from(root.querySelectorAll<HTMLElement>('.lp-stat-item, .lp-feature-card, .lp-step, .lp-doc-type-chip'));
    targets.forEach((el) => reveal.observe(el));

    // Counters — animate once the stats strip is well in view.
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

      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <button type="button" className="lp-nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="lp-nav-logo-icon">RA</span>
            <span className="lp-nav-logo-text">RobAssister</span>
          </button>
          <button type="button" className="lp-nav-cta" onClick={launch} disabled={loading}>
            Launch App ↗
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <canvas className="lp-canvas" ref={canvasRef} aria-hidden="true" />
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
            <a href="#lp-features" className="lp-btn-ghost">See Features</a>
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

      {/* FEATURES */}
      <section className="lp-section" id="lp-features">
        <div className="lp-section-inner">
          <div className="lp-section-tag">Core Features</div>
          <h2 className="lp-section-title">Everything You Need<br />to Write with Confidence</h2>
          <p className="lp-section-sub">Built for students who need results. Powerful AI tools inside one clean, distraction-free writing environment.</p>
          <div className="lp-features-grid">
            {FEATURES.map((f) => (
              <div className="lp-feature-card" key={f.num}>
                <span className="lp-feature-num">{f.num}</span>
                <div className="lp-feature-icon"><f.icon size={22} strokeWidth={1.8} /></div>
                <div className="lp-feature-title">{f.title}</div>
                <div className="lp-feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp-section lp-how">
        <div className="lp-section-inner">
          <div className="lp-section-tag">How It Works</div>
          <h2 className="lp-section-title">From Blank Page<br />to Polished Draft</h2>
          <p className="lp-section-sub">Three steps. No learning curve. Just open, write, and let RobAssister do the heavy lifting.</p>
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

      {/* DOC TYPES */}
      <section className="lp-section">
        <div className="lp-section-inner">
          <div className="lp-section-tag">Document Support</div>
          <h2 className="lp-section-title">Built for Every<br />Academic Format</h2>
          <p className="lp-section-sub">Whether you're writing a quick essay or a full research paper, RobAssister has the right template and tools for the job.</p>
          <div className="lp-doc-types-grid">
            {DOC_TYPES.map((d) => (
              <div className="lp-doc-type-chip" key={d.label}>
                <d.icon size={14} strokeWidth={2} />
                {d.label}
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

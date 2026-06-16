import { useId } from 'react';
import { cn } from '@/lib/utils';

type LogoSize = 'sm' | 'md' | 'lg';

interface LogoProps {
  /** Controls the size of the mark and wordmark. Dashboard uses sm/md, auth screens use lg. */
  size?: LogoSize;
  /** Whether to render the "ROBASSISTER" wordmark next to the mark. */
  showWordmark?: boolean;
  className?: string;
}

const WORDMARK = 'ROBASSISTER';

const SIZES: Record<
  LogoSize,
  { mark: number; gap: string; text: string; weight: number }
> = {
  sm: { mark: 28, gap: 'gap-2', text: 'text-base', weight: 700 },
  md: { mark: 36, gap: 'gap-2.5', text: 'text-xl', weight: 700 },
  lg: { mark: 48, gap: 'gap-3', text: 'text-3xl', weight: 900 },
};

/**
 * RobAssister brand logo: a custom inline-SVG "RA" monogram with a signature
 * cut-through stripe on a theme-tinted gradient square, paired with an Orbitron
 * wordmark. Pure CSS animation (mount + hover), and it honors reduced-motion.
 * All colors come from existing theme tokens, so it works across every theme.
 */
export function Logo({ size = 'md', showWordmark = true, className }: LogoProps) {
  // Unique mask id so multiple logos on one page don't collide.
  const maskId = useId();
  const { mark, gap, text, weight } = SIZES[size];

  return (
    <div
      className={cn('logo-root inline-flex items-center', gap, className)}
      role="img"
      aria-label="RobAssister"
    >
      <span
        className="logo-mark relative flex shrink-0 items-center justify-center rounded-[28%] shadow-md ring-1 ring-white/10"
        style={{
          width: mark,
          height: mark,
          background:
            'linear-gradient(135deg, hsl(var(--primary)), color-mix(in srgb, hsl(var(--primary)) 58%, #fff))',
        }}
      >
        <svg
          viewBox="0 0 48 48"
          width="72%"
          height="72%"
          aria-hidden="true"
          style={{ color: 'hsl(var(--primary-foreground))' }}
        >
          <mask id={maskId}>
            {/* Show everything, then carve two thin horizontal cut-through stripes. */}
            <rect width="48" height="48" fill="white" />
            <rect x="0" y="17.6" width="48" height="2.2" fill="black" />
            <rect x="0" y="29.4" width="48" height="2.2" fill="black" />
          </mask>
          <g
            mask={`url(#${maskId})`}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinejoin="miter"
            strokeLinecap="butt"
          >
            {/* R: stem, rectangular bowl, diagonal leg */}
            <path d="M10 38 V10 H20 V21 H10 M15 21 L21 38" />
            {/* A: two legs + crossbar */}
            <path d="M27 38 L32.5 10 L38 38 M29 29 H36" />
          </g>
        </svg>
      </span>

      {showWordmark && (
        <span
          aria-hidden="true"
          className={cn('font-logo leading-none tracking-[0.05em] text-foreground', text)}
          style={{ fontWeight: weight }}
        >
          {WORDMARK.split('').map((char, i) => (
            <span
              key={i}
              className="logo-letter"
              style={{ animationDelay: `${120 + i * 28}ms` }}
            >
              {char}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

export default Logo;

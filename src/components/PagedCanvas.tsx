import React, { useRef, useEffect, useState, useCallback } from 'react';

const PAGE_HEIGHT = 1056;        // A4 height at 96dpi
const PAGE_GAP = 28;             // visible grey gap between pages
const PAGE_PADDING_X = 96;
const PAGE_PADDING_Y = 80;
const PAGE_PADDING_X_MOBILE = 20;
const PAGE_PADDING_Y_MOBILE = 40;

interface PagedCanvasProps {
  children: React.ReactNode;
  maxWidth: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  'data-intro-id'?: string;
}

const PagedCanvas: React.FC<PagedCanvasProps> = ({
  children, maxWidth, className, style, onClick, ...rest
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 640
  );

  const padY = isMobile ? PAGE_PADDING_Y_MOBILE : PAGE_PADDING_Y;
  const padX = isMobile ? PAGE_PADDING_X_MOBILE : PAGE_PADDING_X;

  // Vertical distance from the top of one page to the top of the next.
  const pageStride = PAGE_HEIGHT + PAGE_GAP;

  // ── TRUE PAGE-BREAK LOGIC ──────────────────────────────────────────────
  // A block's offsetTop is measured from the content div's border box, so it
  // ALREADY INCLUDES the div's top padding (padY). All boundary math below is
  // expressed in that same padding-inclusive space.
  //
  //   Page i content area (in offsetTop space):
  //     top    = i * pageStride + padY
  //     bottom = i * pageStride + PAGE_HEIGHT - padY
  //
  // A block must not extend past its page's content bottom. If it does, we push
  // it so its top lands exactly at the next page's content top.
  const applyPageBreaks = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;

    const proseRoot = container.querySelector('.ProseMirror') as HTMLElement | null;
    if (!proseRoot) return;

    const blocks = Array.from(proseRoot.children) as HTMLElement[];
    if (blocks.length === 0) return;

    // STEP 1: clear previously injected margins, flush layout
    for (const block of blocks) block.style.marginTop = '';
    void proseRoot.offsetHeight;

    const usableHeight = PAGE_HEIGHT - padY * 2;

    // STEP 2: assign each block to a page, pushing when it would overflow
    let pageIndex = 0;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      const blockTop = block.offsetTop;          // padding-inclusive
      const blockHeight = block.offsetHeight;
      const blockBottom = blockTop + blockHeight;

      // Bottom edge of the current page's usable content area
      const pageContentBottom = pageIndex * pageStride + (PAGE_HEIGHT - padY);

      if (blockBottom > pageContentBottom && blockHeight <= usableHeight) {
        // Block overflows the page but fits within one page → push to next page
        const nextPageContentTop = (pageIndex + 1) * pageStride + padY;
        const push = nextPageContentTop - blockTop;
        if (push > 0) {
          block.style.marginTop = `${push}px`;
          void proseRoot.offsetHeight; // flush so following blocks measure correctly
        }
        pageIndex += 1;
      } else if (blockBottom > pageContentBottom) {
        // Block taller than a whole page → can't push it. Advance pageIndex to
        // the page where this block's BOTTOM lands, so the next block is
        // measured against the correct page boundary (prevents re-bleed after
        // an oversized block such as a large pasted image or table).
        while (pageIndex * pageStride + (PAGE_HEIGHT - padY) < blockBottom) {
          pageIndex += 1;
        }
      }
    }

    // STEP 3: recompute page count from final layout
    const last = blocks[blocks.length - 1];
    const finalBottom = last.offsetTop + last.offsetHeight;
    const pages = Math.max(1, Math.ceil(finalBottom / pageStride));
    setPageCount(pages);
  }, [padY, pageStride]);

  // Track viewport for responsive padding
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Recalculate whenever content changes
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    let frame = 0;
    let tries = 0;

    // Debounced scheduler. Also guards the initial mount: if TipTap hasn't
    // injected .ProseMirror yet, it retries on the next frame (up to ~30
    // frames) so the first paint still gets paginated without waiting for the
    // user to type. KEEP the single-rAF debounce — it is what prevents the
    // observer (which fires on the margins we inject) from looping infinitely.
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const hasEditor = contentRef.current?.querySelector('.ProseMirror');
        if (!hasEditor && tries < 30) {
          tries += 1;
          schedule();
          return;
        }
        tries = 0;
        applyPageBreaks();
      });
    };

    schedule(); // initial run

    const observer = new MutationObserver(schedule);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Fonts change line heights — re-run once they're ready
    if (document.fonts?.ready) {
      document.fonts.ready.then(schedule).catch(() => {});
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [applyPageBreaks]);

  const totalHeight = pageCount * PAGE_HEIGHT + (pageCount - 1) * PAGE_GAP;

  return (
    <div
      className={`relative ${maxWidth} w-full`}
      style={{ minHeight: totalHeight }}
      onClick={onClick}
      {...rest}
    >
      {/* Page background rectangles */}
      {Array.from({ length: pageCount }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 bg-white dark:bg-[#1c2030] shadow-[0_2px_16px_rgba(0,0,0,0.18)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.5)] rounded-sm border border-black/[0.06] dark:border-white/[0.04]"
          style={{
            top: i * (PAGE_HEIGHT + PAGE_GAP),
            height: PAGE_HEIGHT,
          }}
        />
      ))}

      {/* Page number labels */}
      {pageCount > 1 && Array.from({ length: pageCount }, (_, i) => (
        <div
          key={`num-${i}`}
          className="absolute right-4 text-[10px] text-gray-400 dark:text-gray-600 select-none pointer-events-none font-mono"
          style={{ top: i * (PAGE_HEIGHT + PAGE_GAP) + PAGE_HEIGHT - 24 }}
        >
          Page {i + 1} of {pageCount}
        </div>
      ))}

      {/* Editor content. Paddings are forced LAST so a caller-supplied `style`
          can never override them — the page-break math depends on padY/padX
          being exactly these values. */}
      <div
        ref={contentRef}
        className={`relative z-10 text-[#1a1a1a] dark:text-[#e8edf5] ${className ?? ''}`}
        style={{
          ...style,
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: padY,
          paddingBottom: padY,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PagedCanvas;

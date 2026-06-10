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

  // Usable writing height inside one page (page minus its top+bottom padding)
  const usablePageHeight = PAGE_HEIGHT - padY * 2;
  // Full vertical distance from the top of one page's content to the next
  const pageStride = PAGE_HEIGHT + PAGE_GAP;

  // ── TRUE PAGE-BREAK LOGIC ──────────────────────────────────────────────
  const applyPageBreaks = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;

    const proseRoot = container.querySelector('.tiptap') as HTMLElement | null;
    if (!proseRoot) return;

    const blocks = Array.from(proseRoot.children) as HTMLElement[];
    if (blocks.length === 0) return;

    // STEP 1: clear all previously injected margins so we measure natural flow
    for (const block of blocks) block.style.marginTop = '';

    // Force layout flush after clearing
    void proseRoot.offsetHeight;

    // STEP 2: walk blocks, re-measuring LIVE after each injection.
    // We track the running boundary of the current page in content-space.
    // contentTop of a block = its offsetTop within proseRoot (which already
    // starts at 0 at the top of the writing area, since padding is on the parent).
    let pageIndex = 0;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      // Live measurement — reflects any margins injected on earlier blocks
      const blockTop = block.offsetTop;
      const blockHeight = block.offsetHeight;
      const blockBottom = blockTop + blockHeight;

      // Bottom limit of the page this block currently starts on
      const currentPageBottom = pageIndex * pageStride + usablePageHeight;

      // If the block fits entirely within a page but crosses the bottom edge,
      // and it's not taller than a full page, push it to the next page.
      if (blockBottom > currentPageBottom && blockHeight <= usablePageHeight) {
        const nextPageTop = (pageIndex + 1) * pageStride;
        const push = nextPageTop - blockTop;
        if (push > 0) {
          block.style.marginTop = `${push}px`;
          void proseRoot.offsetHeight; // flush so next iteration measures correctly
        }
        pageIndex += 1;
      } else if (blockBottom > currentPageBottom) {
        // Block taller than a page — let it flow, advance pageIndex past it
        while ((pageIndex + 1) * pageStride < blockBottom + (pageStride - usablePageHeight)) {
          pageIndex += 1;
        }
      }
    }

    // STEP 3: recompute page count from final laid-out height
    const finalBottom = (() => {
      const last = blocks[blocks.length - 1];
      return last.offsetTop + last.offsetHeight;
    })();
    const pages = Math.max(1, Math.ceil((finalBottom + 1) / pageStride));
    setPageCount(pages);
  }, [usablePageHeight, pageStride]);

  // Track viewport for mobile padding
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Re-run breaks whenever content changes
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(applyPageBreaks);
    };

    schedule(); // initial

    const observer = new MutationObserver(schedule);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Re-run when fonts finish loading (affects heights)
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

      {/* Editor content */}
      <div
        ref={contentRef}
        className={`relative z-10 text-[#1a1a1a] dark:text-[#e8edf5] ${className ?? ''}`}
        style={{
          paddingLeft: padX,
          paddingRight: padX,
          paddingTop: padY,
          paddingBottom: padY,
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PagedCanvas;

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

  // The usable content height of a single page (page height minus top+bottom padding)
  const usablePageHeight = PAGE_HEIGHT - padY * 2;

  // ── TRUE PAGE-BREAK LOGIC ──────────────────────────────────────────────
  // Measures every top-level block in the editor. When a block would cross a
  // page boundary, injects top-margin to push it onto the next page — so text
  // never appears in the grey gap between pages.
  const applyPageBreaks = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;

    // The actual editor content lives inside .tiptap (ProseMirror root)
    const proseRoot = container.querySelector('.tiptap') as HTMLElement | null;
    if (!proseRoot) return;

    const blocks = Array.from(proseRoot.children) as HTMLElement[];
    if (blocks.length === 0) return;

    // Reset any previously-injected spacing first
    for (const block of blocks) {
      block.style.marginTop = '';
    }

    // The vertical stride of one page = usable height + the gap + the two paddings
    const pageStride = usablePageHeight + PAGE_GAP + padY * 2;

    let currentPageTop = 0; // top boundary (content-space) of the current page

    for (const block of blocks) {
      const blockTop = block.offsetTop;          // relative to proseRoot
      const blockHeight = block.offsetHeight;
      const blockBottom = blockTop + blockHeight;

      // The bottom edge of the current usable page area
      const pageBottomLimit = currentPageTop + usablePageHeight;

      // If this block overflows the current page AND it isn't taller than a
      // whole page (a giant block can't be pushed, it just flows), push it down.
      if (blockBottom > pageBottomLimit && blockHeight <= usablePageHeight) {
        const pushTo = currentPageTop + pageStride;        // top of next page
        const gapToPush = pushTo - blockTop;
        if (gapToPush > 0) {
          block.style.marginTop = `${gapToPush}px`;
        }
        currentPageTop = pushTo;
      } else if (blockBottom > pageBottomLimit) {
        // Block taller than a page — advance the boundary past it
        while (currentPageTop + usablePageHeight < blockBottom) {
          currentPageTop += pageStride;
        }
      }
    }

    // Recalculate page count from the final laid-out height
    const totalHeight = proseRoot.scrollHeight;
    setPageCount(Math.max(1, Math.ceil(totalHeight / pageStride)));
  }, [usablePageHeight, padY]);

  // Re-apply on resize
  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Observe content changes (typing, deleting, formatting)
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    // Run once on mount
    const raf = requestAnimationFrame(applyPageBreaks);

    const observer = new MutationObserver(() => {
      requestAnimationFrame(applyPageBreaks);
    });
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [applyPageBreaks]);

  const pageStride = usablePageHeight + PAGE_GAP + padY * 2;
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

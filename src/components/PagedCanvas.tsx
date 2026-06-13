import React, { useRef, useEffect, useState, useCallback } from 'react';

const PAGE_HEIGHT = 1056;        // A4 height at 96dpi — the page-divider interval
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

/**
 * Continuous A4-width "sheet" with subtle page-divider lines.
 *
 * Rather than simulating discrete pages (which forces whole paragraphs to jump
 * across a grey gutter and bleeds long paragraphs), the content flows in one
 * continuous sheet. Faint dashed "Page N" markers are drawn behind the text at
 * each A4 interval, so text can never fall into a broken gap. On phones the
 * sheet reflows full-width with no dividers.
 */
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

  // Number of A4-length slices the content currently spans. Measured from the
  // content box's own height, which is independent of the sheet's minHeight, so
  // the count grows and shrinks correctly as the document reflows.
  const recalcPages = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    const pages = Math.max(1, Math.ceil(content.offsetHeight / PAGE_HEIGHT));
    setPageCount(pages);
  }, []);

  // Track viewport for responsive padding / divider visibility.
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Recompute on any reflow of the content: typing, width/focus toggles,
  // line-spacing or font-size changes. A ResizeObserver catches them all —
  // including reflows that don't mutate the DOM (the old MutationObserver bug).
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    recalcPages();

    const observer = new ResizeObserver(() => recalcPages());
    observer.observe(content);

    // Fonts change line metrics — re-measure once they're ready.
    if (document.fonts?.ready) {
      document.fonts.ready.then(recalcPages).catch(() => {});
    }

    return () => observer.disconnect();
  }, [recalcPages, padX, padY]);

  // Dividers and a full last page only make sense in the desktop "paged" view.
  const showPages = !isMobile && pageCount > 1;
  const minHeight = isMobile ? undefined : pageCount * PAGE_HEIGHT;

  return (
    <div
      className={`relative ${maxWidth} w-full rounded-sm bg-white dark:bg-[#1c2030] shadow-[0_2px_16px_rgba(0,0,0,0.18)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.5)] border border-black/[0.06] dark:border-white/[0.04]`}
      style={{ minHeight }}
      onClick={onClick}
      {...rest}
    >
      {/* Page-divider markers — behind the text, never intercept the caret. */}
      {showPages && Array.from({ length: pageCount - 1 }, (_, i) => (
        <div
          key={`divider-${i}`}
          className="pointer-events-none absolute left-0 right-0 z-0 select-none border-t border-dashed border-black/10 dark:border-white/10"
          style={{ top: (i + 1) * PAGE_HEIGHT }}
        >
          <span className="absolute right-3 -top-2.5 rounded bg-white px-1.5 text-[10px] font-mono text-gray-400 dark:bg-[#1c2030] dark:text-gray-500">
            Page {i + 2}
          </span>
        </div>
      ))}

      {/* Editor content. Paddings (the page margins) are forced LAST so a
          caller-supplied `style` can never override them. */}
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

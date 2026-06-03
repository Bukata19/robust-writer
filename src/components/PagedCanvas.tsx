import React, { useRef, useEffect, useState } from 'react';

const PAGE_HEIGHT = 1056; // A4 at 96dpi
const PAGE_GAP = 24;      // gap between pages in px
const PAGE_PADDING_X = 96; // horizontal padding per page (px-24 equivalent)
const PAGE_PADDING_Y = 80; // vertical padding per page (py-20 equivalent)

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

  useEffect(() => {
    if (!contentRef.current) return;
    const ro = new ResizeObserver(() => {
      const h = contentRef.current?.scrollHeight ?? PAGE_HEIGHT;
      setPageCount(Math.max(1, Math.ceil(h / PAGE_HEIGHT)));
    });
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, []);

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
          className="absolute left-0 right-0 bg-white dark:bg-[#1c2030] shadow-[0_2px_24px_rgba(0,0,0,0.18)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.55)] rounded-sm"
          style={{
            top: i * (PAGE_HEIGHT + PAGE_GAP),
            height: PAGE_HEIGHT,
          }}
        />
      ))}
      {/* Page number labels in bottom-right corner of each page */}
      {pageCount > 1 && Array.from({ length: pageCount }, (_, i) => (
        <div
          key={`num-${i}`}
          className="absolute right-3 text-[10px] text-gray-300 dark:text-gray-600 select-none pointer-events-none font-mono"
          style={{ top: i * (PAGE_HEIGHT + PAGE_GAP) + PAGE_HEIGHT - 20 }}
        >
          {i + 1} / {pageCount}
        </div>
      ))}
      {/* Actual editor content — sits on top of the page backgrounds */}
      <div
        ref={contentRef}
        className={`relative z-10 text-[#1a1a1a] dark:text-[#e8edf5] ${className ?? ''}`}
        style={{
          paddingLeft: PAGE_PADDING_X,
          paddingRight: PAGE_PADDING_X,
          paddingTop: PAGE_PADDING_Y,
          // Bottom padding: fill to end of last page
          paddingBottom: PAGE_PADDING_Y,  
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PagedCanvas;

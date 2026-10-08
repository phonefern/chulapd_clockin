"use client";

import { useLayoutEffect, useRef, useState } from "react";

// A4 landscape (297 × 210 mm) in CSS px at 96 dpi.
const SHEET_WIDTH_PX = 1122.52;
const SHEET_HEIGHT_PX = 793.7;

// Scales the fixed-size A4 sheet down to the available width with a transform, and reserves
// the scaled height so nothing below overlaps and nothing is clipped. Never enlarges.
export function ScaledSheet({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const width = el.getBoundingClientRect().width;
      if (width > 0) setScale(Math.min(1, width / SHEET_WIDTH_PX));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full">
      <div
        className="relative mx-auto overflow-hidden"
        style={{
          width: scale === null ? "100%" : SHEET_WIDTH_PX * scale,
          height: scale === null ? 0 : SHEET_HEIGHT_PX * scale,
        }}
      >
        {scale !== null && (
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ width: SHEET_WIDTH_PX, transform: `scale(${scale})` }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

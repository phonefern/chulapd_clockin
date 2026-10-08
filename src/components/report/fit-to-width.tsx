"use client";

import { useEffect, useRef, useState } from "react";

// A4 landscape (297mm) in CSS px.
const SHEET_WIDTH_PX = 1123;

// Shrinks the fixed-size A4 sheet to the available width (phones), never enlarging it.
export function FitToWidth({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setZoom(Math.min(1, el.clientWidth / SHEET_WIDTH_PX));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full overflow-hidden">
      <div style={{ zoom }}>{children}</div>
    </div>
  );
}

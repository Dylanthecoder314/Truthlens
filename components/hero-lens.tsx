"use client";

import type { CSSProperties, PointerEvent, ReactNode } from "react";

const MARKS: { t: string; s: CSSProperties }[] = [
  { t: "source?", s: { left: "6%", top: "16%" } },
  { t: "cropped", s: { left: "38%", top: "10%" } },
  { t: "2019, not today", s: { right: "8%", top: "34%" } },
  { t: "no author", s: { left: "12%", top: "62%" } },
  { t: "edited", s: { left: "46%", top: "48%" } },
  { t: "who says?", s: { right: "14%", top: "72%" } },
  { t: "missing context", s: { left: "30%", top: "84%" } },
];

/** Hero wrapper. Under a fine pointer, a hidden layer of annotations is revealed around the cursor. */
export function HeroLens({ className, children }: { className?: string; children: ReactNode }) {
  function move(e: PointerEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }
  return (
    <section onPointerMove={move} className={`lens-host ${className ?? ""}`}>
      {children}
      <div aria-hidden="true" className="lens-layer">
        {MARKS.map((m) => (
          <span key={m.t} style={m.s}>{m.t}</span>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useRef } from "react";

// Pulls its child a few pixels toward the cursor, then springs back.
export function Magnetic({ children, strength = .28 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const move = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType !== "mouse" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) * strength;
    const y = (event.clientY - rect.top - rect.height / 2) * strength * 1.3;
    ref.current.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  };
  const reset = () => { if (ref.current) ref.current.style.transform = ""; };
  return <span className="magnetic" ref={ref} onPointerMove={move} onPointerLeave={reset}>{children}</span>;
}

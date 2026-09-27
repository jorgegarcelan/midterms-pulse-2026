"use client";

import { useEffect, useRef, useState } from "react";
import { easeOutQuart, prefersReducedMotion } from "@/components/motion/motion-utils";

type CountUpProps = { value: number; decimals?: number; delay?: number; duration?: number; locale?: boolean };

// Counts from zero the first time it scrolls into view, then glides between values when data changes.
export function CountUp({ value, decimals = 0, delay = 0, duration = 1400, locale = false }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);

  useEffect(() => {
    const first = shown.current === null;
    const from = first ? 0 : shown.current!;
    let frame = 0;
    let timer = 0;
    let observer: IntersectionObserver | null = null;
    if (prefersReducedMotion() || from === value) {
      shown.current = value;
      frame = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(frame);
    }
    const length = first ? duration : Math.min(700, duration);
    const run = () => {
      let start = 0;
      const step = (now: number) => {
        if (!start) start = now;
        const progress = Math.min(1, (now - start) / length);
        const next = from + (value - from) * easeOutQuart(progress);
        shown.current = next;
        setDisplay(next);
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    if (first && ref.current) {
      // shown stays null until the count starts, so a Strict Mode remount replays the intro.
      frame = requestAnimationFrame(() => setDisplay(0));
      observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer?.disconnect();
        timer = window.setTimeout(run, delay);
      }, { rootMargin: "0px 0px -6% 0px" });
      observer.observe(ref.current);
    } else run();
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); observer?.disconnect(); };
  }, [value, decimals, delay, duration]);

  const text = locale ? Math.round(display).toLocaleString("en-US") : display.toFixed(decimals);
  return <span className="count-up" ref={ref}>{text}</span>;
}

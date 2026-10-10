"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { easeOutQuart, prefersReducedMotion } from "@/components/motion/motion-utils";

// Glides a number to its new value whenever it changes (no intro count: the first value renders as-is).
export function useTweenedNumber(value: number, duration = 650) {
  const [display, setDisplay] = useState(value);
  const shown = useRef(value);

  useEffect(() => {
    const from = shown.current;
    let frame = 0;
    if (from === value || prefersReducedMotion()) {
      shown.current = value;
      frame = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(frame);
    }
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / duration);
      const next = from + (value - from) * easeOutQuart(progress);
      shown.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return display;
}

// FLIP for re-ordered lists: children marked data-flip="<key>" slide from their old slot to the new one.
// Pass a key that changes whenever the order changes (e.g. the sort or the joined row ids).
export function useFlipList<T extends HTMLElement>(orderKey: string, { duration = 560, maxItems = 220 } = {}) {
  const ref = useRef<T>(null);
  const previous = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const origin = root.getBoundingClientRect().top;
    const items = [...root.querySelectorAll<HTMLElement>("[data-flip]")];
    const next = new Map<string, number>();
    const animate = !prefersReducedMotion() && previous.current.size > 0 && items.length <= maxItems;
    const viewport = window.innerHeight;
    items.forEach((element, index) => {
      const box = element.getBoundingClientRect();
      const top = box.top - origin;
      const key = element.dataset.flip!;
      next.set(key, top);
      if (!animate || box.bottom < -40 || box.top > viewport + 40) return;
      const before = previous.current.get(key);
      if (before === undefined) {
        element.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: Math.min(index, 14) * 18, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
        return;
      }
      const delta = before - top;
      if (Math.abs(delta) < 1) return;
      element.animate([{ transform: `translateY(${delta}px)` }, { transform: "none" }], { duration, easing: "cubic-bezier(.16,1,.3,1)" });
    });
    previous.current = next;
  }, [orderKey, duration, maxItems]);

  return ref;
}

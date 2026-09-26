"use client";

import { useEffect, useRef, useState } from "react";

// True once the element has entered the viewport (or whenever it is in view with `once: false`).
export function useInView<T extends Element>({ once = true, rootMargin = "0px 0px -18% 0px", threshold = 0 } = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        if (once) observer.disconnect();
      } else if (!once) setInView(false);
    }, { rootMargin, threshold });
    observer.observe(element);
    return () => observer.disconnect();
  }, [once, rootMargin, threshold]);
  return [ref, inView] as const;
}

export const signedLabel = (margin: number, digits = 1) => `${margin >= 0 ? "D" : "R"}+${Math.abs(margin).toFixed(digits)}`;

"use client";

import { useEffect, useState } from "react";
import { introRemaining, prefersReducedMotion } from "@/components/motion/motion-utils";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·/+%";

// Decoder effect: characters resolve left to right out of data noise.
export function ScrambleText({ text, delay = 0, duration = 900 }: { text: string; delay?: number; duration?: number }) {
  const [output, setOutput] = useState(text);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    const noise = () => text.replace(/[^\s·]/g, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
    frame = requestAnimationFrame(() => setOutput(noise()));
    const timer = window.setTimeout(() => {
      let start = 0;
      const step = (now: number) => {
        if (!start) start = now;
        const progress = Math.min(1, (now - start) / duration);
        const resolved = Math.floor(progress * text.length);
        setOutput(text.slice(0, resolved) + noise().slice(resolved));
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, introRemaining(delay));
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [text, delay, duration]);

  return <><span className="sr-only">{text}</span><span aria-hidden="true">{output}</span></>;
}

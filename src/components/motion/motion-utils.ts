export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// True while the home cold open owns the screen (full load of "/", motion allowed, not skipped).
export function introPlaying() {
  return typeof document !== "undefined" && document.documentElement.dataset.intro !== "off" && Boolean(document.querySelector(".cold-open")) && !prefersReducedMotion();
}

// Delay for an entrance: `extra` ms after the cold open hands over (or just `extra` when it is not playing).
export function introRemaining(extra = 0) {
  if (!introPlaying()) return extra;
  return Math.max(extra, 1550 + extra - performance.now());
}

export const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;

// Small deterministic PRNG so server and client agree on "random" layouts.
export function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

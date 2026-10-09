"use client";

import { useState } from "react";

type ScrubOptions = {
  /** Number of points the cursor can land on. */
  count: number;
  /** Maps the pointer's horizontal position (0–1 across the element) to a point index. */
  indexAt: (ratio: number) => number;
  /** Point focused first when the chart receives keyboard focus (defaults to the latest). */
  initial?: number;
};

// One cursor for every chart: pointer scrubbing, touch drag and arrow keys all move the same index.
export function useChartScrub({ count, indexAt, initial }: ScrubOptions) {
  const [active, setActive] = useState<number | null>(null);
  const clamp = (index: number) => Math.max(0, Math.min(count - 1, index));

  function fromPointer(event: React.PointerEvent<Element>) {
    if (!count) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    setActive(clamp(indexAt((event.clientX - rect.left) / rect.width)));
  }

  function onKeyDown(event: React.KeyboardEvent<Element>) {
    if (!count) return;
    const start = active ?? initial ?? count - 1;
    const jump = event.shiftKey ? 10 : 1;
    const next = event.key === "ArrowRight" || event.key === "ArrowUp" ? start + jump
      : event.key === "ArrowLeft" || event.key === "ArrowDown" ? start - jump
        : event.key === "Home" ? 0
          : event.key === "End" ? count - 1
            : null;
    if (event.key === "Escape") { setActive(null); return; }
    if (next === null) return;
    event.preventDefault();
    setActive(clamp(active === null ? start : next));
  }

  return {
    active: active === null || active >= count ? null : active,
    setActive,
    bind: {
      tabIndex: count ? 0 : -1,
      onPointerMove: fromPointer,
      onPointerDown: fromPointer,
      onPointerLeave: (event: React.PointerEvent<Element>) => { if (event.pointerType === "mouse") setActive(null); },
      onKeyDown,
      onFocus: () => setActive((current) => current ?? clamp(initial ?? count - 1)),
      onBlur: () => setActive(null),
    },
  };
}

/** Index of the value nearest to `target` in an ascending list of x positions. */
export function nearestIndex(positions: readonly number[], target: number) {
  let best = 0;
  for (let index = 1; index < positions.length; index += 1) {
    if (Math.abs(positions[index] - target) < Math.abs(positions[best] - target)) best = index;
  }
  return best;
}

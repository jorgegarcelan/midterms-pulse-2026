"use client";

import { useLayoutEffect, useRef } from "react";
import { introPlaying } from "@/components/motion/motion-utils";

const YEAR = ["2", "0", "2", "6"];

// Pure-CSS title sequence: it starts on the first painted frame, before hydration.
// It only plays on a full page load; client-side visits to "/" switch it off before paint.
export function ColdOpen() {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (root.dataset.booted) root.dataset.intro = "off";
    if (!introPlaying()) return;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      ref.current?.classList.add("is-skipping");
      window.setTimeout(() => { root.dataset.intro = "off"; }, 280);
      cleanup();
    };
    const onKey = (event: KeyboardEvent) => { if (!event.metaKey && !event.ctrlKey) finish(); };
    const events: (keyof WindowEventMap)[] = ["wheel", "touchstart", "pointerdown"];
    events.forEach((name) => window.addEventListener(name, finish, { passive: true }));
    window.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => { finished = true; cleanup(); }, 2200);
    // Once every entrance has landed, drop the intro offset so later visits to "/" start instantly.
    // Not cleared on unmount: Strict Mode remounts must not cut the sequence short.
    window.setTimeout(() => { root.dataset.intro = "off"; }, 5200);
    function cleanup() {
      events.forEach((name) => window.removeEventListener(name, finish));
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    }
    return cleanup;
  }, []);

  return (
    <div className="cold-open" ref={ref} aria-hidden="true">
      <div className="co-door co-door-left"><i /></div>
      <div className="co-door co-door-right"><i /></div>
      <div className="co-stage">
        <svg className="co-pulse" viewBox="0 0 1200 200" preserveAspectRatio="none">
          <path pathLength={1} d="M0 100 H500 L528 100 L546 68 L566 142 L588 18 L612 182 L632 88 L650 100 L676 100 L690 84 L704 100 H1200" />
        </svg>
        <span className="co-burst co-burst-blue" />
        <span className="co-burst co-burst-red" />
        <div className="co-center">
          <div className="co-year">{YEAR.map((digit, index) => <span key={index}><b style={{ "--i": index } as React.CSSProperties}>{digit}</b></span>)}</div>
          <div className="co-cuts">
            <span><b>435</b> <em>House seats</em></span>
            <span><b>35</b> <em>Senate races</em></span>
            <span><b>One</b> <em>night</em></span>
          </div>
        </div>
        <div className="co-hud"><i /><i /><i /><i /><span className="co-slate">MIDTERM PULSE · ELECTION DESK</span><span className="co-live">LIVE</span><span className="co-skip">Click to skip</span></div>
        <div className="co-flash" />
      </div>
    </div>
  );
}

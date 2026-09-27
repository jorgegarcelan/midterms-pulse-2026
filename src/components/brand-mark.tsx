import { useId } from "react";

// Pulse trace drawn as an "M": Democratic blue into Republican red, meeting at the tipping-point dot.
// Same geometry as the app icons (scripts/build-icons.mjs), rescaled to a 40×24 box.
const TRACE = "M1.5 21.6H8.16L13.71 2.4L20 17.2L26.29 2.4L31.84 21.6H38.5";

export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  const id = useId();
  return (
    <svg className={className} viewBox="0 0 40 24" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-split`} gradientUnits="userSpaceOnUse" x1="1.5" y1="0" x2="38.5" y2="0">
          <stop offset=".4" stopColor="var(--blue)" /><stop offset=".6" stopColor="var(--red)" />
        </linearGradient>
      </defs>
      <path className="brand-trace" d={TRACE} pathLength={100} stroke={`url(#${id}-split)`} />
      <path className="brand-comet" d={TRACE} pathLength={100} />
      <circle className="brand-ripple" cx="20" cy="17.2" r="2.3" />
      <circle className="brand-dot" cx="20" cy="17.2" r="2.3" />
    </svg>
  );
}

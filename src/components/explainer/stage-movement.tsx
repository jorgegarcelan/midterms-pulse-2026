"use client";

import { NATIONALIZATION } from "@/lib/mp26";
import { signedLabel, useInView } from "@/components/explainer/use-in-view";
import { useT } from "@/components/i18n/locale-provider";

const MIN = -4;
const MAX = 10;
const LEGACY_BASELINE = 7.4; // v0.1's fixed constant, kept here only to show what was fixed

// Two readings of the same poll index, on two dates. Their difference is the only movement applied.
export function StageMovement({ today, benchmark, movement, benchmarkDate, runDate }: { today: number; benchmark: number; movement: number; benchmarkDate: string; runDate: string }) {
  const t = useT();
  const [ref, inView] = useInView<HTMLDivElement>();
  const x = (margin: number) => `${(Math.max(MIN, Math.min(MAX, margin)) - MIN) / (MAX - MIN) * 100}%`;
  const ticks = [-4, -2, 0, 2, 4, 6, 8, 10];

  return (
    <div className="stage-viz movement-viz" ref={ref} data-in={inView ? "true" : undefined}>
      <div className="movement-scale">
        <div className="movement-track">{ticks.map((tick) => <span key={tick} style={{ left: x(tick) }}><i />{tick === 0 ? t("EVEN") : signedLabel(tick, 0)}</span>)}</div>
        <div className="movement-marker benchmark" style={{ left: x(benchmark) }}><b>{signedLabel(benchmark)}</b><small>{t("Poll index at benchmark run")}<br />{benchmarkDate}</small></div>
        <div className="movement-marker today" style={{ left: x(today) }}><b>{signedLabel(today)}</b><small>{t("Same index, same weights")}<br />{t("today")} · {runDate}</small></div>
        <div className="movement-marker legacy" style={{ left: x(LEGACY_BASELINE) }}><b>D+7.4</b><small>{t("v0.1 fixed constant")}<br />{t("other source · Sep 19")}</small></div>
        <div className="movement-span" style={{ left: x(Math.min(today, benchmark)), width: `calc(${x(Math.max(today, benchmark))} - ${x(Math.min(today, benchmark))})` }} />
      </div>
      <div className="movement-result">
        <div><span>{t("Movement")}</span><strong className={movement >= 0 ? "dem-text" : "rep-text"}>{signedLabel(movement)}</strong></div>
        <em>× {NATIONALIZATION}</em>
        <div><span>{t("Shift applied to every race")}</span><strong>{movement * NATIONALIZATION >= 0 ? "+" : "−"}{t("{value} pts", { value: Math.abs(movement * NATIONALIZATION).toFixed(1) })}</strong></div>
      </div>
      <p className="viz-note">{t("v0.1 subtracted a fixed D+7.4 from another source and date, inventing {movement} of movement. Measured like for like, a same-day benchmark gets no adjustment; a dated fallback benchmark moves only by what the polls did since it was published.", { movement: signedLabel(today - LEGACY_BASELINE) })}</p>
    </div>
  );
}

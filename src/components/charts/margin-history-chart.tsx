"use client";

import "@/app/motion-b.css";
import { useMemo, useState } from "react";
import { useInView } from "@/components/explainer/use-in-view";
import { useT } from "@/components/i18n/locale-provider";
import { nearestIndex, useChartScrub } from "@/components/motion/chart-scrub";
import { ChartTooltip } from "@/components/motion/chart-tooltip";

export type HistoryPoint = { year: number; margin: number; winner: "D" | "R" | "O"; title: string; detail: string; hollow?: boolean };
type ContextSeries = { label: string; points: { year: number; margin: number }[] };
type Props = {
  points: HistoryPoint[];
  label: string;
  forecast?: { year: number; margin: number; label: string };
  context?: ContextSeries;
  markers?: { year: number; label: string }[];
  ariaLabel: string;
};
type Series = "dem" | "rep" | "other" | "context" | "forecast";

const VW = 720;
const VH = 300;
const PAD = { left: 50, right: 24, top: 26, bottom: 32 };
const signed = (value: number) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(Math.abs(value) >= 10 ? 0 : 1)}`;
const tone = (winner: HistoryPoint["winner"]): Series => winner === "D" ? "dem" : winner === "R" ? "rep" : "other";

// Margin over time: D above the line, R below. Dots are races, the dashed tail is today's forecast.
// Scrub with the pointer or arrow keys; legend entries toggle their series.
export function MarginHistoryChart({ points, label, forecast, context, markers = [], ariaLabel }: Props) {
  const t = useT();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [hidden, setHidden] = useState<Set<Series>>(() => new Set());

  const layout = useMemo(() => {
    const years = [...points.map((point) => point.year), ...(context?.points.map((point) => point.year) || []), forecast?.year ?? 0].filter(Boolean);
    const start = Math.min(...years) - 1;
    const end = Math.max(...years) + 1;
    const extent = Math.max(20, ...points.filter((point) => !point.hollow).map((point) => Math.abs(point.margin)), ...(context?.points.map((point) => Math.abs(point.margin)) || []), Math.abs(forecast?.margin ?? 0));
    const limit = Math.min(60, Math.ceil(extent / 10) * 10);
    const x = (year: number) => PAD.left + (year - start) / (end - start) * (VW - PAD.left - PAD.right);
    const y = (margin: number) => PAD.top + (limit - Math.max(-limit, Math.min(limit, margin))) / (2 * limit) * (VH - PAD.top - PAD.bottom);
    const line = (list: { year: number; margin: number }[]) => list.map((point, index) => `${index ? "L" : "M"} ${x(point.year).toFixed(1)} ${y(point.margin).toFixed(1)}`).join(" ");
    const tickStep = end - start > 30 ? 8 : 4;
    const firstTick = Math.ceil(start / tickStep) * tickStep;
    const xTicks = Array.from({ length: Math.floor((end - firstTick) / tickStep) + 1 }, (_, index) => firstTick + index * tickStep);
    const stops = [...points.map((point) => x(point.year)), ...(forecast ? [x(forecast.year)] : [])];
    return { x, y, limit, line, xTicks, stops };
  }, [context, forecast, points]);

  const { x, y, limit, line, xTicks, stops } = layout;
  const last = points.at(-1);
  const scrub = useChartScrub({ count: stops.length, indexAt: (ratio) => nearestIndex(stops, ratio * VW) });
  const hover = scrub.active;
  const isForecast = hover !== null && hover === points.length && Boolean(forecast);
  const hovered = hover === null || isForecast ? null : points[hover];

  const tip = useMemo(() => {
    if (hover === null) return null;
    if (isForecast && forecast) {
      const previous = last ? forecast.margin - last.margin : null;
      return {
        x: x(forecast.year), y: y(forecast.margin), year: forecast.year, margin: forecast.margin,
        title: t("{year} · forecast", { year: forecast.year }),
        rows: [
          { label: t("2026 model"), value: signed(forecast.margin), tone: forecast.margin >= 0 ? "dem" as const : "rep" as const },
          ...(previous !== null && last ? [{ label: t("Change since {year}", { year: last.year }), value: `${previous >= 0 ? "D" : "R"} +${Math.abs(previous).toFixed(1)}`, tone: "muted" as const }] : []),
        ],
        note: forecast.label,
      };
    }
    if (!hovered || hover === null) return null;
    const before = hover > 0 ? points[hover - 1] : null;
    const contextPoint = context?.points.find((point) => point.year === hovered.year);
    const unopposed = Math.abs(hovered.margin) >= 100;
    const shift = before && !unopposed && Math.abs(before.margin) < 100 ? hovered.margin - before.margin : null;
    return {
      x: x(hovered.year), y: y(hovered.margin), year: hovered.year, margin: hovered.margin,
      title: hovered.title,
      rows: [
        { label, value: unopposed ? t("Unopposed") : signed(hovered.margin), tone: hovered.winner === "D" ? "dem" as const : hovered.winner === "R" ? "rep" as const : "muted" as const },
        ...(contextPoint && !hidden.has("context") ? [{ label: context!.label, value: signed(contextPoint.margin), tone: "muted" as const, swatch: "#a78bfa" }] : []),
        ...(shift !== null && before ? [{ label: t("Change since {year}", { year: before.year }), value: `${shift >= 0 ? "D" : "R"} +${Math.abs(shift).toFixed(1)}`, tone: "muted" as const }] : []),
      ],
      note: hovered.detail,
    };
  }, [context, forecast, hidden, hover, hovered, isForecast, label, last, points, t, x, y]);

  function toggle(series: Series) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(series)) next.delete(series); else next.add(series);
      return next;
    });
  }
  const legend = (series: Series, content: React.ReactNode) => (
    <button type="button" className={hidden.has(series) ? "off" : undefined} aria-pressed={!hidden.has(series)} onClick={() => toggle(series)}>{content}</button>
  );

  return (
    <div className={`history-chart mpb-chart${hover !== null ? " scrubbing" : ""}`} ref={ref} data-in={inView ? "true" : undefined}>
      <div className="chart-frame mpb-frame" role="group" aria-label={`${ariaLabel}. ${t("Use the arrow keys to move between elections.")}`} {...scrub.bind}>
      <svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={ariaLabel}>
        <rect className="band dem" x={PAD.left} y={PAD.top} width={VW - PAD.left - PAD.right} height={y(0) - PAD.top} />
        <rect className="band rep" x={PAD.left} y={y(0)} width={VW - PAD.left - PAD.right} height={VH - PAD.bottom - y(0)} />
        {[limit, limit / 2, 0, -limit / 2, -limit].map((tick) => <g key={tick} className="grid"><line x1={PAD.left} x2={VW - PAD.right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "zero" : undefined} /><text x={PAD.left - 8} y={y(tick) + 4}>{tick === 0 ? t("EVEN") : signed(tick)}</text></g>)}
        {xTicks.map((year) => <text key={year} className={`x-tick${tip?.year === year ? " on" : ""}`} x={x(year)} y={VH - 10}>{year}</text>)}
        {markers.map((marker) => <g key={marker.year} className="marker"><line x1={x(marker.year)} x2={x(marker.year)} y1={PAD.top} y2={VH - PAD.bottom} /><text x={x(marker.year) + 4} y={PAD.top + 10}>{marker.label}</text></g>)}
        {context && context.points.length > 1 && <g className={`context-series mpb-series${hidden.has("context") ? " off" : ""}`}>
          <path d={line(context.points)} pathLength={1} />
          {context.points.map((point) => <circle key={point.year} cx={x(point.year)} cy={y(point.margin)} r={tip?.year === point.year ? 4 : 2.6} />)}
        </g>}
        {points.length > 1 && <path className="history-line" d={line(points)} pathLength={1} />}
        {forecast && last && <g className={`forecast mpb-series${hidden.has("forecast") ? " off" : ""}`}>
          <path d={`M ${x(last.year)} ${y(last.margin)} L ${x(forecast.year)} ${y(forecast.margin)}`} />
          <circle className={`${forecast.margin >= 0 ? "dem" : "rep"}${isForecast ? " active" : ""}`} cx={x(forecast.year)} cy={y(forecast.margin)} r="7" />
          {forecast.margin !== 0 && <circle className={`mpb-pulse ${forecast.margin >= 0 ? "dem" : "rep"}`} cx={x(forecast.year)} cy={y(forecast.margin)} r="7" />}
          <text x={x(forecast.year) - 10} y={y(forecast.margin) + (forecast.margin >= 0 ? -14 : 22)} textAnchor="end">{forecast.label}</text>
        </g>}
        {tip && <g className="mpb-crosshair" aria-hidden="true">
          <line className="hover-guide" x1={tip.x} x2={tip.x} y1={PAD.top} y2={VH - PAD.bottom} />
          <line className="mpb-hline" x1={PAD.left} x2={VW - PAD.right} y1={tip.y} y2={tip.y} />
          <g className="mpb-pill" transform={`translate(${PAD.left - 4} ${tip.y})`}><rect x={-46} y={-9} width={46} height={18} rx={9} /><text x={-23} y={4}>{Math.abs(tip.margin) >= 100 ? "—" : signed(tip.margin)}</text></g>
          <g className="mpb-pill year" transform={`translate(${tip.x} ${VH - 14})`}><rect x={-22} y={-9} width={44} height={18} rx={9} /><text x={0} y={4}>{tip.year}</text></g>
        </g>}
        {points.map((point, index) => (
          <circle
            key={`${point.year}-${index}`}
            className={`history-dot ${tone(point.winner)}${point.hollow ? " hollow" : ""}${hover === index ? " active" : ""}${hidden.has(tone(point.winner)) ? " off" : ""}`}
            cx={x(point.year)}
            cy={y(point.margin)}
            r="5"
            style={{ "--i": index } as React.CSSProperties}
          />
        ))}
        <rect className="hover-capture" x={PAD.left} y={0} width={VW - PAD.left - PAD.right} height={VH} />
      </svg>
      {tip && <ChartTooltip x={tip.x / VW * 100} y={tip.y / VH * 100} title={tip.title} rows={tip.rows} note={tip.note} />}
      </div>
      <div className="chart-legend mpb-legend">
        {legend("dem", <><i className="dot dem" />{t("{label}: Democratic win", { label })}</>)}
        {legend("rep", <><i className="dot rep" />{t("Republican win")}</>)}
        {points.some((point) => point.winner === "O") && legend("other", <><i className="dot other" />{t("Other")}</>)}
        {context && legend("context", <><i className="dash" />{context.label}</>)}
        {forecast && legend("forecast", <><i className="ring" />{t("2026 model")}</>)}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useInView } from "@/components/explainer/use-in-view";
import { useT } from "@/components/i18n/locale-provider";

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

const VW = 720;
const VH = 300;
const PAD = { left: 50, right: 24, top: 26, bottom: 32 };
const signed = (value: number) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(Math.abs(value) >= 10 ? 0 : 1)}`;

// Margin over time: D above the line, R below. Dots are races, the dashed tail is today's forecast.
export function MarginHistoryChart({ points, label, forecast, context, markers = [], ariaLabel }: Props) {
  const t = useT();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

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
    return { x, y, limit, line, xTicks };
  }, [context, forecast, points]);

  const { x, y, limit, line, xTicks } = layout;
  const last = points.at(-1);
  const hovered = hover === null ? null : hover === points.length ? null : points[hover];

  function move(event: React.PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width * VW;
    const candidates = [...points.map((point, index) => ({ index, x: x(point.year) })), ...(forecast ? [{ index: points.length, x: x(forecast.year) }] : [])];
    const nearest = candidates.sort((a, b) => Math.abs(a.x - px) - Math.abs(b.x - px))[0];
    setHover(nearest ? nearest.index : null);
  }

  const tip = hover === null ? null : hover === points.length && forecast
    ? { x: x(forecast.year), y: y(forecast.margin), title: t("{year} · forecast", { year: forecast.year }), detail: forecast.label, margin: forecast.margin }
    : hovered ? { x: x(hovered.year), y: y(hovered.margin), title: hovered.title, detail: hovered.detail, margin: hovered.margin } : null;

  return (
    <div className="history-chart" ref={ref} data-in={inView ? "true" : undefined}>
      <div className="chart-frame">
      <svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={ariaLabel}>
        <rect className="band dem" x={PAD.left} y={PAD.top} width={VW - PAD.left - PAD.right} height={y(0) - PAD.top} />
        <rect className="band rep" x={PAD.left} y={y(0)} width={VW - PAD.left - PAD.right} height={VH - PAD.bottom - y(0)} />
        {[limit, limit / 2, 0, -limit / 2, -limit].map((tick) => <g key={tick} className="grid"><line x1={PAD.left} x2={VW - PAD.right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "zero" : undefined} /><text x={PAD.left - 8} y={y(tick) + 4}>{tick === 0 ? t("EVEN") : signed(tick)}</text></g>)}
        {xTicks.map((year) => <text key={year} className="x-tick" x={x(year)} y={VH - 10}>{year}</text>)}
        {markers.map((marker) => <g key={marker.year} className="marker"><line x1={x(marker.year)} x2={x(marker.year)} y1={PAD.top} y2={VH - PAD.bottom} /><text x={x(marker.year) + 4} y={PAD.top + 10}>{marker.label}</text></g>)}
        {context && context.points.length > 1 && <g className="context-series">
          <path d={line(context.points)} pathLength={1} />
          {context.points.map((point) => <circle key={point.year} cx={x(point.year)} cy={y(point.margin)} r="2.6" />)}
        </g>}
        {points.length > 1 && <path className="history-line" d={line(points)} pathLength={1} />}
        {forecast && last && <g className="forecast">
          <path d={`M ${x(last.year)} ${y(last.margin)} L ${x(forecast.year)} ${y(forecast.margin)}`} />
          <circle className={forecast.margin >= 0 ? "dem" : "rep"} cx={x(forecast.year)} cy={y(forecast.margin)} r="7" />
          <text x={x(forecast.year) - 10} y={y(forecast.margin) + (forecast.margin >= 0 ? -14 : 22)} textAnchor="end">{forecast.label}</text>
        </g>}
        {points.map((point, index) => (
          <circle
            key={`${point.year}-${index}`}
            className={`history-dot ${point.winner === "D" ? "dem" : point.winner === "R" ? "rep" : "other"}${point.hollow ? " hollow" : ""}${hover === index ? " active" : ""}`}
            cx={x(point.year)}
            cy={y(point.margin)}
            r="5"
            style={{ "--i": index } as React.CSSProperties}
          />
        ))}
        {tip && <line className="hover-guide" x1={tip.x} x2={tip.x} y1={PAD.top} y2={VH - PAD.bottom} />}
        <rect className="hover-capture" x={PAD.left} y={0} width={VW - PAD.left - PAD.right} height={VH} onPointerMove={move} onPointerLeave={() => setHover(null)} />
      </svg>
      {tip && <div className="chart-tip" style={{ left: `${tip.x / VW * 100}%`, top: `${tip.y / VH * 100}%` }}>
        <strong>{tip.title}</strong>
        <b className={tip.margin >= 0 ? "dem-text" : "rep-text"}>{Math.abs(tip.margin) >= 100 ? t("Unopposed") : signed(tip.margin)}</b>
        <span>{tip.detail}</span>
      </div>}
      </div>
      <div className="chart-legend">
        <span><i className="dot dem" />{t("{label}: Democratic win", { label })}</span>
        <span><i className="dot rep" />{t("Republican win")}</span>
        {points.some((point) => point.winner === "O") && <span><i className="dot other" />{t("Other")}</span>}
        {context && <span><i className="dash" />{context.label}</span>}
        {forecast && <span><i className="ring" />{t("2026 model")}</span>}
      </div>
    </div>
  );
}

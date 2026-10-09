"use client";

import "@/app/motion-b.css";
import { useMemo, useState } from "react";
import { useInView } from "@/components/explainer/use-in-view";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { nearestIndex, useChartScrub } from "@/components/motion/chart-scrub";
import { ChartTooltip } from "@/components/motion/chart-tooltip";

type Dot = { date: string; value: number; tone: "dem" | "rep"; title: string };
type Props = {
  dots?: Dot[];
  line: { date: string; value: number }[];
  domain: [number, number];
  ticks: number[];
  format: (value: number) => string;
  baseline?: number;
  reference?: { value: number; label: string };
  tone?: "margin" | "market";
  ariaLabel: string;
  /** Legend names for the dots and the line; when given, the legend toggles each series. */
  legend?: { dots?: string; line: string };
};
type Series = "dots" | "line" | "reference";

const VW = 720;
const VH = 260;
const PAD = { left: 50, right: 24, top: 18, bottom: 30 };
const time = (date: string) => Date.parse(`${date}T00:00:00Z`);
const NEAR = 7;

// Time series for polls (dots + weighted trend) and market prices (line + area), with a model reference.
// A crosshair scrubs the line (pointer, touch or arrow keys) and lists the polls released around that date.
export function SignalChart({ dots = [], line, domain, ticks, format, baseline, reference, tone = "margin", ariaLabel, legend }: Props) {
  const t = useT();
  const locale = useIntlLocale();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [hidden, setHidden] = useState<Set<Series>>(() => new Set());

  const layout = useMemo(() => {
    const dates = [...dots.map((dot) => time(dot.date)), ...line.map((point) => time(point.date))];
    const start = Math.min(...dates);
    const end = Math.max(...dates);
    const x = (date: string) => PAD.left + (time(date) - start) / Math.max(1, end - start) * (VW - PAD.left - PAD.right);
    const y = (value: number) => PAD.top + (domain[1] - Math.max(domain[0], Math.min(domain[1], value))) / (domain[1] - domain[0]) * (VH - PAD.top - PAD.bottom);
    const path = line.map((point, index) => `${index ? "L" : "M"} ${x(point.date).toFixed(1)} ${y(point.value).toFixed(1)}`).join(" ");
    const floor = y(baseline ?? domain[0]);
    const area = line.length ? `${path} L ${x(line.at(-1)!.date).toFixed(1)} ${floor} L ${x(line[0].date).toFixed(1)} ${floor} Z` : "";
    const months: { label: string; x: number }[] = [];
    const cursor = new Date(start);
    cursor.setUTCDate(1);
    const step = end - start > 300 * 86_400_000 ? 3 : 1;
    while (cursor.getTime() <= end) {
      if (cursor.getTime() >= start) months.push({ label: cursor.toLocaleDateString(locale, { month: "short", year: "2-digit", timeZone: "UTC" }), x: x(cursor.toISOString().slice(0, 10)) });
      cursor.setUTCMonth(cursor.getUTCMonth() + step);
    }
    const stops = line.map((point) => x(point.date));
    const dotX = dots.map((dot) => x(dot.date));
    return { x, y, path, area, months, stops, dotX };
  }, [baseline, domain, dots, line, locale]);

  const { x, y, path, area, months, stops, dotX } = layout;
  const scrub = useChartScrub({ count: line.length, indexAt: (ratio) => nearestIndex(stops, ratio * VW) });
  const hover = scrub.active;
  const hovered = hover === null ? null : line[hover];
  const cx = hovered ? x(hovered.date) : 0;
  const near = useMemo(() => {
    if (!hovered || hidden.has("dots")) return new Set<number>();
    return new Set(dotX.flatMap((value, index) => Math.abs(value - cx) <= NEAR ? [index] : []));
  }, [cx, dotX, hidden, hovered]);

  function toggle(series: Series) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(series)) next.delete(series); else next.add(series);
      return next;
    });
  }

  const tip = hovered ? {
    title: new Date(time(hovered.date)).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
    rows: [
      { label: legend?.line || (tone === "market" ? t("Price") : t("Trend")), value: format(hovered.value), tone: tone === "market" ? "muted" as const : hovered.value >= 0 ? "dem" as const : "rep" as const, swatch: tone === "market" ? "#9fb8ff" : "#fff" },
      ...(reference && !hidden.has("reference") ? [{ label: t("Gap to the model"), value: tone === "market" ? `${hovered.value - reference.value >= 0 ? "+" : "−"}${Math.abs(hovered.value - reference.value).toFixed(1)} ${t("pts")}` : format(hovered.value - reference.value), tone: "muted" as const, swatch: "#f5d06f" }] : []),
    ],
    note: near.size ? [...near].sort((left, right) => Math.abs(dotX[left] - cx) - Math.abs(dotX[right] - cx)).slice(0, 3).map((index) => dots[index].title.split(" · ").filter((_, part) => part !== 1).join(" · ")).join("\n") + (near.size > 3 ? `\n${t("+{count} more", { count: near.size - 3 })}` : "") : undefined,
  } : null;

  return (
    <div className={`signal-chart mpb-chart ${tone}${hover !== null ? " scrubbing" : ""}`} ref={ref} data-in={inView ? "true" : undefined}>
      <div className="chart-frame mpb-frame" role="group" aria-label={`${ariaLabel}. ${t("Use the arrow keys to move through time.")}`} {...scrub.bind}>
      <svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={ariaLabel}>
        {ticks.map((tick) => <g key={tick} className="grid"><line x1={PAD.left} x2={VW - PAD.right} y1={y(tick)} y2={y(tick)} className={tick === baseline ? "zero" : undefined} /><text x={PAD.left - 8} y={y(tick) + 4}>{format(tick)}</text></g>)}
        {months.map((month) => <text key={month.x} className="x-tick" x={month.x} y={VH - 9}>{month.label}</text>)}
        {tone === "market" && area && <path className={`signal-area mpb-series${hidden.has("line") ? " off" : ""}`} d={area} />}
        {reference && <g className={`reference mpb-series${hidden.has("reference") ? " off" : ""}`}><line x1={PAD.left} x2={VW - PAD.right} y1={y(reference.value)} y2={y(reference.value)} /><text x={VW - PAD.right} y={y(reference.value) - 6}>{reference.label}</text></g>}
        <g className={`mpb-series${hidden.has("dots") ? " off" : ""}`}>
          {dots.map((dot, index) => <circle key={index} className={`signal-dot ${dot.tone}${near.has(index) ? " near" : ""}`} cx={dotX[index]} cy={y(dot.value)} r={near.has(index) ? 5 : 3.4} style={{ "--i": index } as React.CSSProperties}><title>{dot.title}</title></circle>)}
        </g>
        {path && <path className={`signal-line mpb-series${hidden.has("line") ? " off" : ""}`} d={path} pathLength={1} />}
        {path && line.length > 0 && !hidden.has("line") && <circle className="mpb-live-dot" cx={stops.at(-1)} cy={y(line.at(-1)!.value)} r="4" />}
        {hovered && <g className="hover-mark mpb-crosshair" aria-hidden="true">
          <line x1={cx} x2={cx} y1={PAD.top} y2={VH - PAD.bottom} />
          <line className="mpb-hline" x1={PAD.left} x2={VW - PAD.right} y1={y(hovered.value)} y2={y(hovered.value)} />
          {!hidden.has("line") && <circle cx={cx} cy={y(hovered.value)} r="5" />}
          <g className="mpb-pill" transform={`translate(${PAD.left - 4} ${y(hovered.value)})`}><rect x={-46} y={-9} width={46} height={18} rx={9} /><text x={-23} y={4}>{format(Math.round(hovered.value * 10) / 10)}</text></g>
        </g>}
        <rect className="hover-capture" x={PAD.left} y={0} width={VW - PAD.left - PAD.right} height={VH} />
      </svg>
      {hovered && tip && <ChartTooltip x={cx / VW * 100} y={y(hovered.value) / VH * 100} title={tip.title} rows={tip.rows} note={tip.note} />}
      </div>
      {legend && <div className="chart-legend mpb-legend">
        {dots.length > 0 && legend.dots && <button type="button" className={hidden.has("dots") ? "off" : undefined} aria-pressed={!hidden.has("dots")} onClick={() => toggle("dots")}><i className="dot split" />{legend.dots}</button>}
        <button type="button" className={hidden.has("line") ? "off" : undefined} aria-pressed={!hidden.has("line")} onClick={() => toggle("line")}><i className={`swatch-line ${tone}`} />{legend.line}</button>
        {reference && <button type="button" className={hidden.has("reference") ? "off" : undefined} aria-pressed={!hidden.has("reference")} onClick={() => toggle("reference")}><i className="swatch-ref" />{reference.label}</button>}
      </div>}
    </div>
  );
}

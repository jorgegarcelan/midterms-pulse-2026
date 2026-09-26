"use client";

import { useMemo, useState } from "react";
import { useInView } from "@/components/explainer/use-in-view";

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
};

const VW = 720;
const VH = 260;
const PAD = { left: 50, right: 24, top: 18, bottom: 30 };
const time = (date: string) => Date.parse(`${date}T00:00:00Z`);

// Time series for polls (dots + weighted trend) and market prices (line + area), with a model reference.
export function SignalChart({ dots = [], line, domain, ticks, format, baseline, reference, tone = "margin", ariaLabel }: Props) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

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
      if (cursor.getTime() >= start) months.push({ label: cursor.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }), x: x(cursor.toISOString().slice(0, 10)) });
      cursor.setUTCMonth(cursor.getUTCMonth() + step);
    }
    return { x, y, path, area, months };
  }, [baseline, domain, dots, line]);

  const { x, y, path, area, months } = layout;
  const hovered = hover === null ? null : line[hover];

  function move(event: React.PointerEvent<SVGRectElement>) {
    if (!line.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width * VW;
    let best = 0;
    line.forEach((point, index) => { if (Math.abs(x(point.date) - px) < Math.abs(x(line[best].date) - px)) best = index; });
    setHover(best);
  }

  return (
    <div className={`signal-chart ${tone}`} ref={ref} data-in={inView ? "true" : undefined}>
      <div className="chart-frame">
      <svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={ariaLabel}>
        {ticks.map((tick) => <g key={tick} className="grid"><line x1={PAD.left} x2={VW - PAD.right} y1={y(tick)} y2={y(tick)} className={tick === baseline ? "zero" : undefined} /><text x={PAD.left - 8} y={y(tick) + 4}>{format(tick)}</text></g>)}
        {months.map((month) => <text key={month.x} className="x-tick" x={month.x} y={VH - 9}>{month.label}</text>)}
        {tone === "market" && area && <path className="signal-area" d={area} />}
        {reference && <g className="reference"><line x1={PAD.left} x2={VW - PAD.right} y1={y(reference.value)} y2={y(reference.value)} /><text x={VW - PAD.right} y={y(reference.value) - 6}>{reference.label}</text></g>}
        {dots.map((dot, index) => <circle key={index} className={`signal-dot ${dot.tone}`} cx={x(dot.date)} cy={y(dot.value)} r="3.4" style={{ "--i": index } as React.CSSProperties}><title>{dot.title}</title></circle>)}
        {path && <path className="signal-line" d={path} pathLength={1} />}
        {hovered && <g className="hover-mark"><line x1={x(hovered.date)} x2={x(hovered.date)} y1={PAD.top} y2={VH - PAD.bottom} /><circle cx={x(hovered.date)} cy={y(hovered.value)} r="5" /></g>}
        <rect className="hover-capture" x={PAD.left} y={0} width={VW - PAD.left - PAD.right} height={VH} onPointerMove={move} onPointerLeave={() => setHover(null)} />
      </svg>
      {hovered && <div className="chart-tip" style={{ left: `${x(hovered.date) / VW * 100}%`, top: `${y(hovered.value) / VH * 100}%` }}>
        <strong>{new Date(time(hovered.date)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</strong>
        <b>{format(hovered.value)}</b>
      </div>}
      </div>
    </div>
  );
}

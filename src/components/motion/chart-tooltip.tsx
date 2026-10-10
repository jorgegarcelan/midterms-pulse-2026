"use client";

import "@/app/motion-a.css";

type TooltipRow = { label: string; value: string; tone?: "dem" | "rep" | "house" | "senate" | "muted"; swatch?: string };

type ChartTooltipProps = {
  /** Anchor position as a percentage of the chart frame (0–100). */
  x: number;
  y: number;
  title: string;
  rows?: TooltipRow[];
  note?: string;
};

// Rich chart tooltip: a title, keyed rows with swatches and a footnote. It flips at the frame edges
// so it never spills off a narrow screen, and glides between points instead of jumping.
export function ChartTooltip({ x, y, title, rows = [], note }: ChartTooltipProps) {
  const edge = x < 18 ? "left" : x > 82 ? "right" : "center";
  return (
    <div className="chart-tip mpa-tip" data-edge={edge} data-below={y < 30 ? "true" : undefined} style={{ left: `${x}%`, top: `${y}%` }} role="status" aria-live="polite">
      <strong>{title}</strong>
      {rows.map((row) => (
        <span key={row.label} className="mpa-tip-row" data-tone={row.tone}>
          <i style={row.swatch ? { background: row.swatch } : undefined} />
          <em>{row.label}</em>
          <b>{row.value}</b>
        </span>
      ))}
      {note && <small>{note}</small>}
    </div>
  );
}

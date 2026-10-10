"use client";

import { useState } from "react";
import { useInView } from "@/components/explainer/use-in-view";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { ChartTooltip } from "@/components/motion/chart-tooltip";
import { useChartScrub } from "@/components/motion/chart-scrub";

type Series = { key: string; values: (number | null)[]; className: string; label: string };
type Props = { series: Series[]; dates: string[]; min: number; max: number; reference?: number; unit: string; label: string };

const WIDTH = 640;
const HEIGHT = 200;
const PAD = { top: 12, right: 44, bottom: 24, left: 8 };

// The forecast-history chart: lines draw in on scroll, the legend toggles a series, and a crosshair
// (pointer, touch or arrow keys) reads every series on one archived run, with its day-on-day change.
export function ChangesLineChart({ series, dates, min, max, reference, unit, label }: Props) {
  const t = useT();
  const locale = useIntlLocale();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const span = Math.max(1e-6, max - min);
  const x = (index: number) => PAD.left + (dates.length < 2 ? (WIDTH - PAD.left - PAD.right) / 2 : index / (dates.length - 1) * (WIDTH - PAD.left - PAD.right));
  const y = (value: number) => PAD.top + (1 - (value - min) / span) * (HEIGHT - PAD.top - PAD.bottom);
  const scrub = useChartScrub({ count: dates.length, indexAt: (ratio) => dates.length < 2 ? 0 : Math.round((ratio * WIDTH - PAD.left) / (WIDTH - PAD.left - PAD.right) * (dates.length - 1)) });
  const active = scrub.active;
  const visible = series.filter((item) => !hidden.has(item.key));
  const format = (value: number) => `${Math.round(value * 10) / 10}${unit}`;
  const dateLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const anchor = active === null ? null : visible.map((item) => item.values[active]).find((value) => value !== null && value !== undefined) ?? null;

  function toggle(key: string) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else if (next.size < series.length - 1) next.add(key);
      return next;
    });
  }

  return (
    <div ref={ref} className="mpa-changes" data-in={inView ? "true" : undefined}>
      {series.length > 1 && <div className="mpa-legend-toggles mpa-changes-toggles" role="group" aria-label={t("Show or hide a series")}>
        {series.map((item) => <button key={item.key} type="button" className={item.className} aria-pressed={!hidden.has(item.key)} onClick={() => toggle(item.key)}>{item.label}</button>)}
      </div>}
      <div className="mpa-chart-frame">
        <svg className="changes-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} {...scrub.bind}>
          {reference !== undefined && <><line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(reference)} y2={y(reference)} className="changes-ref" /><text x={WIDTH - PAD.right + 6} y={y(reference) + 4}>{reference}{unit}</text></>}
          {series.map((item, order) => {
            const points = item.values.map((value, index) => value === null ? null : [x(index), y(value)] as const).filter((point): point is readonly [number, number] => point !== null);
            const last = points.at(-1);
            const lastValue = item.values.filter((value) => value !== null).at(-1);
            return <g key={item.key} className={`${item.className} mpa-series`} data-off={hidden.has(item.key) ? "true" : undefined} style={{ "--o": order } as React.CSSProperties}>
              {points.length > 1 && <path className="mpa-changes-line" d={points.map(([px, py], index) => `${index ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ")} pathLength={1} />}
              {points.map(([px, py], index) => <circle key={index} className="mpa-changes-dot" cx={px} cy={py} r={points.length > 40 ? 0 : 3} style={{ "--i": index } as React.CSSProperties} />)}
              {last && <text className="mpa-changes-end" x={last[0] + 6} y={last[1] + 4}>{lastValue}{unit}</text>}
            </g>;
          })}
          {dates.length > 0 && <><text x={PAD.left} y={HEIGHT - 6} className="changes-axis">{dates[0]}</text>{dates.length > 1 && <text x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end" className="changes-axis">{dates.at(-1)}</text>}</>}
          {active !== null && <g className="mpa-cross">
            <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={HEIGHT - PAD.bottom} />
            {visible.map((item) => item.values[active] !== null && <circle key={item.key} className={item.className === "series-senate" ? "senate-gold" : "dem"} cx={x(active)} cy={y(item.values[active]!)} r="5" />)}
          </g>}
          <rect className="hover-capture" x={PAD.left} y={0} width={WIDTH - PAD.left - PAD.right} height={HEIGHT} />
        </svg>
        {active !== null && anchor !== null && <ChartTooltip x={x(active) / WIDTH * 100} y={y(anchor) / HEIGHT * 100} title={dateLabel(dates[active])} rows={visible.flatMap((item) => {
          const value = item.values[active];
          if (value === null || value === undefined) return [];
          const previous = active > 0 ? item.values[active - 1] : null;
          const change = previous === null || previous === undefined ? "" : `  (${value - previous > 0 ? "+" : value - previous < 0 ? "−" : "±"}${Math.abs(Math.round((value - previous) * 10) / 10)})`;
          return [{ label: item.label, value: `${format(value)}${change}`, tone: item.className === "series-senate" ? "muted" as const : "dem" as const, swatch: item.className === "series-senate" ? "#e5d7a8" : undefined }];
        })} note={active > 0 ? t("In brackets: change since the previous run") : undefined} />}
      </div>
    </div>
  );
}

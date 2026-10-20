"use client";

import { useMemo, useRef, useState } from "react";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { FEATURE_LABELS, type CensusBacktestYear, type CensusFeature } from "@/lib/census-model";

// Party colours come from the site theme; "split" marks a race where census and polls disagree.
const D = "var(--blue)";
const R = "var(--red)";
const SPLIT = "#fbbf24";
const NEUTRAL = "#aab0bd";
const WITH_PRES = "#a78bfa";

export function useNumber() {
  const intl = useIntlLocale();
  return useMemo(() => ({
    fixed: (value: number, digits = 1) => value.toLocaleString(intl, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    percent: (value: number, digits = 0) => value.toLocaleString(intl, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }),
    margin: (value: number, digits = 1) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toLocaleString(intl, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`,
  }), [intl]);
}

type Tip = { x: number; y: number; title: string; lines: string[] } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div className="cz-tip" style={{ left: `${tip.x}%`, top: `${tip.y}%` }} role="status">
      <b>{tip.title}</b>
      {tip.lines.map((line) => <span key={line}>{line}</span>)}
    </div>
  );
}

// 20,000 simulated chambers: Democratic seats, with the majority line, the median and the 80% band.
// Defaults are the House (218 of 435); the Senate passes its own range and 51.
export function SeatHistogram({ distribution, median, p10, p90, compact = false, range = [150, 320], majority = 218, ticks = [175, 200, 250, 275, 300], chamber = "House" }: {
  distribution: [number, number][]; median: number; p10: number; p90: number; compact?: boolean;
  range?: [number, number]; majority?: number; ticks?: number[]; chamber?: "House" | "Senate";
}) {
  const t = useT();
  const n = useNumber();
  const [tip, setTip] = useState<Tip>(null);
  const width = 640, height = compact ? 220 : 260, pad = { l: 8, r: 8, t: 34, b: 30 };
  const [lo, hi] = range;
  const peak = Math.max(...distribution.map(([, share]) => share));
  const x = (seats: number) => pad.l + (seats - lo) / (hi - lo) * (width - pad.l - pad.r);
  const y = (share: number) => height - pad.b - share / peak * (height - pad.t - pad.b);
  const step = (width - pad.l - pad.r) / (hi - lo);
  const bars = distribution.filter(([seats]) => seats >= lo && seats <= hi);

  return (
    <figure className="cz-chart cz-hist">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t(chamber === "House" ? "Simulated Democratic House seats: median {median}, 80% between {p10} and {p90}" : "Simulated Democratic Senate seats: median {median}, 80% between {p10} and {p90}", { median, p10, p90 })}
        onPointerLeave={() => setTip(null)}>
        <rect x={x(p10)} y={pad.t - 8} width={x(p90) - x(p10)} height={height - pad.t - pad.b + 8} className="cz-band" />
        {bars.map(([seats, share]) => (
          <rect key={seats} x={x(seats) - step / 2 + .5} y={y(share)} width={Math.max(step - 1, .8)} height={height - pad.b - y(share)} rx={1}
            fill={seats >= majority ? D : R} opacity={tip && tip.title !== String(seats) ? .55 : .9}
            onPointerEnter={() => setTip({ x: x(seats) / width * 100, y: y(share) / height * 100, title: String(seats), lines: [t("{share} of simulations", { share: n.percent(share, 1) })] })} />
        ))}
        <line x1={x(majority - .5)} x2={x(majority - .5)} y1={pad.t - 14} y2={height - pad.b} className="cz-rule" />
        <text x={x(majority - .5) + 6} y={pad.t - 4} className="cz-note">{t("{n} for a majority", { n: majority })}</text>
        <line x1={x(median)} x2={x(median)} y1={pad.t + 6} y2={height - pad.b} className="cz-median" />
        <text x={x(median)} y={height - pad.b + 20} textAnchor="middle" className="cz-axis strong">{median}</text>
        {ticks.filter((tick) => Math.abs(tick - median) > (hi - lo) / 30).map((tick) => <text key={tick} x={x(tick)} y={height - pad.b + 20} textAnchor="middle" className="cz-axis">{tick}</text>)}
        <line x1={pad.l} x2={width - pad.r} y1={height - pad.b} y2={height - pad.b} className="cz-baseline" />
      </svg>
      <Tooltip tip={tip} />
      {!compact && <figcaption>{t("Each bar is a number of Democratic seats; its height, how often it came up in 20,000 simulations. The shaded band holds 80% of them.")}{chamber === "Senate" ? ` ${t("A 50–50 Senate is Republican: the Vice President breaks ties.")}` : ""}</figcaption>}
    </figure>
  );
}

// How much the 2024 blind prediction degrades when one variable is shuffled, and which way it pushes.
export function FeatureBars({ features }: { features: CensusFeature[] }) {
  const t = useT();
  const n = useNumber();
  const top = features.slice(0, 10);
  const max = Math.max(...top.map((feature) => feature.importance));
  return (
    <figure className="cz-chart cz-features">
      <ol>
        {top.map((feature, i) => {
          const side = feature.key === "division" ? null : Math.abs(feature.correlation) < .1 ? "mixed" : feature.correlation > 0 ? "D" : "R";
          return (
            <li key={feature.key} style={{ "--i": i, "--w": `${feature.importance / max * 100}%` } as React.CSSProperties}>
              <span className="cz-feature-name">{t(FEATURE_LABELS[feature.key] ?? feature.key)}</span>
              <span className="cz-feature-bar" aria-hidden="true"><i /></span>
              <b>{t("+{points} pts", { points: n.fixed(feature.importance) })}</b>
              <span className={`cz-feature-dir ${side ?? "none"}`}>
                {side === "D" ? t("more → Democratic") : side === "R" ? t("more → Republican") : side === "mixed" ? t("no single direction") : t("where the district is")}
              </span>
            </li>
          );
        })}
      </ol>
      <figcaption>{t("Bar length: how many points the 2024 district error grows when that variable is shuffled at random (the model trained only on 2012–2022). Direction: the plain correlation with the Democratic margin across 2024 districts.")}</figcaption>
    </figure>
  );
}

// Per cycle: the real result, the census model given the real popular vote, and the fully blind forecast with its 80% range.
export function BacktestChart({ years }: { years: CensusBacktestYear[] }) {
  const t = useT();
  const width = 640, rowH = 52, pad = { l: 56, r: 24, t: 30, b: 34 };
  const height = pad.t + years.length * rowH + pad.b;
  const lo = 160, hi = 290;
  const x = (seats: number) => pad.l + (seats - lo) / (hi - lo) * (width - pad.l - pad.r);
  return (
    <figure className="cz-chart cz-backtest">
      <div className="cz-legend" aria-hidden="true">
        <span><i className="actual" />{t("Actual result")}</span>
        <span><i className="oracle" />{t("Census, given the real popular vote")}</span>
        <span><i className="blind" />{t("Census, fully blind (80% range)")}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t("Backtest: Democratic seats predicted and won, 2016 to 2024")}>
        <line x1={x(218)} x2={x(218)} y1={pad.t - 12} y2={height - pad.b} className="cz-rule" />
        <text x={x(218) + 6} y={pad.t - 2} className="cz-note">{t("218")}</text>
        {years.map((year, i) => {
          const cy = pad.t + i * rowH + rowH / 2;
          return (
            <g key={year.year}>
              <text x={pad.l - 14} y={cy + 4} textAnchor="end" className="cz-axis strong">{year.year}</text>
              <line x1={x(Math.max(lo, year.p10))} x2={x(Math.min(hi, year.p90))} y1={cy} y2={cy} className="cz-range" />
              <circle cx={x(year.sim)} cy={cy} r={5} className="cz-blind" />
              <circle cx={x(year.oracle)} cy={cy} r={6} className="cz-oracle" />
              <rect x={x(year.actual) - 5.5} y={cy - 5.5} width={11} height={11} transform={`rotate(45 ${x(year.actual)} ${cy})`} className="cz-actual" />
            </g>
          );
        })}
        {[175, 200, 225, 250, 275].map((tick) => <text key={tick} x={x(tick)} y={height - pad.b + 22} textAnchor="middle" className="cz-axis">{tick}</text>)}
        <line x1={pad.l} x2={width - pad.r} y1={height - pad.b + 4} y2={height - pad.b + 4} className="cz-baseline" />
      </svg>
      <figcaption>{t("Democratic seats. Each year was predicted using only earlier cycles.")}</figcaption>
    </figure>
  );
}

// Swing against the president's party in every midterm since 2002, House popular vote.
export function SwingBars({ swings }: { swings: Record<string, number> }) {
  const t = useT();
  const n = useNumber();
  const entries = Object.entries(swings);
  const max = Math.max(...entries.map(([, value]) => Math.abs(value)));
  return (
    <figure className="cz-chart cz-swings">
      <ul>
        {entries.map(([year, value]) => (
          <li key={year}>
            <span>{year}</span>
            <span className="cz-swing-track" aria-hidden="true">
              <i style={{ width: `${Math.abs(value) / max * 50}%`, [value >= 0 ? "left" : "right"]: "50%" } as React.CSSProperties} className={value >= 0 ? "against" : "for"} />
            </span>
            <b>{value >= 0 ? "−" : "+"}{n.fixed(Math.abs(value))}</b>
          </li>
        ))}
      </ul>
      <figcaption>{t("Points the president's party lost (−) or gained (+) in the House popular vote at each midterm, against the election two years before.")}</figcaption>
    </figure>
  );
}

export type ScatterPoint = { code: string; census: number; polls: number };

// Census margin against the MP-26 (polls) margin for every district; off-diagonal quadrants are disagreements.
export function DisagreementScatter({ points }: { points: ScatterPoint[] }) {
  const t = useT();
  const n = useNumber();
  const svg = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<ScatterPoint | null>(null);
  const size = 520, pad = 40, span = 50;
  const clamp = (value: number) => Math.max(-span, Math.min(span, value));
  const sx = (value: number) => pad + (clamp(value) + span) / (2 * span) * (size - 2 * pad);
  const sy = (value: number) => size - pad - (clamp(value) + span) / (2 * span) * (size - 2 * pad);
  const colour = (point: ScatterPoint) => (point.census >= 0) !== (point.polls >= 0) ? SPLIT : point.census >= 0 ? D : R;

  function nearest(event: React.PointerEvent<SVGSVGElement>) {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const px = (event.clientX - box.left) / box.width * size;
    const py = (event.clientY - box.top) / box.height * size;
    let best: ScatterPoint | null = null, bestDistance = 22 * 22;
    for (const point of points) {
      const dx = sx(point.census) - px, dy = sy(point.polls) - py;
      if (dx * dx + dy * dy < bestDistance) { best = point; bestDistance = dx * dx + dy * dy; }
    }
    setActive(best);
  }

  return (
    <figure className="cz-chart cz-scatter">
      <div className="cz-legend" aria-hidden="true">
        <span><i style={{ background: D }} />{t("Both say Democratic")}</span>
        <span><i style={{ background: R }} />{t("Both say Republican")}</span>
        <span><i style={{ background: SPLIT }} />{t("They disagree")}</span>
      </div>
      <div className="cz-scatter-frame">
        <svg ref={svg} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t("Census margin against poll-based margin for every House district")}
          onPointerMove={nearest} onPointerLeave={() => setActive(null)}>
          <rect x={pad} y={pad} width={sx(0) - pad} height={sy(0) - pad} className="cz-quad" />
          <rect x={sx(0)} y={sy(0)} width={size - pad - sx(0)} height={size - pad - sy(0)} className="cz-quad" />
          <line x1={sx(0)} x2={sx(0)} y1={pad} y2={size - pad} className="cz-baseline" />
          <line x1={pad} x2={size - pad} y1={sy(0)} y2={sy(0)} className="cz-baseline" />
          <line x1={sx(-span)} y1={sy(-span)} x2={sx(span)} y2={sy(span)} className="cz-diagonal" />
          <text x={size - pad} y={pad - 12} textAnchor="end" className="cz-note">{t("polls more Democratic ↑")}</text>
          <text x={size - pad} y={size - 10} textAnchor="end" className="cz-note">{t("census more Democratic →")}</text>
          <text x={pad + 8} y={pad + 18} className="cz-quad-label">{t("Census R · polls D")}</text>
          <text x={size - pad - 8} y={size - pad - 10} textAnchor="end" className="cz-quad-label">{t("Census D · polls R")}</text>
          {points.map((point) => (
            <circle key={point.code} cx={sx(point.census)} cy={sy(point.polls)} r={active?.code === point.code ? 6.5 : 4} fill={colour(point)}
              className={active && active.code !== point.code ? "cz-dot dim" : "cz-dot"} />
          ))}
        </svg>
        {active && (
          <div className="cz-tip" style={{ left: `${sx(active.census) / size * 100}%`, top: `${sy(active.polls) / size * 100}%` }} role="status">
            <b>{active.code}</b>
            <span>{t("Census: {margin}", { margin: n.margin(active.census) })}</span>
            <span>{t("Polls (MP-26): {margin}", { margin: n.margin(active.polls) })}</span>
          </div>
        )}
      </div>
      <figcaption>{t("Each dot is a district. Margins beyond ±50 points sit on the edge.")}</figcaption>
    </figure>
  );
}

// Change in expected Democratic seats from the new 2026 maps, state by state: census only vs census + presidential results.
export function RedrawBars({ rows }: { rows: { state: string; census: number; withPres: number }[] }) {
  const t = useT();
  const n = useNumber();
  const max = Math.max(3, ...rows.flatMap((row) => [Math.abs(row.census), Math.abs(row.withPres)]));
  const bar = (value: number, colour: string) => (
    <span className="cz-redraw-track">
      <i style={{ width: `${Math.abs(value) / max * 50}%`, [value >= 0 ? "left" : "right"]: "50%", background: colour } as React.CSSProperties} />
    </span>
  );
  const sign = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${n.fixed(Math.abs(value))}`;
  return (
    <figure className="cz-chart cz-redraw">
      <div className="cz-legend" aria-hidden="true">
        <span><i style={{ background: NEUTRAL }} />{t("Census only")}</span>
        <span><i style={{ background: WITH_PRES }} />{t("Census + 2024 presidential results")}</span>
      </div>
      <div className="cz-redraw-axis" aria-hidden="true"><span>{t("← fewer Democratic seats")}</span><span>{t("more Democratic seats →")}</span></div>
      <ul>
        {[...rows].sort((a, b) => a.withPres - b.withPres).map((row) => (
          <li key={row.state}>
            <span className="cz-redraw-state">{row.state}</span>
            <span className="cz-redraw-bars">{bar(row.census, NEUTRAL)}{bar(row.withPres, WITH_PRES)}</span>
            <span className="cz-redraw-values"><b>{sign(row.census)}</b><b className="pres">{sign(row.withPres)}</b></span>
          </li>
        ))}
      </ul>
      <figcaption>{t("Expected Democratic seats on the November 2026 maps minus the same model on the 2024 maps, in the same national environment.")}</figcaption>
    </figure>
  );
}

// The 35 Senate races of 2026: census margin per state (diverging) and the Democratic win chance.
export function SenateStates({ races }: { races: { state: string; margin: number; pD: number; special?: boolean }[] }) {
  const t = useT();
  const n = useNumber();
  const cap = 40;
  return (
    <figure className="cz-chart cz-senate-states">
      <div className="cz-redraw-axis" aria-hidden="true"><span>{t("← Republican")}</span><span>{t("Democratic →")}</span></div>
      <ul>
        {[...races].sort((a, b) => b.margin - a.margin).map((race) => (
          <li key={race.state}>
            <span className="cz-redraw-state">{race.state}{race.special ? <sup>*</sup> : null}</span>
            <span className="cz-redraw-track">
              <i style={{ width: `${Math.min(Math.abs(race.margin), cap) / cap * 50}%`, [race.margin >= 0 ? "left" : "right"]: "50%", background: race.margin >= 0 ? D : R } as React.CSSProperties} />
            </span>
            <b className={race.margin >= 0 ? "blue" : "red"}>{n.margin(race.margin)}</b>
            <span className="cz-senate-p">{n.percent(race.pD)}</span>
          </li>
        ))}
      </ul>
      <figcaption>{t("Census margin and Democratic win chance in each state with a 2026 Senate race. * Special election (Florida, Ohio). Margins beyond ±40 points are capped.")}</figcaption>
    </figure>
  );
}

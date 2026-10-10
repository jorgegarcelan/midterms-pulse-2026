"use client";

import { useEffect, useMemo, useState } from "react";
import { pollWeight, POLL_HALF_LIFE_DAYS, type WeightedPoll } from "@/lib/mp26";
import { signedLabel, useInView } from "@/components/explainer/use-in-view";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";

export type ExplainerPoll = WeightedPoll & { id: string; pollster: string; dem: number; rep: number };

const VW = 640;
const VH = 330;
const PAD = { left: 44, right: 16, top: 18, bottom: 78 };
const Y_MIN = -8;
const Y_MAX = 14;

// Every poll starts equal; then each one grows or shrinks to the weight the model gives it.
export function StagePollWeights({ polls, runDate, modelMargin, totalPolls }: { polls: ExplainerPoll[]; runDate: string; modelMargin: number; totalPolls: number }) {
  const t = useT();
  const intl = useIntlLocale();
  const [ref, inView] = useInView<HTMLDivElement>();
  const [weighted, setWeighted] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const timer = window.setTimeout(() => setWeighted(true), 1300);
    return () => window.clearTimeout(timer);
  }, [inView]);

  const layout = useMemo(() => {
    if (!polls.length) return null;
    const end = Date.parse(`${runDate}T00:00:00Z`);
    const start = Math.min(...polls.map((poll) => Date.parse(`${poll.endDate}T00:00:00Z`))) - 2 * 86_400_000;
    const x = (date: number) => PAD.left + (date - start) / (end - start) * (VW - PAD.left - PAD.right);
    const y = (margin: number) => PAD.top + (Y_MAX - Math.max(Y_MIN, Math.min(Y_MAX, margin))) / (Y_MAX - Y_MIN) * (VH - PAD.top - PAD.bottom);
    const scored = polls.map((poll) => ({ poll, ...pollWeight(poll, runDate) }));
    const maxWeight = Math.max(...scored.map((item) => item.weight));
    const dots = scored.map((item) => ({ ...item, cx: x(Date.parse(`${item.poll.endDate}T00:00:00Z`)), cy: y(item.poll.dem - item.poll.rep), scale: Math.max(.35, Math.sqrt(item.weight / maxWeight) * 2.6) }));
    const unweighted = polls.reduce((sum, poll) => sum + poll.dem - poll.rep, 0) / polls.length;
    // Recency curve along the bottom band: weight of a poll that closed on each date.
    const band = { top: VH - PAD.bottom + 26, bottom: VH - 10 };
    const curve = Array.from({ length: 61 }, (_, index) => {
      const date = start + (end - start) * index / 60;
      const recency = .5 ** ((end - date) / 86_400_000 / POLL_HALF_LIFE_DAYS);
      return `${x(date).toFixed(1)},${(band.bottom - recency * (band.bottom - band.top)).toFixed(1)}`;
    });
    const heaviest = [...scored].sort((a, b) => b.weight - a.weight)[0];
    const months = Array.from({ length: 5 }, (_, index) => start + (end - start) * index / 4).map((date) => ({ x: x(date), label: new Date(date).toLocaleDateString(intl, { month: "short", day: "numeric", timeZone: "UTC" }) }));
    return { dots, y, unweighted, curve, band, heaviest, months };
  }, [polls, runDate, intl]);

  if (!layout) return <div className="stage-viz viz-empty" ref={ref}>{t("Loading polls…")}</div>;
  const { dots, y, unweighted, curve, band, heaviest, months } = layout;

  return (
    <div className="stage-viz" ref={ref} data-in={inView ? "true" : undefined} data-weighted={weighted ? "true" : undefined}>
      <div className="viz-toolbar">
        <span>{t("Latest {count} of {total} polls · dot area = model weight", { count: polls.length, total: totalPolls.toLocaleString(intl) })}</span>
        <div className="segmented" role="group" aria-label={t("Poll weighting")}>
          <button type="button" className={!weighted ? "selected" : ""} onClick={() => setWeighted(false)}>{t("Equal")}</button>
          <button type="button" className={weighted ? "selected" : ""} onClick={() => setWeighted(true)}>{t("Weighted")}</button>
        </div>
      </div>
      <svg viewBox={`0 0 ${VW} ${VH}`} className="viz-svg" role="img" aria-label={t("Generic-ballot polls sized by model weight; weighted average {margin}", { margin: signedLabel(modelMargin) })}>
        {[-5, 0, 5, 10].map((tick) => <g key={tick} className="viz-grid"><line x1={PAD.left} x2={VW - PAD.right} y1={y(tick)} y2={y(tick)} /><text x={PAD.left - 8} y={y(tick) + 4}>{tick === 0 ? t("EVEN") : signedLabel(tick, 0)}</text></g>)}
        {dots.map((dot, index) => (
          <circle
            key={dot.poll.id}
            className={`poll-dot ${dot.poll.dem >= dot.poll.rep ? "dem" : "rep"}`}
            cx={dot.cx.toFixed(1)}
            cy={dot.cy.toFixed(1)}
            r="3"
            style={{ "--i": index, "--s": dot.scale.toFixed(2), "--o": (.3 + .7 * dot.recency).toFixed(2) } as React.CSSProperties}
          >
            <title>{`${dot.poll.pollster} · ${dot.poll.endDate} · ${signedLabel(dot.poll.dem - dot.poll.rep)} · ${t("weight {value}", { value: dot.weight.toFixed(2) })}`}</title>
          </circle>
        ))}
        <g className="avg-line unweighted"><line x1={PAD.left} x2={VW - PAD.right} y1={y(unweighted)} y2={y(unweighted)} pathLength={1} /><text className="start" x={PAD.left + 4} y={y(unweighted) + (unweighted > modelMargin ? -6 : 14)}>{t("simple mean {margin}", { margin: signedLabel(unweighted) })}</text></g>
        <g className="avg-line weighted"><line x1={PAD.left} x2={VW - PAD.right} y1={y(modelMargin)} y2={y(modelMargin)} pathLength={1} /><text x={VW - PAD.right} y={y(modelMargin) + (unweighted > modelMargin ? 14 : -6)}>{t("weighted {margin}", { margin: signedLabel(modelMargin) })}</text></g>
        <g className="recency-band">
          <text x={PAD.left} y={band.top - 8}>{t("RECENCY WEIGHT · HALF-LIFE {days} DAYS", { days: POLL_HALF_LIFE_DAYS })}</text>
          <path className="recency-area" d={`M ${curve[0].split(",")[0]},${band.bottom} L ${curve.join(" L ")} L ${curve.at(-1)!.split(",")[0]},${band.bottom} Z`} />
          <path className="recency-line" d={`M ${curve.join(" L ")}`} pathLength={1} />
          {months.map((month) => <text key={month.x} className="axis-label" x={month.x} y={VH - 1} textAnchor="middle">{month.label}</text>)}
        </g>
      </svg>
      <div className="viz-foot">
        <span>{t("Heaviest:")} <b>{heaviest.poll.pollster}</b> · {heaviest.poll.population} · n={heaviest.poll.sample.toLocaleString(intl)} · w {heaviest.weight.toFixed(2)}</span>
        <span>{t("A poll from 60 days ago counts")} <b>{(.5 ** (60 / POLL_HALF_LIFE_DAYS) * 100).toFixed(0)}%</b> {t("as much as today's")}</span>
      </div>
    </div>
  );
}

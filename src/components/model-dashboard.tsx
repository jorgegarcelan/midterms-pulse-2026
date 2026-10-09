"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "@/components/i18n/link";
import type { ModelResult } from "@/lib/model";
import { NATIONALIZATION } from "@/lib/mp26";
import { simulateHouse } from "@/lib/chamber-sim";
import { simulateSenate } from "@/lib/senate-sim";
import { CountUp } from "@/components/motion/count-up";
import { ChartTooltip } from "@/components/motion/chart-tooltip";
import { useChartScrub } from "@/components/motion/chart-scrub";
import { useInView } from "@/components/explainer/use-in-view";
import { useT } from "@/components/i18n/locale-provider";

type T = ReturnType<typeof useT>;
type Bucket = { seats: number; frequency: number };

// API copy carries live numbers; translate it with the numbers lifted out as {0}, {1}… placeholders.
// Without a translation the template is filled back in, so English stays identical.
function translateNumbers(t: T, text: string) {
  const vars: Record<string, string> = {};
  let index = 0;
  const key = text.replace(/\d+(?:\.\d+)?/g, (match) => { vars[index] = match; return `{${index++}}`; });
  return t(key, vars);
}

// Both chambers are bottom-up, so a swing is re-simulated race by race with the model's own engine.
// The House uses 10,000 runs to stay interactive; at zero swing the published 50,000-run numbers show.
function runScenario(model: ModelResult, swing: number) {
  if (swing === 0) return { houseSeats: model.house.demSeats, houseProbability: model.house.demMajority, senateSeats: model.senate.demSeats, senateProbability: model.senate.demMajority, houseDistribution: model.house.distribution, senateDistribution: model.senate.distribution };
  const shift = swing * NATIONALIZATION;
  const house = simulateHouse(model.races, { shift, runs: 10_000 });
  const senate = simulateSenate(model.races.filter((race) => race.chamber === "senate"), {}, { shift });
  return { houseSeats: house.median, houseProbability: Math.round(house.controlD * 100), senateSeats: senate.median, senateProbability: Math.round(senate.controlD * 100), houseDistribution: house.distribution, senateDistribution: senate.distribution };
}

// The seat axis is fixed around the published distribution with room to slide, so a swing visibly
// pushes the whole bell left or right instead of re-scaling the axis under it.
function seatDomain(baseline: Bucket[], current: Bucket[], pad: number, total: number): [number, number] {
  const seats = [...baseline, ...current].map((item) => item.seats);
  const first = baseline[0]?.seats ?? 0;
  const last = baseline.at(-1)?.seats ?? total;
  return [Math.max(0, Math.min(...seats, first - pad)), Math.min(total, Math.max(...seats, last + pad))];
}

const pct = (value: number) => `${value.toFixed(1)}%`;

function Distribution({ data, baseline, threshold, total, pad, median, shifted, step = 1 }: { data: Bucket[]; baseline: Bucket[]; threshold: number; total: number; pad: number; median: number; shifted: boolean; step?: number }) {
  const t = useT();
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: "0px 0px -10% 0px" });
  const [lo, hi] = seatDomain(baseline, data, pad, total);
  const slots = useMemo(() => {
    const now = new Map(data.map((item) => [item.seats, item.frequency]));
    const base = new Map(baseline.map((item) => [item.seats, item.frequency]));
    const result: { seats: number; frequency: number; base: number; atLeast: number }[] = [];
    let above = now.size ? [...now.values()].reduce((sum, value) => sum + value, 0) : 0;
    for (let seats = lo; seats <= hi; seats += step) {
      const frequency = now.get(seats) ?? 0;
      result.push({ seats, frequency, base: base.get(seats) ?? 0, atLeast: Math.max(0, Math.min(100, above)) });
      above -= frequency;
    }
    return result;
  }, [baseline, data, hi, lo, step]);
  const max = Math.max(...slots.map((slot) => Math.max(slot.frequency, shifted ? slot.base : 0)), 1);
  const medianIndex = Math.max(0, Math.min(slots.length - 1, Math.round((median - lo) / step)));
  const scrub = useChartScrub({ count: slots.length, indexAt: (ratio) => Math.floor(ratio * slots.length), initial: medianIndex });
  const active = scrub.active === null ? null : slots[scrub.active];
  // Buckets are labelled by their upper seat (the House publishes two-seat buckets).
  const at = (seats: number) => ((seats - lo) / step + .5) / slots.length * 100;
  const range = (seats: number) => step > 1 ? `${seats - step + 1}–${seats}` : String(seats);

  return <>
    <div className="mpa-dist-frame">
      <div ref={ref} className="mpa-dist" data-in={inView ? "true" : undefined} data-shifted={shifted ? "true" : undefined} data-scrub={active ? "true" : undefined} role="img" aria-label={t("Simulated Democratic seat distribution")} {...scrub.bind}>
        {slots.map((slot, index) => <span key={slot.seats} className={`${slot.seats >= threshold ? "dem" : "rep"}${scrub.active === index ? " active" : ""}`} style={{ "--h": `${slot.frequency / max * 100}%`, "--g": `${slot.base / max * 100}%`, "--i": Math.abs(index - medianIndex) } as React.CSSProperties}><i />{shifted && slot.base > 0 && <s />}</span>)}
        <b className="mpa-dist-majority" style={{ left: `${(threshold - lo) / step / slots.length * 100}%` }}><em>{t("{seats} majority", { seats: threshold })}</em></b>
        <b className="mpa-dist-median" style={{ left: `${at(median)}%` }}><em>{t("Median {seats}", { seats: median })}</em></b>
        {active && <i className="mpa-crosshair" style={{ left: `${at(active.seats)}%` }} />}
      </div>
      {active && <ChartTooltip x={at(active.seats)} y={100 - active.frequency / max * 100} title={t("{seats} Democratic seats", { seats: range(active.seats) })} rows={[
        { label: shifted ? t("This scenario") : t("Probability"), value: pct(active.frequency), tone: active.seats >= threshold ? "dem" : "rep" },
        ...(shifted ? [{ label: t("Published forecast"), value: pct(active.base), tone: "muted" as const, swatch: "#f5d06f" }] : []),
        { label: t("{seats} or more", { seats: active.seats - step + 1 }), value: pct(active.atLeast), tone: "muted" },
      ]} note={active.seats >= threshold ? t("Democratic majority") : t("Republican majority")} />}
    </div>
    <div className="distribution-axis"><span>{lo}</span><b>{shifted ? <><i className="mpa-ghost-key" />{t("Published forecast")}</> : t("Hover, tap or use the arrow keys to read any outcome")}</b><span>{hi}</span></div>
  </>;
}

const signedSeats = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value)}`;

export function ModelDashboard() {
  const t = useT();
  const [model, setModel] = useState<ModelResult | null>(null);
  const [swing, setSwing] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/model", { signal: controller.signal }).then((response) => response.json() as Promise<ModelResult>).then(setModel).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const deferredSwing = useDeferredValue(swing);
  const scenario = useMemo(() => model ? runScenario(model, deferredSwing) : null, [model, deferredSwing]);

  if (!model || !scenario) return <section className="panel model-loading">{t("Running 50,000 deterministic simulations…")}</section>;

  const shifted = deferredSwing !== 0;
  const houseDelta = scenario.houseSeats - model.house.demSeats;
  const senateDelta = scenario.senateSeats - model.senate.demSeats;

  return <>
    <section className="page-intro model-intro">
      <div><p className="eyebrow">{t("MIDTERM PULSE MODEL")} · {model.version}</p><h1>{t("A forecast you can inspect")}</h1><p>{t("An experimental, reproducible model that combines a weighted generic ballot, a public seat-level benchmark and correlated uncertainty. Every assumption is exposed below.")}</p></div>
      <div className="model-status"><span>{t("Experimental")}</span><strong><CountUp value={model.simulations} locale duration={1600} /></strong><small>{t("simulations")} · {model.runDate}</small></div>
    </section>
    <section className="model-control-grid">
      <article className="model-control-card dem-card"><p className="eyebrow">{t("HOUSE CONTROL")}</p><strong><CountUp value={scenario.houseProbability} />%</strong><span>{t("Democratic majority")}</span><div><b>D <CountUp value={scenario.houseSeats} /></b><i>218</i><b><CountUp value={435 - scenario.houseSeats} /> R</b></div><small>{t("80% interval: {low}–{high} D seats", { low: model.house.interval80[0], high: model.house.interval80[1] })}</small></article>
      <article className="model-control-card senate-model-card"><p className="eyebrow">{t("SENATE CONTROL")}</p><strong><CountUp value={scenario.senateProbability} />%</strong><span>{t("Democratic majority")}</span><div><b>D <CountUp value={scenario.senateSeats} /></b><i>51</i><b><CountUp value={100 - scenario.senateSeats} /> R</b></div><small>{t("80% interval: {low}–{high} D seats", { low: model.senate.interval80[0], high: model.senate.interval80[1] })}</small></article>
      <article className="panel model-scenario mpa-scenario" data-pending={swing !== deferredSwing ? "true" : undefined}>
        <div><p className="eyebrow">{t("SENSITIVITY TEST")}</p><h2 key={swing}>{swing === 0 ? t("Current baseline") : t("{shift} national shift", { shift: `${swing > 0 ? "D" : "R"}+${Math.abs(swing)}` })}</h2><p>{t("Apply a uniform polling movement without overwriting the stored forecast.")}</p></div>
        <div className="mpa-swing" style={{ "--pos": `${(swing + 5) * 10}%`, "--from": swing >= 0 ? "50%" : `${(swing + 5) * 10}%`, "--to": swing >= 0 ? `${(swing + 5) * 10}%` : "50%" } as React.CSSProperties} data-side={swing > 0 ? "D" : swing < 0 ? "R" : undefined}>
          <i aria-hidden="true" />
          <input aria-label={t("National polling shift")} aria-valuetext={swing === 0 ? t("Current baseline") : `${swing > 0 ? "D" : "R"}+${Math.abs(swing)}`} type="range" min="-5" max="5" step="0.5" value={swing} onChange={(event) => setSwing(Number(event.target.value))} />
        </div>
        <p className="mpa-scenario-delta" aria-live="polite">{shifted ? t("vs. published forecast: House {house} D seats · Senate {senate}", { house: signedSeats(houseDelta), senate: signedSeats(senateDelta) }) : t("Drag the slider: the distributions below re-simulate live.")}</p>
        <div><span>R+5</span><button type="button" onClick={() => setSwing(0)} disabled={swing === 0}>{t("Reset")}</button><span>D+5</span></div>
      </article>
    </section>
    <section className="model-chart-grid">
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">{t("HOUSE DISTRIBUTION")}</p><h2>{t("Democratic seats")}</h2></div><span className="panel-tag">{shifted ? t("10K draws · scenario") : t("50K draws")}</span></div><Distribution data={scenario.houseDistribution} baseline={model.house.distribution} threshold={218} total={435} pad={24} median={scenario.houseSeats} shifted={shifted} step={2} /></article>
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">{t("SENATE DISTRIBUTION")}</p><h2>{t("Democratic seats")}</h2></div><span className="panel-tag">{t("50K draws")}{shifted ? ` · ${t("scenario")}` : ""}</span></div><Distribution data={scenario.senateDistribution} baseline={model.senate.distribution} threshold={51} total={100} pad={4} median={scenario.senateSeats} shifted={shifted} /></article>
    </section>
    <section className="model-method-grid">
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">{t("CURRENT INPUTS")}</p><h2>{t("What moved the model")}</h2></div><span className="panel-tag">{t("auditable")}</span></div><div className="model-input-list">{model.inputs.map((input) => <div key={input.label}><span>{t(input.label)}</span><strong>{translateNumbers(t, input.value)}</strong><small>{translateNumbers(t, input.source)}</small></div>)}</div></article>
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">{t("ASSUMPTIONS")}</p><h2>{t("What {version} assumes", { version: model.version.replace("MP-26 ", "") })}</h2></div></div><ol className="assumption-list">{model.assumptions.map((item) => <li key={item}>{translateNumbers(t, item)}</li>)}</ol><p className="model-warning">{t("This version is not yet historically calibrated and should be read as a structured sensitivity model, not an election call.")}</p><div className="model-actions"><Link href="/how-it-works">{t("How the model works")} →</Link><Link href="/districts">{t("Open district map")} →</Link><Link href="/methodology">{t("Read methodology")} →</Link></div></article>
    </section>
  </>;
}

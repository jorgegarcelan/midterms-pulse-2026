"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "@/components/i18n/link";
import type { ModelResult } from "@/lib/model";
import { NATIONALIZATION } from "@/lib/mp26";
import { simulateHouse } from "@/lib/chamber-sim";
import { simulateSenate } from "@/lib/senate-sim";
import { CountUp } from "@/components/motion/count-up";
import { useT } from "@/components/i18n/locale-provider";

type T = ReturnType<typeof useT>;

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
  if (swing === 0) return { houseSeats: model.house.demSeats, houseProbability: model.house.demMajority, senateSeats: model.senate.demSeats, senateProbability: model.senate.demMajority };
  const shift = swing * NATIONALIZATION;
  const house = simulateHouse(model.races, { shift, runs: 10_000 });
  const senate = simulateSenate(model.races.filter((race) => race.chamber === "senate"), {}, { shift });
  return { houseSeats: house.median, houseProbability: Math.round(house.controlD * 100), senateSeats: senate.median, senateProbability: Math.round(senate.controlD * 100) };
}

function Distribution({ data, threshold }: { data: { seats: number; frequency: number }[]; threshold: number }) {
  const t = useT();
  const max = Math.max(...data.map((item) => item.frequency), 1);
  return <div className="distribution-chart" role="img" aria-label={t("Simulated Democratic seat distribution")}>
    {data.map((item, index) => <span key={item.seats} className={item.seats >= threshold ? "dem" : "rep"} style={{ height: `${Math.max(2, item.frequency / max * 100)}%`, "--i": index } as React.CSSProperties} title={t("{seats} seats: {frequency}%", { seats: item.seats, frequency: item.frequency })} />)}
  </div>;
}

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

  return <>
    <section className="page-intro model-intro">
      <div><p className="eyebrow">{t("MIDTERM PULSE MODEL")} · {model.version}</p><h1>{t("A forecast you can inspect")}</h1><p>{t("An experimental, reproducible model that combines a weighted generic ballot, a public seat-level benchmark and correlated uncertainty. Every assumption is exposed below.")}</p></div>
      <div className="model-status"><span>{t("Experimental")}</span><strong><CountUp value={model.simulations} locale duration={1600} /></strong><small>{t("simulations")} · {model.runDate}</small></div>
    </section>
    <section className="model-control-grid">
      <article className="model-control-card dem-card"><p className="eyebrow">{t("HOUSE CONTROL")}</p><strong><CountUp value={scenario.houseProbability} />%</strong><span>{t("Democratic majority")}</span><div><b>D <CountUp value={scenario.houseSeats} /></b><i>218</i><b><CountUp value={435 - scenario.houseSeats} /> R</b></div><small>{t("80% interval: {low}–{high} D seats", { low: model.house.interval80[0], high: model.house.interval80[1] })}</small></article>
      <article className="model-control-card senate-model-card"><p className="eyebrow">{t("SENATE CONTROL")}</p><strong><CountUp value={scenario.senateProbability} />%</strong><span>{t("Democratic majority")}</span><div><b>D <CountUp value={scenario.senateSeats} /></b><i>51</i><b><CountUp value={100 - scenario.senateSeats} /> R</b></div><small>{t("80% interval: {low}–{high} D seats", { low: model.senate.interval80[0], high: model.senate.interval80[1] })}</small></article>
      <article className="panel model-scenario"><div><p className="eyebrow">{t("SENSITIVITY TEST")}</p><h2>{swing === 0 ? t("Current baseline") : t("{shift} national shift", { shift: `${swing > 0 ? "D" : "R"}+${Math.abs(swing)}` })}</h2><p>{t("Apply a uniform polling movement without overwriting the stored forecast.")}</p></div><input aria-label={t("National polling shift")} type="range" min="-5" max="5" step="0.5" value={swing} onChange={(event) => setSwing(Number(event.target.value))} /><div><span>R+5</span><button type="button" onClick={() => setSwing(0)}>{t("Reset")}</button><span>D+5</span></div></article>
    </section>
    <section className="model-chart-grid">
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">{t("HOUSE DISTRIBUTION")}</p><h2>{t("Democratic seats")}</h2></div><span className="panel-tag">{t("50K draws")}</span></div><Distribution data={model.house.distribution} threshold={218} /><div className="distribution-axis"><span>{model.house.distribution[0]?.seats}</span><b>{t("{seats} majority", { seats: 218 })}</b><span>{model.house.distribution.at(-1)?.seats}</span></div></article>
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">{t("SENATE DISTRIBUTION")}</p><h2>{t("Democratic seats")}</h2></div><span className="panel-tag">{t("50K draws")}</span></div><Distribution data={model.senate.distribution} threshold={51} /><div className="distribution-axis"><span>{model.senate.distribution[0]?.seats}</span><b>{t("{seats} majority", { seats: 51 })}</b><span>{model.senate.distribution.at(-1)?.seats}</span></div></article>
    </section>
    <section className="model-method-grid">
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">{t("CURRENT INPUTS")}</p><h2>{t("What moved the model")}</h2></div><span className="panel-tag">{t("auditable")}</span></div><div className="model-input-list">{model.inputs.map((input) => <div key={input.label}><span>{t(input.label)}</span><strong>{translateNumbers(t, input.value)}</strong><small>{translateNumbers(t, input.source)}</small></div>)}</div></article>
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">{t("ASSUMPTIONS")}</p><h2>{t("What {version} assumes", { version: model.version.replace("MP-26 ", "") })}</h2></div></div><ol className="assumption-list">{model.assumptions.map((item) => <li key={item}>{translateNumbers(t, item)}</li>)}</ol><p className="model-warning">{t("This version is not yet historically calibrated and should be read as a structured sensitivity model, not an election call.")}</p><div className="model-actions"><Link href="/how-it-works">{t("How the model works")} →</Link><Link href="/districts">{t("Open district map")} →</Link><Link href="/methodology">{t("Read methodology")} →</Link></div></article>
    </section>
  </>;
}

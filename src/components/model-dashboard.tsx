"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ModelResult } from "@/lib/model";

function Distribution({ data, threshold }: { data: { seats: number; frequency: number }[]; threshold: number }) {
  const max = Math.max(...data.map((item) => item.frequency), 1);
  return <div className="distribution-chart" role="img" aria-label="Simulated Democratic seat distribution">
    {data.map((item) => <span key={item.seats} className={item.seats >= threshold ? "dem" : "rep"} style={{ height: `${Math.max(2, item.frequency / max * 100)}%` }} title={`${item.seats} seats: ${item.frequency}%`} />)}
  </div>;
}

export function ModelDashboard() {
  const [model, setModel] = useState<ModelResult | null>(null);
  const [swing, setSwing] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/model", { signal: controller.signal }).then((response) => response.json() as Promise<ModelResult>).then(setModel).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const scenario = useMemo(() => {
    if (!model) return null;
    return {
      houseSeats: Math.round(model.house.demSeats + swing * 2.15),
      houseProbability: Math.max(1, Math.min(99, Math.round(model.house.demMajority + swing * 5))),
      senateSeats: Math.round(model.senate.demSeats + swing * 0.18),
      senateProbability: Math.max(1, Math.min(99, Math.round(model.senate.demMajority + swing * 4))),
    };
  }, [model, swing]);

  if (!model || !scenario) return <section className="panel model-loading">Running 50,000 deterministic simulations…</section>;

  return <>
    <section className="page-intro model-intro">
      <div><p className="eyebrow">MIDTERM PULSE MODEL · {model.version}</p><h1>A forecast you can inspect</h1><p>An experimental, reproducible model that combines a weighted generic ballot, a public seat-level benchmark and correlated uncertainty. Every assumption is exposed below.</p></div>
      <div className="model-status"><span>Experimental</span><strong>{model.simulations.toLocaleString("en-US")}</strong><small>simulations · {model.runDate}</small></div>
    </section>
    <section className="model-control-grid">
      <article className="model-control-card dem-card"><p className="eyebrow">HOUSE CONTROL</p><strong>{scenario.houseProbability}%</strong><span>Democratic majority</span><div><b>D {scenario.houseSeats}</b><i>218</i><b>{435 - scenario.houseSeats} R</b></div><small>80% interval: {model.house.interval80[0]}–{model.house.interval80[1]} D seats</small></article>
      <article className="model-control-card senate-model-card"><p className="eyebrow">SENATE CONTROL</p><strong>{scenario.senateProbability}%</strong><span>Democratic majority</span><div><b>D {scenario.senateSeats}</b><i>51</i><b>{100 - scenario.senateSeats} R</b></div><small>80% interval: {model.senate.interval80[0]}–{model.senate.interval80[1]} D seats</small></article>
      <article className="panel model-scenario"><div><p className="eyebrow">SENSITIVITY TEST</p><h2>{swing === 0 ? "Current baseline" : `${swing > 0 ? "D" : "R"}+${Math.abs(swing)} national shift`}</h2><p>Apply a uniform polling movement without overwriting the stored forecast.</p></div><input aria-label="National polling shift" type="range" min="-5" max="5" step="0.5" value={swing} onChange={(event) => setSwing(Number(event.target.value))} /><div><span>R+5</span><button type="button" onClick={() => setSwing(0)}>Reset</button><span>D+5</span></div></article>
    </section>
    <section className="model-chart-grid">
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">HOUSE DISTRIBUTION</p><h2>Democratic seats</h2></div><span className="panel-tag">50K draws</span></div><Distribution data={model.house.distribution} threshold={218} /><div className="distribution-axis"><span>{model.house.distribution[0]?.seats}</span><b>218 majority</b><span>{model.house.distribution.at(-1)?.seats}</span></div></article>
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">SENATE DISTRIBUTION</p><h2>Democratic seats</h2></div><span className="panel-tag">50K draws</span></div><Distribution data={model.senate.distribution} threshold={51} /><div className="distribution-axis"><span>{model.senate.distribution[0]?.seats}</span><b>51 majority</b><span>{model.senate.distribution.at(-1)?.seats}</span></div></article>
    </section>
    <section className="model-method-grid">
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">CURRENT INPUTS</p><h2>What moved the model</h2></div><span className="panel-tag">auditable</span></div><div className="model-input-list">{model.inputs.map((input) => <div key={input.label}><span>{input.label}</span><strong>{input.value}</strong><small>{input.source}</small></div>)}</div></article>
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">ASSUMPTIONS</p><h2>What v0.1 assumes</h2></div></div><ol className="assumption-list">{model.assumptions.map((item) => <li key={item}>{item}</li>)}</ol><p className="model-warning">This version is not yet historically calibrated and should be read as a structured sensitivity model, not an election call.</p><div className="model-actions"><Link href="/districts">Open district map →</Link><Link href="/methodology">Read methodology →</Link></div></article>
    </section>
  </>;
}

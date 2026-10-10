"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HOUSE_SPEC, sampleChamber, SENATE_SEED, type ChamberSpec } from "@/lib/chamber-sim";
import { SIMULATIONS } from "@/lib/mp26";
import { seatsNotUp } from "@/lib/senate-sim";
import { useInView } from "@/components/explainer/use-in-view";
import type { ExplainerRace } from "@/components/explainer/stage-race-curve";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";

const LIVE_RUNS = 3000;
const PER_FRAME = 10;

type Chamber = { key: "house" | "senate"; label: string; spec: ChamberSpec; margins: number[]; domain: [number, number]; published: number };

function Histogram({ chamber, counts, runs }: { chamber: Chamber; counts: Uint32Array; runs: number }) {
  const t = useT();
  const intl = useIntlLocale();
  const [low, high] = chamber.domain;
  const step = chamber.key === "house" ? 2 : 1;
  const bins = [];
  for (let seats = low; seats <= high; seats += step) {
    let count = 0;
    for (let offset = 0; offset < step; offset += 1) count += counts[seats + offset] || 0;
    bins.push({ seats, count });
  }
  const max = Math.max(1, ...bins.map((bin) => bin.count));
  let majority = 0;
  counts.forEach((count, seats) => { if (seats >= chamber.spec.majority) majority += count; });
  const share = runs ? majority / runs : 0;
  const majorityIndex = bins.findIndex((bin) => bin.seats + step - 1 >= chamber.spec.majority);

  return (
    <div className="sim-chart">
      <div className="sim-chart-head">
        <span>{t(chamber.label)}</span>
        <strong className={share >= .5 ? "dem-text" : "rep-text"}>{(share * 100).toFixed(runs >= SIMULATIONS ? 0 : 1)}%</strong>
        <small>{t("D majority · published {pct}%", { pct: chamber.published })}</small>
      </div>
      <div className="sim-bars" style={{ "--bins": bins.length, "--majority": majorityIndex } as React.CSSProperties}>
        {bins.map((bin) => <i key={bin.seats} className={bin.seats >= chamber.spec.majority ? "dem" : "rep"} style={{ height: `${bin.count / max * 100}%` }} title={t("{seats} seats: {count} runs", { seats: `${bin.seats}${step > 1 ? `–${bin.seats + step - 1}` : ""}`, count: bin.count.toLocaleString(intl) })} />)}
        <b className="sim-majority" />
      </div>
      <div className="sim-axis"><span>{low}</span><span>{t("{seats} to win", { seats: chamber.spec.majority })}</span><span>{high}</span></div>
    </div>
  );
}

// Runs the model's own engine in the browser, a few simulations per frame, so the estimate visibly converges.
export function StageLiveSim({ races, houseMajority, senateMajority }: { races: ExplainerRace[]; houseMajority: number; senateMajority: number }) {
  const t = useT();
  const intl = useIntlLocale();
  const [ref, inView] = useInView<HTMLDivElement>();
  const chambers = useMemo<Chamber[]>(() => {
    const senate = races.filter((race) => race.chamber === "senate");
    const notUp = seatsNotUp(senate.map((race) => ({ ...race, margin: Math.abs(race.signedMargin) })));
    return [
      { key: "house", label: "House · 435 districts", spec: HOUSE_SPEC, margins: races.filter((race) => race.chamber === "house").map((race) => race.signedMargin), domain: [196, 290], published: houseMajority },
      { key: "senate", label: "Senate · 35 races + 65 not up", spec: { seats: 100, majority: 51, fixed: notUp, seed: SENATE_SEED }, margins: senate.map((race) => race.signedMargin), domain: [42, 60], published: senateMajority },
    ];
  }, [races, houseMajority, senateMajority]);

  const [runs, setRuns] = useState(0);
  const [counts, setCounts] = useState<Record<"house" | "senate", Uint32Array>>(() => ({ house: new Uint32Array(436), senate: new Uint32Array(101) }));
  const [done, setDone] = useState(false);
  const frame = useRef(0);
  const batch = useRef(0);

  const reset = useCallback(() => {
    cancelAnimationFrame(frame.current);
    batch.current = 0;
    setRuns(0);
    setDone(false);
    setCounts({ house: new Uint32Array(436), senate: new Uint32Array(101) });
  }, []);

  const play = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const tick = () => {
      batch.current += 1;
      const seed = 7_000 + batch.current;
      setCounts((current) => {
        const next = { house: current.house.slice(), senate: current.senate.slice() };
        for (const chamber of chambers) {
          const sample = sampleChamber(chamber.margins, chamber.spec, { runs: PER_FRAME, seed: seed * 31 + (chamber.key === "house" ? 1 : 2) });
          sample.forEach((count, seats) => { next[chamber.key][seats] += count; });
        }
        return next;
      });
      setRuns((current) => current + PER_FRAME);
      if (batch.current * PER_FRAME < LIVE_RUNS) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [chambers]);

  // The full, seeded 50,000-run model: exactly what /api/model publishes.
  const fastForward = useCallback(() => {
    cancelAnimationFrame(frame.current);
    setCounts({
      house: sampleChamber(chambers[0].margins, chambers[0].spec),
      senate: sampleChamber(chambers[1].margins, chambers[1].spec),
    });
    setRuns(SIMULATIONS);
    setDone(true);
  }, [chambers]);

  useEffect(() => {
    if (!inView || !chambers[0].margins.length) return;
    const start = window.setTimeout(play, 300);
    return () => { window.clearTimeout(start); cancelAnimationFrame(frame.current); };
  }, [chambers, inView, play]);

  return (
    <div className="stage-viz sim-viz" ref={ref} data-in={inView ? "true" : undefined}>
      <div className="viz-toolbar">
        <span className="sim-counter"><b>{runs.toLocaleString(intl)}</b> {t("simulated elections")}{done ? ` · ${t("full seeded model")}` : runs >= LIVE_RUNS ? ` · ${t("live sample")}` : ""}</span>
        <div className="viz-actions">
          <button type="button" className="viz-button" onClick={() => { reset(); window.setTimeout(play, 60); }}>{t("Replay")}</button>
          <button type="button" className="viz-button primary" onClick={fastForward} disabled={done}>{t("Run all {count}", { count: SIMULATIONS.toLocaleString(intl) })}</button>
        </div>
      </div>
      <div className="sim-grid">
        {chambers.map((chamber) => <Histogram key={chamber.key} chamber={chamber} counts={counts[chamber.key]} runs={runs} />)}
      </div>
      <p className="viz-note">{t("Each bar counts how many simulated elections ended with that many Democratic seats. The live sample wobbles and then settles; the full seeded run reproduces the published odds exactly.")}</p>
    </div>
  );
}

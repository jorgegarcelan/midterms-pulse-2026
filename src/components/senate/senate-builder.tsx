"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CountUp } from "@/components/motion/count-up";
import { Hemicycle } from "@/components/motion/hemicycle";
import { stateByCode } from "@/data/geography";
import { demProbability, seatsNotUp, signedMargin, simulateSenate, type SenatePick, type SenateRace } from "@/lib/senate-sim";

const lean = (margin: number) => `${margin >= 0 ? "D" : "R"}+${Math.abs(margin).toFixed(1)}`;

// Pick the battlegrounds and watch control odds, the seat bar and the chamber respond.
export function SenateBuilder({ races, chamberModel }: { races: SenateRace[]; chamberModel: number }) {
  const [picks, setPicks] = useState<Record<string, SenatePick>>({});
  const sorted = useMemo(() => [...races].sort((a, b) => Math.abs(signedMargin(a)) - Math.abs(signedMargin(b))), [races]);
  const outlook = useMemo(() => simulateSenate(races, picks), [picks, races]);
  const notUp = useMemo(() => seatsNotUp(races), [races]);
  if (races.length < 30) return null;

  const pickedD = outlook.locked.D - notUp.D;
  const pickedR = outlook.locked.R - notUp.R;
  const openExpectedD = outlook.expected - outlook.locked.D;
  const openExpectedR = 100 - outlook.expected - outlook.locked.R;
  const expectedD = Math.round(outlook.expected);
  const control = Math.round(outlook.controlD * 100);
  const decided = Object.keys(picks).length;

  function cycle(code: string) {
    setPicks((current) => {
      const next = { ...current };
      if (!current[code]) next[code] = "D";
      else if (current[code] === "D") next[code] = "R";
      else delete next[code];
      return next;
    });
  }

  function preset(kind: "model" | "D" | "R") {
    if (kind === "model") return setPicks({});
    setPicks(Object.fromEntries(races.filter((race) => Math.abs(signedMargin(race)) < 5).map((race) => [race.code, kind])));
  }

  const segments = [
    { key: "d-locked", value: notUp.D + pickedD, className: "d-locked", label: `${notUp.D} not up + ${pickedD} picked` },
    { key: "d-open", value: openExpectedD, className: "d-open", label: "expected from open races" },
    { key: "r-open", value: openExpectedR, className: "r-open", label: "expected from open races" },
    { key: "r-locked", value: notUp.R + pickedR, className: "r-locked", label: `${notUp.R} not up + ${pickedR} picked` },
  ];

  return (
    <section className="panel senate-builder" id="senate" aria-labelledby="senate-builder-title">
      <div className="senate-head">
        <div>
          <p className="eyebrow">Senate · Build your majority</p>
          <h2 id="senate-builder-title">Call the races. Watch the chamber move.</h2>
          <p>Click a state to give it to Democrats, again for Republicans, a third time to hand it back to the model. Open races are simulated 6,000 times with a shared national error, calibrated to each race&apos;s model odds.</p>
        </div>
        <div className="senate-presets" role="group" aria-label="Presets">
          <button type="button" onClick={() => preset("model")} className={decided === 0 ? "active" : ""}>Model</button>
          <button type="button" onClick={() => preset("D")}>Toss-ups → D</button>
          <button type="button" onClick={() => preset("R")}>Toss-ups → R</button>
        </div>
      </div>

      <div className="senate-dash">
        <div className="senate-odds" style={{ "--odds": control } as React.CSSProperties}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="track" cx="60" cy="60" r="52" pathLength={100} />
            <circle className="value" cx="60" cy="60" r="52" pathLength={100} />
          </svg>
          <div><strong><CountUp value={control} duration={600} />%</strong><span>Democratic control</span><small>{Math.round(outlook.tieR * 100)}% chance of a 50–50 tie (VP breaks it for the GOP)</small><small className="senate-model-note">Chamber model: {chamberModel}%. This tool aggregates race-level odds, which v0.1 moves more than chamber seats.</small></div>
        </div>

        <div className="senate-bar-wrap">
          <div className="senate-bar-labels"><span className="dem-text">D <CountUp value={expectedD} duration={600} /></span><span>51 for control</span><span className="rep-text"><CountUp value={100 - expectedD} duration={600} /> R</span></div>
          <div className="senate-bar" role="img" aria-label={`${expectedD} expected Democratic seats`}>
            {segments.map((segment) => <i key={segment.key} className={segment.className} style={{ flexGrow: Math.max(0, segment.value) }} title={`${segment.value.toFixed(1)} · ${segment.label}`} />)}
            <b className="senate-bar-line" />
          </div>
          <div className="senate-bar-legend"><span><i className="d-locked" />Locked D</span><span><i className="d-open" />Expected D</span><span><i className="r-open" />Expected R</span><span><i className="r-locked" />Locked R</span></div>
          <p className="senate-decided">{decided ? `${decided} of ${races.length} races called by you` : `All ${races.length} races follow the model`}</p>
        </div>

        <div className="senate-chamber"><Hemicycle label="Projected Senate" total={100} dem={expectedD} majority={51} rows={5} inner={.42} majorityNote="VP breaks ties" /></div>
      </div>

      <div className="senate-grid">
        {sorted.map((race, index) => {
          const pick = picks[race.code];
          const margin = signedMargin(race);
          const pD = Math.round(demProbability(race) * 100);
          const name = stateByCode.get(race.code)?.name || race.code;
          return (
            <button
              key={race.code}
              type="button"
              className="sen-tile"
              data-pick={pick || "model"}
              style={{ "--i": index, "--pd": `${pD}%` } as React.CSSProperties}
              onClick={() => cycle(race.code)}
              aria-pressed={Boolean(pick)}
              aria-label={`${name}${race.special ? " special" : ""}: model ${lean(margin)}, ${pD}% Democratic. ${pick ? `Called for ${pick === "D" ? "Democrats" : "Republicans"}` : "Following the model"}`}
            >
              <span className="sen-flip">
                <span className="sen-face sen-front">
                  <span className="sen-top"><strong>{race.code}</strong>{race.special && <em>Special</em>}</span>
                  <span className="sen-name">{name}</span>
                  <span className="sen-meter"><i /></span>
                  <span className="sen-line"><b className={margin >= 0 ? "dem-text" : "rep-text"}>{lean(margin)}</b><small>{pD}% D</small></span>
                </span>
                <span className="sen-face sen-back">
                  <span className="sen-top"><strong>{race.code}</strong></span>
                  <span className="sen-call">{pick === "R" ? "Republican" : "Democrat"}</span>
                  <small>{pick === "R" ? "Called R · click to reset" : "Called D · click for R"}</small>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="chart-note">Seats not on the ballot: {notUp.D} Democratic caucus, {notUp.R} Republican. Race odds from the MP-26 v0.1 model; this tool is a scenario explorer, not a forecast. <Link href="/races?chamber=senate">Senate race profiles →</Link></p>
    </section>
  );
}

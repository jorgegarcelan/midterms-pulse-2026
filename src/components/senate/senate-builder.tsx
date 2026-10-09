"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "@/components/i18n/link";
import { useT } from "@/components/i18n/locale-provider";
import { CountUp } from "@/components/motion/count-up";
import { Hemicycle } from "@/components/motion/hemicycle";
import { ShareImageButton } from "@/components/share-image-button";
import { stateByCode } from "@/data/geography";
import { MODEL_VERSION } from "@/lib/mp26";
import { demProbability, signedMargin, simulateSenate, type SenatePick, type SenateRace } from "@/lib/senate-sim";

const lean = (margin: number) => `${margin >= 0 ? "D" : "R"}+${Math.abs(margin).toFixed(1)}`;

// Pick the battlegrounds and watch control odds, the seat bar and the chamber respond.
export function SenateBuilder({ races }: { races: SenateRace[] }) {
  const t = useT();
  const [picks, setPicks] = useState<Record<string, SenatePick>>({});
  const sorted = useMemo(() => [...races].sort((a, b) => Math.abs(signedMargin(a)) - Math.abs(signedMargin(b))), [races]);
  // Same function, seed and run count as the published model: with no races called this is the forecast.
  // Deferred so a tile flips on the click frame and the 50,000-run simulation follows right after.
  const deferredPicks = useDeferredValue(picks);
  const outlook = useMemo(() => simulateSenate(races, deferredPicks), [deferredPicks, races]);
  if (races.length < 30) return null;
  const { notUp } = outlook;

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
    { key: "d-locked", value: notUp.D + pickedD, className: "d-locked", label: t("{notUp} not up + {picked} picked", { notUp: notUp.D, picked: pickedD }) },
    { key: "d-open", value: openExpectedD, className: "d-open", label: t("expected from open races") },
    { key: "r-open", value: openExpectedR, className: "r-open", label: t("expected from open races") },
    { key: "r-locked", value: notUp.R + pickedR, className: "r-locked", label: t("{notUp} not up + {picked} picked", { notUp: notUp.R, picked: pickedR }) },
  ];

  return (
    <section className="panel senate-builder" id="senate" aria-labelledby="senate-builder-title">
      <div className="senate-head">
        <div>
          <p className="eyebrow">{t("Senate · Build your majority")}</p>
          <h2 id="senate-builder-title">{t("Call the races. Watch the chamber move.")}</h2>
          <p>{t("Click a state to give it to Democrats, again for Republicans, a third time to hand it back to the model. Every open race is re-simulated 50,000 times with a shared national error, the same engine that produces the published Senate forecast.")}</p>
        </div>
        <div className="senate-presets" role="group" aria-label={t("Presets")}>
          <button type="button" onClick={() => preset("model")} className={decided === 0 ? "active" : ""}>{t("Model")}</button>
          <button type="button" onClick={() => preset("D")}>{t("Toss-ups → D")}</button>
          <button type="button" onClick={() => preset("R")}>{t("Toss-ups → R")}</button>
        </div>
      </div>

      <div className="senate-dash">
        <div className="senate-odds" style={{ "--odds": control } as React.CSSProperties}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="track" cx="60" cy="60" r="52" pathLength={100} />
            <circle className="value" cx="60" cy="60" r="52" pathLength={100} />
          </svg>
          <div><strong><CountUp value={control} duration={600} />%</strong><span>{t("Democratic control")}</span><small>{t("{pct}% chance of a 50–50 tie (VP breaks it for the GOP)", { pct: Math.round(outlook.tieR * 100) })}</small><small className="senate-model-note">{t(decided ? "Your calls are fixed; the other races keep their model odds." : "No calls yet: this is the published MP-26 Senate forecast.")}</small></div>
        </div>

        <div className="senate-bar-wrap">
          <div className="senate-bar-labels"><span className="dem-text">D <CountUp value={expectedD} duration={600} /></span><span>{t("51 for control")}</span><span className="rep-text"><CountUp value={100 - expectedD} duration={600} /> R</span></div>
          <div className="senate-bar" role="img" aria-label={t("{count} expected Democratic seats", { count: expectedD })}>
            {segments.map((segment) => <i key={segment.key} className={segment.className} style={{ flexGrow: Math.max(0, segment.value) }} title={`${segment.value.toFixed(1)} · ${segment.label}`} />)}
            <b className="senate-bar-line" />
          </div>
          <div className="senate-bar-legend"><span><i className="d-locked" />{t("Locked D")}</span><span><i className="d-open" />{t("Expected D")}</span><span><i className="r-open" />{t("Expected R")}</span><span><i className="r-locked" />{t("Locked R")}</span></div>
          <p className="senate-decided">{decided ? t("{decided} of {total} races called by you", { decided, total: races.length }) : t("All {total} races follow the model", { total: races.length })}</p>
        </div>

        <div className="senate-chamber"><Hemicycle label={t("Projected Senate")} total={100} dem={expectedD} majority={51} rows={5} inner={.42} majorityNote={t("VP breaks ties")} /><ShareImageButton label={t(decided ? "Download your scenario" : "Download image")} href={`/api/share/senate${decided ? `?picks=${Object.entries(picks).map(([code, pick]) => `${code}-${pick}`).join(",")}` : ""}`} /></div>
      </div>

      <div className="senate-grid">
        {sorted.map((race, index) => {
          const pick = picks[race.code];
          const margin = signedMargin(race);
          const pD = Math.round(demProbability(race) * 100);
          const name = t(stateByCode.get(race.code)?.name || race.code);
          return (
            <button
              key={race.code}
              type="button"
              className="sen-tile"
              data-pick={pick || "model"}
              style={{ "--i": index, "--pd": `${pD}%` } as React.CSSProperties}
              onClick={() => cycle(race.code)}
              aria-pressed={Boolean(pick)}
              aria-label={t("{name}: model {lean}, {pct}% Democratic. {status}", { name: race.special ? t("{name} special", { name }) : name, lean: lean(margin), pct: pD, status: pick ? t(pick === "D" ? "Called for Democrats" : "Called for Republicans") : t("Following the model") })}
            >
              <span className="sen-flip">
                <span className="sen-face sen-front">
                  <span className="sen-top"><strong>{race.code}</strong>{race.special && <em>{t("Special")}</em>}</span>
                  <span className="sen-name">{name}</span>
                  <span className="sen-meter"><i /></span>
                  <span className="sen-line"><b className={margin >= 0 ? "dem-text" : "rep-text"}>{lean(margin)}</b><small>{pD}% D</small></span>
                </span>
                <span className="sen-face sen-back">
                  <span className="sen-top"><strong>{race.code}</strong></span>
                  <span className="sen-call">{t(pick === "R" ? "Republican" : "Democrat")}</span>
                  <small>{t(pick === "R" ? "Called R · click to reset" : "Called D · click for R")}</small>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="chart-note">{t("Seats not on the ballot: {d} Democratic caucus, {r} Republican. Race odds from the {version} model; your calls turn it into a scenario, not a forecast.", { d: notUp.D, r: notUp.R, version: MODEL_VERSION })} <Link href="/races?chamber=senate">{t("Senate race profiles →")}</Link></p>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/i18n/link";
import { useIntlLocale, useLocalePath, useT } from "@/components/i18n/locale-provider";
import { ChamberCard } from "@/components/playground/chamber-card";
import { DotMap } from "@/components/playground/dot-map";
import { copyText, useDemographics } from "@/components/playground/hooks";
import { QUICK_RUNS, useSimulation } from "@/components/playground/use-simulation";
import { REGIONS, type RegionKey } from "@/data/regions";
import { stateTiles } from "@/data/states";
import { demWinProbability, NATIONALIZATION, SIMULATIONS } from "@/lib/mp26";
import { marginColor, signedLabel } from "@/lib/playground/math";
import { adjustMargin, decodeScenario, encodeScenario, GROUPS, isNeutral, LIMITS, neutralScenario, PRESETS, scenarioKey, sharesFor, type GroupKey, type Scenario } from "@/lib/playground/scenario";
import { patchUrl, type PlayRace, type Published } from "@/lib/playground/types";
import { raceName, raceSlug } from "@/lib/races";
import type { SenateRace } from "@/lib/senate-sim";

type Props = { races: PlayRace[]; published: Published; initial: Record<string, string | undefined> };

function Swing({ id, label, hint, value, limit, disabled, onChange }: { id: string; label: string; hint?: string; value: number; limit: number; disabled?: boolean; onChange: (value: number) => void }) {
  const t = useT();
  const text = value === 0 ? t("No change") : t("{value} toward {party}", { value: Math.abs(value).toFixed(1), party: value > 0 ? "D" : "R" });
  return <div className={`pg-swing${disabled ? " disabled" : ""}`} data-side={value > 0 ? "D" : value < 0 ? "R" : "0"}>
    <div className="pg-swing-head">
      <label htmlFor={id} title={label}>{label}</label>
      <button type="button" className="pg-swing-value" onClick={() => onChange(0)} disabled={disabled || value === 0} title={t("Reset to zero")}>{value === 0 ? "0" : signedLabel(value)}</button>
    </div>
    <input
      id={id}
      type="range"
      min={-limit}
      max={limit}
      step={.5}
      value={value}
      disabled={disabled}
      aria-valuetext={text}
      onChange={(event) => onChange(Number(event.target.value))}
      onDoubleClick={() => onChange(0)}
      style={{ "--v": value / limit } as React.CSSProperties}
    />
    {hint && <small>{hint}</small>}
  </div>;
}

export function ScenarioSimulator({ races, published, initial }: Props) {
  const t = useT();
  const router = useRouter();
  const localize = useLocalePath();
  const intl = useIntlLocale();
  const [scenario, setScenario] = useState<Scenario>(() => decodeScenario(initial));
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [showAllFlips, setShowAllFlips] = useState(false);
  const demographics = useDemographics();
  const key = scenarioKey(scenario);
  const neutral = isNeutral(scenario);

  // URL keeps the scenario shareable; replaceState never triggers a navigation.
  useEffect(() => { patchUrl(encodeScenario(scenario)); }, [scenario]);

  const shares = useMemo(() => {
    const file = demographics.data;
    if (!file) return null;
    return new Map(races.map((race) => [`${race.chamber}-${race.code}`, sharesFor(race.chamber === "house" ? file.districts[race.code] : file.states[race.state])]));
  }, [demographics.data, races]);

  const adjusted = useMemo(() => races.map((race) => ({ race, margin: adjustMargin(race.signedMargin, race.state, shares?.get(`${race.chamber}-${race.code}`), scenario) })), [races, shares, scenario]);
  const houseMargins = useMemo(() => adjusted.filter((item) => item.race.chamber === "house").map((item) => item.margin), [adjusted]);
  const senateRaces = useMemo<SenateRace[]>(() => adjusted.filter((item) => item.race.chamber === "senate").map(({ race, margin }) => ({
    code: race.code, leader: margin >= 0 ? "D" : "R", margin: Math.abs(margin), signedMargin: margin, winProbability: Math.round(demWinProbability(margin) * 100), incumbentParty: race.incumbentParty, special: race.special,
  })), [adjusted]);
  // Shares arrive a moment after the page; include them in the key so the simulation re-runs.
  const result = useSimulation(`${key}|${shares ? "s" : "-"}`, houseMargins, senateRaces);
  const refining = !result || result.key !== `${key}|${shares ? "s" : "-"}` || result.runs < SIMULATIONS;

  const houseMap = useMemo(() => new Map(adjusted.filter((item) => item.race.chamber === "house").map((item) => [item.race.code, item.margin])), [adjusted]);
  const senateMap = useMemo(() => new Map(adjusted.filter((item) => item.race.chamber === "senate").map((item) => [item.race.code, item.margin])), [adjusted]);
  const flips = useMemo(() => adjusted.filter(({ race, margin }) => (race.signedMargin >= 0) !== (margin >= 0))
    .sort((a, b) => (a.race.chamber === b.race.chamber ? 0 : a.race.chamber === "senate" ? -1 : 1) || Math.abs(b.margin - b.race.signedMargin) - Math.abs(a.margin - a.race.signedMargin)), [adjusted]);
  const flipped = useMemo(() => new Set(flips.filter((item) => item.race.chamber === "house").map((item) => item.race.code)), [flips]);
  const flippedSenate = useMemo(() => new Set(flips.filter((item) => item.race.chamber === "senate").map((item) => item.race.code)), [flips]);
  const toD = flips.filter((item) => item.margin >= 0).length;
  const toR = flips.length - toD;
  const leaning = { house: houseMargins.filter((margin) => margin >= 0).length };

  const set = (patch: Partial<Scenario>) => setScenario((current) => ({ ...current, ...patch }));
  const setRegion = (region: RegionKey, value: number) => setScenario((current) => ({ ...current, regions: { ...current.regions, [region]: value } }));
  const setGroup = (group: GroupKey, value: number) => setScenario((current) => ({ ...current, groups: { ...current.groups, [group]: value } }));
  const activePreset = PRESETS.find((item) => scenarioKey(item.apply(neutralScenario())) === key)?.key;

  async function copyLink() {
    if (await copyText(window.location.href)) { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  }

  const hoveredRace = hovered ? races.find((race) => race.chamber === "house" && race.code === hovered) : null;
  const hoveredMargin = hovered ? houseMap.get(hovered) : undefined;
  const flipList = showAllFlips ? flips : flips.slice(0, 18);

  return <div className="pg-scenario">
    <aside className="panel pg-controls" aria-label={t("Scenario controls")}>
      <div className="pg-controls-head">
        <div><p className="eyebrow">{t("YOUR SCENARIO")}</p><h2>{t("Move the map")}</h2></div>
        <div className="pg-actions">
          <button type="button" className="pg-button ghost" onClick={() => setScenario(neutralScenario())} disabled={neutral}>{t("Reset")}</button>
          <button type="button" className="pg-button" onClick={copyLink}>{copied ? t("Link copied ✓") : t("Copy link")}</button>
        </div>
      </div>

      <div className="pg-presets" role="group" aria-label={t("Presets")}>
        {PRESETS.map((item) => <button key={item.key} type="button" className={activePreset === item.key ? "active" : ""} aria-pressed={activePreset === item.key} title={t(item.note)} onClick={() => setScenario(item.apply(neutralScenario()))}>{t(item.label)}</button>)}
      </div>
      {activePreset && <p className="pg-preset-note">{t(PRESETS.find((item) => item.key === activePreset)!.note)}</p>}

      <fieldset>
        <legend>{t("National")}</legend>
        <Swing id="pg-nat" label={t("National swing")} hint={t("Generic-ballot movement; each race absorbs {pct}%, as in the model.", { pct: Math.round(NATIONALIZATION * 100) })} value={scenario.national} limit={LIMITS.national} onChange={(value) => set({ national: value })} />
        <Swing id="pg-err" label={t("Polling error")} hint={t("A systematic miss: every race moves by the full amount.")} value={scenario.polling} limit={LIMITS.polling} onChange={(value) => set({ polling: value })} />
      </fieldset>

      <fieldset>
        <legend>{t("Regional swing")}</legend>
        <div className="pg-swing-grid">
          {REGIONS.map((region) => <Swing key={region.key} id={`pg-r-${region.key}`} label={t(region.name)} value={scenario.regions[region.key]} limit={LIMITS.region} onChange={(value) => setRegion(region.key, value)} />)}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t("Demographic swing")}</legend>
        {demographics.error && <p className="pg-error">{t("Census profiles could not be loaded; demographic swings are off.")}</p>}
        <div className="pg-swing-grid">
          {GROUPS.map((group) => <Swing key={group.key} id={`pg-g-${group.key}`} label={t(group.label)} value={scenario.groups[group.key]} limit={LIMITS.group} disabled={!shares} onChange={(value) => setGroup(group.key, value)} />)}
        </div>
      </fieldset>

      <details className="pg-how">
        <summary>{t("How this works")}</summary>
        <p>{t("Every one of the 470 races starts from its published {version} margin. Your sliders add to it, linearly:", { version: published.version })}</p>
        <code>{t("margin = model + national × {k} + polling error + region + Σ (group swing × group share)", { k: NATIONALIZATION })}</code>
        <p>{t("A group's share is its share of the district's population (the state's, for Senate races) in the Census ACS 2024 5-year profiles. A 10-point Hispanic swing therefore moves a 50% Hispanic district by 5 points and a 5% one by half a point. White non-college is estimated as white share × (1 − bachelor's share). Population shares are not electorate shares, so treat group swings as rough.")}</p>
        <p>{t("Both chambers are then re-simulated in your browser with the model's own engine: a shared national error plus local error for every race. While you drag, {quick} quick runs; once you stop, the full {full}.", { quick: QUICK_RUNS.toLocaleString(intl), full: SIMULATIONS.toLocaleString(intl) })}</p>
      </details>
      {result && <div className="pg-mini" aria-hidden="true">
        <span>{t("House")} <b className={result.house.controlD >= .5 ? "dem-text" : "rep-text"}>D {Math.round(result.house.controlD * 100)}%</b> <small>{result.house.median}</small></span>
        <span>{t("Senate")} <b className={result.senate.controlD >= .5 ? "dem-text" : "rep-text"}>D {Math.round(result.senate.controlD * 100)}%</b> <small>{result.senate.median}</small></span>
      </div>}
    </aside>

    <div className="pg-results">
      <div className="pg-status" aria-live="polite">
        <span className={refining ? "pulse" : "done"} />
        {refining ? t("Simulating…") : neutral ? t("Untouched: this is the published forecast ({runs} simulations)", { runs: SIMULATIONS.toLocaleString(intl) }) : t("{runs} simulations of your scenario", { runs: SIMULATIONS.toLocaleString(intl) })}
      </div>
      <div className="pg-chambers">
        <ChamberCard title={t("HOUSE")} total={435} majority={218} outlook={result?.house ?? null} published={published.house} domain={[150, 320]} bucket={2} />
        <ChamberCard title={t("SENATE")} total={100} majority={51} outlook={result?.senate ?? null} published={published.senate} domain={[38, 64]} bucket={1} note={t("50–50 goes to Republicans: the Vice President breaks ties.")} />
      </div>

      <article className="panel pg-mapcard">
        <div className="panel-head">
          <div><p className="eyebrow">{t("435 DISTRICTS · YOUR SCENARIO")}</p><h2>{t("{n} districts lean Democratic", { n: leaning.house })}</h2></div>
          <div className="pg-legend"><span><i className="rep" />R</span><i className="pg-legend-ramp" /><span>D<i className="dem" /></span><span><i className="ring" />{t("Flips")}</span></div>
        </div>
        <DotMap margins={houseMap} flipped={flipped} label={t("Map of House districts coloured by scenario margin")} onHover={setHovered} onSelect={(code) => router.push(localize(`/races/${code.toLowerCase()}`))} />
        <div className="pg-readout" aria-live="polite">
          {hoveredRace && hoveredMargin !== undefined ? <>
            <strong>{hoveredRace.code}</strong><span>{raceName(hoveredRace, t)}</span>
            <span>{t("Forecast")} <b className={hoveredRace.signedMargin >= 0 ? "dem-text" : "rep-text"}>{signedLabel(hoveredRace.signedMargin)}</b> → <b className={hoveredMargin >= 0 ? "dem-text" : "rep-text"}>{signedLabel(hoveredMargin)}</b></span>
            <span>{t("{pct}% D", { pct: Math.round(demWinProbability(hoveredMargin) * 100) })}</span>
          </> : <span className="muted">{t("Hover a district to compare; click to open its race.")}</span>}
        </div>
        <div className="pg-senate-tiles" aria-label={t("Senate races in your scenario")}>
          {stateTiles.map((tile) => {
            const margin = senateMap.get(tile.code);
            const race = races.find((item) => item.chamber === "senate" && item.code === tile.code);
            const style = { gridColumn: tile.col + 1, gridRow: tile.row + 1, background: margin === undefined ? undefined : marginColor(margin, 15) } as React.CSSProperties;
            if (margin === undefined || !race) return <span key={tile.code} className="pg-tile empty" style={style} aria-hidden="true">{tile.code}</span>;
            return <Link key={tile.code} href={`/races/${raceSlug(race)}`} className={`pg-tile${flippedSenate.has(tile.code) ? " flipped" : ""}`} style={style} title={`${raceName(race, t)}: ${signedLabel(race.signedMargin)} → ${signedLabel(margin)}`} aria-label={t("{name}: forecast {from}, scenario {to}", { name: raceName(race, t), from: signedLabel(race.signedMargin), to: signedLabel(margin) })}>
              <b>{tile.code}</b><small>{signedLabel(margin, 0)}</small>
            </Link>;
          })}
        </div>
        <p className="chart-note">{t("Senate tiles: the 35 seats on the ballot. Grey tiles have no race in 2026.")}</p>
      </article>

      <article className="panel pg-flips">
        <div className="panel-head">
          <div><p className="eyebrow">{t("VS THE PUBLISHED FORECAST")}</p><h2>{flips.length ? t("{n} races change favourite", { n: flips.length }) : t("No race changes favourite")}</h2></div>
          {flips.length > 0 && <span className="pg-chip"><b className="dem-text">{t("{n} to D", { n: toD })}</b> · <b className="rep-text">{t("{n} to R", { n: toR })}</b></span>}
        </div>
        {flips.length === 0 ? <p className="pg-empty">{t("Move a slider or pick a preset: races whose expected winner changes appear here.")}</p> : <ul className="pg-flip-list">
          {flipList.map(({ race, margin }) => <li key={`${race.chamber}-${race.code}`} className={margin >= 0 ? "to-d" : "to-r"}>
            <Link href={`/races/${raceSlug(race)}`}>
              <span className="pg-flip-code">{race.code}</span>
              <span className="pg-flip-name">{raceName(race, t)}</span>
              <span className="pg-flip-move"><b className={race.signedMargin >= 0 ? "dem-text" : "rep-text"}>{signedLabel(race.signedMargin)}</b> → <b className={margin >= 0 ? "dem-text" : "rep-text"}>{signedLabel(margin)}</b></span>
            </Link>
          </li>)}
        </ul>}
        {flips.length > 18 && <button type="button" className="text-button" onClick={() => setShowAllFlips((value) => !value)}>{showAllFlips ? t("Show fewer") : t("Show all {n}", { n: flips.length })}</button>}
      </article>
    </div>
  </div>;
}

"use client";

import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { percent } from "@/components/night/use-night";
import { etClock, spainClock, type ChamberNight, type NightCall, type NightState } from "@/lib/night";

export function RehearsalTag() {
  const t = useT();
  return <span className="night-rehearsal-tag">{t("REHEARSAL · SIMULATED RESULTS")}</span>;
}

// One chamber: seats called for each party (and, in the Senate, the seats not on the ballot), the uncalled
// seats in the middle, the majority line, and the chance of a Democratic majority given the calls so far.
export function ChamberResult({ label, chamber, big = false }: { label: string; chamber: ChamberNight; big?: boolean }) {
  const t = useT();
  const share = (value: number) => `${(value / chamber.seats) * 100}%`;
  const d = chamber.controlD;
  return <section className={`night-chamber${big ? " big" : ""}`}>
    <header><p className="eyebrow">{label}</p><span>{t("{n} for a majority", { n: chamber.majority })}</span></header>
    <div className="night-tally"><strong className="dem-text">{chamber.locked.D}</strong><span>{t("{n} uncalled", { n: chamber.uncalled })}</span><strong className="rep-text">{chamber.locked.R}</strong></div>
    <div className="night-seat-bar" role="img" aria-label={t("Democrats {d}, Republicans {r}, {n} uncalled", { d: chamber.locked.D, r: chamber.locked.R, n: chamber.uncalled })}>
      <i className="dem" style={{ width: share(chamber.locked.D) }} /><i className="rep" style={{ width: share(chamber.locked.R) }} /><b style={{ left: share(chamber.majority) }} />
    </div>
    <p className="night-odds"><b className="night-odds-model">MP-26</b> <strong className={d >= .5 ? "dem-text" : "rep-text"}>{percent(d >= .5 ? d : 1 - d)}</strong> {d >= .5 ? t("chance of a Democratic majority") : t("chance of a Republican majority")}<small>{t("forecast before the night: {p} D", { p: percent(chamber.forecast.controlD) })}</small></p>
    {chamber.locked.D !== chamber.called.D || chamber.locked.R !== chamber.called.R ? <p className="night-chamber-note">{t("Includes the {d} D and {r} R seats not on the ballot.", { d: chamber.locked.D - chamber.called.D, r: chamber.locked.R - chamber.called.R })}</p> : null}
  </section>;
}

export function useShiftSentence(shift: number | null) {
  const t = useT();
  const intl = useIntlLocale();
  if (shift === null || Math.abs(shift) < .5) return null;
  const n = Math.abs(shift).toLocaleString(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return shift > 0
    ? t("The calls so far point to Democrats running {n} points ahead of the forecast nationally.", { n })
    : t("The calls so far point to Republicans running {n} points ahead of the forecast nationally.", { n });
}

// Results header for the election night guide: chambers, the night's clock and the latest calls.
export function NightBoard({ state, now, nameOf }: { state: NightState; now: number; nameOf: (key: string) => string }) {
  const t = useT();
  const shift = useShiftSentence(state.shift);
  return <section className={`panel night-board${state.mode === "rehearsal" ? " rehearsal" : ""}`} aria-live="polite">
    <div className="night-board-head">
      <p className="eyebrow">{state.mode === "rehearsal" ? <RehearsalTag /> : t("LIVE · RACES CALLED")}</p>
      <p className="night-clock"><strong>{spainClock(now)}</strong> <span>{t("in Spain")} · {etClock(now)} ET</span></p>
    </div>
    {state.house && state.senate && <div className="night-chambers">
      <ChamberResult label={t("U.S. House")} chamber={state.house} />
      <ChamberResult label={t("U.S. Senate")} chamber={state.senate} />
    </div>}
    {shift && <p className="night-shift">{shift}</p>}
    {state.calls.length > 0 && <ol className="night-latest">
      {state.calls.slice(0, 6).map((call: NightCall) => <li key={call.key}><time>{spainClock(Date.parse(call.at))}</time><b className={call.winner === "D" ? "dem-text" : "rep-text"}>{call.winner}</b> {nameOf(call.key)}</li>)}
    </ol>}
    <p className="night-board-note">{t("Races are marked called when the major networks project them. The odds update with every call: each result also says something about the races still being counted.")}</p>
  </section>;
}

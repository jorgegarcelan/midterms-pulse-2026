"use client";

import { useEffect, useState } from "react";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { StreamStage, useStreamModel } from "@/components/stream/stream-stage";
import type { ModelResult } from "@/lib/model";

const ELECTION = Date.parse("2026-11-03T11:00:00Z");

function Chamber({ label, seats, majority, outlook }: { label: string; seats: number; majority: number; outlook: ModelResult["house"] }) {
  const t = useT();
  const d = outlook.demMajority;
  const leader = d >= 50 ? "dem" : "rep";
  const share = (value: number) => `${(value / seats) * 100}%`;
  return <section className={`stream-chamber ${leader}`}>
    <p className="stream-kicker">{label}</p>
    <div className="stream-odds"><strong>{d >= 50 ? d : 100 - d}%</strong><span>{d >= 50 ? t("chance of a Democratic majority") : t("chance of a Republican majority")}</span></div>
    <div className="stream-seats">
      <div className="stream-seat-bar"><i className="dem" style={{ width: share(outlook.demSeats) }} /><i className="rep" style={{ width: share(outlook.repSeats) }} /><b style={{ left: share(majority) }} /></div>
      <div className="stream-seat-labels"><span className="dem-text">D {outlook.demSeats}</span><span>{t("{n} for a majority", { n: majority })}</span><span className="rep-text">{outlook.repSeats} R</span></div>
      <p className="stream-interval">{t("Democrats win between {low} and {high} seats in 80% of simulations", { low: outlook.interval80[0], high: outlook.interval80[1] })}</p>
    </div>
  </section>;
}

// Broadcast scoreboard: both chambers, the generic ballot and the days left.
export function StreamControl({ transparent }: { transparent: boolean }) {
  const t = useT();
  const intl = useIntlLocale();
  const model = useStreamModel();
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setDays(Math.max(0, Math.ceil((ELECTION - Date.now()) / 86_400_000)));
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);
  const ballot = model?.genericBallot.margin ?? 0;
  return <StreamStage transparent={transparent} model={model}>
    {model ? <div className="stream-control">
      <Chamber label={t("U.S. House")} seats={435} majority={218} outlook={model.house} />
      <Chamber label={t("U.S. Senate")} seats={100} majority={51} outlook={model.senate} />
      <div className="stream-strip">
        <div><span>{t("Generic ballot")}</span><strong className={ballot >= 0 ? "dem-text" : "rep-text"}>{ballot >= 0 ? "D" : "R"}+{Math.abs(ballot).toFixed(1)}</strong></div>
        <div><span>{t("Days to election")}</span><strong>{days ?? "—"}</strong></div>
        <div><span>{t("Simulations")}</span><strong>{model.simulations.toLocaleString(intl)}</strong></div>
      </div>
    </div> : <p className="stream-loading">{t("Loading model…")}</p>}
  </StreamStage>;
}

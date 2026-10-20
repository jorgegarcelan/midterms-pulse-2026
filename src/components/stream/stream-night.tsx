"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { ChamberResult, RehearsalTag, useShiftSentence } from "@/components/night/night-board";
import { useNight, useRehearsalFlag } from "@/components/night/use-night";
import { StreamStage } from "@/components/stream/stream-stage";
import { etClock, spainClock } from "@/lib/night";
import { raceName } from "@/lib/races";

// Race names for the ticker, from the published model.
function useRaceNames() {
  const t = useT();
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/model").then((response) => response.json()).then((model: { races: { chamber: "house" | "senate"; code: string; state: string }[] }) => {
      setNames(Object.fromEntries(model.races.map((race) => [`${race.chamber}:${race.code}`, raceName(race, t)])));
    }).catch(() => undefined);
  }, [t]);
  return names;
}

// Election night scoreboard: seats called in each chamber, majority odds given the calls, the latest calls.
export function StreamNight({ transparent }: { transparent: boolean }) {
  const t = useT();
  const rehearsal = useRehearsalFlag();
  const { state, now } = useNight(rehearsal);
  const names = useRaceNames();
  const shift = useShiftSentence(state?.shift ?? null);
  return <StreamStage transparent={transparent}>
    {state?.house && state.senate ? <div className="stream-night">
      <div className="stream-night-head">
        {state.mode === "rehearsal" ? <RehearsalTag /> : <span className="stream-kicker">{t("LIVE · RACES CALLED")}</span>}
        <span className="stream-night-clock"><strong>{spainClock(now)}</strong> {t("in Spain")} · {etClock(now)} ET</span>
      </div>
      <div className="stream-night-chambers">
        <ChamberResult label={t("U.S. House")} chamber={state.house} big />
        <ChamberResult label={t("U.S. Senate")} chamber={state.senate} big />
      </div>
      <div className="stream-night-foot">
        <ol className="stream-night-ticker">
          {state.calls.slice(0, 4).map((call) => <li key={call.key}><time>{spainClock(Date.parse(call.at))}</time><b className={call.winner === "D" ? "dem-text" : "rep-text"}>{call.winner}</b>{names[call.key] || call.key}</li>)}
          {state.calls.length === 0 && <li className="quiet">{t("No races called yet.")}</li>}
        </ol>
        {shift && <p className="stream-night-shift">{shift}</p>}
      </div>
    </div> : <p className="stream-loading">{t("Loading results…")}</p>}
  </StreamStage>;
}

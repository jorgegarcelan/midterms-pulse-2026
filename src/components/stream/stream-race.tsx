"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { RaceReadingsView, SourcesLine } from "@/components/readings/readings";
import { StreamStage, useStreamModel } from "@/components/stream/stream-stage";
import { stateByCode } from "@/data/geography";
import { expertBook, modelRatingLabel, RATERS } from "@/lib/expert-ratings";
import { parseRaceSlug } from "@/lib/races";
import type { RaceReadings } from "@/lib/readings-shared";

const tone = (rating: string | null) => !rating ? "" : rating.endsWith(" D") ? "dem-text" : rating.endsWith(" R") ? "rep-text" : "toss-text";

// One race, full screen: the four readings (polls, markets, MP-26, Census-26) and the three raters.
export function StreamRace({ slug, transparent }: { slug: string; transparent: boolean }) {
  const t = useT();
  const model = useStreamModel();
  const parsed = parseRaceSlug(slug);
  const [readings, setReadings] = useState<RaceReadings | null>(null);
  const wanted = parsed ? `${parsed.chamber}:${parsed.code}` : "";
  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    const load = () => fetch(`/api/readings?race=${wanted}`).then((response) => response.ok ? response.json() as Promise<RaceReadings> : null).then((next) => { if (alive && next) setReadings(next); }).catch(() => undefined);
    load();
    const timer = window.setInterval(load, 5 * 60_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [wanted]);
  const race = parsed && model?.races.find((item) => item.chamber === parsed.chamber && item.code === parsed.code);
  if (!race) return <StreamStage transparent={transparent} model={model}><p className="stream-loading">{model ? t("No modeled race matches this URL.") : t("Loading model…")}</p></StreamStage>;

  const state = t(stateByCode.get(race.state)?.name || race.state);
  const title = race.chamber === "senate" ? t("{state} Senate", { state }) : race.code;
  const subtitle = race.chamber === "senate" ? t("U.S. Senate") : `${t("U.S. House")} · ${state}`;
  const demP = race.leader === "D" ? race.winProbability : 100 - race.winProbability;
  const entry = expertBook(race);

  return <StreamStage transparent={transparent} model={model}>
    <div className="stream-race">
      <div className="stream-race-head"><p className="stream-kicker">{subtitle}{race.special ? ` · ${t("special")}` : ""}</p><h1>{title}</h1></div>
      {readings ? <RaceReadingsView readings={readings} variant="stream" /> : <p className="stream-loading">{t("Loading…")}</p>}
      {readings && <SourcesLine readings={readings} />}
      <div className="stream-ratings">
        <div><span>{model?.version}</span><strong className={tone(modelRatingLabel(demP))}>{t(modelRatingLabel(demP))}</strong></div>
        {RATERS.map((rater) => { const rating = entry?.book[rater.key] ?? null; return <div key={rater.key}><span>{rater.short}</span><strong className={tone(rating)}>{rating ? t(rating) : "—"}</strong></div>; })}
      </div>
    </div>
  </StreamStage>;
}

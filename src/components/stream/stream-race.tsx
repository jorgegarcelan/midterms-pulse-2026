"use client";

import { useT } from "@/components/i18n/locale-provider";
import { StreamStage, useStreamModel } from "@/components/stream/stream-stage";
import { stateByCode } from "@/data/geography";
import { expertBook, modelRatingLabel, RATERS } from "@/lib/expert-ratings";
import { parseRaceSlug } from "@/lib/races";

const tone = (rating: string | null) => !rating ? "" : rating.endsWith(" D") ? "dem-text" : rating.endsWith(" R") ? "rep-text" : "toss-text";

// One race, full screen: the model's call, the vote split and the three raters.
export function StreamRace({ slug, transparent }: { slug: string; transparent: boolean }) {
  const t = useT();
  const model = useStreamModel();
  const parsed = parseRaceSlug(slug);
  const race = parsed && model?.races.find((item) => item.chamber === parsed.chamber && item.code === parsed.code);
  if (!race) return <StreamStage transparent={transparent} model={model}><p className="stream-loading">{model ? t("No modeled race matches this URL.") : t("Loading model…")}</p></StreamStage>;

  const state = t(stateByCode.get(race.state)?.name || race.state);
  const title = race.chamber === "senate" ? t("{state} Senate", { state }) : race.code;
  const subtitle = race.chamber === "senate" ? t("U.S. Senate") : `${t("U.S. House")} · ${state}`;
  const demP = race.leader === "D" ? race.winProbability : 100 - race.winProbability;
  const entry = expertBook(race);
  const dem = race.demVote ?? 50;
  const rep = race.repVote ?? 50;

  return <StreamStage transparent={transparent} model={model}>
    <div className="stream-race">
      <div className="stream-race-head"><p className="stream-kicker">{subtitle}{race.special ? ` · ${t("special")}` : ""}</p><h1>{title}</h1></div>
      <div className="stream-race-call">
        <div><span>{t("Model margin")}</span><strong className={race.leader === "D" ? "dem-text" : "rep-text"}>{race.leader}+{race.margin.toFixed(1)}</strong></div>
        <div><span>{t("Democratic win probability")}</span><strong>{demP}%</strong></div>
      </div>
      <div className="stream-race-bar"><i className="dem" style={{ width: `${demP}%` }} /><i className="rep" style={{ width: `${100 - demP}%` }} /><b /></div>
      <div className="stream-race-votes"><span className="dem-text">D {dem.toFixed(1)}%</span><span>{t("projected vote")}</span><span className="rep-text">R {rep.toFixed(1)}%</span></div>
      <div className="stream-ratings">
        <div><span>{model?.version}</span><strong className={tone(modelRatingLabel(demP))}>{t(modelRatingLabel(demP))}</strong></div>
        {RATERS.map((rater) => { const rating = entry?.book[rater.key] ?? null; return <div key={rater.key}><span>{rater.short}</span><strong className={tone(rating)}>{rating ? t(rating) : "—"}</strong></div>; })}
      </div>
    </div>
  </StreamStage>;
}

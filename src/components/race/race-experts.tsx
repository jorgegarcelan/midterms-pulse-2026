"use client";

import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import type { ForecastRace } from "@/lib/forecast";
import { disagreement, expertBook, modelRatingLabel, RATERS, ratingDates, ratingsRetrieved } from "@/lib/expert-ratings";
import { MODEL_VERSION } from "@/lib/mp26";

const tone = (rating: string | null) => !rating ? "" : rating.endsWith(" D") ? "dem" : rating.endsWith(" R") ? "rep" : "toss";
const shortDate = (iso: string | null, locale: string) => iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" }) : "";

// The model's call next to the three established handicappers, with an explicit note when they part ways.
export function RaceExperts({ race }: { race: ForecastRace }) {
  const t = useT();
  const intl = useIntlLocale();
  const entry = expertBook(race);
  const demProbability = race.leader === "D" ? race.winProbability : 100 - race.winProbability;
  const model = modelRatingLabel(demProbability);
  const split = disagreement(race);
  const dates = ratingDates(race.chamber);

  return <article className="panel race-experts">
    <div className="panel-head"><div><p className="eyebrow">{t("SECOND OPINION")}</p><h2>{t("Model vs. the handicappers")}</h2></div><span className="panel-tag">{t("Ratings as of {date}", { date: shortDate(ratingsRetrieved, intl) })}</span></div>
    <div className="expert-grid">
      <div className="expert-cell model"><span>{MODEL_VERSION}</span><strong className={tone(model)}>{t(model)}</strong><small>{race.winProbability}% {race.leader}</small></div>
      {RATERS.map((rater) => {
        const rating = entry?.book[rater.key] ?? null;
        return <a key={rater.key} className="expert-cell" href={rater.url} target="_blank" rel="noreferrer"><span>{rater.short} ↗</span><strong className={tone(rating)}>{rating ? t(rating) : t("Not rated")}</strong><small>{entry?.listed ? shortDate(dates[rater.key], intl) : t("Not on competitive list")}</small></a>;
      })}
    </div>
    {split
      ? <p className="expert-note warn">{split.toward === "D" ? t("The model is more bullish on Democrats than the handicappers here.") : t("The model is more bullish on Republicans than the handicappers here.")} {t("It reads polls and the national environment; the raters also weigh candidate quality, money and local reporting the model cannot see.")}</p>
      : entry && <p className="expert-note">{t("The model and the handicappers broadly agree on this race.")}</p>}
  </article>;
}

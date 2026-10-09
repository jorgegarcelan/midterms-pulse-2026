import type { ForecastRace } from "@/lib/forecast";
import { disagreement, expertBook, modelRatingLabel, RATERS, ratingDates, ratingsRetrieved } from "@/lib/expert-ratings";
import { MODEL_VERSION } from "@/lib/mp26";

const tone = (rating: string | null) => !rating ? "" : rating.endsWith(" D") ? "dem" : rating.endsWith(" R") ? "rep" : "toss";
const shortDate = (iso: string | null) => iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";

// The model's call next to the three established handicappers, with an explicit note when they part ways.
export function RaceExperts({ race }: { race: ForecastRace }) {
  const entry = expertBook(race);
  const demProbability = race.leader === "D" ? race.winProbability : 100 - race.winProbability;
  const model = modelRatingLabel(demProbability);
  const split = disagreement(race);
  const dates = ratingDates(race.chamber);
  const partyName = (party: "D" | "R") => party === "D" ? "Democrats" : "Republicans";

  return <article className="panel race-experts">
    <div className="panel-head"><div><p className="eyebrow">SECOND OPINION</p><h2>Model vs. the handicappers</h2></div><span className="panel-tag">Ratings as of {shortDate(ratingsRetrieved)}</span></div>
    <div className="expert-grid">
      <div className="expert-cell model"><span>{MODEL_VERSION}</span><strong className={tone(model)}>{model}</strong><small>{race.winProbability}% {race.leader}</small></div>
      {RATERS.map((rater) => {
        const rating = entry?.book[rater.key] ?? null;
        return <a key={rater.key} className="expert-cell" href={rater.url} target="_blank" rel="noreferrer"><span>{rater.short} ↗</span><strong className={tone(rating)}>{rating || "Not rated"}</strong><small>{entry?.listed ? shortDate(dates[rater.key]) : "Not on competitive list"}</small></a>;
      })}
    </div>
    {split
      ? <p className="expert-note warn">The model is more bullish on {partyName(split.toward)} than the handicappers here. It reads polls and the national environment; the raters also weigh candidate quality, money and local reporting the model cannot see.</p>
      : entry && <p className="expert-note">The model and the handicappers broadly agree on this race.</p>}
  </article>;
}

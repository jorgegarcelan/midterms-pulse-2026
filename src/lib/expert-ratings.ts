import ratings from "@/data/expert-ratings.json";
import type { ForecastRace } from "@/lib/forecast";

export type RaterKey = "cook" | "ie" | "sabato";
export type ExpertBook = Record<RaterKey, string | null>;

export const RATERS: { key: RaterKey; name: string; short: string; url: string }[] = [
  { key: "cook", name: "Cook Political Report", short: "Cook", url: "https://www.cookpolitical.com/ratings" },
  { key: "ie", name: "Inside Elections", short: "IE", url: "https://insideelections.com/ratings" },
  { key: "sabato", name: "Sabato's Crystal Ball", short: "Sabato", url: "https://centerforpolitics.org/crystalball/" },
];

export const ratingsRetrieved = ratings.retrieved;
export const ratingsSource = ratings.source;
export const ratingDates = (chamber: ForecastRace["chamber"]) => ratings[chamber].dates as Record<RaterKey, string | null>;

const SCORE: Record<string, number> = { "Safe D": 3, "Likely D": 2, "Lean D": 1, "Tilt D": .5, "Toss-up": 0, "Tilt R": -.5, "Lean R": -1, "Likely R": -2, "Safe R": -3 };

// Races missing from the House table are on no rater's competitive list: Safe for the 2024 winner.
export function expertBook(race: Pick<ForecastRace, "chamber" | "code" | "baselineDem" | "baselineRep">): { book: ExpertBook; listed: boolean } | null {
  const listed = (ratings[race.chamber].races as Record<string, ExpertBook>)[race.code];
  if (listed) return { book: listed, listed: true };
  if (race.chamber === "senate" || race.baselineDem === null || race.baselineRep === null) return null;
  const safe = race.baselineDem > race.baselineRep ? "Safe D" : "Safe R";
  return { book: { cook: safe, ie: safe, sabato: safe }, listed: false };
}

// Average of the three ratings on a −3 (Safe R) … +3 (Safe D) scale.
export function expertScore(book: ExpertBook) {
  const scores = Object.values(book).flatMap((rating) => rating && rating in SCORE ? [SCORE[rating]] : []);
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
}

// The model's Democratic win probability on the same scale, using the raters' usual bands.
export function modelScore(demProbability: number) {
  const p = demProbability >= 50 ? demProbability : 100 - demProbability;
  const tier = p < 60 ? 0 : p < 75 ? 1 : p < 90 ? 2 : 3;
  return demProbability >= 50 ? tier : -tier;
}

export function modelRatingLabel(demProbability: number) {
  const score = modelScore(demProbability);
  if (score === 0) return "Toss-up";
  return `${["", "Lean", "Likely", "Safe"][Math.abs(score)]} ${score > 0 ? "D" : "R"}`;
}

// The model and the raters disagree when they are two or more steps apart, or favour different parties
// with the model outside the toss-up band.
export function disagreement(race: ForecastRace) {
  const entry = expertBook(race);
  const experts = entry && expertScore(entry.book);
  if (experts === null || experts === undefined) return null;
  const demProbability = race.leader === "D" ? race.winProbability : 100 - race.winProbability;
  const model = modelScore(demProbability);
  const gap = model - experts;
  const opposite = model !== 0 && Math.sign(model) !== Math.sign(experts) && experts !== 0;
  if (Math.abs(gap) < 2 && !opposite) return null;
  return { gap, toward: gap > 0 ? "D" as const : "R" as const, model: modelRatingLabel(demProbability) };
}

// Types of the general layer (polls, markets, ratings), shared with client components.

export type RaceOverview = {
  key: string; chamber: "house" | "senate"; code: string; state: string; special: boolean;
  // The non-Republican side: the Democrat, or the independent where no Democrat runs (Nebraska).
  side: "D" | "I";
  // 2024 margin on the district's lines (D positive): a result, not a forecast.
  baseline: number | null;
  rating: { score: number; label: string; listed: boolean } | null;
  polls: { margin: number; polls: number; latest: string } | null;
  // Polymarket probability for the non-Republican side; Senate races only.
  market: number | null;
};

export type ChamberOverview = {
  seats: number; majority: number;
  polls: { margin: number; kind: "generic" } | null;
  market: { p: number; url: string } | null;
  // Races by the raters' consensus: favouring D (Tilt D or more), toss-up, favouring R.
  ratings: { D: number; toss: number; R: number };
  // Senate: seats not on the ballot, and who leads the polls in each race.
  notUp: { D: number; R: number } | null;
  pollLeaders: { D: number; I: number; R: number; none: number } | null;
};

export type Overview = { updated: string; races: RaceOverview[]; house: ChamberOverview; senate: ChamberOverview };

// Ordering strength of a race on one axis, for maps and ladders: the rating band first, the 2024 result
// only to order races inside the same band. Positive leans Democratic.
export function ratingStrength(race: Pick<RaceOverview, "rating" | "baseline">) {
  const score = race.rating?.score ?? 0;
  // Consensus scores differ by at least 1/6 (three raters, half steps), so ±0.08 never crosses a band.
  const tie = Math.max(-1, Math.min(1, (race.baseline ?? 0) / 30)) * .08;
  return score + tie;
}

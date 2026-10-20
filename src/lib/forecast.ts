import snapshot from "@/data/forecast-snapshot.json";
import newLines from "@/data/pres-2024-new-lines.json";
import { fetchVoteScope } from "@/lib/vote-scope";

export type ForecastRace = {
  code: string;
  state: string;
  name: string;
  chamber: "house" | "senate";
  leader: "D" | "R";
  margin: number;
  signedMargin: number;
  winProbability: number;
  closeProbability: number;
  rating: string;
  demVote: number | null;
  repVote: number | null;
  // The 2024 result on the district's lines: the House race, or for the nine states with new maps
  // in 2026 (no House race on those lines yet) the presidential two-party margin. Signed D − R.
  baselineDem: number | null;
  baselineRep: number | null;
  baselineMargin: number | null;
  baselineKind: "result" | "pres-new-lines";
  pollCount: number | null;
  incumbentParty: "D" | "R" | null;
  special: boolean;
};

export type ForecastFeed = {
  updated: string;
  house: { demMajority: number; demSeats: number; repSeats: number; interval: number[]; polls: number };
  senate: { demMajority: number; demSeats: number; repSeats: number; interval: number[]; polls: number };
  districts: ForecastRace[];
  senateRaces: ForecastRace[];
  races: ForecastRace[];
  source: string;
  sourceUrl: string;
  stale?: boolean;
};

type SourceParty = { party: string; seats_projected?: number; seats_median?: number; seats_ci_low_80?: number; seats_ci_high_80?: number; p_majority?: number };
type SourceRiding = {
  name_en: string; province: string; incumbent_party?: string; is_special?: boolean; poll_count?: number;
  projection: { winner: string; p_winner: number; mean_margin: number; p_close_race?: number; vote_mean?: { us_dem?: number; us_rep?: number }; rating?: { label_en?: string } };
  baseline_result?: { us_dem_pct?: number; us_rep_pct?: number };
};
type SourcePayload = { meta: { run_date: string; n_polls: number }; parties: SourceParty[]; ridings: SourceRiding[] };

function chamberSummary(payload: SourcePayload) {
  const dem = payload.parties.find((item) => item.party === "us_dem");
  const rep = payload.parties.find((item) => item.party === "us_rep");
  return {
    demMajority: Math.round((dem?.p_majority || 0) * 100),
    demSeats: Math.round(dem?.seats_projected ?? dem?.seats_median ?? 0),
    repSeats: Math.round(rep?.seats_projected ?? rep?.seats_median ?? 0),
    interval: [Math.round(dem?.seats_ci_low_80 ?? 0), Math.round(dem?.seats_ci_high_80 ?? 0)],
    polls: payload.meta.n_polls,
  };
}

// Census and FEC key at-large seats as district "00"; the forecast feed calls them "AL".
function normalizeCode(value: string) {
  const match = value.match(/^([A-Z]{2})-(\d{1,2}|AL)$/);
  if (!match) return value;
  return `${match[1]}-${match[2] === "AL" ? "00" : match[2].padStart(2, "0")}`;
}

/*
  The source's `mean_margin` is the expected size of the winning margin, |D − R|, not the expected
  D − R margin: a dead-even race with ±5 pts of uncertainty reports ≈4. The signed expectation is the
  difference of the mean vote shares, which always agrees with the projected winner.
*/
function expectedMargin(race: SourceRiding) {
  const vote = race.projection.vote_mean;
  if (vote?.us_dem !== undefined && vote.us_rep !== undefined) return Math.round((vote.us_dem - vote.us_rep) * 100) / 100;
  return (race.projection.winner === "us_dem" ? 1 : -1) * Math.abs(race.projection.mean_margin);
}

function normalizeRaces(payload: SourcePayload, chamber: "house" | "senate"): ForecastRace[] {
  return payload.ridings.map((race): ForecastRace => {
    const signed = expectedMargin(race);
    const leader = signed >= 0 ? "D" : "R";
    const margin = Math.abs(signed);
    return {
      code: chamber === "house" ? normalizeCode(race.name_en) : race.province,
      state: race.province,
      name: race.name_en,
      chamber,
      leader,
      margin,
      signedMargin: leader === "D" ? margin : -margin,
      winProbability: Math.round(race.projection.p_winner * 100),
      closeProbability: Math.round((race.projection.p_close_race || 0) * 100),
      rating: race.projection.rating?.label_en || "Unrated",
      demVote: race.projection.vote_mean?.us_dem ?? null,
      repVote: race.projection.vote_mean?.us_rep ?? null,
      baselineDem: race.baseline_result?.us_dem_pct ?? null,
      baselineRep: race.baseline_result?.us_rep_pct ?? null,
      baselineMargin: null,
      baselineKind: "result",
      pollCount: race.poll_count ?? null,
      incumbentParty: race.incumbent_party === "us_dem" ? "D" : race.incumbent_party === "us_rep" ? "R" : null,
      special: Boolean(race.is_special),
    };
  }).map(onTheseLines);
}

const REDRAWN_2026: readonly string[] = newLines.states;
const presNewLines = newLines.margins as Record<string, number>;

/*
  The feed's baseline is the 2024 House result of the old district with the same number, which in the
  nine redrawn states is different territory (the new UT-01 is a Salt Lake seat; the old one was R+29).
  Those districts get the 2024 presidential margin measured on the new lines instead.
*/
function onTheseLines(race: ForecastRace): ForecastRace {
  if (race.chamber === "house" && REDRAWN_2026.includes(race.state)) {
    return { ...race, baselineDem: null, baselineRep: null, baselineMargin: presNewLines[race.code] ?? null, baselineKind: "pres-new-lines" };
  }
  const margin = race.baselineDem !== null && race.baselineRep !== null ? Math.round((race.baselineDem - race.baselineRep) * 100) / 100 : null;
  return { ...race, baselineMargin: margin, baselineKind: "result" };
}

function closest(districts: ForecastRace[], senateRaces: ForecastRace[]) {
  return [...senateRaces].sort((a, b) => a.margin - b.margin).slice(0, 8)
    .concat([...districts].sort((a, b) => a.margin - b.margin).slice(0, 12));
}

export function cachedForecast(): ForecastFeed {
  const typed = snapshot as unknown as Omit<ForecastFeed, "races" | "stale">;
  const districts = typed.districts.map(onTheseLines);
  const senateRaces = typed.senateRaces.map(onTheseLines);
  return { ...typed, districts, senateRaces, races: closest(districts, senateRaces), stale: true };
}

export function normalizeForecast(house: SourcePayload, senate: SourcePayload): ForecastFeed {
  const districts = normalizeRaces(house, "house");
  const senateRaces = normalizeRaces(senate, "senate");
  return {
    updated: house.meta.run_date > senate.meta.run_date ? house.meta.run_date : senate.meta.run_date,
    house: chamberSummary(house), senate: chamberSummary(senate), districts, senateRaces,
    races: closest(districts, senateRaces), source: "Vote-Scope", sourceUrl: "https://vote-scope.com/api/",
  };
}

export async function fetchForecast(): Promise<ForecastFeed> {
  try {
    const [house, senate] = await Promise.all([fetchVoteScope<SourcePayload>("us-house/latest.json"), fetchVoteScope<SourcePayload>("us-senate/latest.json")]);
    return normalizeForecast(house, senate);
  } catch {
    return cachedForecast();
  }
}

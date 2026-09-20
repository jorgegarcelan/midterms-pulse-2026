import snapshot from "@/data/forecast-snapshot.json";

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
  baselineDem: number | null;
  baselineRep: number | null;
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

function normalizeCode(value: string) {
  const match = value.match(/^([A-Z]{2})-(\d{1,2})$/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}` : value;
}

function normalizeRaces(payload: SourcePayload, chamber: "house" | "senate"): ForecastRace[] {
  return payload.ridings.map((race) => {
    const leader = race.projection.winner === "us_dem" ? "D" : "R";
    const margin = Math.abs(race.projection.mean_margin);
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
      pollCount: race.poll_count ?? null,
      incumbentParty: race.incumbent_party === "us_dem" ? "D" : race.incumbent_party === "us_rep" ? "R" : null,
      special: Boolean(race.is_special),
    };
  });
}

function closest(districts: ForecastRace[], senateRaces: ForecastRace[]) {
  return [...senateRaces].sort((a, b) => a.margin - b.margin).slice(0, 8)
    .concat([...districts].sort((a, b) => a.margin - b.margin).slice(0, 12));
}

export function cachedForecast(): ForecastFeed {
  const typed = snapshot as Omit<ForecastFeed, "races" | "stale">;
  return { ...typed, races: closest(typed.districts, typed.senateRaces), stale: true };
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
    const [houseResponse, senateResponse] = await Promise.all([
      fetch("https://vote-scope.com/web_data/us-house/latest.json", { next: { revalidate: 900 } }),
      fetch("https://vote-scope.com/web_data/us-senate/latest.json", { next: { revalidate: 900 } }),
    ]);
    if (!houseResponse.ok || !senateResponse.ok) throw new Error("Forecast source unavailable");
    const [house, senate] = await Promise.all([houseResponse.json() as Promise<SourcePayload>, senateResponse.json() as Promise<SourcePayload>]);
    return normalizeForecast(house, senate);
  } catch {
    return cachedForecast();
  }
}

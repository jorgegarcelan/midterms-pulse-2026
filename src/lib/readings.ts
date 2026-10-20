import directory from "../../public/data/candidates-2026.json";
import { stateByCode } from "@/data/geography";
import type { CandidateData } from "@/lib/candidates";
import { loadCensusModel } from "@/lib/census-model";
import { consensus, expertBook, ratingDates } from "@/lib/expert-ratings";
import type { ForecastRace } from "@/lib/forecast";
import type { ModelResult } from "@/lib/model";
import { inverseNormal, RACE_SD } from "@/lib/mp26";
import { fetchWinnerMarket, senateWinnerSlug } from "@/lib/polymarket";
import { loadRacePolls, raceAverage } from "@/lib/race-polls";
import type { RaceReadings } from "@/lib/readings-shared";

export { readingsDisagree, type RaceReadings } from "@/lib/readings-shared";

/*
  The four readings of a race or a chamber, always in this order: what voters say (polls), what money
  says (Polymarket), and the two models (MP-26: polls and fundamentals; Census-26: demographics only).
  Probabilities are for the non-Republican side: the Democrat, or the independent in Nebraska.
*/

/*
  Census-26 covers the House; a Senate extension, when census-model/export_web.py writes it, adds
  `senate` (one entry per state with a Senate race) and `senateChamber` to the same file. Until then
  Senate readings show no Census-26 value.
*/
type CensusSenate = { senate?: { state: string; margin: number; pD: number }[]; senateChamber?: { median: number; p10: number; p90: number; pMajority: number } };
const censusSenate = () => loadCensusModel() as unknown as CensusSenate;

let censusRaces: Map<string, { margin: number; pD: number }> | null = null;
function census() {
  censusRaces ??= new Map([
    ...loadCensusModel().races.map((race) => [`house:${race.code}`, { margin: race.margin, pD: race.pD }] as const),
    ...(censusSenate().senate || []).map((race) => [`senate:${race.state}`, { margin: race.margin, pD: race.pD }] as const),
  ]);
  return censusRaces;
}

const key = (race: Pick<ForecastRace, "chamber" | "code">) => `${race.chamber}:${race.code}`;

// 80% range of a margin with normal error: ±1.28 standard deviations.
const Z80 = 1.2816;
const range = (margin: number, sd: number): [number, number] => [margin - Z80 * sd, margin + Z80 * sd];
// Census-26 publishes a margin and a probability per district; the spread behind them follows from both
// (it is wider where the lines were redrawn). Near a tie the ratio is unstable, so the typical spread is used.
const CENSUS_TYPICAL_SD = 11;
function censusSd(margin: number, p: number) {
  if (Math.abs(margin) < 1 || p <= .005 || p >= .995) return CENSUS_TYPICAL_SD;
  const sd = margin / inverseNormal(p);
  return sd > 0 && Number.isFinite(sd) ? sd : CENSUS_TYPICAL_SD;
}

const candidates = directory as unknown as CandidateData;
const partyOf = new Map(candidates.candidates.map((candidate) => [candidate.slug, candidate.party]));
export function sideOf(race: ForecastRace): "D" | "I" {
  const parties = (candidates.races[key(race)]?.candidates || []).map((slug) => partyOf.get(slug));
  return !parties.includes("D") && parties.includes("I") ? "I" : "D";
}
const demSide = (race: ForecastRace) => (race.leader === "D" ? race.winProbability : 100 - race.winProbability) / 100;

// Polymarket only lists a winner market per race in the Senate; a House district has none of its own.
async function raceMarket(race: ForecastRace): Promise<RaceReadings["market"]> {
  if (race.chamber !== "senate") return null;
  const market = await fetchWinnerMarket(senateWinnerSlug(stateByCode.get(race.state)?.name || race.state), { history: false }).catch(() => null);
  if (!market) return null;
  return { p: market.side === "D" ? market.probability : 1 - market.probability, volume: market.volume, url: market.url };
}

export async function raceReadings(races: ForecastRace[], model: Pick<ModelResult, "benchmarkDate" | "genericBallot">): Promise<Map<string, RaceReadings>> {
  const polls = await loadRacePolls();
  const today = new Date().toISOString().slice(0, 10);
  const markets = await Promise.all(races.map(raceMarket));
  const read = new Date().toISOString();
  const censusModel = loadCensusModel();
  return new Map(races.map((race, index) => {
    const blind = census().get(key(race));
    return [key(race), {
      key: key(race),
      side: sideOf(race),
      polls: raceAverage(polls.get(key(race)), today),
      market: markets[index],
      mp26: { margin: race.signedMargin, p: demSide(race), range: range(race.signedMargin, RACE_SD) },
      census: blind ? { margin: blind.margin, p: blind.pD, range: range(blind.margin, censusSd(blind.margin, blind.pD)) } : null,
      sources: {
        benchmarkDate: model.benchmarkDate, movement: model.genericBallot.movement,
        census: blind ? { generated: censusModel.generated, rmse: censusModel.headline.rmse } : null,
        ratings: (() => { const entry = expertBook(race); return entry ? { book: entry.book, consensus: consensus(race)?.label ?? null, dates: ratingDates(race.chamber) } : null; })(),
        marketRead: markets[index] ? read : null,
      },
    }];
  }));
}


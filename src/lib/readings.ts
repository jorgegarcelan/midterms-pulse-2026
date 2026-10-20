import directory from "../../public/data/candidates-2026.json";
import { stateByCode } from "@/data/geography";
import type { CandidateData } from "@/lib/candidates";
import { loadCensusModel } from "@/lib/census-model";
import type { ForecastRace } from "@/lib/forecast";
import type { ModelResult } from "@/lib/model";
import { fetchWinnerMarket, HOUSE_CONTROL_SLUG, SENATE_CONTROL_SLUG, senateWinnerSlug } from "@/lib/polymarket";
import { loadRacePolls, raceAverage } from "@/lib/race-polls";
import type { ChamberReadings, RaceReadings } from "@/lib/readings-shared";

export { readingsDisagree, type ChamberReadings, type RaceReadings } from "@/lib/readings-shared";

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

const candidates = directory as unknown as CandidateData;
const partyOf = new Map(candidates.candidates.map((candidate) => [candidate.slug, candidate.party]));
function sideOf(race: ForecastRace): "D" | "I" {
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

export async function raceReadings(races: ForecastRace[]): Promise<Map<string, RaceReadings>> {
  const polls = await loadRacePolls();
  const today = new Date().toISOString().slice(0, 10);
  const markets = await Promise.all(races.map(raceMarket));
  return new Map(races.map((race, index) => {
    const blind = census().get(key(race));
    return [key(race), {
      key: key(race),
      side: sideOf(race),
      polls: raceAverage(polls.get(key(race)), today),
      market: markets[index],
      mp26: { margin: race.signedMargin, p: demSide(race) },
      census: blind ? { margin: blind.margin, p: blind.pD } : null,
    }];
  }));
}

export async function chamberReadings(model: ModelResult): Promise<{ house: ChamberReadings; senate: ChamberReadings }> {
  const [house, senate] = await Promise.all([HOUSE_CONTROL_SLUG, SENATE_CONTROL_SLUG].map((slug) => fetchWinnerMarket(slug, { history: false }).catch(() => null)));
  const market = (value: typeof house) => value && { p: value.side === "D" ? value.probability : 1 - value.probability, url: value.url };
  const blind = loadCensusModel().house;
  const senateChamber = censusSenate().senateChamber;
  return {
    house: {
      polls: { margin: model.genericBallot.margin },
      market: market(house),
      mp26: { p: model.house.demMajority / 100, seats: model.house.demSeats, majority: 218, interval: model.house.interval80 },
      census: { p: blind.pMajority, seats: blind.median, interval: [blind.p10, blind.p90] },
    },
    senate: {
      polls: null,
      market: market(senate),
      mp26: { p: model.senate.demMajority / 100, seats: model.senate.demSeats, majority: 51, interval: model.senate.interval80 },
      census: senateChamber ? { p: senateChamber.pMajority, seats: senateChamber.median, interval: [senateChamber.p10, senateChamber.p90] } : null,
    },
  };
}

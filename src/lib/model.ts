import type { ForecastFeed, ForecastRace } from "@/lib/forecast";
import { demWinProbability, gaussian, MODEL_VERSION, mulberry32, NATIONAL_SD, NATIONALIZATION, SIMULATIONS } from "@/lib/mp26";
import { simulateSenate } from "@/lib/senate-sim";

export type ModelPoll = { endDate: string; dem: number; rep: number; sample: number; population: "LV" | "RV" | "A" };
export type ModelResult = {
  version: string; status: "experimental"; runDate: string; simulations: number;
  genericBallot: { dem: number; rep: number; margin: number; effectivePolls: number; latestPoll: string; source: string; benchmarkMargin: number; movement: number };
  house: { demMajority: number; demSeats: number; repSeats: number; interval80: [number, number]; distribution: { seats: number; frequency: number }[] };
  senate: { demMajority: number; demSeats: number; repSeats: number; interval80: [number, number]; distribution: { seats: number; frequency: number }[] };
  races: ForecastRace[];
  inputs: { label: string; value: string; source: string }[];
  assumptions: string[];
};

const HOUSE_SEATS_PER_POINT = 2.15;
const HOUSE_CHAMBER_SD = 4.2;
// Only used when no poll at all is available; movement is then zero by construction.
const FALLBACK_BALLOT = { margin: 7.4, dem: 49.3, rep: 41.9 };

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function quantile(sorted: number[], percentile: number) { return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * percentile))]; }

function distribution(draws: number[], step: number) {
  const buckets = new Map<number, number>();
  for (const draw of draws) {
    const seat = Math.round(draw / step) * step;
    buckets.set(seat, (buckets.get(seat) || 0) + 1);
  }
  return [...buckets.entries()].sort(([a], [b]) => a - b).map(([seats, count]) => ({ seats, frequency: Math.round(count / draws.length * 1000) / 10 }));
}

function weightedBallot(polls: ModelPoll[], runDate: string) {
  const anchor = new Date(`${runDate}T00:00:00Z`).getTime();
  let marginNumerator = 0;
  let demNumerator = 0;
  let repNumerator = 0;
  let denominator = 0;
  for (const poll of polls) {
    const age = Math.max(0, (anchor - new Date(`${poll.endDate}T00:00:00Z`).getTime()) / 86_400_000);
    const recency = 0.5 ** (age / 30);
    const sample = poll.sample > 0 ? Math.sqrt(poll.sample / 1000) : 0.55;
    const population = poll.population === "LV" ? 1 : poll.population === "RV" ? 0.86 : 0.72;
    const weight = recency * sample * population;
    marginNumerator += (poll.dem - poll.rep) * weight;
    demNumerator += poll.dem * weight;
    repNumerator += poll.rep * weight;
    denominator += weight;
  }
  return denominator ? { margin: marginNumerator / denominator, dem: demNumerator / denominator, rep: repNumerator / denominator } : FALLBACK_BALLOT;
}

// Races absorb part of the national movement; win odds use the same error budget as the Senate simulation.
function adjustedRaces(races: ForecastRace[], movement: number) {
  return races.map((race) => {
    const signedMargin = race.signedMargin + movement * NATIONALIZATION;
    const demProbability = demWinProbability(signedMargin);
    const leader = signedMargin >= 0 ? "D" as const : "R" as const;
    return { ...race, leader, margin: Math.abs(signedMargin), signedMargin, winProbability: Math.round((leader === "D" ? demProbability : 1 - demProbability) * 100) };
  });
}

/*
  MP-26 v0.2
  - Movement is measured like for like: the same poll index and weighting, evaluated today and at
    the benchmark's run date. A same-day benchmark therefore gets (almost) no adjustment; a dated
    fallback benchmark is moved by what the polls did since it was published.
  - The House chamber stays anchored to the benchmark seat count plus correlated simulation error.
  - The Senate is simulated bottom-up from its 35 races, so chamber odds equal the aggregate of the
    published race odds (and the Senate builder reproduces them exactly).
*/
export function runModel(forecast: ForecastFeed, polls: ModelPoll[], today: string, pollSource: string): ModelResult {
  const ballot = weightedBallot(polls, today);
  const benchmarkPolls = polls.filter((poll) => poll.endDate <= forecast.updated);
  const benchmark = benchmarkPolls.length ? weightedBallot(benchmarkPolls, forecast.updated) : ballot;
  const movement = ballot.margin - benchmark.margin;

  const random = mulberry32(20260920);
  const houseDraws: number[] = [];
  let houseMajorities = 0;
  for (let index = 0; index < SIMULATIONS; index += 1) {
    const nationalError = gaussian(random) * NATIONAL_SD;
    const house = Math.round(clamp(forecast.house.demSeats + (movement + nationalError) * HOUSE_SEATS_PER_POINT + gaussian(random) * HOUSE_CHAMBER_SD, 120, 315));
    houseDraws.push(house);
    if (house >= 218) houseMajorities += 1;
  }
  houseDraws.sort((a, b) => a - b);
  const houseMedian = quantile(houseDraws, 0.5);

  const races = adjustedRaces([...forecast.senateRaces, ...forecast.districts], movement);
  const senate = simulateSenate(races.filter((race) => race.chamber === "senate"));
  const latestPoll = polls.map((poll) => poll.endDate).sort().at(-1) || today;
  const signed = (value: number) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;

  return {
    version: MODEL_VERSION, status: "experimental", runDate: today, simulations: SIMULATIONS,
    genericBallot: {
      dem: Math.round(ballot.dem * 10) / 10, rep: Math.round(ballot.rep * 10) / 10, margin: Math.round(ballot.margin * 10) / 10,
      effectivePolls: polls.length, latestPoll, source: pollSource,
      benchmarkMargin: Math.round(benchmark.margin * 10) / 10, movement: Math.round(movement * 10) / 10,
    },
    house: { demMajority: Math.round(houseMajorities / SIMULATIONS * 100), demSeats: houseMedian, repSeats: 435 - houseMedian, interval80: [quantile(houseDraws, 0.1), quantile(houseDraws, 0.9)], distribution: distribution(houseDraws, 2) },
    senate: { demMajority: Math.round(senate.controlD * 100), demSeats: senate.median, repSeats: 100 - senate.median, interval80: senate.interval80, distribution: senate.distribution },
    races,
    inputs: [
      { label: "Generic ballot", value: signed(ballot.margin), source: pollSource },
      { label: "Movement since benchmark", value: `${signed(movement)} since ${forecast.updated}`, source: "Same poll index and weighting at both dates" },
      { label: "House anchor", value: `${forecast.house.demSeats} D seats`, source: "Vote-Scope public benchmark" },
      { label: "Senate", value: `${races.filter((race) => race.chamber === "senate").length} races simulated · ${senate.notUp.D} D / ${senate.notUp.R} R not up`, source: "Bottom-up from race margins" },
      { label: "Simulation error", value: `±${NATIONAL_SD} national pts`, source: `Explicit ${MODEL_VERSION} assumption` },
    ],
    assumptions: [
      "Polls lose half their weight every 30 days; likely-voter samples receive the highest weight.",
      "National movement is measured against the same poll index at the benchmark's run date, so a same-day benchmark is not adjusted twice.",
      `House: the benchmark seat count moves ${HOUSE_SEATS_PER_POINT} seats per national point, with correlated national and chamber error.`,
      "Senate: each of the 35 races is simulated with a shared national error and its own local error, so chamber odds equal the aggregate of the race odds.",
      `Races absorb ${Math.round(NATIONALIZATION * 100)}% of national movement; candidate and fundraising effects are not yet estimated.`,
    ],
  };
}

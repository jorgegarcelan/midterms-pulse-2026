import type { ForecastFeed, ForecastRace } from "@/lib/forecast";

export type ModelPoll = { endDate: string; dem: number; rep: number; sample: number; population: "LV" | "RV" | "A" };
export type ModelResult = {
  version: string; status: "experimental"; runDate: string; simulations: number;
  genericBallot: { dem: number; rep: number; margin: number; effectivePolls: number; latestPoll: string; source: string };
  house: { demMajority: number; demSeats: number; repSeats: number; interval80: [number, number]; distribution: { seats: number; frequency: number }[] };
  senate: { demMajority: number; demSeats: number; repSeats: number; interval80: [number, number]; distribution: { seats: number; frequency: number }[] };
  races: ForecastRace[];
  inputs: { label: string; value: string; source: string }[];
  assumptions: string[];
};

const RUNS = 50_000;
const BASELINE_MARGIN = 7.4;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function normal(random: () => number) {
  const u = Math.max(random(), Number.EPSILON);
  const v = Math.max(random(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

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
  return denominator ? { margin: marginNumerator / denominator, dem: demNumerator / denominator, rep: repNumerator / denominator } : { margin: BASELINE_MARGIN, dem: 49.3, rep: 41.9 };
}

function adjustedRaces(races: ForecastRace[], delta: number) {
  return races.map((race) => {
    const signedMargin = race.signedMargin + delta * 0.7;
    const demProbability = 1 / (1 + Math.exp(-signedMargin / 3.15));
    const leader = signedMargin >= 0 ? "D" as const : "R" as const;
    return { ...race, leader, margin: Math.abs(signedMargin), signedMargin, winProbability: Math.round((leader === "D" ? demProbability : 1 - demProbability) * 100) };
  });
}

export function runModel(forecast: ForecastFeed, polls: ModelPoll[], runDate: string, pollSource: string): ModelResult {
  const ballot = weightedBallot(polls, runDate);
  const margin = ballot.margin;
  const delta = margin - BASELINE_MARGIN;
  const random = mulberry32(20260920);
  const houseDraws: number[] = [];
  const senateDraws: number[] = [];
  let houseMajorities = 0;
  let senateMajorities = 0;

  for (let index = 0; index < RUNS; index += 1) {
    const nationalError = normal(random) * 2.75;
    const house = Math.round(clamp(forecast.house.demSeats + (delta + nationalError) * 2.15 + normal(random) * 4.2, 120, 315));
    const senate = Math.round(clamp(forecast.senate.demSeats + (delta + nationalError) * 0.18 + normal(random) * 1.25, 40, 60));
    houseDraws.push(house);
    senateDraws.push(senate);
    if (house >= 218) houseMajorities += 1;
    if (senate >= 51) senateMajorities += 1;
  }

  houseDraws.sort((a, b) => a - b);
  senateDraws.sort((a, b) => a - b);
  const houseMedian = quantile(houseDraws, 0.5);
  const senateMedian = quantile(senateDraws, 0.5);
  const latestPoll = polls.map((poll) => poll.endDate).sort().at(-1) || runDate;

  return {
    version: "MP-26 v0.1", status: "experimental", runDate, simulations: RUNS,
    genericBallot: { dem: Math.round(ballot.dem * 10) / 10, rep: Math.round(ballot.rep * 10) / 10, margin: Math.round(margin * 10) / 10, effectivePolls: polls.length, latestPoll, source: pollSource },
    house: { demMajority: Math.round(houseMajorities / RUNS * 100), demSeats: houseMedian, repSeats: 435 - houseMedian, interval80: [quantile(houseDraws, 0.1), quantile(houseDraws, 0.9)], distribution: distribution(houseDraws, 2) },
    senate: { demMajority: Math.round(senateMajorities / RUNS * 100), demSeats: senateMedian, repSeats: 100 - senateMedian, interval80: [quantile(senateDraws, 0.1), quantile(senateDraws, 0.9)], distribution: distribution(senateDraws, 1) },
    races: adjustedRaces([...forecast.senateRaces, ...forecast.districts], delta),
    inputs: [
      { label: "Generic ballot", value: `${margin >= 0 ? "D" : "R"}+${Math.abs(margin).toFixed(1)}`, source: pollSource },
      { label: "House anchor", value: `${forecast.house.demSeats} D seats`, source: "Vote-Scope public benchmark" },
      { label: "Senate anchor", value: `${forecast.senate.demSeats} D seats`, source: "Vote-Scope public benchmark" },
      { label: "Simulation error", value: "±2.75 national pts", source: "Explicit v0.1 assumption" },
    ],
    assumptions: [
      "Polls lose half their weight every 30 days; likely-voter samples receive the highest weight.",
      "The public benchmark supplies the seat-level starting point; Midterm Pulse simulates correlated national and chamber uncertainty.",
      "A one-point national movement shifts the expected House by 2.15 seats and the Senate by 0.18 seats in this provisional version.",
      "District movement is partially nationalized at 70%; local candidate and fundraising effects are not yet estimated.",
    ],
  };
}

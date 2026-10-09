import type { ForecastFeed, ForecastRace } from "@/lib/forecast";
import { simulateHouse } from "@/lib/chamber-sim";
import { demWinProbability, MODEL_VERSION, pollWeight, NATIONAL_SD, NATIONALIZATION, RACE_COMMON_SD, RACE_SD, SIMULATIONS } from "@/lib/mp26";
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

// Only used when no poll at all is available; movement is then zero by construction.
const FALLBACK_BALLOT = { margin: 7.4, dem: 49.3, rep: 41.9 };



function weightedBallot(polls: ModelPoll[], runDate: string) {
  let marginNumerator = 0;
  let demNumerator = 0;
  let repNumerator = 0;
  let denominator = 0;
  for (const poll of polls) {
    const { weight } = pollWeight(poll, runDate);
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
  MP-26 v0.4
  - Race margins are the benchmark's expected D − R vote share (see expectedMargin in forecast.ts).
  - Movement is measured like for like: the same poll index and weighting, evaluated today and at
    the benchmark's run date. A same-day benchmark therefore gets (almost) no adjustment; a dated
    fallback benchmark is moved by what the polls did since it was published.
  - Both chambers are simulated bottom-up on one engine: every race draws a shared national error
    and its own local error, so chamber odds are exactly the aggregate of the published race odds.
*/
export function runModel(forecast: ForecastFeed, polls: ModelPoll[], today: string, pollSource: string): ModelResult {
  const ballot = weightedBallot(polls, today);
  const benchmarkPolls = polls.filter((poll) => poll.endDate <= forecast.updated);
  const benchmark = benchmarkPolls.length ? weightedBallot(benchmarkPolls, forecast.updated) : ballot;
  const movement = ballot.margin - benchmark.margin;

  const races = adjustedRaces([...forecast.senateRaces, ...forecast.districts], movement);
  const house = simulateHouse(races);
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
    house: { demMajority: Math.round(house.controlD * 100), demSeats: house.median, repSeats: 435 - house.median, interval80: house.interval80, distribution: house.distribution },
    senate: { demMajority: Math.round(senate.controlD * 100), demSeats: senate.median, repSeats: 100 - senate.median, interval80: senate.interval80, distribution: senate.distribution },
    races,
    inputs: [
      { label: "Generic ballot", value: signed(ballot.margin), source: pollSource },
      { label: "Movement since benchmark", value: `${signed(movement)} since ${forecast.updated}`, source: "Same poll index and weighting at both dates" },
      { label: "House", value: `${races.filter((race) => race.chamber === "house").length} districts simulated · ${house.expected.toFixed(1)} expected D seats`, source: "Bottom-up from race margins" },
      { label: "Senate", value: `${races.filter((race) => race.chamber === "senate").length} races simulated · ${senate.notUp.D} D / ${senate.notUp.R} R not up`, source: "Bottom-up from race margins" },
      { label: "Simulation error", value: `±${NATIONAL_SD} national · ±${RACE_SD} per race`, source: `Explicit ${MODEL_VERSION} assumption` },
    ],
    assumptions: [
      "Polls lose half their weight every 30 days; likely-voter samples receive the highest weight.",
      "National movement is measured against the same poll index at the benchmark's run date, so a same-day benchmark is not adjusted twice.",
      "Both chambers are simulated race by race: all 435 districts and the 35 Senate races, so chamber odds equal the aggregate of the race odds.",
      `Each race margin has ${RACE_SD} pts of error, calibrated to the benchmark's race odds; ${RACE_COMMON_SD.toFixed(1)} pts of it is shared nationally, matching the benchmark's correlated error.`,
      `Races absorb ${Math.round(NATIONALIZATION * 100)}% of national movement; candidate and fundraising effects are not yet estimated.`,
    ],
  };
}

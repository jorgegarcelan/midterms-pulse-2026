import { SENATE_SEED, simulateChamber } from "@/lib/chamber-sim";

export type SenateRace = { code: string; leader: "D" | "R"; margin: number; signedMargin?: number; winProbability: number; incumbentParty?: "D" | "R" | null; special?: boolean; rating?: string };
export type SenatePick = "D" | "R";
export type SenateOutlook = {
  expected: number;
  locked: { D: number; R: number };
  notUp: { D: number; R: number };
  controlD: number;
  tieR: number;
  median: number;
  interval80: [number, number];
  distribution: { seats: number; frequency: number }[];
};

// 119th Congress: 47 seats caucus with Democrats (incl. two independents), 53 with Republicans.
const CAUCUS = { D: 47, R: 53 };

export const signedMargin = (race: SenateRace) => race.signedMargin ?? (race.leader === "D" ? race.margin : -race.margin);
export const demProbability = (race: SenateRace) => (race.leader === "D" ? race.winProbability : 100 - race.winProbability) / 100;

// Seats not on the ballot: current caucus minus the seats each party is defending this cycle.
export function seatsNotUp(races: SenateRace[]) {
  const defending = { D: races.filter((race) => race.incumbentParty === "D").length, R: races.filter((race) => race.incumbentParty === "R").length };
  if (defending.D + defending.R !== races.length) return { D: 34, R: 31 };
  return { D: CAUCUS.D - defending.D, R: CAUCUS.R - defending.R };
}

/*
  The MP-26 Senate model, bottom-up on the shared chamber engine: open races are simulated with a
  shared national error and their own local error; seats not on the ballot (and races the user has
  called) are fixed. Democrats need 51 seats; Republicans hold a 50–50 chamber through the Vice
  President. The server model and the Senate builder call this with the same seed and run count,
  so with no races called the builder reproduces the published forecast exactly.
*/
export function simulateSenate(races: SenateRace[], picks: Record<string, SenatePick> = {}, options: { shift?: number; runs?: number } = {}): SenateOutlook {
  const notUp = seatsNotUp(races);
  const locked = { D: notUp.D, R: notUp.R };
  const open: number[] = [];
  for (const race of races) {
    const pick = picks[race.code];
    if (pick) locked[pick] += 1;
    else open.push(signedMargin(race));
  }
  const outlook = simulateChamber(open, { seats: 100, majority: 51, fixed: locked, seed: SENATE_SEED }, options);
  return { expected: outlook.expected, locked, notUp, controlD: outlook.controlD, tieR: outlook.tie, median: outlook.median, interval80: outlook.interval80, distribution: outlook.distribution };
}

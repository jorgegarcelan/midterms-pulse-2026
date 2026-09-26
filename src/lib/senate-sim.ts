import { demWinProbability, gaussian, mulberry32, RACE_COMMON_SD, RACE_LOCAL_SD, SIMULATIONS } from "@/lib/mp26";

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
const SEED = 20261103;

export const signedMargin = (race: SenateRace) => race.signedMargin ?? (race.leader === "D" ? race.margin : -race.margin);
export const demProbability = (race: SenateRace) => (race.leader === "D" ? race.winProbability : 100 - race.winProbability) / 100;

// Seats not on the ballot: current caucus minus the seats each party is defending this cycle.
export function seatsNotUp(races: SenateRace[]) {
  const defending = { D: races.filter((race) => race.incumbentParty === "D").length, R: races.filter((race) => race.incumbentParty === "R").length };
  if (defending.D + defending.R !== races.length) return { D: 34, R: 31 };
  return { D: CAUCUS.D - defending.D, R: CAUCUS.R - defending.R };
}

/*
  The MP-26 Senate model, bottom-up. Every open race draws its margin as
  expected margin + shared national error + local error, using the same error budget that sets
  the published race probabilities, so the chamber odds are exactly the aggregate of the race odds.
  Seats not on the ballot are fixed; Republicans hold a 50–50 chamber through the Vice President.
  The server model and the Senate builder call this with the same seed, so with no races called
  the builder reproduces the published forecast exactly.
*/
export function simulateSenate(races: SenateRace[], picks: Record<string, SenatePick> = {}, options: { shift?: number; runs?: number } = {}): SenateOutlook {
  const { shift = 0, runs = SIMULATIONS } = options;
  const notUp = seatsNotUp(races);
  const locked = { D: notUp.D, R: notUp.R };
  const open: number[] = [];
  for (const race of races) {
    const pick = picks[race.code];
    if (pick) locked[pick] += 1;
    else open.push(signedMargin(race) + shift);
  }
  const expected = locked.D + open.reduce((sum, margin) => sum + demWinProbability(margin), 0);

  const random = mulberry32(SEED);
  const counts = new Uint32Array(101);
  let control = 0;
  let ties = 0;
  for (let run = 0; run < runs; run += 1) {
    const national = gaussian(random) * RACE_COMMON_SD;
    let seats = locked.D;
    for (let index = 0; index < open.length; index += 1) if (open[index] + national + gaussian(random) * RACE_LOCAL_SD > 0) seats += 1;
    counts[seats] += 1;
    if (seats >= 51) control += 1;
    else if (seats === 50) ties += 1;
  }

  const quantile = (share: number) => {
    let cumulative = 0;
    for (let seats = 0; seats <= 100; seats += 1) { cumulative += counts[seats]; if (cumulative >= share * runs) return seats; }
    return 100;
  };
  const distribution = Array.from(counts, (count, seats) => ({ seats, frequency: Math.round(count / runs * 1000) / 10 })).filter((item) => item.frequency > 0);
  return { expected, locked, notUp, controlD: control / runs, tieR: ties / runs, median: quantile(.5), interval80: [quantile(.1), quantile(.9)], distribution };
}

export type SenateRace = { code: string; leader: "D" | "R"; margin: number; signedMargin?: number; winProbability: number; incumbentParty?: "D" | "R" | null; special?: boolean; rating?: string };
export type SenatePick = "D" | "R";
export type SenateOutlook = { expected: number; locked: { D: number; R: number }; controlD: number; tieR: number };

// 119th Congress: 47 seats caucus with Democrats (incl. two independents), 53 with Republicans.
const CAUCUS = { D: 47, R: 53 };
const NATIONAL_SD = 3;
const RUNS = 6000;

export const signedMargin = (race: SenateRace) => race.signedMargin ?? (race.leader === "D" ? race.margin : -race.margin);
export const demProbability = (race: SenateRace) => (race.leader === "D" ? race.winProbability : 100 - race.winProbability) / 100;

// Seats not on the ballot: current caucus minus the seats each party is defending this cycle.
export function seatsNotUp(races: SenateRace[]) {
  const defending = { D: races.filter((race) => race.incumbentParty === "D").length, R: races.filter((race) => race.incumbentParty === "R").length };
  if (defending.D + defending.R !== races.length) return { D: 34, R: 31 };
  return { D: CAUCUS.D - defending.D, R: CAUCUS.R - defending.R };
}

// Acklam's rational approximation of the inverse standard normal CDF.
function inverseNormal(p: number) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-.00778489400243029, -.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [.00778469570904146, .32246712907004, 2.445134137143, 3.75440866190742];
  const low = .02425;
  if (p < low) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - low) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - .5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/*
  Correlated simulation of the undecided races. Each race's total error is backed out from its
  model margin and win probability (σ = |margin| / Φ⁻¹(p)), so single-race odds match the model;
  a shared national error then moves every race together. Republicans hold 50–50 via the VP.
*/
export function simulateSenate(races: SenateRace[], picks: Record<string, SenatePick>): SenateOutlook {
  const notUp = seatsNotUp(races);
  const locked = { D: notUp.D, R: notUp.R };
  const open: { margin: number; local: number; p: number }[] = [];
  for (const race of races) {
    const pick = picks[race.code];
    if (pick) { locked[pick] += 1; continue; }
    const p = Math.min(.995, Math.max(.005, demProbability(race)));
    const margin = signedMargin(race);
    const z = inverseNormal(p);
    const sigma = Math.abs(z) > .05 && Math.abs(margin) > .2 ? Math.min(16, Math.max(3.4, Math.abs(margin / z))) : 6;
    open.push({ margin, local: Math.sqrt(sigma * sigma - NATIONAL_SD * NATIONAL_SD), p });
  }
  const expected = locked.D + open.reduce((sum, race) => sum + race.p, 0);
  const random = mulberry32(20261103);
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(random(), 1e-12))) * Math.cos(2 * Math.PI * random());
  let control = 0;
  let ties = 0;
  for (let run = 0; run < RUNS; run += 1) {
    const national = normal() * NATIONAL_SD;
    let seats = locked.D;
    for (const race of open) if (race.margin + national + normal() * race.local > 0) seats += 1;
    if (seats >= 51) control += 1;
    else if (seats === 50) ties += 1;
  }
  return { expected, locked, controlD: control / RUNS, tieR: ties / RUNS };
}

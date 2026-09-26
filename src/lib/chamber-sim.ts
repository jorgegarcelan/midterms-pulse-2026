import { demWinProbability, inverseNormal, RACE_COMMON_SD, RACE_LOCAL_SD, SIMULATIONS } from "@/lib/mp26";

export type ChamberSpec = { seats: number; majority: number; fixed: { D: number; R: number }; seed: number; bucket?: number };
export type ChamberOutlook = {
  expected: number;
  controlD: number;
  tie: number;
  median: number;
  interval80: [number, number];
  distribution: { seats: number; frequency: number }[];
};

// Normal draws by table lookup: 8,192 equal-probability quantiles, fast enough for 435 races × 50,000 runs.
const TABLE_SIZE = 8192;
let normalTable: Float64Array | null = null;
function quantiles() {
  normalTable ??= Float64Array.from({ length: TABLE_SIZE }, (_, index) => inverseNormal((index + .5) / TABLE_SIZE));
  return normalTable;
}

/*
  Bottom-up chamber simulation shared by the MP-26 server model and the in-browser tools.
  Each run draws one national error for every race plus an independent local error per race;
  a race goes Democratic when expected margin + shift + national + local > 0. Seats in `fixed`
  are not simulated (not on the ballot, or called by the user). Same inputs and seed, same output.
*/
export function simulateChamber(margins: number[], spec: ChamberSpec, options: { shift?: number; runs?: number } = {}): ChamberOutlook {
  const { shift = 0, runs = SIMULATIONS } = options;
  const table = quantiles();
  const open = Float64Array.from(margins, (margin) => margin + shift);
  const expected = spec.fixed.D + open.reduce((sum, margin) => sum + demWinProbability(margin), 0);
  const counts = new Uint32Array(spec.seats + 1);
  let control = 0;
  let ties = 0;
  // mulberry32, inlined: ~22M draws per House run make call overhead matter.
  let state = spec.seed | 0;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  for (let run = 0; run < runs; run += 1) {
    const national = table[(next() * TABLE_SIZE) | 0] * RACE_COMMON_SD;
    let seats = spec.fixed.D;
    for (let index = 0; index < open.length; index += 1) {
      if (open[index] + national + table[(next() * TABLE_SIZE) | 0] * RACE_LOCAL_SD > 0) seats += 1;
    }
    counts[seats] += 1;
    if (seats >= spec.majority) control += 1;
    else if (seats * 2 === spec.seats) ties += 1;
  }

  const quantile = (share: number) => {
    let cumulative = 0;
    for (let seats = 0; seats <= spec.seats; seats += 1) { cumulative += counts[seats]; if (cumulative >= share * runs) return seats; }
    return spec.seats;
  };
  const bucket = spec.bucket ?? 1;
  const buckets = new Map<number, number>();
  counts.forEach((count, seats) => { if (count) buckets.set(Math.round(seats / bucket) * bucket, (buckets.get(Math.round(seats / bucket) * bucket) || 0) + count); });
  const distribution = [...buckets.entries()].sort(([a], [b]) => a - b).map(([seats, count]) => ({ seats, frequency: Math.round(count / runs * 1000) / 10 })).filter((item) => item.frequency > 0);
  return { expected, controlD: control / runs, tie: ties / runs, median: quantile(.5), interval80: [quantile(.1), quantile(.9)], distribution };
}

export const HOUSE_SPEC: ChamberSpec = { seats: 435, majority: 218, fixed: { D: 0, R: 0 }, seed: 20260920, bucket: 2 };

// The House, bottom-up from all 435 districts (no seats are fixed).
export function simulateHouse(races: { chamber: string; signedMargin: number }[], options: { shift?: number; runs?: number } = {}) {
  return simulateChamber(races.filter((race) => race.chamber === "house").map((race) => race.signedMargin), HOUSE_SPEC, options);
}

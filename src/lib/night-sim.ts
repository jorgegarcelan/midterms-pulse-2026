import { quantiles, TABLE_SIZE } from "@/lib/chamber-sim";
import type { ModelResult } from "@/lib/model";
import { normalCdf, RACE_COMMON_SD, RACE_LOCAL_SD } from "@/lib/mp26";
import { seatsNotUp } from "@/lib/senate-sim";
import { closingTime, raceKey, stateClosing, type Baseline, type ChamberNight, type NightCall, type Scenario, type Winner } from "@/lib/night";
import { POLL_CLOSING } from "@/data/poll-closing";

/*
  Chamber odds given the races called so far. Calls are evidence about the shared national error:
  the posterior over that error is computed on a grid (prior × likelihood of every call), then the
  uncalled races are simulated around it. So an early upset moves the odds in races that have not
  been called, as it should. The likelihood uses a slightly heavy-tailed local error (3% of races
  with three times the spread) so one freak result or a mis-click does not swing the whole night.
*/

const GRID = 241;
const SPAN = 5;
const RUNS = 20_000;
const SEED = 20261104;
const OUTLIER = .03;

function rng(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// log Φ(z), accurate in the far lower tail where the CDF approximation runs out of precision.
function logCdf(z: number) {
  if (z > -4) return Math.log(Math.max(normalCdf(z), 1e-300));
  const z2 = z * z;
  return -z2 / 2 - Math.log(-z) - .5 * Math.log(2 * Math.PI) + Math.log(1 - 1 / z2 + 3 / (z2 * z2));
}
function logWin(margin: number, sign: 1 | -1) {
  const core = Math.exp(logCdf(sign * margin / RACE_LOCAL_SD));
  const tail = Math.exp(logCdf(sign * margin / (3 * RACE_LOCAL_SD)));
  return Math.log((1 - OUTLIER) * core + OUTLIER * tail);
}

type Posterior = { values: Float64Array; weights: Float64Array; cdf: Float64Array; mean: number };

function posterior(called: { margin: number; winner: Winner }[]): Posterior {
  const values = new Float64Array(GRID);
  const log = new Float64Array(GRID);
  for (let k = 0; k < GRID; k += 1) {
    const nu = (-SPAN + (2 * SPAN * k) / (GRID - 1)) * RACE_COMMON_SD;
    values[k] = nu;
    let sum = -.5 * (nu / RACE_COMMON_SD) ** 2;
    for (const race of called) sum += logWin(race.margin + nu, race.winner === "D" ? 1 : -1);
    log[k] = sum;
  }
  const top = Math.max(...log);
  const weights = log.map((value) => Math.exp(value - top));
  const total = weights.reduce((a, b) => a + b, 0);
  const cdf = new Float64Array(GRID);
  let running = 0;
  let mean = 0;
  for (let k = 0; k < GRID; k += 1) { weights[k] /= total; running += weights[k]; cdf[k] = running; mean += weights[k] * values[k]; }
  return { values, weights, cdf, mean };
}

function chamber(open: number[], locked: { D: number; R: number }, called: { D: number; R: number }, seats: number, majority: number, post: Posterior, forecast: { controlD: number; seats: number }, anyCall: boolean): ChamberNight {
  const table = quantiles();
  const next = rng(SEED + seats);
  const counts = new Uint32Array(seats + 1);
  const step = post.values[1] - post.values[0];
  for (let run = 0; run < RUNS; run += 1) {
    // National error from the grid posterior, jittered within its cell.
    const u = next();
    let low = 0, high = GRID - 1;
    while (low < high) { const mid = (low + high) >> 1; if (post.cdf[mid] < u) low = mid + 1; else high = mid; }
    const nu = post.values[low] + (next() - .5) * step;
    let d = locked.D;
    for (let index = 0; index < open.length; index += 1) if (open[index] + nu + table[(next() * TABLE_SIZE) | 0] * RACE_LOCAL_SD > 0) d += 1;
    counts[d] += 1;
  }
  let control = 0;
  counts.forEach((count, d) => { if (d >= majority) control += count; });
  const quantile = (share: number) => { let cumulative = 0; for (let d = 0; d <= seats; d += 1) { cumulative += counts[d]; if (cumulative >= share * RUNS) return d; } return seats; };
  let expected = locked.D;
  for (let k = 0; k < GRID; k += 1) {
    if (post.weights[k] < 1e-9) continue;
    let sum = 0;
    for (const margin of open) sum += normalCdf((margin + post.values[k]) / RACE_LOCAL_SD);
    expected += post.weights[k] * sum;
  }
  return {
    seats, majority, called, locked, uncalled: open.length,
    // Before the first call the published number stands, so the screen does not jitter against the forecast.
    controlD: anyCall ? control / RUNS : forecast.controlD, expected, median: quantile(.5), interval80: [quantile(.1), quantile(.9)], forecast,
  };
}

export function nightOutlook(baseline: Baseline, calls: NightCall[]) {
  const winners = new Map(calls.map((call) => [call.key, call.winner]));
  const called = baseline.races.filter((race) => winners.has(race.key)).map((race) => ({ margin: race.signedMargin, winner: winners.get(race.key)! }));
  const post = posterior(called);
  const build = (prefix: "house" | "senate") => {
    const races = baseline.races.filter((race) => race.key.startsWith(`${prefix}:`));
    const open = races.filter((race) => !winners.has(race.key)).map((race) => race.signedMargin);
    const tally = { D: 0, R: 0 };
    for (const race of races) { const winner = winners.get(race.key); if (winner) tally[winner] += 1; }
    const notUp = prefix === "senate"
      ? seatsNotUp(races.map((race) => ({ code: race.key, leader: race.signedMargin >= 0 ? "D" as const : "R" as const, margin: Math.abs(race.signedMargin), winProbability: 50, incumbentParty: race.incumbentParty })))
      : { D: 0, R: 0 };
    const locked = { D: notUp.D + tally.D, R: notUp.R + tally.R };
    const forecast = prefix === "house" ? baseline.house : baseline.senate;
    return chamber(open, locked, tally, prefix === "house" ? 435 : 100, prefix === "house" ? 218 : 51, post, { controlD: forecast.demMajority / 100, seats: forecast.demSeats }, called.length > 0);
  };
  return { house: build("house"), senate: build("senate"), shift: called.length ? post.mean : null };
}

export function freezeBaseline(model: ModelResult): Baseline {
  return {
    runDate: model.runDate, version: model.version,
    races: model.races.map((race) => ({ key: raceKey(race), state: race.state, signedMargin: Math.round(race.signedMargin * 100) / 100, incumbentParty: race.incumbentParty })),
    house: { demMajority: model.house.demMajority, demSeats: model.house.demSeats },
    senate: { demMajority: model.senate.demMajority, demSeats: model.senate.demSeats },
  };
}

/*
  A simulated night for rehearsals: one draw of the national error (fixed by the scenario, or random)
  and a local error per race give every winner; the call comes after the state's polls close, later
  the closer the result, and some close races are not called tonight at all, as on a real night.
*/
const SHIFT: Record<Scenario, number | null> = { forecast: 0, "dem-wave": 4, "rep-wave": -4, random: null };
const SLOW_COUNT = new Set(["CA", "WA", "OR", "AZ", "NV", "UT"]);
const RUNOFF = new Set(["GA", "ME", "AK"]);

export function simulateNight(baseline: Baseline, scenario: Scenario, seed: number) {
  const next = rng(seed);
  const table = quantiles();
  const normal = () => table[(next() * TABLE_SIZE) | 0];
  const nu = SHIFT[scenario] ?? normal() * RACE_COMMON_SD;
  const minutes = (low: number, high: number) => (low + next() * (high - low)) * 60_000;
  const firstClose = new Map(POLL_CLOSING.map((state) => [state.code, closingTime(state.firstClose || state.close)]));
  const calls: NightCall[] = [];
  for (const race of baseline.races) {
    const close = stateClosing.get(race.state);
    if (close === undefined) continue;
    const margin = race.signedMargin + nu + normal() * RACE_LOCAL_SD;
    const gap = Math.abs(margin);
    let delay: number | null;
    if (gap >= 20) delay = minutes(0, 2);
    else if (gap >= 10) delay = minutes(4, 45);
    else if (gap >= 5) delay = minutes(40, 150);
    else if (gap >= 2) delay = minutes(120, 300);
    else delay = next() < .5 ? null : minutes(240, 420);
    if (delay !== null && SLOW_COUNT.has(race.state) && gap < 8) delay = gap < 4 ? null : delay + minutes(90, 180);
    if (race.state === "AK" && gap < 15) delay = null;
    if (RUNOFF.has(race.state) && gap < 1.5) delay = null;
    if (delay === null) continue;
    // Safe seats in states that close in two steps are called when the last polls close, never before.
    const at = Math.max(close, firstClose.get(race.state) ?? close) + delay;
    calls.push({ key: race.key, winner: margin > 0 ? "D" : "R", at: new Date(Math.round(at / 1000) * 1000).toISOString() });
  }
  return { calls: calls.sort((a, b) => a.at.localeCompare(b.at)), shift: nu };
}

/*
  MP-26 backtest on the 2018 and 2022 midterms.

    npx tsx scripts/backtest.ts   → src/data/backtest.json

  Vote-Scope, MP-26's benchmark, did not publish 2018 or 2022 forecasts, so the full pipeline cannot be
  replayed. What can be tested is MP-26's own probability layer — the per-race error (RACE_SD), the shared
  national error and the 50,000-run chamber simulation — fed with a benchmark of the same kind: each
  race's final expected margin from FiveThirtyEight's published forecasts (data/backtest/inputs-*.json).
  Outcomes come from the race histories the site already ships (public/data/history).
*/
import { readFileSync, writeFileSync } from "node:fs";
import { HOUSE_SPEC, SENATE_SEED, simulateChamber } from "../src/lib/chamber-sim";
import { normalCdf, RACE_COMMON_SD, RACE_SD, SIMULATIONS } from "../src/lib/mp26";

type Input = { chamber: "house" | "senate"; code: string; d: number | null; r: number | null; p538: number };
type Result = { y: number; dp: number; rp: number; m: number; w: string; n?: string; s?: 1 };
const DEM_CAUCUS = /Sanders|King/;
const SENATE = {
  2018: { notUp: { D: 23, R: 42 }, majority: 51 }, // Vice President Pence broke ties for Republicans
  2022: { notUp: { D: 36, R: 29 }, majority: 50 }, // Vice President Harris broke ties for Democrats
} as const;

const read = <T,>(path: string) => JSON.parse(readFileSync(path, "utf8")) as T;
const senateHistory = read<{ states: Record<string, Result[]> }>("public/data/history/senate.json").states;
const houseHistory = (state: string) => read<{ districts: Record<string, Result[]> }>(`public/data/history/house/${state}.json`).districts;

function outcome(race: Input, year: number) {
  const [state, rest] = race.code.split("-");
  const results = race.chamber === "senate"
    ? senateHistory[state]?.filter((item) => item.y === year && Boolean(item.s) === (rest === "special"))
    // At-large seats are keyed "-00", except where a state has since gained a district (Montana 2018 is "MT-01").
    : (houseHistory(state)[race.code] ?? houseHistory(state)[race.code.replace(/-00$/, "-01")])?.filter((item) => item.y === year);
  const result = results?.[0];
  if (!result) return null;
  const demWon = result.w === "D" || (result.w === "O" && DEM_CAUCUS.test(result.n ?? ""));
  return { demWon, margin: result.dp > 0 && result.rp > 0 ? result.m : null };
}

const expected = (race: Input) => race.d !== null && race.r !== null ? race.d - race.r : race.d !== null ? 100 : -100;
const clip = (p: number) => Math.min(1 - 1e-3, Math.max(1e-3, p));
const round = (value: number, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;

type Row = { year: number; chamber: "house" | "senate"; code: string; expected: number; actual: number | null; demWon: boolean; p538: number };
const rows: Row[] = [];
const chambers: Record<string, unknown> = {};
const national = new Map<number, { house538: Record<string, number>; senate538?: Record<string, number> }>();

for (const year of [2018, 2022] as const) {
  const input = read<{ races: Input[]; house538: Record<string, number>; senate538?: Record<string, number> }>(`data/backtest/inputs-${year}.json`);
  national.set(year, input);
  for (const race of input.races) {
    const result = outcome(race, year);
    if (!result) throw new Error(`No ${year} result for ${race.chamber} ${race.code}`);
    rows.push({ year, chamber: race.chamber, code: race.code, expected: expected(race), actual: result.margin, demWon: result.demWon, p538: race.p538 });
  }
}

// Scores for a set of races under a given per-race error.
function score(set: Row[], sd = RACE_SD) {
  let brier = 0, brier538 = 0, log = 0, log538 = 0, hits = 0;
  for (const row of set) {
    const p = normalCdf(row.expected / sd);
    const o = row.demWon ? 1 : 0;
    brier += (p - o) ** 2; brier538 += (row.p538 - o) ** 2;
    log -= Math.log(clip(o ? p : 1 - p)); log538 -= Math.log(clip(o ? row.p538 : 1 - row.p538));
    if ((p >= .5) === row.demWon) hits += 1;
  }
  const n = set.length || 1;
  return { n: set.length, brier: round(brier / n, 4), brier538: round(brier538 / n, 4), logLoss: round(log / n, 4), logLoss538: round(log538 / n, 4), accuracy: round(hits / n, 4) };
}

const competitive = (row: Row) => { const p = normalCdf(row.expected / RACE_SD); return p > .05 && p < .95; };

for (const year of [2018, 2022] as const) {
  const set = rows.filter((row) => row.year === year);
  const house = set.filter((row) => row.chamber === "house");
  const senate = set.filter((row) => row.chamber === "senate");
  const houseSim = simulateChamber(house.map((row) => row.expected), HOUSE_SPEC);
  const senateSpec = SENATE[year];
  const senateSim = simulateChamber(senate.map((row) => row.expected), { seats: 100, majority: senateSpec.majority, fixed: senateSpec.notUp, seed: SENATE_SEED });
  const residuals = set.filter((row) => row.actual !== null).map((row) => row.actual! - row.expected);
  const meanResidual = residuals.reduce((sum, value) => sum + value, 0) / residuals.length;
  const houseActual = house.filter((row) => row.demWon).length;
  const senateActual = senateSpec.notUp.D + senate.filter((row) => row.demWon).length;
  const n = national.get(year)!;
  chambers[year] = {
    house: { ...score(house), competitive: score(house.filter(competitive)), mp26: { pD: round(houseSim.controlD), median: houseSim.median, low: houseSim.interval80[0], high: houseSim.interval80[1] }, fte: n.house538, actual: houseActual, majority: HOUSE_SPEC.majority },
    senate: { ...score(senate), competitive: score(senate.filter(competitive)), mp26: { pD: round(senateSim.controlD), median: senateSim.median, low: senateSim.interval80[0], high: senateSim.interval80[1] }, fte: n.senate538 ?? null, actual: senateActual, majority: senateSpec.majority },
    // Positive: Democrats beat their expected margin on average (the correlated miss the national error has to absorb).
    meanMiss: round(meanResidual, 2),
    rmse: round(Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / residuals.length), 2),
    sdMiss: round(Math.sqrt(residuals.reduce((sum, value) => sum + (value - meanResidual) ** 2, 0) / residuals.length), 2),
  };
}

// Calibration over both years' competitive races: forecast bins against observed Democratic win rates.
const BINS = [0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1];
const pool = rows.filter(competitive);
const calibration = BINS.slice(0, -1).map((low, index) => {
  const high = BINS[index + 1];
  const members = pool.filter((row) => { const p = normalCdf(row.expected / RACE_SD); return p >= low && (p < high || (high === 1 && p <= 1)); });
  const mean = members.reduce((sum, row) => sum + normalCdf(row.expected / RACE_SD), 0) / (members.length || 1);
  return { low, high, n: members.length, forecast: round(mean), observed: members.length ? round(members.filter((row) => row.demWon).length / members.length) : null };
});

// Which per-race error would have scored best? (log loss on all contested races, both years)
const contested = rows.filter((row) => Math.abs(row.expected) < 100);
const sweep = [4, 5, 6, 7, 7.5, 8, 9, 10, 12].map((sd) => ({ sd, ...score(contested, sd) }));

// Expected vs actual margins for the chart (contested races only).
const points = rows.filter((row) => row.actual !== null && Math.abs(row.expected) < 60).map((row) => [row.year, row.chamber === "house" ? "H" : "S", row.code, round(row.expected, 1), round(row.actual!, 1), row.demWon ? 1 : 0]);

const output = {
  generated: new Date().toISOString().slice(0, 10),
  engine: { raceSd: RACE_SD, commonSd: round(RACE_COMMON_SD, 2), simulations: SIMULATIONS },
  source: "Inputs: FiveThirtyEight final 2018/2022 forecasts (classic), CC BY 4.0, via the Internet Archive. Outcomes: FiveThirtyEight election-results (CC BY 4.0).",
  years: chambers,
  overall: { all: score(rows), competitive: score(pool) },
  calibration,
  sweep,
  points,
};
writeFileSync("src/data/backtest.json", `${JSON.stringify(output)}\n`);
console.log(JSON.stringify({ years: chambers, overall: output.overall, calibration, sweep }, null, 1));

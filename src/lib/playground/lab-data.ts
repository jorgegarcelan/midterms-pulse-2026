import Papa from "papaparse";
import { stateByName } from "@/data/geography";
import { regionOf, type RegionKey } from "@/data/regions";
import type { DemographicsFile } from "@/lib/playground/scenario";
import type { PlayRace } from "@/lib/playground/types";

export type Unit = "county" | "district";
export type VarKey =
  | "m2016" | "m2020" | "m2024" | "shift2024" | "shift2016"
  | "model2026" | "winprob" | "house2024" | "modelShift"
  | "college" | "bachelor" | "white" | "black" | "hispanic" | "asian" | "foreign"
  | "income" | "age" | "poverty" | "density" | "population";

export type LabPoint = {
  id: string;
  name: string;
  state: string;
  region: RegionKey | undefined;
  population: number;
  votes: number;
  party: number; // margin used for party colour (2024 result, or 2026 model for districts)
  values: Partial<Record<VarKey, number>>;
  href?: string;
};

export type VarDef = { key: VarKey; label: string; units: Unit[]; kind: "margin" | "pct" | "money" | "years" | "density" | "count"; log?: boolean };

export const VARIABLES: VarDef[] = [
  { key: "m2024", label: "2024 presidential margin", units: ["county"], kind: "margin" },
  { key: "m2020", label: "2020 presidential margin", units: ["county"], kind: "margin" },
  { key: "m2016", label: "2016 presidential margin", units: ["county"], kind: "margin" },
  { key: "shift2024", label: "Shift 2020 → 2024", units: ["county"], kind: "margin" },
  { key: "shift2016", label: "Shift 2016 → 2024", units: ["county"], kind: "margin" },
  { key: "model2026", label: "2026 model margin", units: ["district"], kind: "margin" },
  { key: "winprob", label: "2026 Democratic win probability", units: ["district"], kind: "pct" },
  { key: "house2024", label: "2024 House margin", units: ["district"], kind: "margin" },
  { key: "modelShift", label: "Model 2026 vs 2024 House", units: ["district"], kind: "margin" },
  { key: "bachelor", label: "% with a bachelor's degree", units: ["county"], kind: "pct" },
  { key: "college", label: "% college graduates", units: ["district"], kind: "pct" },
  { key: "white", label: "% white", units: ["county", "district"], kind: "pct" },
  { key: "black", label: "% Black", units: ["county", "district"], kind: "pct" },
  { key: "hispanic", label: "% Hispanic", units: ["county", "district"], kind: "pct" },
  { key: "asian", label: "% Asian", units: ["county", "district"], kind: "pct" },
  { key: "foreign", label: "% foreign-born", units: ["district"], kind: "pct" },
  { key: "income", label: "Median household income", units: ["county", "district"], kind: "money" },
  { key: "age", label: "Median age", units: ["county", "district"], kind: "years" },
  { key: "poverty", label: "% in poverty", units: ["county", "district"], kind: "pct" },
  { key: "density", label: "Population density", units: ["county", "district"], kind: "density", log: true },
  { key: "population", label: "Population", units: ["county"], kind: "count", log: true },
];
export const varByKey = new Map(VARIABLES.map((item) => [item.key, item]));
export const DEFAULTS: Record<Unit, { x: VarKey; y: VarKey }> = { county: { x: "bachelor", y: "shift2024" }, district: { x: "hispanic", y: "model2026" } };

const num = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : NaN; };
const margin = (row: Record<string, string> | undefined) => row ? (num(row.per_dem) - num(row.per_gop)) * 100 : NaN;

// Counties: the three presidential files joined on FIPS, with 2024 ACS columns from the 2024 file.
export function buildCounties(csv: Record<"2016" | "2020" | "2024", string>): LabPoint[] {
  const parse = (text: string) => new Map(Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true }).data
    .map((row) => [String(row.county_fips || "").padStart(5, "0"), row] as const));
  const [y16, y20, y24] = [parse(csv["2016"]), parse(csv["2020"]), parse(csv["2024"])];
  const points: LabPoint[] = [];
  for (const [fips, row] of y24) {
    const state = stateByName.get(row.state)?.code || (row.state === "District of Columbia" ? "DC" : "");
    if (!state || fips.length !== 5) continue;
    const m24 = margin(row), m20 = margin(y20.get(fips)), m16 = margin(y16.get(fips));
    const population = num(row.pop_total);
    points.push({
      id: fips, name: `${row.county}, ${state}`, state, region: regionOf.get(state), population, votes: num(row.total_votes), party: m24,
      values: {
        m2024: m24, m2020: m20, m2016: m16, shift2024: m24 - m20, shift2016: m24 - m16,
        bachelor: num(row.bachelors_rate), white: num(row.white_rate), black: num(row.black_rate), hispanic: num(row.hispanic_rate), asian: num(row.asian_rate),
        income: num(row.median_income), age: num(row.median_age), poverty: num(row.poverty_rate), population,
      },
    });
  }
  return points;
}

// County land area (sq. mi.) from the Census county outlines, read only when density is asked for.
export function countyDensity(geo: { features: { properties: { GEO_ID: string; CENSUSAREA: number } }[] }) {
  return new Map(geo.features.map((feature) => [feature.properties.GEO_ID.slice(-5), feature.properties.CENSUSAREA * 2.58999]));
}

export function buildDistricts(races: PlayRace[], demographics: DemographicsFile): LabPoint[] {
  return races.filter((race) => race.chamber === "house").map((race) => {
    const profile = demographics.districts[race.code] as DemographicsFile["districts"][string] | undefined;
    const demP = race.leader === "D" ? race.winProbability : 100 - race.winProbability;
    return {
      id: race.code, name: race.code, state: race.state, region: regionOf.get(race.state), population: profile?.population ?? NaN, votes: NaN, party: race.signedMargin,
      href: `/races/${race.code.toLowerCase()}`,
      values: {
        model2026: race.signedMargin, winprob: demP, house2024: race.baselineMargin ?? NaN, modelShift: race.baselineMargin === null ? NaN : race.signedMargin - race.baselineMargin,
        college: profile?.bachelors ?? NaN, white: profile?.race.white ?? NaN, black: profile?.race.black ?? NaN, hispanic: profile?.race.hispanic ?? NaN, asian: profile?.race.asian ?? NaN,
        foreign: profile?.foreignBorn ?? NaN, income: profile?.medianIncome ?? NaN, age: profile?.medianAge ?? NaN, poverty: profile?.poverty ?? NaN,
      },
    };
  });
}

export function formatValue(kind: VarDef["kind"], value: number, locale: string) {
  if (!Number.isFinite(value)) return "—";
  switch (kind) {
    case "margin": return `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;
    case "pct": return `${value.toFixed(1)}%`;
    case "money": return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: value >= 1e5 ? "compact" : "standard" }).format(value);
    case "years": return value.toFixed(1);
    case "density": return `${new Intl.NumberFormat(locale, { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value)}/km²`;
    case "count": return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  }
}

// Short tick labels.
export function formatTick(kind: VarDef["kind"], value: number, locale: string) {
  if (kind === "margin") return value === 0 ? "0" : `${value > 0 ? "D" : "R"}+${Math.abs(value)}`;
  if (kind === "pct") return `${value}%`;
  if (kind === "money") return `$${Math.round(value / 1000)}k`;
  if (kind === "density" || kind === "count") return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  return String(value);
}

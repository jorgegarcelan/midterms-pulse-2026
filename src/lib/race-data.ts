// Static election history and Census demographics, loaded once per page and cached in memory.

export type HistoryResult = { y: number; dp: number; rp: number; m: number; w: "D" | "R" | "O"; n?: string; s?: 1; u?: 1 };
export type DemographicProfile = {
  population: number | null; medianAge: number | null; medianIncome: number | null; poverty: number | null; bachelors: number | null;
  unemployment: number | null; ownerOccupied: number | null; foreignBorn: number | null; veterans: number | null;
  race: { white: number | null; black: number | null; hispanic: number | null; asian: number | null; other: number | null };
};
export type Demographics = { source: string; release: string; retrieved: string; us: DemographicProfile; states: Record<string, DemographicProfile>; districts: Record<string, DemographicProfile> };

const cache = new Map<string, Promise<unknown>>();
function load<T>(url: string): Promise<T> {
  if (!cache.has(url)) cache.set(url, fetch(url).then((response) => { if (!response.ok) throw new Error(url); return response.json(); }).catch((error) => { cache.delete(url); throw error; }));
  return cache.get(url) as Promise<T>;
}

export const loadDemographics = () => load<Demographics>("/data/demographics.json");
export const loadHouseHistory = (state: string) => load<{ source: string; districts: Record<string, HistoryResult[]> }>(`/data/history/house/${state}.json`);
export const loadSenateHistory = () => load<{ source: string; states: Record<string, HistoryResult[]> }>("/data/history/senate.json");
export const loadPresidentHistory = () => load<{ source: string; states: Record<string, HistoryResult[]> }>("/data/history/president.json");

export type Metric = { key: Exclude<keyof DemographicProfile, "race">; label: string; format: (value: number) => string; hint?: string };
export const METRICS: Metric[] = [
  { key: "population", label: "Population", format: (value) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value) },
  { key: "medianIncome", label: "Median household income", format: (value) => `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)}` },
  { key: "medianAge", label: "Median age", format: (value) => value.toFixed(1) },
  { key: "bachelors", label: "Bachelor's degree or higher", format: (value) => `${value.toFixed(1)}%`, hint: "adults 25+" },
  { key: "poverty", label: "Below poverty line", format: (value) => `${value.toFixed(1)}%` },
  { key: "unemployment", label: "Unemployment", format: (value) => `${value.toFixed(1)}%`, hint: "civilian labor force" },
  { key: "ownerOccupied", label: "Homeowners", format: (value) => `${value.toFixed(1)}%`, hint: "owner-occupied homes" },
  { key: "foreignBorn", label: "Foreign-born", format: (value) => `${value.toFixed(1)}%` },
  { key: "veterans", label: "Veterans", format: (value) => `${value.toFixed(1)}%`, hint: "adults 18+" },
];
export const RACE_GROUPS = [
  { key: "white", label: "White" }, { key: "hispanic", label: "Hispanic" }, { key: "black", label: "Black" }, { key: "asian", label: "Asian" }, { key: "other", label: "Other / multiracial" },
] as const;

// Share of districts with a lower value (0–100), for "percentile among all 435 districts".
export function districtPercentile(demographics: Demographics, key: Metric["key"], value: number) {
  const values = Object.values(demographics.districts).map((profile) => profile[key]).filter((item): item is number => item !== null);
  return Math.round(values.filter((item) => item < value).length / values.length * 100);
}

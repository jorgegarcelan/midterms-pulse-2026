import raw from "@/data/census-model.json";

/*
  The census-only House model, built offline in census-model/ (Python) and exported by
  census-model/export_web.py. Every district's margin comes from its ACS profile alone;
  the national level comes from election history. No polls, no markets.
*/
export type CensusBacktestYear = {
  year: number; actual: number; oracle: number; sim: number; p10: number; p90: number; pMajority: number;
  accuracy: number; brier: number; brier538: number | null; brierMp26: number | null; nationalTrue: number; nationalBlind: number;
};
export type CensusFeature = { key: string; importance: number; correlation: number };
export type CensusRace = { code: string; margin: number; pD: number; redrawn: boolean };
export type CensusBenchmark = { set: string; brier: number; accuracy: number; seatBias: number; median2026: number; pMajority2026: number };
export type CensusModel = {
  generated: string; acs: string; mainModel: string;
  headline: { accuracy: number; years: number[]; rmse: number; stateHoldoutRmse: number; variables: number };
  national: { mean: number; sd: number; popularVote2024: number; swings: Record<string, number> };
  house: { median: number; p10: number; p90: number; pMajority: number; expected: number; distribution: [number, number][] };
  backtest: CensusBacktestYear[];
  lesson2018: { meanContested: number; popularVote: number };
  features: CensusFeature[];
  races: CensusRace[];
  redraw: { state: string; census: number; withPres: number }[];
  benchmarks: CensusBenchmark[];
};

type RawRace = [string, number, number, number];

export function loadCensusModel(): CensusModel {
  const data = raw as unknown as Omit<CensusModel, "races"> & { races: RawRace[] };
  return { ...data, races: data.races.map(([code, margin, pD, redrawn]) => ({ code, margin, pD, redrawn: redrawn === 1 })) };
}

// English source labels for the ACS variables; translated at render time.
export const FEATURE_LABELS: Record<string, string> = {
  white_noncollege: "White adults without a degree",
  white_college: "White college graduates",
  married: "Married adults",
  public_transport: "Commute by public transit",
  division: "Census region",
  median_age: "Median age",
  age_65_plus: "Aged 65 and over",
  age_18_29: "Aged 18 to 29",
  hispanic: "Hispanic",
  black: "Black",
  asian: "Asian",
  white: "White (non-Hispanic)",
  bachelors: "Bachelor's degree or higher",
  hs_or_less: "High school or less",
  log_density: "Population density",
  income_index: "Median household income",
  home_value_index: "Home values",
  poverty: "Below the poverty line",
  unemployment: "Unemployment",
  owner: "Homeowners",
  foreign_born: "Foreign-born",
  veterans: "Veterans",
  work_from_home: "Work from home",
};

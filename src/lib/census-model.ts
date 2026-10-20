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
export type CensusTwin = { kind: "alike" | "apart"; distance: number; a: string; b: string; marginA: number; marginB: number };
export type ToyVariable = { key: string; mean: number; sd: number; coef: number; min: number; max: number };
export type CensusToy = {
  intercept: number; variables: ToyVariable[]; regions: Record<string, number>; rmse: number; national2026: number;
  presets: { code: string; division: string; margin2024: number | null; values: Record<string, number> }[];
};
export type CensusSenateRace = { state: string; margin: number; pD: number; special?: boolean };
export type CensusSenateChamber = {
  median: number; p10: number; p90: number; pMajority: number; expected: number; notUp: { D: number; R: number };
  localSd: number; nationalSd: number; national: number; weighting: "equal" | "votes"; houseLocalSd: number; distribution: [number, number][];
};
export type CensusSenateYear = {
  year: number; races: number; localSd: number; nationalSd: number; brier: number; accuracy: number; accuracyRealVote: number;
  meanAbsError: number; meanAbsErrorRealVote: number; meanError: number; demWinsExpected: number; demWins: number; brierMp26: number | null;
};
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
  profileKeys: string[];
  profiles2026: Record<string, (number | null)[]>;
  profiles2024: Record<string, (number | null)[]>;
  results2024: [string, number, number | null][];
  twins: CensusTwin[];
  toy: CensusToy;
  // Senate (census-model/senate.py); optional so the page still renders from an older export.
  senate?: CensusSenateRace[];
  senateChamber?: CensusSenateChamber;
  senateBacktest?: CensusSenateYear[];
};

type RawRace = [string, number, number, number];

export function loadCensusModel(): CensusModel {
  const data = raw as unknown as Omit<CensusModel, "races"> & { races: RawRace[] };
  return { ...data, races: data.races.map(([code, margin, pD, redrawn]) => ({ code, margin, pD, redrawn: redrawn === 1 })) };
}

// English source labels for the ACS variables; translated at render time.
export const FEATURE_LABELS: Record<string, string> = {
  density: "People per square mile",
  income: "Median household income",
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

// Short labels and units for the profile variables shown on cards, charts and sliders.
export const PROFILE_FORMAT: Record<string, { label: string; unit: "%" | "years" | "people" | "$" }> = {
  bachelors: { label: "Bachelor's degree or higher", unit: "%" },
  white_noncollege: { label: "White adults without a degree", unit: "%" },
  white: { label: "White (non-Hispanic)", unit: "%" },
  black: { label: "Black", unit: "%" },
  hispanic: { label: "Hispanic", unit: "%" },
  married: { label: "Married adults", unit: "%" },
  median_age: { label: "Median age", unit: "years" },
  public_transport: { label: "Commute by public transit", unit: "%" },
  density: { label: "People per square mile", unit: "people" },
  log_density: { label: "People per square mile", unit: "people" },
  income: { label: "Median household income", unit: "$" },
};

// Census divisions, named by their states so no translation is needed beyond the word itself.
export const REGION_STATES: Record<string, string> = {
  "New England": "CT, ME, MA, NH, RI, VT", "Mid-Atlantic": "NJ, NY, PA", "East North Central": "IL, IN, MI, OH, WI",
  "West North Central": "IA, KS, MN, MO, NE, ND, SD", "South Atlantic": "DE, FL, GA, MD, NC, SC, VA, WV", "East South Central": "AL, KY, MS, TN",
  "West South Central": "AR, LA, OK, TX", Mountain: "AZ, CO, ID, MT, NV, NM, UT, WY", Pacific: "AK, CA, HI, OR, WA",
};

// The profile of one district as { key: value } from the compact row arrays.
export function profileOf(model: CensusModel, lines: "2024" | "2026", code: string) {
  const row = (lines === "2026" ? model.profiles2026 : model.profiles2024)[code];
  return row ? Object.fromEntries(model.profileKeys.map((key, i) => [key, row[i]])) as Record<string, number | null> : null;
}

// The average district: plain mean of each variable over the 435 districts on the given lines.
export function averageProfile(model: CensusModel, lines: "2024" | "2026") {
  const rows = Object.values(lines === "2026" ? model.profiles2026 : model.profiles2024);
  return Object.fromEntries(model.profileKeys.map((key, i) => {
    const values = rows.map((row) => row[i]).filter((value): value is number => value !== null);
    return [key, values.reduce((sum, value) => sum + value, 0) / values.length];
  })) as Record<string, number>;
}

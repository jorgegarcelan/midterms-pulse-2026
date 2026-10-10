import { REGIONS, regionOf, type RegionKey } from "@/data/regions";
import { NATIONALIZATION } from "@/lib/mp26";

/*
  Playground scenarios: transparent, linear edits to every race's expected margin (D − R, points).

    adjusted = model margin
             + national swing × NATIONALIZATION   (generic-ballot movement, absorbed like the model does)
             + polling error                       (a uniform miss in every race)
             + regional swing                      (the race's region)
             + Σ group swing × group share         (share of the district or state population, 0–1)

  Positive values always move toward Democrats.
*/
export type GroupKey = "hispanic" | "black" | "whiteNonCollege" | "college";
export type Scenario = { national: number; polling: number; regions: Record<RegionKey, number>; groups: Record<GroupKey, number> };
export type Shares = Record<GroupKey, number>;
export type DemographicProfile = { population: number; bachelors: number; medianAge?: number; medianIncome?: number; poverty?: number; foreignBorn?: number; race: { white: number; black: number; hispanic: number; asian: number; other: number } };
export type DemographicsFile = { states: Record<string, DemographicProfile>; districts: Record<string, DemographicProfile> };

export const GROUPS: { key: GroupKey; label: string; param: string }[] = [
  { key: "hispanic", label: "Hispanic voters", param: "his" },
  { key: "black", label: "Black voters", param: "blk" },
  { key: "whiteNonCollege", label: "White non-college", param: "wnc" },
  { key: "college", label: "College graduates", param: "col" },
];

export const LIMITS = { national: 10, polling: 6, region: 8, group: 20 } as const;

export const neutralScenario = (): Scenario => ({
  national: 0,
  polling: 0,
  regions: Object.fromEntries(REGIONS.map((region) => [region.key, 0])) as Record<RegionKey, number>,
  groups: { hispanic: 0, black: 0, whiteNonCollege: 0, college: 0 },
});

export const isNeutral = (scenario: Scenario) => scenarioKey(scenario) === scenarioKey(neutralScenario());

/*
  Group shares from ACS 5-year profiles. Race and ethnicity shares are of the whole population;
  bachelor's attainment is of adults 25+. White non-college is estimated as white share × (1 − college
  share), i.e. assuming white residents hold degrees at the area's overall rate.
*/
export function sharesFor(profile?: DemographicProfile): Shares | undefined {
  if (!profile) return undefined;
  const college = profile.bachelors / 100;
  return {
    hispanic: profile.race.hispanic / 100,
    black: profile.race.black / 100,
    whiteNonCollege: profile.race.white / 100 * (1 - college),
    college,
  };
}

export function adjustMargin(margin: number, state: string, shares: Shares | undefined, scenario: Scenario) {
  let value = margin + scenario.national * NATIONALIZATION + scenario.polling;
  const region = regionOf.get(state);
  if (region) value += scenario.regions[region];
  if (shares) for (const group of GROUPS) value += scenario.groups[group.key] * shares[group.key];
  return value;
}

// ---------- URL encoding ----------

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
const read = (params: Record<string, string | undefined>, key: string, limit: number) => {
  const value = Number(params[key]);
  return Number.isFinite(value) ? clamp(Math.round(value * 2) / 2, limit) : 0;
};

export function decodeScenario(params: Record<string, string | undefined>): Scenario {
  const scenario = neutralScenario();
  scenario.national = read(params, "nat", LIMITS.national);
  scenario.polling = read(params, "err", LIMITS.polling);
  for (const region of REGIONS) scenario.regions[region.key] = read(params, `r_${region.key}`, LIMITS.region);
  for (const group of GROUPS) scenario.groups[group.key] = read(params, group.param, LIMITS.group);
  return scenario;
}

// Only non-zero values travel; null removes the key.
export function encodeScenario(scenario: Scenario): Record<string, string | null> {
  const value = (number: number) => (number ? String(number) : null);
  return {
    nat: value(scenario.national),
    err: value(scenario.polling),
    ...Object.fromEntries(REGIONS.map((region) => [`r_${region.key}`, value(scenario.regions[region.key])])),
    ...Object.fromEntries(GROUPS.map((group) => [group.param, value(scenario.groups[group.key])])),
  };
}

export const scenarioKey = (scenario: Scenario) => JSON.stringify(encodeScenario(scenario));

// ---------- Presets ----------

export type Preset = { key: string; label: string; note: string; apply: (scenario: Scenario) => Scenario };

const preset = (patch: { national?: number; polling?: number; regions?: Partial<Record<RegionKey, number>>; groups?: Partial<Record<GroupKey, number>> }) => () => {
  const base = neutralScenario();
  return { national: patch.national ?? 0, polling: patch.polling ?? 0, regions: { ...base.regions, ...patch.regions }, groups: { ...base.groups, ...patch.groups } };
};

export const PRESETS: Preset[] = [
  { key: "wave2018", label: "2018-style blue wave", note: "Generic ballot 5 pts better for Democrats, with suburban college graduates moving most.", apply: preset({ national: 5, groups: { college: 6 } }) },
  { key: "miss2020", label: "Polls underestimate Republicans like 2020", note: "Every race misses by 4 pts toward the GOP.", apply: preset({ polling: -4 }) },
  { key: "hispanic", label: "Hispanic shift continues", note: "Hispanic voters move another 15 pts toward Republicans, as from 2020 to 2024.", apply: preset({ groups: { hispanic: -15 } }) },
  { key: "redwave", label: "Red wave", note: "The national environment swings 10 pts to the GOP and working-class white voters turn out.", apply: preset({ national: -10, groups: { whiteNonCollege: -4 } }) },
  { key: "rustbelt", label: "Blue wall rebuilt", note: "Democrats gain 4 pts across the Rust Belt and 3 with white non-college voters.", apply: preset({ regions: { rust: 4 }, groups: { whiteNonCollege: 3 } }) },
  { key: "sunbelt", label: "Sun Belt surge", note: "Democrats gain 4 pts in the Sun Belt and 8 with Black voters.", apply: preset({ regions: { sun: 4 }, groups: { black: 8 } }) },
];

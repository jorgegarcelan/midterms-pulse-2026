import { ELECTORAL_VOTES, REGIONS, regionOf, type RegionKey } from "@/data/regions";

/*
  County-level geography of the vote: the axes (density, education, race, income), the belts and the
  regional axes used by /geography. Margins are D − R in points of the total vote (D positive).
*/
export type Votes = [dem: number, rep: number, total: number];
export type County = {
  f: string; s: string; n: string; lat: number; lon: number; pop: number | null; den: number | null;
  w: number | null; b: number | null; h: number | null; c: number | null; inc: number | null; age: number | null;
  v16: Votes; v20: Votes; v24: Votes;
};
export type Year = "v16" | "v20" | "v24";
export const YEARS: { key: Year; label: string }[] = [{ key: "v16", label: "2016" }, { key: "v20", label: "2020" }, { key: "v24", label: "2024" }];

export const margin = (votes: Votes) => (votes[2] ? (votes[0] - votes[1]) / votes[2] * 100 : 0);
export const signed = (value: number, digits = 1) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(digits)}`;

export function aggregate(counties: County[], year: Year) {
  let dem = 0, rep = 0, total = 0;
  for (const county of counties) { dem += county[year][0]; rep += county[year][1]; total += county[year][2]; }
  return { dem, rep, total, margin: total ? (dem - rep) / total * 100 : 0 };
}

export type Bucket = { key: string; label: string; note: string; test: (county: County) => boolean };
export type Axis = { key: string; title: string; kicker: string; story: string; source: string; buckets: Bucket[] };

const between = (value: number | null, low: number, high: number) => value !== null && value >= low && value < high;

export const AXES: Axis[] = [
  {
    key: "density", kicker: "AXIS 1 · CITY VS COUNTRY", title: "Cities and the countryside",
    story: "The single strongest divide in American politics. Big cities vote overwhelmingly Democratic, rural counties overwhelmingly Republican, and the suburbs decide who wins. The farther from downtown, the redder the vote.",
    source: "People per square mile, Census county population and land area.",
    buckets: [
      { key: "urban", label: "Big cities", note: "1,000+ people per sq mi", test: (county) => between(county.den, 1000, Infinity) },
      { key: "suburban", label: "Suburbs", note: "250–1,000 per sq mi", test: (county) => between(county.den, 250, 1000) },
      { key: "town", label: "Small towns and exurbs", note: "50–250 per sq mi", test: (county) => between(county.den, 50, 250) },
      { key: "rural", label: "Rural", note: "under 50 per sq mi", test: (county) => between(county.den, 0, 50) },
    ],
  },
  {
    key: "education", kicker: "AXIS 2 · THE DIPLOMA DIVIDE", title: "College degrees",
    story: "Since 2016, education predicts the vote better than income. Counties full of college graduates moved toward Democrats; counties with few graduates, including many former union strongholds, moved hard toward Trump.",
    source: "Share of residents whose highest degree is a bachelor's (Census ACS), split into quarters of the national vote.",
    buckets: [
      { key: "high", label: "Most educated", note: "top quarter of the vote", test: (county) => between(county.c, 17.7, Infinity) },
      { key: "mid-high", label: "Above average", note: "second quarter", test: (county) => between(county.c, 14.7, 17.7) },
      { key: "mid-low", label: "Below average", note: "third quarter", test: (county) => between(county.c, 11.7, 14.7) },
      { key: "low", label: "Fewest graduates", note: "bottom quarter of the vote", test: (county) => between(county.c, 0, 11.7) },
    ],
  },
  {
    key: "race", kicker: "AXIS 3 · RACE AND ORIGIN", title: "Race and Hispanic origin",
    story: "Black voters remain the most Democratic group in the country. The big story of 2020 and 2024 is Hispanic voters: heavily Hispanic counties, from the Rio Grande Valley to Miami, swung sharply toward Republicans.",
    source: "Census ACS shares of each county's population.",
    buckets: [
      { key: "hispanic", label: "Heavily Hispanic", note: "40%+ Hispanic", test: (county) => between(county.h, 40, Infinity) },
      { key: "black", label: "Large Black population", note: "35%+ Black", test: (county) => between(county.b, 35, Infinity) && !between(county.h, 40, Infinity) },
      { key: "white", label: "Overwhelmingly white", note: "85%+ white, under 10% Hispanic", test: (county) => between(county.w, 85, Infinity) && between(county.h, 0, 10) && !between(county.b, 35, Infinity) },
      { key: "mixed", label: "Diverse and mixed", note: "everything else", test: (county) => !between(county.h, 40, Infinity) && !between(county.b, 35, Infinity) && !(between(county.w, 85, Infinity) && between(county.h, 0, 10)) },
    ],
  },
  {
    key: "income", kicker: "AXIS 4 · MONEY", title: "Household income",
    story: "Income used to be the classic divide: richer meant more Republican. Today it is muddled. Wealthy, educated suburbs lean Democratic while many middle-income and poorer rural counties are the Republican base.",
    source: "Median household income, Census ACS.",
    buckets: [
      { key: "rich", label: "Affluent", note: "$90k+ median household income", test: (county) => between(county.inc, 90000, Infinity) },
      { key: "upper", label: "Comfortable", note: "$70–90k", test: (county) => between(county.inc, 70000, 90000) },
      { key: "middle", label: "Middle", note: "$55–70k", test: (county) => between(county.inc, 55000, 70000) },
      { key: "lower", label: "Lower income", note: "under $55k", test: (county) => between(county.inc, 0, 55000) },
    ],
  },
];

const inStates = (...codes: string[]) => (county: County) => codes.includes(county.s);
const DEEP_SOUTH = ["AL", "GA", "MS", "SC", "NC", "VA", "LA", "TN", "AR", "FL"];

export type Belt = { key: string; name: string; blurb: string; approx?: boolean; test: (county: County) => boolean };
export const BELTS: Belt[] = [
  { key: "rust", name: "Rust Belt", blurb: "The old industrial heartland. The 'blue wall' of Michigan, Wisconsin and Pennsylvania decides the presidency.", test: inStates("IL", "IN", "MI", "MN", "OH", "PA", "WI") },
  { key: "sun", name: "Sun Belt", blurb: "Booming metros in Arizona, Nevada, Georgia and North Carolina: diverse, young and increasingly competitive.", test: inStates("AZ", "NV", "TX", "FL", "GA", "NC", "SC") },
  { key: "black", name: "Black Belt", blurb: "A crescent of Southern counties named for its dark soil, home to the plantations and today to large Black communities. Solidly Democratic islands in red states.", test: (county) => DEEP_SOUTH.includes(county.s) && between(county.b, 35, Infinity) },
  { key: "bible", name: "Bible Belt", blurb: "The evangelical South, the most reliably Republican region of the country.", test: inStates("AL", "AR", "KY", "LA", "MS", "OK", "SC", "TN") },
  { key: "farm", name: "Farm Belt", blurb: "Corn and wheat country across the Plains: few people, huge Republican margins.", test: inStates("IA", "NE", "KS", "SD", "ND") },
  { key: "appalachia", name: "Appalachia", approx: true, blurb: "Coal country from West Virginia to eastern Kentucky and Tennessee. Once union Democrats, now among Trump's best counties.", test: (county) => county.s === "WV" || (county.s === "KY" && county.lon > -85.2) || (county.s === "TN" && county.lon > -85.2 && county.lat > 35.4) || (county.s === "VA" && county.lon < -79.6) || (county.s === "OH" && county.lon > -82.8 && county.lat < 40) || (county.s === "PA" && county.lat < 41 && county.lon < -77.5 && county.lon > -80.5 && (county.den ?? 0) < 400) },
  { key: "border", name: "Hispanic Southwest", blurb: "Majority-Hispanic counties from South Texas to New Mexico and California. The fastest Republican swing of the last decade.", test: (county) => ["TX", "NM", "AZ", "CA", "CO", "FL"].includes(county.s) && between(county.h, 55, Infinity) },
  { key: "acela", name: "Acela Corridor", approx: true, blurb: "The dense Washington–Boston corridor along the Amtrak line: the Democratic establishment's home turf.", test: (county) => ["DC", "MD", "DE", "NJ", "NY", "CT", "RI", "MA", "PA"].includes(county.s) && between(county.den, 800, Infinity) && county.lon > -77.6 },
];

// Regional axes: where each region sits between the parties, for a past presidential year or the 2026 forecast.
export type RegionPoint = { key: RegionKey; name: string; blurb: string; states: string[]; share: number; detail: string; rLeaning: number; dLeaning: number; size: number; expectedR: number };

export function presidentialRegions(stateMargins: Map<string, number>): RegionPoint[] {
  return REGIONS.map((region) => {
    const ev = region.states.reduce((sum, state) => sum + ELECTORAL_VOTES[state], 0);
    const evR = region.states.reduce((sum, state) => sum + ((stateMargins.get(state) ?? 0) < 0 ? ELECTORAL_VOTES[state] : 0), 0);
    const rLeaning = region.states.filter((state) => (stateMargins.get(state) ?? 0) < 0).length;
    return { ...region, share: evR / ev * 100, detail: "EV", rLeaning, dLeaning: region.states.length - rLeaning, size: ev, expectedR: evR };
  });
}

// 2026: expected Republican share of the region's House seats (sum of race probabilities), or of its Senate races.
export function forecastRegions(races: { chamber: string; state: string; demProbability: number }[], chamber: "house" | "senate"): RegionPoint[] {
  return REGIONS.flatMap((region) => {
    const inRegion = races.filter((race) => race.chamber === chamber && region.states.includes(race.state));
    if (!inRegion.length) return [];
    const expectedR = inRegion.reduce((sum, race) => sum + (100 - race.demProbability) / 100, 0);
    const rLeaning = inRegion.filter((race) => race.demProbability < 50).length;
    return [{ ...region, share: expectedR / inRegion.length * 100, detail: chamber === "house" ? "seats" : "races", rLeaning, dLeaning: inRegion.length - rLeaning, size: inRegion.length, expectedR }];
  });
}

export function shareBand(share: number) {
  const distance = Math.abs(share - 50);
  if (distance < 10) return "Toss-up";
  const side = share > 50 ? "R" : "D";
  return distance < 35 ? `Lean ${side}` : `Safe ${side}`;
}

export { regionOf };

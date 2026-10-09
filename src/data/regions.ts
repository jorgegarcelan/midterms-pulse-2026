/*
  Regional axes of the electoral map: a partition of the 50 states plus DC into six regions, and
  2024 electoral votes (2020 apportionment). Shared by the geography explainer and the playground.
*/
export type RegionKey = "rust" | "sun" | "plains" | "pacific" | "mountain" | "east";

export const REGIONS: { key: RegionKey; name: string; blurb: string; states: string[] }[] = [
  { key: "rust", name: "Rust Belt", blurb: "Industrial states where the old blue wall meets recent Republican gains.", states: ["IL", "IN", "MI", "MN", "OH", "PA", "WI"] },
  { key: "sun", name: "Sun Belt & South", blurb: "Fast-growing metros, the Deep South and the largest southern prizes.", states: ["AL", "AZ", "FL", "GA", "KY", "LA", "MS", "NV", "NC", "SC", "TN", "TX", "WV"] },
  { key: "plains", name: "Middle & Rural", blurb: "The Plains and interior states where rural voting patterns dominate.", states: ["AR", "IA", "KS", "MO", "NE", "ND", "OK", "SD"] },
  { key: "pacific", name: "West Coast & Pacific", blurb: "The Pacific coast, Alaska and Hawaii on one regional axis.", states: ["AK", "CA", "HI", "OR", "WA"] },
  { key: "mountain", name: "Mountain West", blurb: "A mix of safe interior states and rapidly changing western battlegrounds.", states: ["CO", "ID", "MT", "NM", "UT", "WY"] },
  { key: "east", name: "East Coast", blurb: "The Northeast corridor through Virginia, dominated by large Democratic states.", states: ["CT", "DE", "DC", "ME", "MD", "MA", "NH", "NJ", "NY", "RI", "VT", "VA"] },
];

export const regionOf = new Map(REGIONS.flatMap((region) => region.states.map((state) => [state, region.key] as const)));

export const ELECTORAL_VOTES: Record<string, number> = {
  AL: 9, AK: 3, AZ: 11, AR: 6, CA: 54, CO: 10, CT: 7, DE: 3, DC: 3, FL: 30, GA: 16, HI: 4, ID: 4, IL: 19, IN: 11, IA: 6, KS: 6,
  KY: 8, LA: 8, ME: 4, MD: 10, MA: 11, MI: 15, MN: 10, MS: 6, MO: 10, MT: 4, NE: 5, NV: 6, NH: 4, NJ: 14, NM: 5, NY: 28, NC: 16,
  ND: 3, OH: 17, OK: 7, OR: 8, PA: 19, RI: 4, SC: 9, SD: 3, TN: 11, TX: 40, UT: 6, VT: 3, VA: 13, WA: 12, WV: 4, WI: 10, WY: 3,
};

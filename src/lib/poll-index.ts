/*
  The Vote-Scope poll indexes mix three kinds of poll. The House index holds national generic-ballot
  polls (no geography) and district polls (geography.riding_id + district); the Senate index holds
  state polls (geography.province). Only the first kind measures the national environment.
*/
export type IndexPoll = {
  poll_id: string; firm_name: string; release_date?: string; field_start?: string; field_end: string; sample_size: number; population: string; source_url: string;
  topline: { us_dem?: number; us_rep?: number; us_oth?: number };
  geography?: { level?: string; province?: string; district?: string; riding_id?: string; region?: string };
};

export const isGenericBallotPoll = (poll: IndexPoll) => !poll.geography?.province && !poll.geography?.riding_id;

// "PA-07" for a district poll (at-large seats come as district "0"), null otherwise.
export function pollDistrict(poll: IndexPoll) {
  const { province, district, riding_id: riding } = poll.geography ?? {};
  if (!riding || !province || district === undefined) return null;
  return `${province}-${String(Number(district) || 0).padStart(2, "0")}`;
}

export const pollPopulation = (value?: string) => value?.toLowerCase() === "lv" ? "LV" as const : value?.toLowerCase() === "rv" ? "RV" as const : "A" as const;

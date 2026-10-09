// The slice of the published model the playground needs, passed from the server page.
export type PlayRace = {
  chamber: "house" | "senate";
  code: string;
  state: string;
  signedMargin: number;
  leader: "D" | "R";
  margin: number;
  winProbability: number;
  rating: string;
  incumbentParty: "D" | "R" | null;
  special: boolean;
  baselineMargin: number | null;
};

export type Published = {
  runDate: string;
  version: string;
  house: { demMajority: number; demSeats: number; interval80: [number, number] };
  senate: { demMajority: number; demSeats: number; interval80: [number, number] };
};

export type ToolKey = "scenario" | "map" | "lab";
export const TOOLS: ToolKey[] = ["scenario", "map", "lab"];

// Merge a patch into the current query string without a navigation (null deletes a key).
export function patchUrl(patch: Record<string, string | null>) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

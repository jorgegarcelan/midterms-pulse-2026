import { regionOf, type RegionKey } from "@/data/regions";
import { stateTiles } from "@/data/states";
import type { RaceOverview } from "@/lib/overview-shared";

// In play: the raters' consensus is Lean or closer.
export const inPlay = (race: Pick<RaceOverview, "rating">) => Math.abs(race.rating?.score ?? 0) <= 1;
export const favours = (race: Pick<RaceOverview, "rating">) => { const score = race.rating?.score ?? 0; return score >= .25 ? "D" as const : score <= -.25 ? "R" as const : "toss" as const; };
export const raceHref = (race: Pick<RaceOverview, "chamber" | "code">) => `/races/${race.chamber === "senate" ? `${race.code.toLowerCase()}-senate` : race.code.toLowerCase()}`;

export type StateSummary = {
  code: string; name: string; region: RegionKey | null;
  // House delegation by the raters' consensus.
  seats: number; favD: number; toss: number; favR: number; competitive: number;
  senate: RaceOverview[];
  president2024: number | null;
};

// One row per state: its House delegation by rating, its Senate race(s) and its last presidential margin.
export function summarizeStates(races: RaceOverview[], president: Record<string, { y: number; m: number }[]>): StateSummary[] {
  return stateTiles.filter((tile) => tile.code !== "DC").map((tile) => {
    const house = races.filter((race) => race.chamber === "house" && race.state === tile.code);
    return {
      code: tile.code, name: tile.name, region: regionOf.get(tile.code) ?? null,
      seats: house.length,
      favD: house.filter((race) => favours(race) === "D").length,
      toss: house.filter((race) => favours(race) === "toss").length,
      favR: house.filter((race) => favours(race) === "R").length,
      competitive: house.filter(inPlay).length,
      senate: races.filter((race) => race.chamber === "senate" && race.state === tile.code),
      president2024: president[tile.code]?.find((result) => result.y === 2024)?.m ?? null,
    };
  });
}

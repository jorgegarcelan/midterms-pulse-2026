import { regionOf, type RegionKey } from "@/data/regions";
import { stateTiles } from "@/data/states";
import { expertBook, expertScore } from "@/lib/expert-ratings";
import type { ForecastRace } from "@/lib/forecast";

export const demChance = (race: Pick<ForecastRace, "leader" | "winProbability">) => (race.leader === "D" ? race.winProbability : 100 - race.winProbability);

// In play: the model has it between 25% and 75%, or the raters keep it at Lean or closer.
export function inPlay(race: ForecastRace) {
  const p = demChance(race);
  if (p > 25 && p < 75) return true;
  const entry = expertBook(race);
  const experts = entry?.listed ? expertScore(entry.book) : null;
  return experts !== null && experts !== undefined && Math.abs(experts) <= 1;
}

export type StateSummary = {
  code: string; name: string; region: RegionKey | null;
  seats: number; expectedD: number; leadD: number; competitive: number;
  senate: { code: string; special: boolean; pD: number; margin: number }[];
  president2024: number | null;
};

// One row per state: its House delegation in the model, its Senate race(s) and its last presidential margin.
export function summarizeStates(races: ForecastRace[], president: Record<string, { y: number; m: number }[]>): StateSummary[] {
  return stateTiles.filter((tile) => tile.code !== "DC").map((tile) => {
    const house = races.filter((race) => race.chamber === "house" && race.state === tile.code);
    const senate = races.filter((race) => race.chamber === "senate" && race.state === tile.code);
    return {
      code: tile.code, name: tile.name, region: regionOf.get(tile.code) ?? null,
      seats: house.length,
      expectedD: house.reduce((sum, race) => sum + demChance(race) / 100, 0),
      leadD: house.filter((race) => race.signedMargin >= 0).length,
      competitive: house.filter(inPlay).length,
      senate: senate.map((race) => ({ code: race.code, special: race.special, pD: demChance(race), margin: race.signedMargin })),
      president2024: president[tile.code]?.find((result) => result.y === 2024)?.m ?? null,
    };
  });
}

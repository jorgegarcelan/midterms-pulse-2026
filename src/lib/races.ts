import type { ForecastRace } from "@/lib/forecast";

export function raceSlug(race: Pick<ForecastRace, "code" | "chamber">) {
  return race.chamber === "senate" ? `${race.code.toLowerCase()}-senate` : race.code.toLowerCase();
}

export function parseRaceSlug(slug: string) {
  const normalized = slug.toUpperCase();
  if (/^[A-Z]{2}-SENATE$/.test(normalized)) return { chamber: "senate" as const, state: normalized.slice(0, 2), code: normalized.slice(0, 2) };
  if (/^[A-Z]{2}-\d{2}$/.test(normalized)) return { chamber: "house" as const, state: normalized.slice(0, 2), code: normalized };
  return null;
}

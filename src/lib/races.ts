import { stateByCode } from "@/data/geography";
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

const ordinal = (value: number) => `${value}${["th", "st", "nd", "rd"][value % 100 > 10 && value % 100 < 14 ? 0 : value % 10 < 4 ? value % 10 : 0]}`;

type Translate = (text: string, vars?: Record<string, string | number>) => string;
const fill = (text: string, vars?: Record<string, string | number>) => vars ? text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match)) : text;

// Display name: "Georgia Senate", "California 13th District", "Wyoming At-Large".
// Pass a translator (getT / useT) for the localized name; without one the English name is returned.
export function raceName(race: Pick<ForecastRace, "code" | "chamber" | "state">, t: Translate = fill) {
  const englishState = stateByCode.get(race.state)?.name || race.state;
  const state = t(englishState);
  if (race.chamber === "senate") return t("{state} Senate", { state });
  const district = Number(race.code.slice(3));
  return district === 0 ? t("{state} At-Large", { state }) : t("{state} {ordinal} District", { state, ordinal: ordinal(district), number: district });
}

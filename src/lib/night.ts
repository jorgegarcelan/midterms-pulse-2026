import { POLL_CLOSING } from "@/data/poll-closing";

/*
  Election night results, shared by the public views, the stream scene and the call desk.
  Races are "called" by hand from the desk as the networks project them; every view reads the same
  record through /api/night. A rehearsal is a second, separate record with a simulated night on a
  sped-up clock: it is only shown to clients that ask for it (?rehearsal=1), never to the public.
*/

export type Winner = "D" | "R";
export type NightCall = { key: string; winner: Winner; at: string };
export type NightClock = { simStart: string; realStart: string; speed: number };

// The forecast frozen when the night starts, so a model rerun at midnight cannot move the baseline mid-show.
export type BaselineRace = { key: string; state: string; signedMargin: number; incumbentParty: "D" | "R" | null };
export type Baseline = {
  runDate: string; version: string; races: BaselineRace[];
  house: { demMajority: number; demSeats: number }; senate: { demMajority: number; demSeats: number };
};

export type NightDoc = { calls: NightCall[]; baseline: Baseline | null; updated: string; clock?: NightClock; scenario?: string };

export type ChamberNight = {
  seats: number; majority: number;
  called: { D: number; R: number };
  // Seats already settled: calls plus (Senate) the seats not on the ballot.
  locked: { D: number; R: number };
  uncalled: number;
  controlD: number; expected: number; median: number; interval80: [number, number];
  forecast: { controlD: number; seats: number };
};

export type NightState = {
  mode: "live" | "rehearsal";
  serverNow: string;
  now: string;
  clock: NightClock | null;
  scenario: string | null;
  calls: NightCall[];
  house: ChamberNight | null;
  senate: ChamberNight | null;
  // Posterior mean of the shared national error, in points of margin (D positive); null before any call.
  shift: number | null;
  baseline: { runDate: string; version: string } | null;
};

export const raceKey = (race: { chamber: string; code: string }) => `${race.chamber}:${race.code}`;
export const parseKey = (key: string) => { const [chamber, code] = key.split(":"); return { chamber: chamber as "house" | "senate", code }; };

// Poll closing times are Eastern Time on 3 November; ET is UTC−5 that night (daylight time ends 1 November).
const ELECTION_DAY = Date.UTC(2026, 10, 3);
export function closingTime(et: string) {
  const [hours, minutes] = et.split(":").map(Number);
  return ELECTION_DAY + (hours + 5) * 3_600_000 + minutes * 60_000;
}
export const stateClosing = new Map(POLL_CLOSING.map((state) => [state.code, closingTime(state.close)]));
export const FIRST_CLOSE = Math.min(...stateClosing.values());
export const LAST_CLOSE = Math.max(...stateClosing.values());

// The time on the night's clock: real time live, simulated time in a rehearsal.
export function clockNow(clock: NightClock | null, realMs = Date.now()) {
  if (!clock) return realMs;
  return Date.parse(clock.simStart) + (realMs - Date.parse(clock.realStart)) * clock.speed;
}

export const spainClock = (ms: number, seconds = false) => new Date(ms).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}) });
export const etClock = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

export const SCENARIOS = ["forecast", "dem-wave", "rep-wave", "random"] as const;
export type Scenario = (typeof SCENARIOS)[number];

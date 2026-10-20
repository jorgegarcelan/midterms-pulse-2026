import type { RaceAverage } from "@/lib/race-polls";

// Types and checks for the four readings that client components need, without the server fetchers.

export type RaceReadings = {
  key: string;
  // The non-Republican side: the Democrat, or the independent where no Democrat runs (Nebraska).
  side: "D" | "I";
  polls: RaceAverage | null;
  market: { p: number; volume: number; url: string } | null;
  mp26: { margin: number; p: number };
  census: { margin: number; p: number } | null;
};

export type ChamberReadings = {
  // Polls: the generic ballot for the House; the Senate has no single poll.
  polls: { margin: number } | null;
  market: { p: number; url: string } | null;
  mp26: { p: number; seats: number; majority: number; interval: [number, number] };
  census: { p: number; seats: number; interval: [number, number] } | null;
};

// Whether the readings disagree on who leads (ignoring near-ties).
export function readingsDisagree(readings: RaceReadings) {
  const leans = [readings.polls?.margin, readings.market && (readings.market.p - .5) * 100, readings.mp26.margin, readings.census?.margin]
    .filter((value): value is number => typeof value === "number" && Math.abs(value) >= .05)
    .map(Math.sign);
  return new Set(leans).size > 1;
}

import type { RaceAverage } from "@/lib/race-polls";

// Types and checks for the four readings that client components need, without the server fetchers.

// Bumped whenever the shape of /api/readings changes: clients ask for ?v=…, so an edge-cached answer
// in the old shape is never served to new code after a deploy.
export const READINGS_VERSION = 2;

export type RaceReadings = {
  key: string;
  // The non-Republican side: the Democrat, or the independent where no Democrat runs (Nebraska).
  side: "D" | "I";
  polls: RaceAverage | null;
  market: { p: number; volume: number; url: string } | null;
  // Each model's margin, probability and 80% range of the margin (low, high; D positive).
  mp26: { margin: number; p: number; range: [number, number] };
  census: { margin: number; p: number; range: [number, number] } | null;
  // Where each number comes from, for anyone quoting it.
  sources: {
    benchmarkDate: string; movement: number;
    census: { generated: string; rmse: number } | null;
    ratings: { book: Record<"cook" | "ie" | "sabato", string | null>; consensus: string | null; dates: Record<"cook" | "ie" | "sabato", string | null> } | null;
    marketRead: string | null;
  };
};

// Typical race-level error of MP-26's probability engine: margin RMSE in the 2018 and 2022 backtest (docs/BACKTEST.md).
export const MP26_RACE_RMSE = 6.2;

// Whether the readings disagree on who leads (ignoring near-ties).
export function readingsDisagree(readings: RaceReadings) {
  const leans = [readings.polls?.margin, readings.market && (readings.market.p - .5) * 100, readings.mp26.margin, readings.census?.margin]
    .filter((value): value is number => typeof value === "number" && Math.abs(value) >= .05)
    .map(Math.sign);
  return new Set(leans).size > 1;
}

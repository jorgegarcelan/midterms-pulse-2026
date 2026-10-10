import type { ExpertBook } from "@/lib/expert-ratings";
import { fetchVoteScope } from "@/lib/vote-scope";

// Daily runs written by .github/workflows/archive-forecast.yml to the forecast-archive branch.
const ARCHIVE = process.env.FORECAST_ARCHIVE_URL || "https://raw.githubusercontent.com/jorgegarcelan/midterms-pulse-2026/forecast-archive";

export type ChamberPoint = { p: number; seats: number; low: number; high: number };
export type RunSummary = { date: string; version: string; ballot: number; house: ChamberPoint; senate: ChamberPoint };
export type RaceRow = [chamber: "H" | "S", code: string, margin: number, demProbability: number];
export type ArchivedRun = RunSummary & {
  races: RaceRow[];
  ratings: { dates: Record<string, unknown>; house: Record<string, ExpertBook>; senate: Record<string, ExpertBook> } | null;
};

async function get<T>(file: string): Promise<T | null> {
  try {
    const response = await fetch(`${ARCHIVE}/${file}`, { next: { revalidate: 3600 } });
    return response.ok ? await response.json() as T : null;
  } catch {
    return null;
  }
}

export const fetchRunIndex = async () => (await get<{ runs: RunSummary[] }>("index.json"))?.runs ?? [];
export const fetchRun = (date: string) => get<ArchivedRun>(`runs/${date}.json`);

// The latest archived run at least `days` before `today`, or the oldest one when history is shorter.
export function baselineRun(runs: RunSummary[], today: string, days: number) {
  const cutoff = new Date(Date.parse(`${today}T12:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  const earlier = runs.filter((run) => run.date < today);
  return earlier.filter((run) => run.date <= cutoff).at(-1) ?? earlier[0] ?? null;
}

type BenchmarkRun = { run_date: string; seats: { us_dem: number } };

// The benchmark's own House seat history (last ~50 runs), shown while our archive is still short.
export async function fetchBenchmarkHouseHistory() {
  try {
    // Mean Democratic seats per run; the payload's headline seats_projected is a different statistic.
    const payload = await fetchVoteScope<{ previous_runs?: BenchmarkRun[] }>("us-house/latest.json", 3600);
    const runs = (payload.previous_runs || []).map((run) => ({ date: run.run_date, seats: Math.round(run.seats.us_dem * 10) / 10 }));
    return [...new Map(runs.map((run) => [run.date, run])).values()].sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

import { NextResponse } from "next/server";
import { fetchForecast } from "@/lib/forecast";

export const revalidate = 900;

// How fresh the data behind the site is: the Vote-Scope run it uses and whether that is behind.
export async function GET() {
  const forecast = await fetchForecast();
  const today = new Date().toISOString().slice(0, 10);
  const ageDays = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${forecast.updated}T00:00:00Z`)) / 86_400_000);
  // Vote-Scope runs daily; one day behind is normal before the morning run, two is stale.
  return NextResponse.json({ benchmarkDate: forecast.updated, ageDays, stale: Boolean(forecast.stale) || ageDays >= 2, bundledSnapshot: Boolean(forecast.stale) });
}

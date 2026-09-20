import { NextResponse } from "next/server";
import { seedPolls } from "@/data/polls";
import { fetchForecast } from "@/lib/forecast";
import { runModel, type ModelPoll } from "@/lib/model";

type SourcePoll = { field_end: string; sample_size: number; population: string; topline: { us_dem?: number; us_rep?: number } };

async function modelPolls(): Promise<{ polls: ModelPoll[]; source: string }> {
  try {
    const response = await fetch("https://vote-scope.com/web_data/us-house/polls/index.json", { next: { revalidate: 900 } });
    if (!response.ok) throw new Error("Poll feed unavailable");
    const payload = await response.json() as { polls: SourcePoll[] };
    const polls = payload.polls.filter((poll) => Number.isFinite(poll.topline.us_dem) && Number.isFinite(poll.topline.us_rep)).map((poll) => ({
      endDate: poll.field_end, dem: poll.topline.us_dem || 0, rep: poll.topline.us_rep || 0, sample: poll.sample_size || 0,
      population: poll.population?.toLowerCase() === "lv" ? "LV" as const : poll.population?.toLowerCase() === "rv" ? "RV" as const : "A" as const,
    }));
    return { polls, source: "Vote-Scope polling index" };
  } catch {
    return { polls: seedPolls.filter((poll) => poll.chamber === "Generic"), source: "Dated local polling aggregate" };
  }
}

export async function GET() {
  const [forecast, polling] = await Promise.all([fetchForecast(), modelPolls()]);
  return NextResponse.json(runModel(forecast, polling.polls, forecast.updated, polling.source));
}

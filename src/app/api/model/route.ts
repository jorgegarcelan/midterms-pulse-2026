import { NextResponse } from "next/server";
import { seedPolls } from "@/data/polls";
import { fetchForecast } from "@/lib/forecast";
import { runModel, type ModelPoll } from "@/lib/model";

type SourcePoll = { field_end: string; sample_size: number; population: string; topline: { us_dem?: number; us_rep?: number } };

async function modelPolls(): Promise<ModelPoll[]> {
  try {
    const response = await fetch("https://vote-scope.com/web_data/us-house/polls/index.json", { next: { revalidate: 900 } });
    if (!response.ok) throw new Error("Poll feed unavailable");
    const payload = await response.json() as { polls: SourcePoll[] };
    return payload.polls.filter((poll) => Number.isFinite(poll.topline.us_dem) && Number.isFinite(poll.topline.us_rep)).map((poll) => ({
      endDate: poll.field_end, dem: poll.topline.us_dem || 0, rep: poll.topline.us_rep || 0, sample: poll.sample_size || 0,
      population: poll.population?.toLowerCase() === "lv" ? "LV" : poll.population?.toLowerCase() === "rv" ? "RV" : "A",
    }));
  } catch {
    return seedPolls.filter((poll) => poll.chamber === "Generic");
  }
}

export async function GET() {
  const [forecast, polls] = await Promise.all([fetchForecast(), modelPolls()]);
  return NextResponse.json(runModel(forecast, polls, forecast.updated));
}

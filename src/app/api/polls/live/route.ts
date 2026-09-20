import { NextResponse } from "next/server";

type SourcePoll = {
  poll_id: string;
  firm_name: string;
  field_start: string;
  field_end: string;
  sample_size: number;
  population: string;
  source_url: string;
  topline: { us_dem?: number; us_rep?: number; us_oth?: number };
};
type PollIndex = { meta: { run_date: string; n_polls: number; latest_field_end: string }; polls: SourcePoll[] };

export async function GET() {
  try {
    const response = await fetch("https://vote-scope.com/web_data/us-house/polls/index.json", { next: { revalidate: 900 } });
    if (!response.ok) throw new Error("Poll source unavailable");
    const payload = await response.json() as PollIndex;
    const usable = payload.polls.filter((poll) => Number.isFinite(poll.topline.us_dem) && Number.isFinite(poll.topline.us_rep));
    const weekly = new Map<string, { dem: number; rep: number; count: number }>();
    for (const poll of usable) {
      const date = new Date(`${poll.field_end}T00:00:00Z`);
      const day = date.getUTCDay();
      date.setUTCDate(date.getUTCDate() - day);
      const key = date.toISOString().slice(0, 10);
      const bucket = weekly.get(key) || { dem: 0, rep: 0, count: 0 };
      bucket.dem += poll.topline.us_dem || 0;
      bucket.rep += poll.topline.us_rep || 0;
      bucket.count += 1;
      weekly.set(key, bucket);
    }
    const trend = [...weekly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-26)
      .map(([date, bucket]) => ({ date, dem: bucket.dem / bucket.count, rep: bucket.rep / bucket.count, margin: (bucket.dem - bucket.rep) / bucket.count, polls: bucket.count }));
    const polls = usable.slice(0, 60).map((poll) => ({
      id: poll.poll_id,
      pollster: poll.firm_name,
      race: "Generic ballot",
      state: "US",
      chamber: "Generic" as const,
      dem: poll.topline.us_dem || 0,
      rep: poll.topline.us_rep || 0,
      sample: poll.sample_size || 0,
      population: poll.population?.toLowerCase() === "lv" ? "LV" : poll.population?.toLowerCase() === "rv" ? "RV" : "A",
      endDate: poll.field_end,
      startDate: poll.field_start,
      source: poll.source_url,
    }));
    return NextResponse.json({ meta: payload.meta, polls, trend, source: "Vote-Scope" });
  } catch {
    return NextResponse.json({ error: "Live polling feed unavailable" }, { status: 502 });
  }
}

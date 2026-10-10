import { seedPolls } from "@/data/polls";
import { fetchForecast } from "@/lib/forecast";
import { runModel, type ModelPoll, type ModelResult } from "@/lib/model";
import { isTwoPartyTopline } from "@/lib/mp26";
import { isGenericBallotPoll, type IndexPoll } from "@/lib/poll-index";

async function modelPolls(): Promise<{ polls: ModelPoll[]; source: string }> {
  try {
    const response = await fetch("https://vote-scope.com/web_data/us-house/polls/index.json", { next: { revalidate: 900 } });
    if (!response.ok) throw new Error("Poll feed unavailable");
    const payload = await response.json() as { polls: IndexPoll[] };
    // The House index also carries district polls; only national generic-ballot polls measure the environment.
    const polls = payload.polls.filter((poll) => isGenericBallotPoll(poll) && isTwoPartyTopline(poll.topline.us_dem, poll.topline.us_rep)).map((poll) => ({
      endDate: poll.field_end, dem: poll.topline.us_dem || 0, rep: poll.topline.us_rep || 0, sample: poll.sample_size || 0,
      population: poll.population?.toLowerCase() === "lv" ? "LV" as const : poll.population?.toLowerCase() === "rv" ? "RV" as const : "A" as const,
    }));
    return { polls, source: "Vote-Scope polling index" };
  } catch {
    return { polls: seedPolls.filter((poll) => poll.chamber === "Generic"), source: "Dated local polling aggregate" };
  }
}

// ~22M race draws per run: reuse the result while its inputs (benchmark, polls, date) are unchanged.
let memo: { key: string; result: ModelResult } | null = null;

// The published MP-26 run, shared by /api/model and the server-rendered share images.
export async function getModel(): Promise<ModelResult> {
  const [forecast, polling] = await Promise.all([fetchForecast(), modelPolls()]);
  const today = new Date().toISOString().slice(0, 10);
  const latestPoll = polling.polls.reduce((latest, poll) => poll.endDate > latest ? poll.endDate : latest, "");
  const key = [forecast.updated, forecast.stale ? "stale" : "live", polling.source, polling.polls.length, latestPoll, today].join("|");
  if (memo?.key !== key) memo = { key, result: runModel(forecast, polling.polls, today, polling.source) };
  return memo.result;
}

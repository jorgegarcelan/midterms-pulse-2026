import { NextRequest, NextResponse } from "next/server";
import { stateByCode } from "@/data/geography";
import { isTwoPartyTopline } from "@/lib/mp26";
import { fetchWinnerMarket, HOUSE_CONTROL_SLUG, senateWinnerSlug, type WinnerMarket } from "@/lib/polymarket";

type SourcePoll = { poll_id: string; firm_name: string; field_end: string; sample_size: number; population: string; source_url: string; topline: { us_dem?: number; us_rep?: number }; geography?: { province?: string } };

export type RacePoll = { id: string; pollster: string; date: string; dem: number; rep: number; sample: number; population: "LV" | "RV" | "A"; url: string };
export type RaceMarket = WinnerMarket;
export type RaceSignals = { chamber: "house" | "senate"; pollScope: "race" | "national"; polls: RacePoll[]; marketScope: "race" | "national" | "none"; market: RaceMarket | null };

const population = (value?: string) => value?.toLowerCase() === "lv" ? "LV" as const : value?.toLowerCase() === "rv" ? "RV" as const : "A" as const;

async function polls(chamber: "house" | "senate", state: string): Promise<RacePoll[]> {
  const response = await fetch(`https://vote-scope.com/web_data/us-${chamber}/polls/index.json`, { next: { revalidate: 900 } });
  if (!response.ok) return [];
  const payload = await response.json() as { polls: SourcePoll[] };
  return payload.polls
    .filter((poll) => isTwoPartyTopline(poll.topline.us_dem, poll.topline.us_rep))
    .filter((poll) => chamber === "house" || poll.geography?.province === state)
    .slice(0, chamber === "house" ? 240 : 400)
    .map((poll) => ({ id: poll.poll_id, pollster: poll.firm_name, date: poll.field_end, dem: poll.topline.us_dem!, rep: poll.topline.us_rep!, sample: poll.sample_size || 0, population: population(poll.population), url: poll.source_url }));
}

// Polls and prediction-market prices over time for one race. Senate races have their own polls and
// Polymarket winner markets; House districts fall back to national signals, flagged as such.
export async function GET(request: NextRequest) {
  const chamber = request.nextUrl.searchParams.get("chamber") === "senate" ? "senate" : "house";
  const state = (request.nextUrl.searchParams.get("state") || "").toUpperCase();
  const name = stateByCode.get(state)?.name;
  if (!name) return NextResponse.json({ error: "Unknown state" }, { status: 400 });

  const slug = chamber === "senate" ? senateWinnerSlug(name) : HOUSE_CONTROL_SLUG;
  const [pollList, marketData] = await Promise.all([polls(chamber, state).catch(() => []), fetchWinnerMarket(slug).catch(() => null)]);
  const body: RaceSignals = {
    chamber,
    pollScope: chamber === "senate" ? "race" : "national",
    polls: pollList,
    marketScope: marketData ? (chamber === "senate" ? "race" : "national") : "none",
    market: marketData,
  };
  return NextResponse.json(body);
}

import { NextRequest, NextResponse } from "next/server";
import { stateByCode } from "@/data/geography";
import { isTwoPartyTopline } from "@/lib/mp26";
import { isGenericBallotPoll, pollDistrict, pollPopulation, type IndexPoll } from "@/lib/poll-index";
import { fetchWinnerMarket, HOUSE_CONTROL_SLUG, senateWinnerSlug, type WinnerMarket } from "@/lib/polymarket";

export type RacePoll = { id: string; pollster: string; date: string; dem: number; rep: number; sample: number; population: "LV" | "RV" | "A"; url: string };
export type RaceMarket = WinnerMarket;
export type RaceSignals = { chamber: "house" | "senate"; pollScope: "race" | "national"; polls: RacePoll[]; marketScope: "race" | "national" | "none"; market: RaceMarket | null };

// Senate: the state's polls. House: the district's own polls when the index has any, else the national generic ballot.
async function polls(chamber: "house" | "senate", state: string, code: string): Promise<{ scope: "race" | "national"; list: RacePoll[] }> {
  const response = await fetch(`https://vote-scope.com/web_data/us-${chamber}/polls/index.json`, { next: { revalidate: 900 } });
  if (!response.ok) return { scope: chamber === "senate" ? "race" : "national", list: [] };
  const usable = (await response.json() as { polls: IndexPoll[] }).polls.filter((poll) => isTwoPartyTopline(poll.topline.us_dem, poll.topline.us_rep));
  const toRow = (poll: IndexPoll): RacePoll => ({ id: poll.poll_id, pollster: poll.firm_name, date: poll.field_end, dem: poll.topline.us_dem!, rep: poll.topline.us_rep!, sample: poll.sample_size || 0, population: pollPopulation(poll.population), url: poll.source_url });
  if (chamber === "senate") return { scope: "race", list: usable.filter((poll) => poll.geography?.province === state).slice(0, 400).map(toRow) };
  const district = usable.filter((poll) => pollDistrict(poll) === code);
  if (district.length) return { scope: "race", list: district.map(toRow) };
  return { scope: "national", list: usable.filter(isGenericBallotPoll).slice(0, 240).map(toRow) };
}

// Polls and prediction-market prices over time for one race. Senate races have their own polls and
// Polymarket winner markets; House districts use their own polls when there are any and the national
// House-control market, flagged as such.
export async function GET(request: NextRequest) {
  const chamber = request.nextUrl.searchParams.get("chamber") === "senate" ? "senate" : "house";
  const state = (request.nextUrl.searchParams.get("state") || "").toUpperCase();
  const code = (request.nextUrl.searchParams.get("code") || "").toUpperCase();
  const name = stateByCode.get(state)?.name;
  if (!name) return NextResponse.json({ error: "Unknown state" }, { status: 400 });

  const slug = chamber === "senate" ? senateWinnerSlug(name) : HOUSE_CONTROL_SLUG;
  const [pollData, marketData] = await Promise.all([polls(chamber, state, code).catch(() => ({ scope: "national" as const, list: [] })), fetchWinnerMarket(slug).catch(() => null)]);
  const body: RaceSignals = {
    chamber,
    pollScope: pollData.scope,
    polls: pollData.list,
    marketScope: marketData ? (chamber === "senate" ? "race" : "national") : "none",
    market: marketData,
  };
  return NextResponse.json(body);
}

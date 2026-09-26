import { NextRequest, NextResponse } from "next/server";
import { stateByCode } from "@/data/geography";
import { isTwoPartyTopline } from "@/lib/mp26";

type SourcePoll = { poll_id: string; firm_name: string; field_end: string; sample_size: number; population: string; source_url: string; topline: { us_dem?: number; us_rep?: number }; geography?: { province?: string } };
type GammaMarket = { question: string; outcomePrices?: string; clobTokenIds?: string; closed?: boolean; volumeNum?: number };
type GammaEvent = { id: string; slug: string; title: string; markets: GammaMarket[] };

export type RacePoll = { id: string; pollster: string; date: string; dem: number; rep: number; sample: number; population: "LV" | "RV" | "A"; url: string };
export type RaceMarket = { title: string; url: string; side: "D" | "R"; label: string; probability: number; volume: number; history: { date: string; probability: number }[] };
export type RaceSignals = { chamber: "house" | "senate"; pollScope: "race" | "national"; polls: RacePoll[]; marketScope: "race" | "national" | "none"; market: RaceMarket | null };

const parseList = (value?: string) => { try { return value ? JSON.parse(value) as string[] : []; } catch { return []; } };
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

async function market(slug: string): Promise<RaceMarket | null> {
  const response = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`, { next: { revalidate: 300 } });
  if (!response.ok) return null;
  const event = (await response.json() as GammaEvent[])[0];
  if (!event) return null;
  const democratic = event.markets.find((item) => /Democrat/i.test(item.question) && parseList(item.outcomePrices).length);
  const republican = event.markets.find((item) => /Republican/i.test(item.question) && parseList(item.outcomePrices).length);
  const price = (item?: GammaMarket) => Number(parseList(item?.outcomePrices)[0]) || 0;
  // With a serious third candidate (e.g. an independent in Nebraska) "Democrats win" says little:
  // when the two party markets leave >10% to others, track the Republican side instead.
  const thirdParty = democratic && republican && price(democratic) + price(republican) < .9;
  const chosen = (thirdParty ? republican : democratic) || republican;
  if (!chosen) return null;
  const side = chosen === democratic ? "D" : "R";
  const token = parseList(chosen.clobTokenIds)[0];
  let history: RaceMarket["history"] = [];
  if (token) {
    const prices = await fetch(`https://clob.polymarket.com/prices-history?market=${encodeURIComponent(token)}&interval=max&fidelity=1440`, { next: { revalidate: 900 } });
    if (prices.ok) history = ((await prices.json() as { history?: { t: number; p: number }[] }).history || []).map((point) => ({ date: new Date(point.t * 1000).toISOString().slice(0, 10), probability: point.p }));
  }
  return {
    title: event.title, url: `https://polymarket.com/event/${event.slug}`, side,
    label: side === "D" ? "Democrats win" : "Republicans win",
    probability: price(chosen), volume: chosen.volumeNum || 0, history,
  };
}

// Polls and prediction-market prices over time for one race. Senate races have their own polls and
// Polymarket winner markets; House districts fall back to national signals, flagged as such.
export async function GET(request: NextRequest) {
  const chamber = request.nextUrl.searchParams.get("chamber") === "senate" ? "senate" : "house";
  const state = (request.nextUrl.searchParams.get("state") || "").toUpperCase();
  const name = stateByCode.get(state)?.name;
  if (!name) return NextResponse.json({ error: "Unknown state" }, { status: 400 });

  const slug = chamber === "senate" ? `${name.toLowerCase().replace(/\s+/g, "-")}-senate-election-winner` : "which-party-will-win-the-house-in-2026";
  const [pollList, marketData] = await Promise.all([polls(chamber, state).catch(() => []), market(slug).catch(() => null)]);
  const body: RaceSignals = {
    chamber,
    pollScope: chamber === "senate" ? "race" : "national",
    polls: pollList,
    marketScope: marketData ? (chamber === "senate" ? "race" : "national") : "none",
    market: marketData,
  };
  return NextResponse.json(body);
}

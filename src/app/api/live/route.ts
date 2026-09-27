import { NextResponse } from "next/server";
import { stateByCode } from "@/data/geography";
import { fetchForecast } from "@/lib/forecast";
import { isTwoPartyTopline } from "@/lib/mp26";
import { fetchWinnerMarket, HOUSE_CONTROL_SLUG, SENATE_CONTROL_SLUG, senateWinnerSlug, type WinnerMarket } from "@/lib/polymarket";
import { isElectionHeadline, mentions, ruleTriage } from "@/lib/triage-rules";

export type WireItem = {
  id: string; type: "poll" | "news" | "market"; time: string; dateOnly?: boolean;
  title: string; meta: string; source: string; url: string; value?: string; tone?: "dem" | "rep";
  topic?: string; urgency?: number; states: string[]; districts: string[];
};
export type Mover = WinnerMarket & { state: string; name: string };
export type LiveFeed = {
  updated: string;
  wire: WireItem[];
  movers: Mover[];
  control: { house: WinnerMarket | null; senate: WinnerMarket | null };
  pulse: { date: string; demSeats: number }[];
  counts: { news: number; polls: number; markets: number };
};

const FEEDS = [
  { source: "Politico", url: "https://rss.politico.com/congress.xml" },
  { source: "Politico", url: "https://rss.politico.com/politics-news.xml" },
  { source: "The Hill", url: "https://thehill.com/homenews/campaign/feed/" },
  { source: "The Hill", url: "https://thehill.com/homenews/senate/feed/" },
  { source: "The Hill", url: "https://thehill.com/homenews/house/feed/" },
  { source: "NPR", url: "https://feeds.npr.org/1014/rss.xml" },
  { source: "PBS NewsHour", url: "https://www.pbs.org/newshour/feeds/rss/politics" },
  { source: "CBS News", url: "https://www.cbsnews.com/latest/rss/politics" },
  { source: "ABC News", url: "https://feeds.abcnews.com/abcnews/politicsheadlines" },
  { source: "Roll Call", url: "https://rollcall.com/feed/" },
];
const HEADERS = { "User-Agent": "midterm-pulse-2026 live desk (https://github.com/jorgegarcelan/midterms-pulse-2026)" };

const decode = (value: string) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))).replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
  .replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&apos;|&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();
const tag = (item: string, name: string) => decode(item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] || "");
const signed = (value: number) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;

// Headlines only (title, source, time, link): the wire never republishes article text.
async function news(): Promise<WireItem[]> {
  const results = await Promise.all(FEEDS.map(async (feed) => {
    try {
      const response = await fetch(feed.url, { headers: HEADERS, next: { revalidate: 120 }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) return [];
      const xml = await response.text();
      return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].map(([item]) => {
        const title = tag(item, "title");
        const time = Date.parse(tag(item, "pubDate"));
        return { title, url: tag(item, "link"), time, source: feed.source };
      }).filter((item) => item.title && item.url && Number.isFinite(item.time));
    } catch { return []; }
  }));
  const seen = new Set<string>();
  return results.flat()
    .filter((item) => { const key = item.title.toLowerCase().slice(0, 80); if (seen.has(key)) return false; seen.add(key); return true; })
    .filter((item) => isElectionHeadline(item.title))
    .map((item) => ({ item, triage: ruleTriage(item.title) }))
    .map(({ item, triage }) => ({
      id: `news-${item.url}`, type: "news" as const, time: new Date(item.time).toISOString(), title: item.title, meta: item.source,
      source: item.source, url: item.url, topic: triage.topic, urgency: triage.urgency, ...mentions(item.title),
    }));
}

type SourcePoll = { poll_id: string; firm_name: string; release_date?: string; field_end: string; sample_size: number; population: string; source_url: string; topline: { us_dem?: number; us_rep?: number }; geography?: { province?: string } };

async function polls(): Promise<WireItem[]> {
  const load = async (chamber: "house" | "senate") => {
    const response = await fetch(`https://vote-scope.com/web_data/us-${chamber}/polls/index.json`, { next: { revalidate: 900 } });
    return response.ok ? (await response.json() as { polls: SourcePoll[] }).polls : [];
  };
  const [house, senate] = await Promise.all([load("house"), load("senate")]);
  const item = (poll: SourcePoll, chamber: "house" | "senate"): WireItem => {
    const margin = poll.topline.us_dem! - poll.topline.us_rep!;
    const state = poll.geography?.province;
    const race = chamber === "senate" && state ? `${stateByCode.get(state)?.name || state} Senate` : "Generic ballot";
    const date = poll.release_date || poll.field_end;
    return {
      id: `poll-${poll.poll_id}`, type: "poll", time: `${date}T16:00:00.000Z`, dateOnly: true,
      title: `${poll.firm_name}: ${race}`, meta: `${poll.population?.toUpperCase() || "—"}${poll.sample_size ? ` · n=${poll.sample_size.toLocaleString("en-US")}` : ""} · fielded to ${poll.field_end}`,
      source: "Vote-Scope poll index", url: poll.source_url, value: signed(margin), tone: margin >= 0 ? "dem" : "rep", topic: "polling",
      states: chamber === "senate" && state ? [state] : [], districts: [],
    };
  };
  const clean = (list: SourcePoll[]) => list.filter((poll) => isTwoPartyTopline(poll.topline.us_dem, poll.topline.us_rep)).sort((a, b) => (b.release_date || b.field_end).localeCompare(a.release_date || a.field_end));
  return [...clean(senate).slice(0, 36).map((poll) => item(poll, "senate")), ...clean(house).slice(0, 14).map((poll) => item(poll, "house"))];
}

async function markets() {
  const forecast = await fetchForecast();
  const states = forecast.senateRaces.map((race) => race.state);
  const [house, senate, ...raceMarkets] = await Promise.all([
    fetchWinnerMarket(HOUSE_CONTROL_SLUG).catch(() => null),
    fetchWinnerMarket(SENATE_CONTROL_SLUG).catch(() => null),
    ...states.map((state) => fetchWinnerMarket(senateWinnerSlug(stateByCode.get(state)?.name || state), { history: false }).then((market) => market && { ...market, state, name: stateByCode.get(state)?.name || state }).catch(() => null)),
  ]);
  const movers = (raceMarkets.filter(Boolean) as Mover[]).sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
  // Price history only for the markets that actually moved, to keep the request count down.
  await Promise.all(movers.slice(0, 8).map(async (mover) => {
    const withHistory = await fetchWinnerMarket(senateWinnerSlug(mover.name)).catch(() => null);
    if (withHistory) mover.history = withHistory.history.slice(-45);
  }));
  const wire: WireItem[] = movers.filter((mover) => Math.abs(mover.change24h) >= .03).map((mover) => ({
    id: `market-${mover.state}-${mover.probability.toFixed(3)}`, type: "market", time: new Date().toISOString(),
    title: `${mover.name} Senate: ${mover.label.toLowerCase()} ${(mover.probability * 100).toFixed(0)}%`,
    meta: `${mover.change24h > 0 ? "▲" : "▼"} ${Math.abs(mover.change24h * 100).toFixed(1)} pts in 24h · ${Math.round(mover.volume).toLocaleString("en-US")} traded`,
    source: "Polymarket", url: mover.url, value: `${mover.change24h > 0 ? "+" : "−"}${Math.abs(mover.change24h * 100).toFixed(1)}`,
    tone: (mover.side === "D") === mover.change24h > 0 ? "dem" : "rep", topic: "markets", urgency: Math.min(.95, .5 + Math.abs(mover.change24h) * 5),
    states: [mover.state], districts: [],
  }));
  return { house, senate, movers, wire };
}

async function pulse() {
  const response = await fetch("https://vote-scope.com/web_data/us-house/latest.json", { next: { revalidate: 900 } });
  if (!response.ok) return [];
  // previous_runs carry mean seats, so the current run uses seats_mean too.
  const payload = await response.json() as { meta: { run_date: string }; parties: { party: string; seats_mean?: number }[]; previous_runs?: { run_date: string; seats: { us_dem: number } }[] };
  const current = payload.parties.find((party) => party.party === "us_dem")?.seats_mean;
  const runs = (payload.previous_runs || []).map((run) => ({ date: run.run_date, demSeats: run.seats.us_dem }));
  if (current !== undefined && !runs.some((run) => run.date === payload.meta.run_date)) runs.unshift({ date: payload.meta.run_date, demSeats: current });
  return runs.sort((a, b) => a.date.localeCompare(b.date));
}

// Everything moving right now: headlines, new polls, market swings and the benchmark's recent runs.
export async function GET() {
  const [newsItems, pollItems, marketData, pulseRuns] = await Promise.all([news().catch(() => []), polls().catch(() => []), markets().catch(() => ({ house: null, senate: null, movers: [], wire: [] })), pulse().catch(() => [])]);
  const wire = [...newsItems, ...pollItems, ...marketData.wire].sort((a, b) => b.time.localeCompare(a.time) || (a.type === "market" ? -1 : 1)).slice(0, 120);
  const body: LiveFeed = {
    updated: new Date().toISOString(),
    wire,
    movers: marketData.movers.slice(0, 8),
    control: { house: marketData.house, senate: marketData.senate },
    pulse: pulseRuns,
    counts: { news: newsItems.length, polls: pollItems.length, markets: marketData.wire.length },
  };
  return NextResponse.json(body);
}

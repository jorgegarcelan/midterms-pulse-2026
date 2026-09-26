type GammaMarket = { question: string; outcomePrices?: string; clobTokenIds?: string; volumeNum?: number; oneDayPriceChange?: number; oneWeekPriceChange?: number };
type GammaEvent = { id: string; slug: string; title: string; markets: GammaMarket[] };

export type WinnerMarket = {
  title: string; url: string; side: "D" | "R"; label: string; probability: number; change24h: number; change7d: number; volume: number;
  history: { date: string; probability: number }[];
};

const parseList = (value?: string) => { try { return value ? JSON.parse(value) as string[] : []; } catch { return []; } };
const price = (market?: GammaMarket) => Number(parseList(market?.outcomePrices)[0]) || 0;

export const senateWinnerSlug = (stateName: string) => `${stateName.toLowerCase().replace(/\s+/g, "-")}-senate-election-winner`;
export const HOUSE_CONTROL_SLUG = "which-party-will-win-the-house-in-2026";
export const SENATE_CONTROL_SLUG = "which-party-will-win-the-senate-in-2026";

async function priceHistory(market: GammaMarket) {
  const token = parseList(market.clobTokenIds)[0];
  if (!token) return [];
  const response = await fetch(`https://clob.polymarket.com/prices-history?market=${encodeURIComponent(token)}&interval=max&fidelity=1440`, { next: { revalidate: 900 } });
  if (!response.ok) return [];
  return ((await response.json() as { history?: { t: number; p: number }[] }).history || []).map((point) => ({ date: new Date(point.t * 1000).toISOString().slice(0, 10), probability: point.p }));
}

/*
  The party-winner market of a Polymarket event. Tracks the Democratic side, except when a serious
  third candidate is running (the two party markets leave >10% to others, e.g. Nebraska): then the
  Republican side is the meaningful one.
*/
export async function fetchWinnerMarket(slug: string, { history = true } = {}): Promise<WinnerMarket | null> {
  const response = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`, { next: { revalidate: 300 } });
  if (!response.ok) return null;
  const event = (await response.json() as GammaEvent[])[0];
  if (!event) return null;
  const democratic = event.markets.find((item) => /Democrat/i.test(item.question) && parseList(item.outcomePrices).length);
  const republican = event.markets.find((item) => /Republican/i.test(item.question) && parseList(item.outcomePrices).length);
  const thirdParty = democratic && republican && price(democratic) + price(republican) < .9;
  const chosen = (thirdParty ? republican : democratic) || republican;
  if (!chosen) return null;
  const side = chosen === democratic ? "D" : "R";
  return {
    title: event.title, url: `https://polymarket.com/event/${event.slug}`, side, label: side === "D" ? "Democrats win" : "Republicans win",
    probability: price(chosen), change24h: chosen.oneDayPriceChange || 0, change7d: chosen.oneWeekPriceChange || 0, volume: chosen.volumeNum || 0,
    history: history ? await priceHistory(chosen) : [],
  };
}

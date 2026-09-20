import { NextResponse } from "next/server";

type GammaMarket = {
  id: string;
  question: string;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string | string[];
  volumeNum?: number;
  liquidityNum?: number;
  oneDayPriceChange?: number;
};
type GammaEvent = { id: string; title: string; slug: string; volume24hr?: number; liquidity?: number; markets: GammaMarket[] };

function parseList(value?: string | string[]) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try { return JSON.parse(value) as string[]; } catch { return []; }
}

function formatEvent(event: GammaEvent) {
  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    url: `https://polymarket.com/event/${event.slug}`,
    volume24h: Number(event.volume24hr || 0),
    liquidity: Number(event.liquidity || 0),
    markets: event.markets
      .filter((market) => parseList(market.outcomePrices).length > 0)
      .map((market) => ({
        id: market.id,
        question: market.question,
        outcomes: parseList(market.outcomes),
        prices: parseList(market.outcomePrices).map(Number),
        volume: Number(market.volumeNum || 0),
        liquidity: Number(market.liquidityNum || 0),
        change24h: Number(market.oneDayPriceChange || 0),
        yesToken: parseList(market.clobTokenIds)[0] || null,
      })),
  };
}

async function getEvent(id: string) {
  const response = await fetch(`https://gamma-api.polymarket.com/events?id=${id}`, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error("Market source unavailable");
  const payload = await response.json() as GammaEvent[];
  if (!payload[0]) throw new Error("Market not found");
  return formatEvent(payload[0]);
}

async function getHistory(token: string | null) {
  if (!token) return [];
  const response = await fetch(`https://clob.polymarket.com/prices-history?market=${encodeURIComponent(token)}&interval=max&fidelity=1440`, { next: { revalidate: 900 } });
  if (!response.ok) return [];
  const payload = await response.json() as { history?: { t: number; p: number }[] };
  return (payload.history || []).slice(-180).map((point) => ({ date: new Date(point.t * 1000).toISOString().slice(0, 10), probability: point.p }));
}

export async function GET() {
  try {
    const [senate, house, balance] = await Promise.all([getEvent("32224"), getEvent("32225"), getEvent("32228")]);
    const senateDem = senate.markets.find((market) => /Democratic Party control/i.test(market.question));
    const houseDem = house.markets.find((market) => /Democratic Party control/i.test(market.question));
    const [senateHistory, houseHistory] = await Promise.all([getHistory(senateDem?.yesToken || null), getHistory(houseDem?.yesToken || null)]);
    return NextResponse.json({
      updated: new Date().toISOString(),
      events: { senate, house, balance },
      history: { senateDem: senateHistory, houseDem: houseHistory },
      source: "Polymarket Gamma + CLOB APIs",
    });
  } catch {
    return NextResponse.json({ error: "Prediction markets unavailable" }, { status: 502 });
  }
}

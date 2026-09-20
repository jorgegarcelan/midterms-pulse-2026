"use client";

import { useEffect, useMemo, useState } from "react";

type Market = {
  id: string;
  question: string;
  outcomes: string[];
  prices: number[];
  volume: number;
  liquidity: number;
  change24h: number;
};

type MarketEvent = {
  id: string;
  title: string;
  url: string;
  volume24h: number;
  liquidity: number;
  markets: Market[];
};

type HistoryPoint = { date: string; probability: number };
type MarketsPayload = {
  updated: string;
  events: { senate: MarketEvent; house: MarketEvent; balance: MarketEvent };
  history: { senateDem: HistoryPoint[]; houseDem: HistoryPoint[] };
  source: string;
};

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function probability(market?: Market) {
  return (market?.prices[0] || 0) * 100;
}

function democraticMarket(event?: MarketEvent) {
  return event?.markets.find((market) => /Democratic Party control/i.test(market.question));
}

function MarketTrend({ house, senate }: { house: HistoryPoint[]; senate: HistoryPoint[] }) {
  const series = useMemo(() => {
    const all = [...house, ...senate];
    if (!all.length) return null;
    const dates = all.map((point) => Date.parse(point.date));
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const x = (date: string) => maxDate === minDate ? 0 : ((Date.parse(date) - minDate) / (maxDate - minDate)) * 760;
    const y = (value: number) => 205 - value * 170;
    const points = (values: HistoryPoint[]) => values.map((point) => `${x(point.date).toFixed(1)},${y(point.probability).toFixed(1)}`).join(" ");
    return { house: points(house), senate: points(senate), start: new Date(minDate), end: new Date(maxDate) };
  }, [house, senate]);

  if (!series) return <div className="market-empty">Price history is temporarily unavailable.</div>;
  const date = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
  return <div className="market-chart">
    <svg viewBox="0 0 760 225" role="img" aria-label="Historical Democratic control probabilities for the House and Senate">
      {[.25, .5, .75, 1].map((value) => <g key={value}><line x1="0" x2="760" y1={205 - value * 170} y2={205 - value * 170} /><text x="5" y={198 - value * 170}>{value * 100}%</text></g>)}
      <polyline className="market-line senate" points={series.senate} />
      <polyline className="market-line house" points={series.house} />
    </svg>
    <div className="market-axis"><span>{date.format(series.start)}</span><span>{date.format(series.end)}</span></div>
  </div>;
}

function OutcomeRow({ market, event }: { market: Market; event: MarketEvent }) {
  const value = probability(market);
  return <a className="market-row" href={event.url} target="_blank" rel="noreferrer">
    <span><strong>{market.question}</strong><small>{currency(market.volume)} traded · {currency(market.liquidity)} liquidity</small></span>
    <i><b style={{ width: `${value}%` }} /></i>
    <strong>{value.toFixed(1)}%</strong>
    <em className={market.change24h >= 0 ? "dem-text" : "rep-text"}>{market.change24h >= 0 ? "+" : ""}{(market.change24h * 100).toFixed(1)} pp</em>
  </a>;
}

export function MarketsDashboard() {
  const [data, setData] = useState<MarketsPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/markets").then((response) => {
      if (!response.ok) throw new Error("Market feed unavailable");
      return response.json() as Promise<MarketsPayload>;
    }).then((payload) => { if (!cancelled) setData(payload); }).catch(() => { if (!cancelled) setError("Live prediction-market data could not be loaded."); });
    return () => { cancelled = true; };
  }, []);

  const houseDem = democraticMarket(data?.events.house);
  const senateDem = democraticMarket(data?.events.senate);
  const balance = data?.events.balance.markets || [];
  const topBalance = [...balance].sort((a, b) => probability(b) - probability(a))[0];
  const totalVolume24h = data ? data.events.house.volume24h + data.events.senate.volume24h + data.events.balance.volume24h : 0;

  return <>
    <section className="page-intro markets-intro">
      <div><p className="eyebrow">PREDICTION MARKETS</p><h1>What traders price into 2026.</h1><p>Live market-implied probabilities for congressional control, tracked separately from polling averages and statistical forecasts.</p></div>
      <div className="market-source"><i /><span>Polymarket feed</span><strong>{data ? `Updated ${new Date(data.updated).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Connecting…"}</strong></div>
    </section>

    {error ? <section className="panel data-error">{error} The rest of the election desk remains available.</section> : !data ? <section className="panel data-loading">Loading live House, Senate and balance-of-power markets…</section> : <>
      <section className="market-kpis">
        <article><span>Democratic House control</span><strong className="dem-text">{probability(houseDem).toFixed(1)}%</strong><small>{houseDem ? `${currency(houseDem.volume)} lifetime volume` : "No active market"}</small></article>
        <article><span>Democratic Senate control</span><strong className="dem-text">{probability(senateDem).toFixed(1)}%</strong><small>{senateDem ? `${currency(senateDem.volume)} lifetime volume` : "No active market"}</small></article>
        <article><span>Most likely balance</span><strong>{probability(topBalance).toFixed(1)}%</strong><small>{topBalance?.question || "No active market"}</small></article>
        <article><span>24-hour event volume</span><strong>{currency(totalVolume24h)}</strong><small>Across tracked 2026 markets</small></article>
      </section>

      <section className="markets-grid">
        <article className="panel market-trend-panel">
          <div className="panel-head"><div><p className="eyebrow">PRICE EVOLUTION</p><h2>Democratic control probability</h2></div><div className="market-legend"><span className="house">House</span><span className="senate">Senate</span></div></div>
          <MarketTrend house={data.history.houseDem} senate={data.history.senateDem} />
          <p className="chart-note">Daily closing prices from Polymarket&apos;s CLOB. A market price is a traded belief, not a poll or a model forecast.</p>
        </article>
        <aside className="panel market-note">
          <p className="eyebrow">HOW TO READ IT</p><h2>Three signals, three meanings.</h2>
          <dl><div><dt>Poll</dt><dd>A sample of voters at a point in time.</dd></div><div><dt>Forecast</dt><dd>A model combining polls, fundamentals and uncertainty.</dd></div><div><dt>Market</dt><dd>The price traders pay for a future outcome.</dd></div></dl>
          <p>Market probabilities can move on news, liquidity and trader positioning. They should be compared with polls—not blended into them without a documented model.</p>
        </aside>
      </section>

      <section className="panel market-board">
        <div className="panel-head"><div><p className="eyebrow">BALANCE OF POWER</p><h2>All active outcomes</h2></div><a className="panel-tag" href={data.events.balance.url} target="_blank" rel="noreferrer">Open market ↗</a></div>
        <div className="market-table-head"><span>Outcome</span><span>Probability</span><span>Price</span><span>24h</span></div>
        <div>{balance.sort((a, b) => probability(b) - probability(a)).map((market) => <OutcomeRow key={market.id} market={market} event={data.events.balance} />)}</div>
      </section>
    </>}
  </>;
}

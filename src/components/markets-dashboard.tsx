"use client";

import { useEffect, useMemo, useState } from "react";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";

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

function currency(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function probability(market?: Market) {
  return (market?.prices[0] || 0) * 100;
}

function democraticMarket(event?: MarketEvent) {
  return event?.markets.find((market) => /Democratic Party control/i.test(market.question));
}

function MarketTrend({ house, senate }: { house: HistoryPoint[]; senate: HistoryPoint[] }) {
  const t = useT();
  const locale = useIntlLocale();
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

  if (!series) return <div className="market-empty">{t("Price history is temporarily unavailable.")}</div>;
  const date = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
  return <div className="market-chart">
    <svg viewBox="0 0 760 225" role="img" aria-label={t("Historical Democratic control probabilities for the House and Senate")}>
      {[.25, .5, .75, 1].map((value) => <g key={value}><line x1="0" x2="760" y1={205 - value * 170} y2={205 - value * 170} /><text x="5" y={198 - value * 170}>{value * 100}%</text></g>)}
      <polyline className="market-line senate" points={series.senate} />
      <polyline className="market-line house" points={series.house} />
    </svg>
    <div className="market-axis"><span>{date.format(series.start)}</span><span>{date.format(series.end)}</span></div>
  </div>;
}

function OutcomeRow({ market, event }: { market: Market; event: MarketEvent }) {
  const t = useT();
  const locale = useIntlLocale();
  const value = probability(market);
  return <a className="market-row" href={event.url} target="_blank" rel="noreferrer">
    <span><strong>{market.question}</strong><small>{t("{volume} traded · {liquidity} liquidity", { volume: currency(market.volume, locale), liquidity: currency(market.liquidity, locale) })}</small></span>
    <i><b style={{ width: `${value}%` }} /></i>
    <strong>{value.toFixed(1)}%</strong>
    <em className={market.change24h >= 0 ? "dem-text" : "rep-text"}>{market.change24h >= 0 ? "+" : ""}{(market.change24h * 100).toFixed(1)} pp</em>
  </a>;
}

export function MarketsDashboard() {
  const t = useT();
  const locale = useIntlLocale();
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
      <div><p className="eyebrow">{t("2026 MARKET DATA")}</p><h1>{t("Prediction markets")}</h1><p>{t("Market-implied probabilities for congressional control, shown separately from polls and statistical forecasts.")}</p></div>
      <div className="market-source"><i /><span>{t("Polymarket feed")}</span><strong>{data ? t("Updated {time}", { time: new Date(data.updated).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }) }) : t("Connecting…")}</strong></div>
    </section>

    {error ? <section className="panel data-error">{t(error)} {t("The rest of the election desk remains available.")}</section> : !data ? <section className="panel data-loading">{t("Loading live House, Senate and balance-of-power markets…")}</section> : <>
      <section className="market-kpis">
        <article><span>{t("Democratic House control")}</span><strong className="dem-text">{probability(houseDem).toFixed(1)}%</strong><small>{houseDem ? t("{volume} lifetime volume", { volume: currency(houseDem.volume, locale) }) : t("No active market")}</small></article>
        <article><span>{t("Democratic Senate control")}</span><strong className="dem-text">{probability(senateDem).toFixed(1)}%</strong><small>{senateDem ? t("{volume} lifetime volume", { volume: currency(senateDem.volume, locale) }) : t("No active market")}</small></article>
        <article><span>{t("Most likely balance")}</span><strong>{probability(topBalance).toFixed(1)}%</strong><small>{topBalance?.question || t("No active market")}</small></article>
        <article><span>{t("24-hour event volume")}</span><strong>{currency(totalVolume24h, locale)}</strong><small>{t("Across tracked 2026 markets")}</small></article>
      </section>

      <section className="markets-grid">
        <article className="panel market-trend-panel">
          <div className="panel-head"><div><p className="eyebrow">{t("PRICE EVOLUTION")}</p><h2>{t("Democratic control probability")}</h2></div><div className="market-legend"><span className="house">{t("House")}</span><span className="senate">{t("Senate")}</span></div></div>
          <MarketTrend house={data.history.houseDem} senate={data.history.senateDem} />
          <p className="chart-note">{t("Daily closing prices from Polymarket's CLOB. A market price is a traded belief, not a poll or a model forecast.")}</p>
        </article>
        <aside className="panel market-note">
          <p className="eyebrow">{t("DEFINITIONS")}</p><h2>{t("Poll, forecast and market")}</h2>
          <dl><div><dt>{t("Poll")}</dt><dd>{t("A sample of voters at a point in time.")}</dd></div><div><dt>{t("Forecast")}</dt><dd>{t("A model combining polls, fundamentals and uncertainty.")}</dd></div><div><dt>{t("Market")}</dt><dd>{t("The price traders pay for a future outcome.")}</dd></div></dl>
          <p>{t("Market probabilities can move on news, liquidity and trader positioning. They should be compared with polls—not blended into them without a documented model.")}</p>
        </aside>
      </section>

      <section className="panel market-board">
        <div className="panel-head"><div><p className="eyebrow">{t("BALANCE OF POWER")}</p><h2>{t("All active outcomes")}</h2></div><a className="panel-tag" href={data.events.balance.url} target="_blank" rel="noreferrer">{t("Open market ↗")}</a></div>
        <div className="market-table-head"><span>{t("Outcome")}</span><span>{t("Probability")}</span><span>{t("Price")}</span><span>{t("24h")}</span></div>
        <div>{balance.sort((a, b) => probability(b) - probability(a)).map((market) => <OutcomeRow key={market.id} market={market} event={data.events.balance} />)}</div>
      </section>
    </>}
  </>;
}

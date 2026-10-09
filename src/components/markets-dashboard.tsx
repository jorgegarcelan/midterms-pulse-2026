"use client";

import { useEffect, useMemo, useState } from "react";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { useInView } from "@/components/explainer/use-in-view";
import { ChartTooltip } from "@/components/motion/chart-tooltip";
import { CountUp } from "@/components/motion/count-up";
import { nearestIndex, useChartScrub } from "@/components/motion/chart-scrub";

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

type SeriesKey = "house" | "senate";
const MW = 760;
const MH = 240;
const MP = { left: 40, right: 52, top: 14, bottom: 12 };
const SERIES: { key: SeriesKey; label: string; color: string }[] = [{ key: "house", label: "House", color: "#9fb8ff" }, { key: "senate", label: "Senate", color: "#c4a6ff" }];

// Both chambers on one time axis: lines draw in on scroll, the legend toggles a chamber, and one
// crosshair (pointer, touch or arrow keys) reads both prices on the same day.
function MarketTrend({ house, senate, hidden }: { house: HistoryPoint[]; senate: HistoryPoint[]; hidden: Set<SeriesKey> }) {
  const t = useT();
  const locale = useIntlLocale();
  const [ref, inView] = useInView<HTMLDivElement>();
  const chart = useMemo(() => {
    const dates = [...new Set([...house, ...senate].map((point) => point.date))].sort();
    if (!dates.length) return null;
    const start = Date.parse(dates[0]);
    const end = Date.parse(dates.at(-1)!);
    const x = (date: string) => MP.left + (end === start ? 0 : (Date.parse(date) - start) / (end - start)) * (MW - MP.left - MP.right);
    const y = (value: number) => MP.top + (1 - value) * (MH - MP.top - MP.bottom);
    const path = (values: HistoryPoint[]) => values.map((point, index) => `${index ? "L" : "M"}${x(point.date).toFixed(1)},${y(point.probability).toFixed(1)}`).join(" ");
    // Each series carries its last known price forward so the crosshair always reads both chambers.
    const lookup = (values: HistoryPoint[]) => {
      const byDate = new Map(values.map((point) => [point.date, point.probability]));
      let last: number | null = null;
      return dates.map((date) => { last = byDate.get(date) ?? last; return last; });
    };
    return { dates, xs: dates.map(x), y, paths: { house: path(house), senate: path(senate) }, values: { house: lookup(house), senate: lookup(senate) }, last: { house: house.at(-1), senate: senate.at(-1) }, x, start: new Date(start), end: new Date(end) };
  }, [house, senate]);
  const scrub = useChartScrub({ count: chart?.dates.length ?? 0, indexAt: (ratio) => chart ? nearestIndex(chart.xs, ratio * MW) : 0 });

  if (!chart) return <div className="market-empty">{t("Price history is temporarily unavailable.")}</div>;
  const date = new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" });
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const active = scrub.active;
  const visible = SERIES.filter((series) => !hidden.has(series.key));
  const anchor = active === null ? null : visible.map((series) => chart.values[series.key][active]).find((value) => value !== null) ?? .5;

  return <div ref={ref} className="market-chart mpa-market-chart" data-in={inView ? "true" : undefined}>
    <div className="mpa-chart-frame">
      <svg viewBox={`0 0 ${MW} ${MH}`} role="img" aria-label={t("Historical Democratic control probabilities for the House and Senate")} {...scrub.bind}>
        {[0, .25, .5, .75, 1].map((value) => <g key={value} className="mpa-grid"><line x1={MP.left} x2={MW - MP.right} y1={chart.y(value)} y2={chart.y(value)} className={value === .5 ? "zero" : undefined} /><text x={MP.left - 8} y={chart.y(value) + 4}>{value * 100}%</text></g>)}
        {SERIES.map((series) => <g key={series.key} className={`mpa-series ${series.key}`} data-off={hidden.has(series.key) ? "true" : undefined}>
          <path className="mpa-line" d={chart.paths[series.key]} pathLength={1} />
          {chart.last[series.key] && <g className="mpa-endpoint" transform={`translate(${chart.x(chart.last[series.key]!.date).toFixed(1)} ${chart.y(chart.last[series.key]!.probability).toFixed(1)})`}><circle r="4" /><text x="9" y="4">{(chart.last[series.key]!.probability * 100).toFixed(0)}%</text></g>}
        </g>)}
        {active !== null && <g className="mpa-cross">
          <line x1={chart.xs[active]} x2={chart.xs[active]} y1={MP.top} y2={MH - MP.bottom} />
          {visible.map((series) => chart.values[series.key][active] !== null && <circle key={series.key} className={series.key === "house" ? "dem" : "senate"} cx={chart.xs[active]} cy={chart.y(chart.values[series.key][active]!)} r="5" />)}
        </g>}
        <rect className="hover-capture" x={MP.left} y={0} width={MW - MP.left - MP.right} height={MH} />
      </svg>
      {active !== null && anchor !== null && <ChartTooltip x={chart.xs[active] / MW * 100} y={chart.y(anchor) / MH * 100} title={day.format(new Date(`${chart.dates[active]}T12:00:00Z`))} rows={visible.map((series) => {
        const value = chart.values[series.key][active];
        return { label: t(series.label), value: value === null ? "—" : `${(value * 100).toFixed(1)}%`, tone: series.key };
      })} note={t("Price of a Democratic-control contract")} />}
    </div>
    <div className="market-axis"><span>{date.format(chart.start)}</span><span>{date.format(chart.end)}</span></div>
  </div>;
}

function OutcomeRow({ market, event, rank }: { market: Market; event: MarketEvent; rank: number }) {
  const t = useT();
  const locale = useIntlLocale();
  const value = probability(market);
  return <a className="market-row mpa-market-row" href={event.url} target="_blank" rel="noreferrer" style={{ "--p": value / 100, "--k": rank } as React.CSSProperties} data-lead={rank === 0 ? "true" : undefined}>
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
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());
  const toggle = (key: SeriesKey) => setHidden((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    // Keep at least one chamber on screen.
    else if (next.size < SERIES.length - 1) next.add(key);
    return next;
  });

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
        <article><span>{t("Democratic House control")}</span><strong className="dem-text"><CountUp value={probability(houseDem)} decimals={1} />%</strong><small>{houseDem ? t("{volume} lifetime volume", { volume: currency(houseDem.volume, locale) }) : t("No active market")}</small></article>
        <article><span>{t("Democratic Senate control")}</span><strong className="dem-text"><CountUp value={probability(senateDem)} decimals={1} />%</strong><small>{senateDem ? t("{volume} lifetime volume", { volume: currency(senateDem.volume, locale) }) : t("No active market")}</small></article>
        <article><span>{t("Most likely balance")}</span><strong><CountUp value={probability(topBalance)} decimals={1} />%</strong><small>{topBalance?.question || t("No active market")}</small></article>
        <article><span>{t("24-hour event volume")}</span><strong>{currency(totalVolume24h, locale)}</strong><small>{t("Across tracked 2026 markets")}</small></article>
      </section>

      <section className="markets-grid">
        <article className="panel market-trend-panel">
          <div className="panel-head"><div><p className="eyebrow">{t("PRICE EVOLUTION")}</p><h2>{t("Democratic control probability")}</h2></div><div className="market-legend mpa-legend-toggles" role="group" aria-label={t("Show or hide a chamber")}>{SERIES.map((series) => <button key={series.key} type="button" className={series.key} aria-pressed={!hidden.has(series.key)} onClick={() => toggle(series.key)}>{t(series.label)}</button>)}</div></div>
          <MarketTrend house={data.history.houseDem} senate={data.history.senateDem} hidden={hidden} />
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
        <div>{balance.sort((a, b) => probability(b) - probability(a)).map((market, rank) => <OutcomeRow key={market.id} market={market} event={data.events.balance} rank={rank} />)}</div>
      </section>
    </>}
  </>;
}

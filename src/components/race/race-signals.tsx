"use client";

import { useEffect, useMemo, useState } from "react";
import type { RaceSignals as RaceSignalsFeed } from "@/app/api/race-signals/route";
import { SignalChart } from "@/components/charts/signal-chart";
import { stateByCode } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { pollWeight } from "@/lib/mp26";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";

const signed = (value: number) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;
const DAY = 86_400_000;

// Trend = the model's own poll weighting, evaluated every few days over the polls released so far.
function weightedTrend(polls: RaceSignalsFeed["polls"]) {
  if (polls.length < 2) return [];
  const sorted = [...polls].sort((a, b) => a.date.localeCompare(b.date));
  const start = Date.parse(`${sorted[0].date}T00:00:00Z`);
  const end = Date.parse(`${sorted.at(-1)!.date}T00:00:00Z`);
  const step = Math.max(DAY, Math.round((end - start) / 90 / DAY) * DAY);
  const trend: { date: string; value: number }[] = [];
  for (let time = start; time <= end + 1; time += step) {
    const date = new Date(time).toISOString().slice(0, 10);
    let numerator = 0;
    let denominator = 0;
    for (const poll of sorted) {
      if (poll.date > date) break;
      const { weight } = pollWeight({ endDate: poll.date, sample: poll.sample, population: poll.population }, date);
      numerator += (poll.dem - poll.rep) * weight;
      denominator += weight;
    }
    if (denominator) trend.push({ date, value: numerator / denominator });
  }
  return trend;
}

// Polls and prediction-market prices over time for one race.
export function RaceSignals({ race, houseMajority }: { race: ForecastRace; houseMajority?: number }) {
  const t = useT();
  const intl = useIntlLocale();
  const [feed, setFeed] = useState<RaceSignalsFeed | null>(null);
  const [failed, setFailed] = useState(false);
  const stateName = t(stateByCode.get(race.state)?.name || race.state);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/race-signals?chamber=${race.chamber}&state=${race.state}`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("signals"); return response.json() as Promise<RaceSignalsFeed>; })
      .then(setFeed).catch((error) => { if (error.name !== "AbortError") setFailed(true); });
    return () => controller.abort();
  }, [race.chamber, race.state]);

  const trend = useMemo(() => weightedTrend(feed?.polls || []), [feed]);
  const national = feed?.pollScope === "national";
  const pollDots = (feed?.polls || []).map((poll) => ({ date: poll.date, value: poll.dem - poll.rep, tone: poll.dem >= poll.rep ? "dem" as const : "rep" as const, title: `${poll.pollster} · ${poll.date} · ${signed(poll.dem - poll.rep)} · ${poll.population}${poll.sample ? ` n=${poll.sample}` : ""}` }));
  // Scale to the 95th percentile so a single outlier poll cannot flatten the chart (outliers sit on the edge).
  const spread = pollDots.map((dot) => Math.abs(dot.value)).sort((a, b) => a - b);
  const marginExtent = Math.max(10, spread[Math.floor(spread.length * .95)] || 0, Math.abs(race.signedMargin));
  const limit = Math.min(40, Math.ceil(marginExtent / 5) * 5);
  const latest = [...(feed?.polls || [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const market = feed?.market;
  const modelSide = market?.side === "R" ? 100 - (race.leader === "D" ? race.winProbability : 100 - race.winProbability) : race.leader === "D" ? race.winProbability : 100 - race.winProbability;
  const marketReference = feed?.marketScope === "national" ? houseMajority : modelSide;

  return (
    <div className="race-signals">
      <article className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">{national ? t("National polls") : t("Polls in {state}", { state: stateName })}</p><h2>{national ? t("Generic ballot over time") : t("Senate polling over time")}</h2></div>
          <span className="panel-tag">{feed ? t("{count} polls", { count: feed.polls.length }) : "…"}</span>
        </div>
        {failed ? <p className="table-empty">{t("Polling data could not be loaded.")}</p>
          : !feed ? <div className="chart-loading">{t("Loading polls…")}</div>
            : feed.polls.length === 0 ? <p className="table-empty">{t("No public two-party polls of this race in the Vote-Scope index yet.")}</p>
              : <>
                <SignalChart
                  dots={pollDots}
                  line={trend}
                  domain={[-limit, limit]}
                  ticks={[-limit, -limit / 2, 0, limit / 2, limit]}
                  baseline={0}
                  format={(value) => value === 0 ? t("EVEN") : `${value >= 0 ? "D" : "R"}+${Number.isInteger(value) ? Math.abs(value) : Math.abs(value).toFixed(1)}`}
                  reference={national ? undefined : { value: race.signedMargin, label: t("2026 model {margin}", { margin: signed(race.signedMargin) }) }}
                  ariaLabel={national ? t("Generic ballot polls over time") : t("{state} Senate polls over time", { state: stateName })}
                />
                <ul className="latest-polls">
                  {latest.map((poll) => <li key={poll.id}><a href={poll.url} target="_blank" rel="noreferrer"><span>{poll.pollster}<small>{poll.date} · {poll.population}{poll.sample ? ` · n=${poll.sample.toLocaleString(intl)}` : ""}</small></span><b className={poll.dem >= poll.rep ? "dem-text" : "rep-text"}>{signed(poll.dem - poll.rep)}</b></a></li>)}
                </ul>
              </>}
        <p className="chart-note">{national ? `${t("The Vote-Scope index has no district-level polls; the national generic ballot is shown instead.")} ` : ""}{t("Dots are individual polls (D minus R); the line applies the model's weighting (30-day half-life, sample size, likely voters) to the polls released by each date.")}</p>
      </article>

      <article className="panel">
        <div className="panel-head">
          <div><p className="eyebrow">{t("Prediction market")}</p><h2>{feed?.marketScope === "national" ? t("House control, priced by traders") : t("{state} Senate, priced by traders", { state: stateName })}</h2></div>
          {market && <a className="panel-tag" href={market.url} target="_blank" rel="noreferrer">Polymarket ↗</a>}
        </div>
        {failed ? <p className="table-empty">{t("Market data could not be loaded.")}</p>
          : !feed ? <div className="chart-loading">{t("Loading market…")}</div>
            : !market ? <p className="table-empty">{t("No Polymarket winner market is listed for this race.")}</p>
              : <>
                <div className="market-now">
                  <strong className={market.side === "D" ? "dem-text" : "rep-text"}>{(market.probability * 100).toFixed(1)}%</strong>
                  <span>{t(`${market.label}${feed.marketScope === "national" ? " the House" : ""} · now`)}</span>
                  {marketReference !== undefined && <em>{t("Model {value}%", { value: Math.round(marketReference) })}</em>}
                </div>
                <SignalChart
                  tone="market"
                  line={market.history.map((point) => ({ date: point.date, value: point.probability * 100 }))}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  baseline={0}
                  format={(value) => `${Math.round(value)}%`}
                  reference={marketReference !== undefined ? { value: marketReference, label: t("Model {value}%", { value: Math.round(marketReference) }) } : undefined}
                  ariaLabel={t("{title}: {label} probability over time", { title: market.title, label: t(market.label) })}
                />
              </>}
        <p className="chart-note">{feed?.marketScope === "national" ? `${t("Polymarket lists no market for this district; the national House-control market is shown.")} ` : ""}{t("Daily closing prices from Polymarket. A price is a traded belief, not a poll or a forecast.")}{market?.side === "R" ? ` ${t("A strong third candidate is running, so the Republican side is tracked.")}` : ""}</p>
      </article>
    </div>
  );
}

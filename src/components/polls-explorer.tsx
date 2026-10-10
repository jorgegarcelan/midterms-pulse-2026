"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useElectionContext } from "@/components/election-context";
import { stateByCode } from "@/data/geography";
import { pollMapMargins, seedPolls, type Poll } from "@/data/polls";
import { StateTileMap } from "@/components/state-tile-map";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { useInView } from "@/components/explainer/use-in-view";
import { ChartTooltip } from "@/components/motion/chart-tooltip";
import { CountUp } from "@/components/motion/count-up";
import { nearestIndex, useChartScrub } from "@/components/motion/chart-scrub";

type TrendPoint = { date: string; dem: number; rep: number; margin: number; polls: number };
type PollFeed = { meta: { run_date: string; n_polls: number; n_generic?: number; latest_field_end: string }; polls: Poll[]; trend: TrendPoint[]; source: string };

const TW = 620;
const TH = 230;
const TP = { left: 38, right: 14, top: 16, bottom: 28 };

function niceStep(span: number) {
  return span > 16 ? 5 : span > 8 ? 2 : 1;
}

// The generic-ballot line draws itself in on scroll, the lead is shaded blue above zero and red below,
// and a crosshair (pointer, touch or arrow keys) reads out any week.
function PollingTrend({ values }: { values: TrendPoint[] }) {
  const t = useT();
  const locale = useIntlLocale();
  const clip = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [ref, inView] = useInView<HTMLDivElement>();
  const layout = useMemo(() => {
    if (!values.length) return null;
    const min = Math.floor(Math.min(...values.map((item) => item.margin), 0) - 1);
    const max = Math.ceil(Math.max(...values.map((item) => item.margin), 0) + 1);
    const x = (index: number) => TP.left + (values.length === 1 ? 0 : index / (values.length - 1)) * (TW - TP.left - TP.right);
    const y = (value: number) => TP.top + (max - value) / (max - min) * (TH - TP.top - TP.bottom);
    const xs = values.map((_, index) => x(index));
    const line = values.map((item, index) => `${index ? "L" : "M"}${xs[index].toFixed(1)},${y(item.margin).toFixed(1)}`).join(" ");
    const zero = y(0);
    const area = `${line} L${xs.at(-1)!.toFixed(1)},${zero.toFixed(1)} L${xs[0].toFixed(1)},${zero.toFixed(1)} Z`;
    const step = niceStep(max - min);
    const ticks: number[] = [];
    for (let tick = Math.ceil(min / step) * step; tick <= max; tick += step) ticks.push(tick);
    return { xs, y, line, area, zero, ticks };
  }, [values]);
  const scrub = useChartScrub({ count: values.length, indexAt: (ratio) => layout ? nearestIndex(layout.xs, ratio * TW) : 0 });
  // The observed wrapper is the same element before and after the data arrives.
  if (!values.length || !layout) return <><div ref={ref} className="large-trend mpa-trend"><div className="market-empty">{t("Waiting for the polling trend…")}</div></div></>;
  const { xs, y, line, area, zero, ticks } = layout;
  const latest = values.at(-1)!;
  const point = scrub.active === null ? null : values[scrub.active];
  const date = (iso: string, long = false) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, long ? { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });
  const lead = (margin: number) => `${margin >= 0 ? "D" : "R"}+${Math.abs(margin).toFixed(1)}`;

  return <>
    <div ref={ref} className="large-trend mpa-trend" data-in={inView ? "true" : undefined}>
      <div className="mpa-chart-frame">
        <svg viewBox={`0 0 ${TW} ${TH}`} role="img" aria-label={t("Generic ballot Democratic margin trend")} {...scrub.bind}>
          <defs>
            <clipPath id={`${clip}-up`}><rect x="0" y="0" width={TW} height={zero} /></clipPath>
            <clipPath id={`${clip}-down`}><rect x="0" y={zero} width={TW} height={TH} /></clipPath>
          </defs>
          {ticks.map((tick) => <g key={tick} className="mpa-grid"><line x1={TP.left} x2={TW - TP.right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "zero" : undefined} /><text x={TP.left - 8} y={y(tick) + 4}>{tick === 0 ? t("EVEN") : lead(tick).replace(".0", "")}</text></g>)}
          <path className="mpa-area dem" d={area} clipPath={`url(#${clip}-up)`} />
          <path className="mpa-area rep" d={area} clipPath={`url(#${clip}-down)`} />
          <path className="mpa-line" d={line} pathLength={1} />
          {!point && <g className="mpa-endpoint" transform={`translate(${xs.at(-1)!.toFixed(1)} ${y(latest.margin).toFixed(1)})`}><circle className="ping" r="5" /><circle r="4.5" /></g>}
          {point && <g className="mpa-cross"><line x1={xs[scrub.active!]} x2={xs[scrub.active!]} y1={TP.top} y2={TH - TP.bottom} /><circle cx={xs[scrub.active!]} cy={y(point.margin)} r="5.5" className={point.margin >= 0 ? "dem" : "rep"} /></g>}
          <rect className="hover-capture" x={TP.left} y={0} width={TW - TP.left - TP.right} height={TH} />
        </svg>
        {point && <ChartTooltip x={xs[scrub.active!] / TW * 100} y={y(point.margin) / TH * 100} title={t("Week of {date}", { date: date(point.date, true) })} rows={[
          { label: t("Margin"), value: lead(point.margin), tone: point.margin >= 0 ? "dem" : "rep" },
          { label: t("Democrats"), value: `${point.dem.toFixed(1)}%`, tone: "dem" },
          { label: t("Republicans"), value: `${point.rep.toFixed(1)}%`, tone: "rep" },
        ]} note={t("{count} polls that week", { count: point.polls })} />}
      </div>
      <div><span>{date(values[0].date)}</span><span>{date(values[Math.floor(values.length / 2)].date)}</span><span>{date(latest.date)}</span></div>
    </div>
    <p className="chart-note">{t("Weekly average from {count} poll observations in the visible period.", { count: values.reduce((sum, item) => sum + item.polls, 0) })}</p>
  </>;
}

// What a poll measures: the national generic ballot, a Senate race or a House district.
function raceLabel(poll: Poll, t: (text: string, vars?: Record<string, string | number>) => string) {
  if (poll.chamber === "Generic") return t("Generic ballot");
  if (poll.chamber === "Senate") return t("{state} Senate", { state: t(stateByCode.get(poll.state)?.name || poll.state) });
  return poll.race;
}

function PollRow({ poll, index }: { poll: Poll; index: number }) {
  const t = useT();
  const locale = useIntlLocale();
  const margin = poll.dem - poll.rep;
  const demWidth = Math.max(0, Math.min(100, poll.dem));
  const repWidth = Math.max(0, Math.min(100, poll.rep));
  return (
    <article className="poll-row mpa-poll-row" style={{ "--k": Math.min(index, 16) } as React.CSSProperties}>
      <div className="poll-meta"><strong>{raceLabel(poll, t)}</strong><span>{poll.pollster} · {poll.population}{poll.sample ? ` · n=${poll.sample.toLocaleString(locale)}` : ""}</span></div>
      <div className="poll-bars" aria-label={t("Democrat {dem}, Republican {rep}", { dem: poll.dem, rep: poll.rep })}>
        <span className="poll-bar dem" style={{ width: `${demWidth}%` }} title={`${poll.pollster} · D ${poll.dem.toFixed(1)}%`}><i>D {poll.dem.toFixed(1)}</i></span>
        <span className="poll-bar rep" style={{ width: `${repWidth}%` }} title={`${poll.pollster} · R ${poll.rep.toFixed(1)}%`}><i>R {poll.rep.toFixed(1)}</i></span>
      </div>
      <div className={`poll-margin ${margin >= 0 ? "dem-text" : "rep-text"}`}>{margin >= 0 ? "D" : "R"}+{Math.abs(margin).toFixed(1)}<small>{poll.endDate.slice(5)}</small></div>
    </article>
  );
}

export function PollsExplorer() {
  const electionContext = useElectionContext();
  const t = useT();
  const [livePolls, setLivePolls] = useState<Poll[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [feedMeta, setFeedMeta] = useState<PollFeed["meta"] | null>(null);
  const [feedSource, setFeedSource] = useState("Connecting to live feed…");
  const [feedError, setFeedError] = useState("");
  const [filter, setFilter] = useState<"All" | Poll["chamber"]>("All");
  const [search, setSearch] = useState("");
  const [population, setPopulation] = useState<"All" | Poll["population"]>("All");
  const [windowDays, setWindowDays] = useState<"30" | "90" | "all">("90");
  const [sort, setSort] = useState<"newest" | "margin" | "sample">("newest");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/polls/live").then((response) => {
      if (!response.ok) throw new Error("Polling feed unavailable");
      return response.json() as Promise<PollFeed>;
    }).then((payload) => {
      if (cancelled) return;
      setLivePolls(payload.polls);
      setTrend(payload.trend);
      setFeedMeta(payload.meta);
      setFeedSource(payload.source);
    }).catch(() => { if (!cancelled) setFeedError("Live feed unavailable; showing the dated local snapshot."); });
    return () => { cancelled = true; };
  }, []);

  const polls = useMemo(() => {
    const sourcePolls = livePolls.length ? livePolls : seedPolls;
    const latestDate = Math.max(0, ...sourcePolls.map((poll) => Date.parse(poll.endDate)));
    const cutoff = windowDays === "all" ? 0 : latestDate - Number(windowDays) * 86400000;
    const contextChamber = electionContext.chamber === "all" ? null : electionContext.chamber === "house" ? "House" : "Senate";
    return sourcePolls
      .filter((poll) => (filter === "All" || poll.chamber === filter) && (!contextChamber || poll.chamber === contextChamber || poll.chamber === "Generic") && (population === "All" || poll.population === population) && (!search || `${poll.pollster} ${poll.race} ${poll.state} ${raceLabel(poll, t)} ${stateByCode.get(poll.state)?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())) && Date.parse(poll.endDate) >= cutoff)
      .sort((a, b) => sort === "margin" ? Math.abs((b.dem - b.rep)) - Math.abs((a.dem - a.rep)) : sort === "sample" ? b.sample - a.sample : b.endDate.localeCompare(a.endDate));
  }, [electionContext.chamber, filter, livePolls, population, search, sort, t, windowDays]);

  return (
    <>
      <section className="page-intro">
        <div><p className="eyebrow">{t("2026 POLLING")}</p><h1>{t("Polling tracker")}</h1><p>{t("The national generic ballot, Senate races and House districts: every public poll in the index, with pollster, sample and field dates.")}</p></div>
        <div className="stat-stamp"><strong><CountUp value={feedMeta?.n_polls || seedPolls.length} locale /></strong><span>{t("polls indexed")}</span><small>{feedMeta ? t("{source} · through {date}", { source: feedSource, date: feedMeta.latest_field_end }) : t(feedError || feedSource)}</small></div>
      </section>

      <section className="split-grid map-grid">
        <article className="panel map-panel"><div className="panel-head"><div><p className="eyebrow">{t("BATTLEGROUND MAP")}</p><h2>{t("Latest margin signal")}</h2></div><span className="panel-tag">D ↔ R</span></div><StateTileMap values={pollMapMargins} label={t("Latest polling margin by battleground state")} /><p className="chart-note">{t("Tiles without a current benchmark remain neutral. Hover a state for its margin.")}</p></article>
        <article className="panel trend-panel"><div className="panel-head"><div><p className="eyebrow">{t("GENERIC BALLOT")}</p><h2>{t("Weekly movement")}</h2></div>{trend.at(-1) && <span className={`big-signal ${trend.at(-1)!.margin >= 0 ? "dem-text" : "rep-text"}`}>{trend.at(-1)!.margin >= 0 ? "D" : "R"}+<CountUp value={Math.abs(trend.at(-1)!.margin)} decimals={1} /></span>}</div><PollingTrend values={trend} /></article>
      </section>

      <section className="polls-workbench polls-solo">
        <article className="panel poll-list-panel">
          <div className="panel-head"><div><p className="eyebrow">{t("POLL FEED")}</p><h2>{t("Latest toplines")}</h2></div><div className="segmented">{(["All", "Generic", "Senate", "House"] as const).map((item) => <button type="button" aria-pressed={filter === item} className={filter === item ? "selected" : ""} key={item} onClick={() => setFilter(item)}>{t(item)}</button>)}</div></div>
          <div className="poll-filter-grid"><label>{t("Search")}<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Pollster, race or state")} /></label><label>{t("Population")}<select value={population} onChange={(event) => setPopulation(event.target.value as typeof population)}><option value="All">{t("All")}</option><option>LV</option><option>RV</option><option>A</option></select></label><label>{t("Period")}<select value={windowDays} onChange={(event) => setWindowDays(event.target.value as typeof windowDays)}><option value="30">{t("30 days")}</option><option value="90">{t("90 days")}</option><option value="all">{t("Full cycle")}</option></select></label><label>{t("Sort")}<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="newest">{t("Newest")}</option><option value="margin">{t("Largest margin")}</option><option value="sample">{t("Sample size")}</option></select></label></div>
          <p className="filter-summary">{t("Showing {count} records · global context: {context}", { count: polls.length, context: electionContext.chamber === "all" ? t("all chambers") : t(electionContext.chamber) })}</p>
          <div className="poll-list mpa-poll-list" key={`${filter}-${population}-${windowDays}-${sort}-${electionContext.chamber}`}>{polls.map((poll, index) => <PollRow key={poll.id} poll={poll} index={index} />)}</div>
        </article>
      </section>
    </>
  );
}

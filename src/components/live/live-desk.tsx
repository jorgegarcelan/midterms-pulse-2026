"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/i18n/link";
import type { LiveFeed, Mover, WireItem } from "@/app/api/live/route";
import { CountUp } from "@/components/motion/count-up";
import { ChartTooltip } from "@/components/motion/chart-tooltip";
import { useChartScrub } from "@/components/motion/chart-scrub";
import { useTweenedValues } from "@/components/motion/chart-tween";
import { OdometerCountdown } from "@/components/motion/odometer-countdown";
import { stateByCode } from "@/data/geography";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import type { Vars } from "@/i18n/translate";

type T = (text: string, vars?: Vars) => string;

type ModelFeed = { house: { demMajority: number; demSeats: number }; senate: { demMajority: number; demSeats: number }; genericBallot: { margin: number }; races: { code: string; chamber: string }[] };
type Filter = "all" | WireItem["type"];

const REFRESH_MS = 60_000;

type SparkProps = { values: number[]; width?: number; height?: number; reference?: number; stretch?: boolean; scrub?: { dates: string[]; title: string; format: (value: number) => string; label: string } };

// Sparklines glide to new values on each refresh; the big one is scrubbable (pointer, touch, arrow keys).
function Sparkline({ values, width = 120, height = 32, reference, stretch = false, scrub }: SparkProps) {
  const t = useT();
  const locale = useIntlLocale();
  const shown = useTweenedValues(values, 900);
  const cursor = useChartScrub({ count: scrub ? values.length : 0, indexAt: (ratio) => Math.round(ratio * (values.length - 1)) });
  if (values.length < 2) return <span className="sparkline-empty" aria-hidden="true" />;
  const min = Math.min(...values, reference ?? Infinity);
  const max = Math.max(...values, reference ?? -Infinity);
  const span = Math.max(1e-6, max - min);
  const x = (index: number) => index / (values.length - 1) * width;
  const y = (value: number) => height - 3 - (value - min) / span * (height - 6);
  const svg = (
    <svg className={`sparkline${stretch ? " stretch" : ""}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio={stretch ? "none" : undefined} aria-hidden="true">
      {reference !== undefined && <line x1="0" x2={width} y1={y(reference)} y2={y(reference)} className="spark-ref" />}
      <path d={shown.map((value, index) => `${index ? "L" : "M"} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(" ")} pathLength={1} />
      {!stretch && <circle cx={x(shown.length - 1)} cy={y(shown.at(-1)!)} r="2.6" />}
      {scrub && cursor.active !== null && <line className="mpa-spark-cross" x1={x(cursor.active)} x2={x(cursor.active)} y1="0" y2={height} />}
    </svg>
  );
  if (!scrub) return svg;
  const active = cursor.active;
  return (
    <div className="mpa-spark" role="img" aria-label={scrub.label} {...cursor.bind} data-scrub={active !== null ? "true" : undefined}>
      {svg}
      {active === null && <i className="mpa-spark-dot live" style={{ left: "100%", top: `${y(shown.at(-1)!) / height * 100}%` }} />}
      {reference !== undefined && <em className="mpa-spark-ref" style={{ top: `${y(reference) / height * 100}%` }}>{reference}</em>}
      {active !== null && <>
        <i className="mpa-spark-dot" style={{ left: `${x(active) / width * 100}%`, top: `${y(values[active]) / height * 100}%` }} />
        <ChartTooltip x={x(active) / width * 100} y={y(values[active]) / height * 100} title={new Date(scrub.dates[active].length === 10 ? `${scrub.dates[active]}T12:00:00Z` : scrub.dates[active]).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} rows={[
          { label: scrub.title, value: scrub.format(values[active]), tone: reference !== undefined && values[active] < reference ? "rep" : "dem" },
          ...(active > 0 ? [{ label: t("Change vs previous run"), value: `${values[active] - values[active - 1] >= 0 ? "+" : "−"}${Math.abs(values[active] - values[active - 1]).toFixed(1)}`, tone: "muted" as const }] : []),
        ]} />
      </>}
    </div>
  );
}

function ago(iso: string, now: number, t: T, locale: string, dateOnly?: boolean) {
  const time = Date.parse(iso);
  if (dateOnly) return new Date(time).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const minutes = Math.max(0, Math.round((now - time) / 60_000));
  if (minutes < 1) return t("now");
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return new Date(time).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function dayLabel(iso: string, now: number, t: T, locale: string) {
  const day = iso.slice(0, 10);
  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10);
  return day === today ? t("Today") : day === yesterday ? t("Yesterday") : new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
}

// The election desk as it moves: headlines, new polls and market swings in one wire, refreshed every minute.
export function LiveDesk() {
  const t = useT();
  const locale = useIntlLocale();
  const [feed, setFeed] = useState<LiveFeed | null>(null);
  const [model, setModel] = useState<ModelFeed | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(0);
  const known = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/live", { cache: "no-store" });
      if (!response.ok) throw new Error("live");
      const next = await response.json() as LiveFeed;
      // Items that were not in the previous refresh flash in; the very first load does not.
      if (known.current) setFresh(new Set(next.wire.filter((item) => !known.current!.has(item.id)).map((item) => item.id)));
      known.current = new Set(next.wire.map((item) => item.id));
      setFeed(next);
      setFailed(false);
    } catch { setFailed(true); } finally { setRefreshing(false); setNow(Date.now()); }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(load, 0);
    const refresh = window.setInterval(load, REFRESH_MS);
    const clock = window.setInterval(() => setNow(Date.now()), 15_000);
    fetch("/api/model").then((response) => response.json() as Promise<ModelFeed>).then(setModel).catch(() => undefined);
    return () => { window.clearTimeout(first); window.clearInterval(refresh); window.clearInterval(clock); };
  }, [load]);

  const senateStates = useMemo(() => new Set((model?.races || []).filter((race) => race.chamber === "senate").map((race) => race.code)), [model]);
  const wire = useMemo(() => (feed?.wire || []).filter((item) => filter === "all" || item.type === filter), [feed, filter]);
  const groups = useMemo(() => {
    const result: { day: string; items: WireItem[] }[] = [];
    for (const item of wire) {
      const day = dayLabel(item.time, now || Date.parse(feed?.updated || "") || 0, t, locale);
      if (result.at(-1)?.day !== day) result.push({ day, items: [] });
      result.at(-1)!.items.push(item);
    }
    return result;
  }, [feed?.updated, locale, now, t, wire]);

  const updatedAgo = feed && now ? Math.max(0, Math.round((now - Date.parse(feed.updated)) / 1000)) : null;
  const pulse = feed?.pulse || [];
  const pulseChange = pulse.length > 7 ? pulse.at(-1)!.demSeats - pulse.at(-8)!.demSeats : 0;
  const control = feed?.control;
  const counts = feed ? { all: feed.wire.length, news: feed.counts.news, poll: feed.counts.polls, market: feed.counts.markets } : null;
  const raceLink = (state: string) => senateStates.has(state) ? `/races/${state.toLowerCase()}-senate` : `/states/${state.toLowerCase()}`;

  return (
    <div className="live-desk">
      <section className="live-head">
        <div>
          <p className="eyebrow">{t("LATEST")}</p>
          <h1>{t("What's moving now")}</h1>
          <p>{t("Headlines from {count} newsrooms, every new public poll and every prediction-market swing, in one wire that refreshes itself.", { count: new Set((feed?.wire || []).filter((item) => item.type === "news").map((item) => item.source)).size || t("eight") })}</p>
        </div>
        <div className="live-status" data-refreshing={refreshing ? "true" : undefined}>
          <span className="live-dot" aria-hidden="true" />
          <div><b>{failed ? t("Reconnecting") : t("Live")}</b><small>{updatedAgo === null ? t("Connecting…") : t("Updated {time} ago · every 60s", { time: updatedAgo < 60 ? `${updatedAgo}s` : `${Math.round(updatedAgo / 60)}m` })}</small></div>
          <button type="button" onClick={load} disabled={refreshing} aria-label={t("Refresh now")}>↻</button>
        </div>
      </section>

      <section className="live-kpis" aria-label={t("Current signals")}>
        <article><span>{t("House · model")}</span><strong className="dem-text">{model ? <><CountUp value={model.house.demMajority} />%</> : "—"}</strong><small>{control?.house ? `Polymarket ${(control.house.probability * 100).toFixed(1)}%` : t("D majority")}</small></article>
        <article><span>{t("Senate · model")}</span><strong className={model && model.senate.demMajority < 50 ? "rep-text" : "dem-text"}>{model ? <><CountUp value={model.senate.demMajority} />%</> : "—"}</strong><small>{control?.senate ? `Polymarket ${(control.senate.probability * 100).toFixed(1)}%${control.senate.change24h ? ` · ${control.senate.change24h > 0 ? "▲" : "▼"}${Math.abs(control.senate.change24h * 100).toFixed(1)}` : ""}` : t("D majority")}</small></article>
        <article><span>{t("Generic ballot")}</span><strong className={model && model.genericBallot.margin < 0 ? "rep-text" : "dem-text"}>{model ? <>{model.genericBallot.margin >= 0 ? "D" : "R"}+<CountUp value={Math.abs(model.genericBallot.margin)} decimals={1} /></> : "—"}</strong><small>{t("weighted poll average")}</small></article>
        <article><span>{t("Benchmark House")}</span><strong>{pulse.length ? <CountUp value={Math.round(pulse.at(-1)!.demSeats)} /> : "—"}</strong><small>{pulse.length > 7 ? t("D seats · {change} over 7 runs", { change: `${pulseChange >= 0 ? "+" : ""}${pulseChange.toFixed(1)}` }) : t("mean D seats")}</small></article>
        <article className="live-countdown"><OdometerCountdown /></article>
      </section>

      <section className="live-grid">
        <div className="panel wire">
          <div className="wire-head">
            <div className="wire-filters" role="tablist" aria-label={t("Filter the wire")}>
              {([["all", "All"], ["news", "Headlines"], ["poll", "Polls"], ["market", "Markets"]] as [Filter, string][]).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{t(label)}{counts && <b>{counts[key]}</b>}</button>
              ))}
            </div>
            {fresh.size > 0 && <span className="wire-new">{t("{count} new", { count: fresh.size })}</span>}
          </div>
          <div className="wire-scroll">
          {failed && !feed ? <p className="table-empty">{t("The live wire could not be reached. Retrying every minute.")}</p>
            : !feed ? <div className="wire-skeleton">{Array.from({ length: 7 }, (_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}</div>
              : wire.length === 0 ? <p className="table-empty">{t("Nothing in this lane yet.")}</p>
                : groups.map((group) => (
                  <div key={group.day} className="wire-day">
                    <p className="wire-day-label">{group.day}</p>
                    {group.items.map((item, index) => (
                      <article key={item.id} className={`wire-item ${item.type}${fresh.has(item.id) ? " fresh" : ""}${(item.urgency ?? 0) >= .8 ? " urgent" : ""}`} style={{ "--i": Math.min(index, 14) } as React.CSSProperties}>
                        <time dateTime={item.time}>{now ? ago(item.time, now, t, locale, item.dateOnly) : ""}</time>
                        <span className={`wire-kind ${item.type}`}>{item.type === "news" ? item.source : item.type === "poll" ? t("Poll") : t("Market")}</span>
                        <div className="wire-body">
                          <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
                          <div className="wire-meta">
                            {item.type !== "news" && <small>{item.meta}</small>}
                            {item.topic && item.type === "news" && <em className={`topic ${item.topic}`}>{t(item.topic)}</em>}
                            {item.states.slice(0, 3).map((state) => <Link key={state} className="state-chip" href={raceLink(state)}>{t(stateByCode.get(state)?.name || state)}</Link>)}
                            {item.districts.slice(0, 2).map((district) => <Link key={district} className="state-chip" href={`/races/${district.toLowerCase()}`}>{district}</Link>)}
                          </div>
                        </div>
                        {item.value && <b className={`wire-value ${item.tone || ""}`}>{item.value}{item.type === "market" ? ` ${t("pts")}` : ""}</b>}
                      </article>
                    ))}
                  </div>
                ))}
          </div>
          <p className="chart-note">{t("Headlines link to the original publishers and are auto-tagged with transparent keyword rules. Polls: Vote-Scope index (two-party toplines only). Markets: Polymarket state Senate winner markets that moved 3+ points in 24 hours.")}</p>
        </div>

        <aside className="live-side">
          <article className="panel movers">
            <div className="panel-head"><div><p className="eyebrow">{t("Market movers")}</p><h2>{t("Senate races, last 24h")}</h2></div><Link className="panel-tag" href="/markets">{t("Markets →")}</Link></div>
            {!feed ? <div className="wire-skeleton small">{Array.from({ length: 4 }, (_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}</div>
              : feed.movers.map((mover: Mover, index) => (
                <Link key={mover.state} className="mover" href={raceLink(mover.state)} style={{ "--i": index } as React.CSSProperties}>
                  <span><b>{t(mover.name)}</b><small>{t(mover.label)}</small></span>
                  <Sparkline values={mover.history.map((point) => point.probability * 100)} width={90} height={28} />
                  <strong><CountUp value={Math.round(mover.probability * 100)} duration={900} />%</strong>
                  <em className={mover.change24h === 0 ? "" : (mover.side === "D") === mover.change24h > 0 ? "dem-text" : "rep-text"}>{mover.change24h === 0 ? "—" : `${mover.change24h > 0 ? "▲" : "▼"}${Math.abs(mover.change24h * 100).toFixed(1)}`}</em>
                </Link>
              ))}
          </article>

        </aside>
      </section>
    </div>
  );
}

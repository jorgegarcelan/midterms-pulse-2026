"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { LiveFeed, Mover, WireItem } from "@/app/api/live/route";
import { CountUp } from "@/components/motion/count-up";
import { OdometerCountdown } from "@/components/motion/odometer-countdown";
import { SignalTriage } from "@/components/live/signal-triage";
import { XWatchlist } from "@/components/live/x-watchlist";
import { stateByCode } from "@/data/geography";

type ModelFeed = { house: { demMajority: number; demSeats: number }; senate: { demMajority: number; demSeats: number }; genericBallot: { margin: number }; races: { code: string; chamber: string }[] };
type Filter = "all" | WireItem["type"];

const REFRESH_MS = 60_000;
const signed = (value: number) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;

function Sparkline({ values, width = 120, height = 32, reference, stretch = false }: { values: number[]; width?: number; height?: number; reference?: number; stretch?: boolean }) {
  if (values.length < 2) return <span className="sparkline-empty" aria-hidden="true" />;
  const min = Math.min(...values, reference ?? Infinity);
  const max = Math.max(...values, reference ?? -Infinity);
  const span = Math.max(1e-6, max - min);
  const x = (index: number) => index / (values.length - 1) * width;
  const y = (value: number) => height - 3 - (value - min) / span * (height - 6);
  return (
    <svg className={`sparkline${stretch ? " stretch" : ""}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio={stretch ? "none" : undefined} aria-hidden="true">
      {reference !== undefined && <line x1="0" x2={width} y1={y(reference)} y2={y(reference)} className="spark-ref" />}
      <path d={values.map((value, index) => `${index ? "L" : "M"} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(" ")} pathLength={1} />
      {!stretch && <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r="2.6" />}
    </svg>
  );
}

function ago(iso: string, now: number, dateOnly?: boolean) {
  const time = Date.parse(iso);
  if (dateOnly) return new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const minutes = Math.max(0, Math.round((now - time) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLabel(iso: string, now: number) {
  const day = iso.slice(0, 10);
  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10);
  return day === today ? "Today" : day === yesterday ? "Yesterday" : new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
}

// The election desk as it moves: headlines, new polls and market swings in one wire, refreshed every minute.
export function LiveDesk() {
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
      const day = dayLabel(item.time, now || Date.parse(feed?.updated || "") || 0);
      if (result.at(-1)?.day !== day) result.push({ day, items: [] });
      result.at(-1)!.items.push(item);
    }
    return result;
  }, [feed?.updated, now, wire]);

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
          <p className="eyebrow">Live desk</p>
          <h1>What&apos;s moving now</h1>
          <p>Headlines from {new Set((feed?.wire || []).filter((item) => item.type === "news").map((item) => item.source)).size || "eight"} newsrooms, every new public poll and every prediction-market swing, in one wire that refreshes itself.</p>
        </div>
        <div className="live-status" data-refreshing={refreshing ? "true" : undefined}>
          <span className="live-dot" aria-hidden="true" />
          <div><b>{failed ? "Reconnecting" : "Live"}</b><small>{updatedAgo === null ? "Connecting…" : `Updated ${updatedAgo < 60 ? `${updatedAgo}s` : `${Math.round(updatedAgo / 60)}m`} ago · every 60s`}</small></div>
          <button type="button" onClick={load} disabled={refreshing} aria-label="Refresh now">↻</button>
        </div>
      </section>

      <section className="live-kpis" aria-label="Current signals">
        <article><span>House · model</span><strong className="dem-text">{model ? <><CountUp value={model.house.demMajority} />%</> : "—"}</strong><small>{control?.house ? `Polymarket ${(control.house.probability * 100).toFixed(1)}%` : "D majority"}</small></article>
        <article><span>Senate · model</span><strong className={model && model.senate.demMajority < 50 ? "rep-text" : "dem-text"}>{model ? <><CountUp value={model.senate.demMajority} />%</> : "—"}</strong><small>{control?.senate ? `Polymarket ${(control.senate.probability * 100).toFixed(1)}%${control.senate.change24h ? ` · ${control.senate.change24h > 0 ? "▲" : "▼"}${Math.abs(control.senate.change24h * 100).toFixed(1)}` : ""}` : "D majority"}</small></article>
        <article><span>Generic ballot</span><strong className={model && model.genericBallot.margin < 0 ? "rep-text" : "dem-text"}>{model ? signed(model.genericBallot.margin) : "—"}</strong><small>weighted poll average</small></article>
        <article><span>Benchmark House</span><strong>{pulse.length ? <CountUp value={Math.round(pulse.at(-1)!.demSeats)} /> : "—"}</strong><small>{pulse.length > 7 ? `D seats · ${pulseChange >= 0 ? "+" : ""}${pulseChange.toFixed(1)} over 7 runs` : "mean D seats"}</small></article>
        <article className="live-countdown"><OdometerCountdown /></article>
      </section>

      <section className="live-grid">
        <div className="panel wire">
          <div className="wire-head">
            <div className="wire-filters" role="tablist" aria-label="Filter the wire">
              {([["all", "All"], ["news", "Headlines"], ["poll", "Polls"], ["market", "Markets"]] as [Filter, string][]).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>{label}{counts && <b>{counts[key]}</b>}</button>
              ))}
            </div>
            {fresh.size > 0 && <span className="wire-new">{fresh.size} new</span>}
          </div>
          <div className="wire-scroll">
          {failed && !feed ? <p className="table-empty">The live wire could not be reached. Retrying every minute.</p>
            : !feed ? <div className="wire-skeleton">{Array.from({ length: 7 }, (_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}</div>
              : wire.length === 0 ? <p className="table-empty">Nothing in this lane yet.</p>
                : groups.map((group) => (
                  <div key={group.day} className="wire-day">
                    <p className="wire-day-label">{group.day}</p>
                    {group.items.map((item, index) => (
                      <article key={item.id} className={`wire-item ${item.type}${fresh.has(item.id) ? " fresh" : ""}${(item.urgency ?? 0) >= .8 ? " urgent" : ""}`} style={{ "--i": Math.min(index, 14) } as React.CSSProperties}>
                        <time dateTime={item.time}>{now ? ago(item.time, now, item.dateOnly) : ""}</time>
                        <span className={`wire-kind ${item.type}`}>{item.type === "news" ? item.source : item.type === "poll" ? "Poll" : "Market"}</span>
                        <div className="wire-body">
                          <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
                          <div className="wire-meta">
                            {item.type !== "news" && <small>{item.meta}</small>}
                            {item.topic && item.type === "news" && <em className={`topic ${item.topic}`}>{item.topic}</em>}
                            {item.states.slice(0, 3).map((state) => <Link key={state} className="state-chip" href={raceLink(state)}>{stateByCode.get(state)?.name || state}</Link>)}
                            {item.districts.slice(0, 2).map((district) => <Link key={district} className="state-chip" href={`/races/${district.toLowerCase()}`}>{district}</Link>)}
                          </div>
                        </div>
                        {item.value && <b className={`wire-value ${item.tone || ""}`}>{item.value}{item.type === "market" ? " pts" : ""}</b>}
                      </article>
                    ))}
                  </div>
                ))}
          </div>
          <p className="chart-note">Headlines link to the original publishers and are auto-tagged with transparent keyword rules. Polls: Vote-Scope index (two-party toplines only). Markets: Polymarket state Senate winner markets that moved 3+ points in 24 hours.</p>
        </div>

        <aside className="live-side">
          <article className="panel movers">
            <div className="panel-head"><div><p className="eyebrow">Market movers</p><h2>Senate races, last 24h</h2></div><Link className="panel-tag" href="/markets">Markets →</Link></div>
            {!feed ? <div className="wire-skeleton small">{Array.from({ length: 4 }, (_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}</div>
              : feed.movers.map((mover: Mover, index) => (
                <Link key={mover.state} className="mover" href={raceLink(mover.state)} style={{ "--i": index } as React.CSSProperties}>
                  <span><b>{mover.name}</b><small>{mover.label}</small></span>
                  <Sparkline values={mover.history.map((point) => point.probability * 100)} width={90} height={28} />
                  <strong>{(mover.probability * 100).toFixed(0)}%</strong>
                  <em className={mover.change24h === 0 ? "" : (mover.side === "D") === mover.change24h > 0 ? "dem-text" : "rep-text"}>{mover.change24h === 0 ? "—" : `${mover.change24h > 0 ? "▲" : "▼"}${Math.abs(mover.change24h * 100).toFixed(1)}`}</em>
                </Link>
              ))}
          </article>

          <article className="panel pulse-card">
            <div className="panel-head"><div><p className="eyebrow">Benchmark pulse</p><h2>House, last {pulse.length || "—"} runs</h2></div><span className="panel-tag">Vote-Scope</span></div>
            {pulse.length > 1 ? <>
              <div className="pulse-now"><strong><CountUp value={Math.round(pulse.at(-1)!.demSeats)} /></strong><span>mean Democratic seats · 218 for majority</span></div>
              <Sparkline values={pulse.map((run) => run.demSeats)} width={320} height={80} reference={218} stretch />
              <div className="pulse-axis"><span>{pulse[0].date}</span><span>{pulse.at(-1)!.date}</span></div>
            </> : <div className="wire-skeleton small"><i /><i /></div>}
          </article>

          <XWatchlist />
          <SignalTriage />
        </aside>
      </section>
    </div>
  );
}

"use client";

import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { MP26_RACE_RMSE, readingsDisagree, type RaceReadings } from "@/lib/readings-shared";
import "./readings.css";

type Row = { label: string; value: string | null; tone: string; detail: string; href?: string };

function Rows({ rows, variant, flag }: { rows: Row[]; variant: "card" | "panel" | "stream"; flag?: string | null }) {
  return <div className={`readings ${variant}`}>
    <dl>{rows.map((row) => <div key={row.label}>
      <dt>{row.label}</dt>
      <dd>{row.value && <strong className={row.tone}>{row.value}</strong>}<small>{row.href ? <a href={row.href} target="_blank" rel="noopener">{row.detail} ↗</a> : row.detail}</small></dd>
    </div>)}</dl>
    {flag && <p className="readings-flag">{flag}</p>}
  </div>;
}

function useFormat() {
  const t = useT();
  const intl = useIntlLocale();
  const one = (value: number) => value.toLocaleString(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pct = (value: number) => `${Math.round(value * 100)}%`;
  const day = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "short", timeZone: "UTC" });
  const money = (value: number) => new Intl.NumberFormat(intl, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
  return { t, one, pct, day, money };
}

/*
  One race, four readings: polling average, Polymarket, MP-26, Census-26. Leads are labelled with the
  readings' side (D, or I where an independent carries the non-Republican side, as in Nebraska).
*/
export function RaceReadingsView({ readings, variant = "card" }: { readings: RaceReadings; variant?: "card" | "panel" | "stream" }) {
  const side = readings.side;
  const { t, one, pct, day, money } = useFormat();
  const tone = (lean: number) => (Math.abs(lean) < .05 ? "" : lean > 0 ? side === "I" ? "ind-text" : "dem-text" : "rep-text");
  const lead = (margin: number) => (Math.abs(margin) < .05 ? t("Tied") : `${margin > 0 ? side : "R"}+${one(Math.abs(margin))}`);
  const chance = (p: number) => t("{p}% chance for {party}", { p: Math.round((p >= .5 ? p : 1 - p) * 100), party: p >= .5 ? side : "R" });
  // An edge-cached answer from before ranges existed has none: show the reading without it.
  const span = (range?: [number, number]) => range ? ` · ${t("80%: {low} to {high}", { low: lead(range[0]), high: lead(range[1]) })}` : "";
  const { polls, market, mp26, census } = readings;
  const rows: Row[] = [
    polls
      ? { label: t("Polls"), value: lead(polls.margin), tone: tone(polls.margin), detail: `${side} ${one(polls.dem)} · R ${one(polls.rep)} · ${t("{n} polls, latest {date}", { n: polls.polls, date: day(polls.latest) })}${pollsAreSolid(polls) ? "" : ` · ${t("few or old polls")}`}` }
      : { label: t("Polls"), value: null, tone: "", detail: t("No public polls") },
    market
      ? { label: t("Markets"), value: `${pct(market.p >= .5 ? market.p : 1 - market.p)} ${market.p >= .5 ? side : "R"}`, tone: tone(market.p - .5), detail: t("Polymarket · {volume} traded", { volume: money(market.volume) }), href: market.url }
      : { label: t("Markets"), value: null, tone: "", detail: readings.key.startsWith("house:") ? t("No market of its own: Polymarket only lists the whole House") : t("No market") },
    { label: "MP-26", value: lead(mp26.margin), tone: tone(mp26.margin), detail: `${chance(mp26.p)}${span(mp26.range)}` },
    census
      ? { label: "Census-26", value: lead(census.margin), tone: tone(census.margin), detail: `${chance(census.p)}${span(census.range)}` }
      : { label: "Census-26", value: null, tone: "", detail: readings.key.startsWith("senate:") ? t("House only") : t("No estimate") },
  ];
  return <Rows rows={rows} variant={variant} flag={readingsDisagree(readings) ? t("They disagree on who leads") : null} />;
}

const SOLID_POLLS = 3;
const FRESH_DAYS = 45;
// Enough recent polls to quote the average on its own: at least three, the latest within 45 days.
export function pollsAreSolid(polls: RaceReadings["polls"], today = new Date()) {
  return Boolean(polls && polls.polls >= SOLID_POLLS && (today.getTime() - Date.parse(`${polls.latest}T12:00:00Z`)) / 86_400_000 <= FRESH_DAYS);
}

/*
  Where every number of a race comes from: what it is, its source and date, and how far it can be off.
  Written for someone quoting the race on air, with a one-line summary to read out.
*/
export function ReadingsSources({ readings, name }: { readings: RaceReadings; name: string }) {
  const { t, one, pct, day, money } = useFormat();
  const intl = useIntlLocale();
  const side = readings.side;
  const lead = (margin: number) => (Math.abs(margin) < .05 ? t("Tied") : `${margin > 0 ? side : "R"}+${one(Math.abs(margin))}`);
  const { polls, market, mp26, census, sources } = readings;
  const solid = pollsAreSolid(polls);
  // Sampling error of the average's margin with all its interviews pooled (95%); real poll error is larger.
  const sampling = polls && polls.respondents ? 1.96 * Math.sqrt(Math.max(.0001, (polls.dem + polls.rep) / 100 - ((polls.dem - polls.rep) / 100) ** 2) / polls.respondents) * 100 : null;
  const time = (iso: string) => new Date(iso).toLocaleString(intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const ratings = sources.ratings;

  const onAir = [
    polls ? t("Polls: {lead} ({n} polls, latest {date})", { lead: lead(polls.margin), n: polls.polls, date: day(polls.latest) }) : t("No public polls"),
    ratings?.consensus ? t("experts: {rating}", { rating: t(ratings.consensus) }) : null,
    market ? t("Polymarket: {odds}", { odds: `${pct(market.p >= .5 ? market.p : 1 - market.p)} ${market.p >= .5 ? side : "R"}` }) : null,
    t("MP-26: {lead} ({p}; between {low} and {high} in 80% of cases)", { lead: lead(mp26.margin), p: `${pct(mp26.p >= .5 ? mp26.p : 1 - mp26.p)} ${mp26.p >= .5 ? side : "R"}`, low: lead(mp26.range[0]), high: lead(mp26.range[1]) }),
    census ? t("Census-26: {lead} (between {low} and {high})", { lead: lead(census.margin), low: lead(census.range[0]), high: lead(census.range[1]) }) : null,
  ].filter(Boolean).join(" · ");

  return <section className="panel readings-sources">
    <div className="panel-head"><div><p className="eyebrow">{t("WHERE EVERY NUMBER COMES FROM")}</p><h2>{t("Before you quote {name}", { name })}</h2></div></div>
    <p className="readings-onair"><b>{t("To say on air")}</b> {onAir}.{!solid && polls ? ` ${t("Few or old polls: lead with the expert rating.")}` : ""}</p>
    <dl className="readings-sources-list">
      <div>
        <dt>{t("Polls")}</dt>
        <dd>{polls ? <>
          <p>{t("Weighted average of {n} polls ({respondents} interviews), the latest from {date}: recent, larger and likely-voter polls weigh more, and each poll counts once. Source: the Vote-Scope poll index.", { n: polls.polls, respondents: polls.respondents.toLocaleString(intl), date: day(polls.latest) })}</p>
          {sampling !== null && <p className="readings-error">{t("Sampling error of the margin: ±{e} points (95%). Real poll error is larger, especially in districts: polls are few and often paid for by campaigns.", { e: one(sampling) })}</p>}
          {!solid && <p className="readings-warn">{t("Fewer than 3 polls or none in the last 45 days: do not quote this average on its own.")}</p>}
          <ul className="readings-polls">{polls.list.slice(0, 8).map((poll) => <li key={`${poll.pollster}-${poll.date}`}><a href={poll.url} target="_blank" rel="noopener">{poll.pollster}</a><span>{day(poll.date)} · {poll.population}{poll.sample ? ` · n=${poll.sample.toLocaleString(intl)}` : ""}</span><b className={poll.dem >= poll.rep ? "dem-text" : "rep-text"}>{lead(poll.dem - poll.rep)}</b></li>)}</ul>
        </> : <p>{t("No public polls of this race in the Vote-Scope index in the last 180 days.")}</p>}</dd>
      </div>
      <div>
        <dt>{t("Markets")}</dt>
        <dd>{market ? <p>{t("Polymarket price read at {time}, {volume} traded. It is what traders bet, not a poll: thin markets move with a few bets.", { time: time(sources.marketRead!), volume: money(market.volume) })}</p>
          : <p>{readings.key.startsWith("house:") ? t("Polymarket has no market for single House districts.") : t("No Polymarket market for this race.")}</p>}</dd>
      </div>
      <div>
        <dt>{t("Experts")}</dt>
        <dd>{ratings ? <p>{(["cook", "ie", "sabato"] as const).map((key) => `${{ cook: "Cook", ie: "Inside Elections", sabato: "Sabato" }[key]}: ${ratings.book[key] ? t(ratings.book[key]!) : "—"}${ratings.dates[key] ? ` (${day(ratings.dates[key]!)})` : ""}`).join(" · ")}{ratings.consensus ? ` → ${t("consensus {rating}", { rating: t(ratings.consensus) })}` : ""}.</p> : <p>{t("Not rated.")}</p>}</dd>
      </div>
      <div>
        <dt>MP-26</dt>
        <dd><p>{t("Starts from the Vote-Scope margin of {date}, moved {move} by the generic-ballot polls since; the probability comes from 50,000 simulations. Typical error per race: ±{e} points of margin (2018 and 2022 backtest).", { date: day(sources.benchmarkDate), move: `${sources.movement >= 0 ? "D" : "R"}+${one(Math.abs(sources.movement))}`, e: one(MP26_RACE_RMSE) })}</p>
          <p className="readings-error">{t("80% range: {low} to {high}, the model's own uncertainty (±{half} points). In the backtest real misses were smaller (±{e}), so the range is on the cautious side.", { low: lead(mp26.range[0]), high: lead(mp26.range[1]), half: one((mp26.range[1] - mp26.range[0]) / 2), e: one(MP26_RACE_RMSE) })}</p></dd>
      </div>
      <div>
        <dt>Census-26</dt>
        <dd>{census && sources.census ? <><p>{t("Only the district's census profile (ACS), no polls; model run of {date}. Typical error: ±{e} points of margin. Use it as a contrast, not as a forecast.", { date: day(sources.census.generated), e: one(sources.census.rmse) })}</p>
          <p className="readings-error">{t("80% range: {low} to {high}, including the uncertainty about the national environment.", { low: lead(census.range[0]), high: lead(census.range[1]) })}</p></> : <p>{t("Covers House districts only.")}</p>}</dd>
      </div>
    </dl>
  </section>;
}

// One line of sources and dates under a broadcast scene.
export function SourcesLine({ readings }: { readings: RaceReadings }) {
  const { t, day } = useFormat();
  const { polls, market, census, sources } = readings;
  const cook = sources.ratings?.dates.cook;
  return <p className="readings-sources-line">{[
    polls ? t("Polls: Vote-Scope index, {n} polls to {date}", { n: polls.polls, date: day(polls.latest) }) : t("No public polls"),
    market ? "Polymarket" : null,
    t("MP-26: Vote-Scope of {date}", { date: day(sources.benchmarkDate) }),
    census ? t("Census-26: ACS census") : null,
    cook ? t("Cook rating of {date}", { date: day(cook) }) : null,
  ].filter(Boolean).join(" · ")}</p>;
}

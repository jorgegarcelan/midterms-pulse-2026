"use client";

import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { readingsDisagree, type ChamberReadings, type RaceReadings } from "@/lib/readings-shared";
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
  const { polls, market, mp26, census } = readings;
  const rows: Row[] = [
    polls
      ? { label: t("Polls"), value: lead(polls.margin), tone: tone(polls.margin), detail: `${side} ${one(polls.dem)} · R ${one(polls.rep)} · ${t("{n} polls, latest {date}", { n: polls.polls, date: day(polls.latest) })}` }
      : { label: t("Polls"), value: null, tone: "", detail: t("No public polls") },
    market
      ? { label: t("Markets"), value: `${pct(market.p >= .5 ? market.p : 1 - market.p)} ${market.p >= .5 ? side : "R"}`, tone: tone(market.p - .5), detail: t("Polymarket · {volume} traded", { volume: money(market.volume) }), href: market.url }
      : { label: t("Markets"), value: null, tone: "", detail: readings.key.startsWith("house:") ? t("No market of its own: Polymarket only lists the whole House") : t("No market") },
    { label: "MP-26", value: lead(mp26.margin), tone: tone(mp26.margin), detail: chance(mp26.p) },
    census
      ? { label: "Census-26", value: lead(census.margin), tone: tone(census.margin), detail: chance(census.p) }
      : { label: "Census-26", value: null, tone: "", detail: t("House only") },
  ];
  return <Rows rows={rows} variant={variant} flag={readingsDisagree(readings) ? t("They disagree on who leads") : null} />;
}

// One chamber, four readings: generic ballot, the control market, MP-26 and Census-26 majority odds.
export function ChamberReadingsView({ readings, variant = "panel" }: { readings: ChamberReadings; variant?: "card" | "panel" | "stream" }) {
  const { t, one, pct } = useFormat();
  const odds = (p: number) => ({ value: `${pct(p >= .5 ? p : 1 - p)} ${p >= .5 ? "D" : "R"}`, tone: p >= .5 ? "dem-text" : "rep-text" });
  const { polls, market, mp26, census } = readings;
  const rows: Row[] = [
    polls
      ? { label: t("Polls"), value: `${polls.margin >= 0 ? "D" : "R"}+${one(Math.abs(polls.margin))}`, tone: polls.margin >= 0 ? "dem-text" : "rep-text", detail: t("Generic ballot average") }
      : { label: t("Polls"), value: null, tone: "", detail: t("No national Senate poll: each state votes its own race") },
    market
      ? { label: t("Markets"), ...odds(market.p), detail: t("Polymarket: chance of control"), href: market.url }
      : { label: t("Markets"), value: null, tone: "", detail: t("No market") },
    { label: "MP-26", ...odds(mp26.p), detail: t("chance of a majority · {seats} D seats (80%: {low}–{high})", { seats: mp26.seats, low: mp26.interval[0], high: mp26.interval[1] }) },
    census
      ? { label: "Census-26", ...odds(census.p), detail: t("chance of a majority · {seats} D seats (80%: {low}–{high})", { seats: census.seats, low: census.interval[0], high: census.interval[1] }) }
      : { label: "Census-26", value: null, tone: "", detail: t("House only") },
  ];
  return <Rows rows={rows} variant={variant} />;
}

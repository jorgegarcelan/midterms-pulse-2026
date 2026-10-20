"use client";

import { useEffect, useState } from "react";
import Link from "@/components/i18n/link";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { SiteFooter } from "@/components/site-footer";
import type { ChamberOverview, Overview } from "@/lib/overview-shared";
import { RaceTicker } from "@/components/motion/race-ticker";
import { PulseStory } from "@/components/pulse/pulse-story";
import "@/components/readings/readings.css";

// What the polls, the markets and the expert raters say about one chamber. The models have their own tabs.
function ChamberOutlook({ chamber, label, data }: { chamber: "house" | "senate"; label: string; data: ChamberOverview | null }) {
  const t = useT();
  const intl = useIntlLocale();
  const one = (value: number) => value.toLocaleString(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const odds = (p: number) => `${Math.round((p >= .5 ? p : 1 - p) * 100)}% ${p >= .5 ? "D" : "R"}`;
  if (!data) return <article className="panel home-reading"><p className="eyebrow">{label}</p><div className="race-readings-wait" aria-busy="true" /></article>;
  const leaders = data.pollLeaders;
  const notUp = data.notUp;
  const rows: { label: string; value: string; tone: string; detail: string; href?: string }[] = [
    chamber === "house" && data.polls
      ? { label: t("Polls"), value: `${data.polls.margin >= 0 ? "D" : "R"}+${one(Math.abs(data.polls.margin))}`, tone: data.polls.margin >= 0 ? "dem-text" : "rep-text", detail: t("Generic ballot average") }
      : leaders && notUp
        ? { label: t("Polls"), value: `${notUp.D + leaders.D} – ${notUp.R + leaders.R}`, tone: notUp.D + leaders.D >= 51 ? "dem-text" : notUp.R + leaders.R >= 50 ? "rep-text" : "", detail: t("D–R seats if every poll leader wins ({none} races without polls)", { none: leaders.none }) }
        : { label: t("Polls"), value: "—", tone: "", detail: "" },
    data.market
      ? { label: t("Markets"), value: odds(data.market.p), tone: data.market.p >= .5 ? "dem-text" : "rep-text", detail: t("Polymarket: chance of control"), href: data.market.url }
      : { label: t("Markets"), value: "—", tone: "", detail: t("No market") },
    {
      label: t("Ratings"), value: `${(notUp?.D ?? 0) + data.ratings.D} · ${data.ratings.toss} · ${(notUp?.R ?? 0) + data.ratings.R}`, tone: "",
      detail: notUp ? t("D seats · toss-ups · R seats, with the {d} D and {r} R seats not up (Cook, IE, Sabato)", { d: notUp.D, r: notUp.R }) : t("Seats favouring D · toss-ups · favouring R (Cook, IE, Sabato)"),
    },
  ];
  return <article className="panel home-reading">
    <div className="panel-head"><div><p className="eyebrow">{label}</p><h3>{t("{n} seats for a majority", { n: data.majority })}</h3></div></div>
    <div className="readings card"><dl>{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd><strong className={row.tone}>{row.value}</strong><small>{row.href ? <a href={row.href} target="_blank" rel="noopener">{row.detail} ↗</a> : row.detail}</small></dd></div>)}</dl></div>
  </article>;
}

export default function Home() {
  const t = useT();
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/overview").then((response) => response.ok ? response.json() as Promise<Overview> : null).then((payload) => { if (!cancelled && payload) setOverview(payload); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="page-main home-main">
      <PulseStory races={overview?.races || []} house={overview?.house || null} senate={overview?.senate || null} />
      <section className="dashboard-shell" id="top">
        <RaceTicker races={overview?.races || []} />

        <section className="home-readings" id="signals" aria-label={t("Polls, markets and ratings")}>
          <div className="home-readings-head"><p className="eyebrow">{t("POLLS, MARKETS AND RATINGS")}</p><h2>{t("What the voters, the money and the experts say")}</h2></div>
          <div className="home-readings-grid">
            <ChamberOutlook chamber="house" label={t("U.S. HOUSE")} data={overview?.house || null} />
            <ChamberOutlook chamber="senate" label={t("U.S. SENATE")} data={overview?.senate || null} />
          </div>
        </section>

        <nav className="home-explore" aria-label={t("Explore")}>
          {[
            { href: "/key-races", title: "Key races", note: "Calle 14's guide, with the four readings" },
            { href: "/races", title: "Every race", note: "Map and list of the 470 House and Senate races" },
            { href: "/model", title: "MP-26", note: "My forecast from polls and fundamentals" },
            { href: "/census", title: "Census-26", note: "My forecast from demographics alone, no polls" },
            { href: "/election-night", title: "Election night", note: "Poll closings hour by hour, and the results live" },
          ].map((item) => <Link key={item.href} href={item.href} className="panel home-explore-card"><b>{t(item.title)}</b><span>{t(item.note)}</span><i aria-hidden="true">→</i></Link>)}
        </nav>

        <SiteFooter />
      </section>
    </main>
  );
}

"use client";

import Link from "@/components/i18n/link";
import { useT } from "@/components/i18n/locale-provider";
import type { Race } from "@/data/election";
import { raceSlug } from "@/lib/races";
import { ScrambleText } from "@/components/motion/scramble-text";

// Broadcast chyron: the closest contests loop continuously; hover or focus pauses it.
export function RaceTicker({ races, live }: { races: Race[]; live: boolean }) {
  const t = useT();
  const senate = races.filter((race) => race.chamber === "senate").sort((a, b) => a.margin - b.margin).slice(0, 8);
  const house = races.filter((race) => race.chamber === "house").sort((a, b) => a.margin - b.margin).slice(0, 12);
  const items = [...senate, ...house].sort((a, b) => a.margin - b.margin);
  if (!items.length) return null;

  const row = (copy: number) => items.map((race) => (
    <Link key={`${copy}-${race.chamber}-${race.code}`} className="ticker-item" href={`/races/${raceSlug(race)}`} tabIndex={copy ? -1 : undefined} aria-hidden={copy ? true : undefined}>
      <strong>{race.chamber === "senate" ? `${race.code} SEN` : race.code}</strong>
      <small>{t(race.chamber === "senate" ? "Senate" : "House")}</small>
      <b className={race.leader === "D" ? "dem-text" : "rep-text"}>{race.leader}+{race.margin.toFixed(1)}</b>
      <em>{race.winProbability}%</em>
    </Link>
  ));

  return (
    <section className="ticker" data-motion aria-label={t("Closest races ticker")}>
      <div className="ticker-badge"><i /><ScrambleText text={t(live ? "Live model" : "Snapshot")} delay={700} duration={600} /></div>
      <div className="ticker-viewport">
        <div className="ticker-track" style={{ "--ticker-duration": `${items.length * 3.4}s` } as React.CSSProperties}>{row(0)}{row(1)}</div>
      </div>
    </section>
  );
}

"use client";

import Link from "@/components/i18n/link";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import type { RaceOverview } from "@/lib/overview-shared";
import { ScrambleText } from "@/components/motion/scramble-text";

const closeness = (race: RaceOverview) => Math.abs(race.rating?.score ?? 0) * 10 + Math.abs(race.polls?.margin ?? 5);
const tone = (score: number) => (score > 0 ? "dem-text" : score < 0 ? "rep-text" : "toss-text");

// Broadcast chyron: the most contested races by the raters' consensus, with their polling average.
export function RaceTicker({ races }: { races: RaceOverview[] }) {
  const t = useT();
  const intl = useIntlLocale();
  const pick = (chamber: "house" | "senate", count: number) => races.filter((race) => race.chamber === chamber && race.rating).sort((a, b) => closeness(a) - closeness(b)).slice(0, count);
  const items = [...pick("senate", 8), ...pick("house", 12)].sort((a, b) => closeness(a) - closeness(b));
  if (!items.length) return null;
  const lean = (race: RaceOverview, margin: number) => `${margin >= 0 ? race.side : "R"}+${Math.abs(margin).toLocaleString(intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

  const row = (copy: number) => items.map((race) => (
    <Link key={`${copy}-${race.key}`} className="ticker-item" href={`/races/${race.chamber === "senate" ? `${race.code.toLowerCase()}-senate` : race.code.toLowerCase()}`} tabIndex={copy ? -1 : undefined} aria-hidden={copy ? true : undefined}>
      <strong>{race.chamber === "senate" ? `${race.code} SEN` : race.code}</strong>
      <small>{t(race.chamber === "senate" ? "Senate" : "House")}</small>
      <b className={tone(race.rating!.score)}>{t(race.rating!.label)}</b>
      <em>{race.polls ? t("polls {lean}", { lean: lean(race, race.polls.margin) }) : t("no polls")}</em>
    </Link>
  ));

  return (
    <section className="ticker" data-motion aria-label={t("Closest races ticker")}>
      <div className="ticker-badge"><i /><ScrambleText text={t("Ratings and polls")} delay={700} duration={600} /></div>
      <div className="ticker-viewport">
        <div className="ticker-track" style={{ "--ticker-duration": `${items.length * 3.4}s` } as React.CSSProperties}>{row(0)}{row(1)}</div>
      </div>
    </section>
  );
}

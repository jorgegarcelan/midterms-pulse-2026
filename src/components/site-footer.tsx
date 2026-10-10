"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import Link from "@/components/i18n/link";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { NAV_GROUPS } from "@/components/nav/main-nav";
import { localePath, stripLocale } from "@/i18n/config";
import { MODEL_VERSION } from "@/lib/mp26";

const ELECTION = Date.parse("2026-11-03T05:00:00Z");

const SOURCES = [
  { name: "Vote-Scope", href: "https://vote-scope.com/api/" },
  { name: "FEC", href: "https://www.fec.gov/data/" },
  { name: "Census ACS", href: "https://www.census.gov/programs-surveys/acs" },
  { name: "MIT Election Lab", href: "https://electionlab.mit.edu/data" },
  { name: "Cook · IE · Sabato", href: "https://en.wikipedia.org/wiki/2026_United_States_House_of_Representatives_election_ratings" },
  { name: "Polymarket", href: "https://polymarket.com" },
];

const SOCIAL = [
  { label: "X", href: "https://x.com/jgarcelan" },
  { label: "LinkedIn", href: "https://linkedin.com/in/jgarcelan" },
  { label: "GitHub", href: "https://github.com/jorgegarcelan/midterms-pulse-2026" },
  { label: "jorgegarcelan.com", href: "https://jorgegarcelan.com/" },
];

// Site-wide footer: brand and model status, the navigation groups, data sources and the author.
export function SiteFooter() {
  const t = useT();
  const locale = useLocale();
  const pathname = stripLocale(usePathname());
  const other = locale === "es" ? "en" : "es";
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setDays(Math.max(0, Math.ceil((ELECTION - Date.now()) / 86_400_000))), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Link href="/" className="footer-logo" aria-label={t("Midterm Pulse 2026 home")}><BrandMark /><span>Midterm <em>Pulse</em> <small>2026</small></span></Link>
          <p>{t("An independent, open forecast of the 2026 US midterms, told in Spanish: every race, every source, every assumption in the open.")}</p>
          <div className="footer-status">
            <span><i className="footer-dot" />{MODEL_VERSION} · {t("updated daily")}</span>
            <span>{t("Experimental model · not a prediction of certainty")}</span>
          </div>
          <div className="footer-cta">
            <Link href="/election-night" className="footer-night"><i aria-hidden="true" />{t("Election night")}{days !== null && days > 0 && <small>{t("{n} days to go", { n: days })}</small>}</Link>
            <Link href="/stream" className="footer-stream">{t("Stream mode")} →</Link>
          </div>
        </div>
        <nav className="footer-columns" aria-label={t("Footer navigation")}>
          <div><p className="eyebrow">{t("Start")}</p><Link href="/">{t("Dashboard")}</Link><Link href="/election-night">{t("Election night")}</Link><Link href="/about">{t("About")}</Link></div>
          {NAV_GROUPS.map((group) => <div key={group.key}><p className="eyebrow">{t(group.label)}</p>{group.items.filter((item) => item.href !== "/about").map((item) => <Link key={item.href} href={item.href}>{t(item.label)}</Link>)}</div>)}
        </nav>
      </div>

      <div className="footer-sources">
        <span>{t("Data")}</span>
        {SOURCES.map((source) => <a key={source.name} href={source.href} target="_blank" rel="noreferrer">{source.name}</a>)}
        <Link href="/methodology" className="footer-more">{t("Methodology")} →</Link>
      </div>

      <div className="footer-bottom">
        <p>{t("Made in Madrid by")} <Link href="/about">Jorge Garcelán</Link> · {SOCIAL.map((item, index) => <span key={item.label}>{index > 0 && " · "}<a href={item.href} target="_blank" rel="noreferrer">{item.label}</a></span>)}</p>
        <p className="footer-legal">{t("Not affiliated with any party, campaign or media outlet.")}</p>
        <div className="footer-tools">
          <NextLink href={localePath(other, pathname)} hrefLang={other} className="footer-lang">{other === "en" ? "Read in English" : "Leer en español"}</NextLink>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>{t("Back to top")} ↑</button>
        </div>
      </div>
    </footer>
  );
}

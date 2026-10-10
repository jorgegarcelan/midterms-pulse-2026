"use client";

import { Suspense } from "react";
import NextLink from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "@/components/i18n/link";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { localePath, stripLocale } from "@/i18n/config";
import { BrandMark } from "@/components/brand-mark";
import { OPEN_COMMAND_EVENT } from "@/components/command-palette";
import { useDataDate, useDataStatus } from "@/components/data-status";
import { MainNav } from "@/components/nav/main-nav";

// Same page in the other language, keeping the shared context in the query string.
function LanguageLink({ pathname, query = "" }: { pathname: string; query?: string }) {
  const locale = useLocale();
  const other = locale === "es" ? "en" : "es";
  const href = localePath(other, pathname) + (query ? `?${query}` : "");
  return <NextLink className="lang-switch" href={href} hrefLang={other} aria-label={other === "en" ? "Read in English" : "Leer en español"}><b>{locale.toUpperCase()}</b><span>{other.toUpperCase()}</span></NextLink>;
}

function LanguageLinkWithQuery({ pathname }: { pathname: string }) {
  return <LanguageLink pathname={pathname} query={useSearchParams()?.toString()} />;
}

// useSearchParams needs a Suspense boundary on statically rendered pages; the fallback drops the query.
const LanguageSwitch = ({ pathname }: { pathname: string }) => <Suspense fallback={<LanguageLink pathname={pathname} />}><LanguageLinkWithQuery pathname={pathname} /></Suspense>;

export function SiteHeader() {
  const t = useT();
  const pathname = stripLocale(usePathname());
  const dataStatus = useDataStatus();
  const dataDate = useDataDate(dataStatus);


  return (
    <header className="topbar" style={{ viewTransitionName: "site-header" }}>
      <Link className="brand" href="/" aria-label={t("Midterm Pulse 2026 home")} transitionTypes={["nav-back"]}>
        <BrandMark />
        <span className="brand-name">Midterm <em>Pulse</em><small>2026</small></span>
      </Link>
      <MainNav pathname={pathname} />
      <div className="topbar-tools">
        <button type="button" className="search-trigger" onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_EVENT))} aria-label={t("Search races, states and pages")}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" /></svg><span>{t("Search")}</span><kbd>⌘K</kbd>
        </button>
        <div className={`update-pill${dataStatus?.stale ? " stale" : ""}`} title={dataStatus ? t("Vote-Scope run of {date}", { date: dataDate }) : undefined}><i /> {dataStatus?.stale ? t("Data delayed") : t("Data")} {dataDate && <span>· {dataDate}</span>}</div>
        <LanguageSwitch pathname={pathname} />
      </div>
      <span className="scroll-progress" aria-hidden="true" />
    </header>
  );
}

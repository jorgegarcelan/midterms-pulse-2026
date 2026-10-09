"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import NextLink from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "@/components/i18n/link";
import { useIntlLocale, useLocale, useT } from "@/components/i18n/locale-provider";
import { localePath, stripLocale } from "@/i18n/config";
import { BrandMark } from "@/components/brand-mark";
import { OPEN_COMMAND_EVENT } from "@/components/command-palette";

const navigation = [
  { href: "/", label: "Dashboard" },
  { href: "/model", label: "Model" },
  { href: "/districts", label: "Map" },
  { href: "/races", label: "Races" },
  { href: "/candidates", label: "Candidates" },
  { href: "/geography", label: "Geography" },
  { href: "/playground", label: "Playground" },
  { href: "/election-night", label: "Election night" },
];

// Everything else lives in a "More" menu so the bar stays on one line.
const more = [
  { href: "/polls", label: "Polls" },
  { href: "/markets", label: "Markets" },
  { href: "/changes", label: "What changed" },
  { href: "/live", label: "Live" },
  { href: "/history", label: "History" },
  { href: "/stream", label: "Stream mode" },
];

function MoreMenu({ pathname }: { pathname: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const active = more.some((item) => isActive(item.href, pathname));
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", close); };
  }, [open]);
  useEffect(() => { const timer = window.setTimeout(() => setOpen(false), 0); return () => window.clearTimeout(timer); }, [pathname]);
  return <div className={`nav-more${active ? " active" : ""}`} ref={menu}>
    <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>{t("More")} <span aria-hidden="true">▾</span></button>
    {open && <div className="nav-more-menu" role="menu">{more.map((item) => <Link key={item.href} role="menuitem" href={item.href} className={isActive(item.href, pathname) ? "active" : ""}>{t(item.label)}</Link>)}</div>}
  </div>;
}

function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

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
  const intl = useIntlLocale();
  const pathname = stripLocale(usePathname());
  const [today, setToday] = useState("");
  const current = navigation.findIndex((item) => isActive(item.href, pathname));

  useEffect(() => {
    const timer = window.setTimeout(() => setToday(new Date().toLocaleDateString(intl, { month: "short", day: "numeric" })), 0);
    return () => window.clearTimeout(timer);
  }, [intl]);

  return (
    <header className="topbar" style={{ viewTransitionName: "site-header" }}>
      <Link className="brand" href="/" aria-label={t("Midterm Pulse 2026 home")} transitionTypes={["nav-back"]}>
        <BrandMark />
        <span className="brand-name">Midterm <em>Pulse</em><small>2026</small></span>
      </Link>
      <nav aria-label={t("Main navigation")}>
        {navigation.map((item, index) => {
          const active = index === current;
          return <Link className={active ? "active" : ""} href={item.href} key={item.href} transitionTypes={[current !== -1 && index < current ? "nav-back" : "nav-forward"]} aria-current={active ? "page" : undefined}>
            {t(item.label)}
            {active && <i className="nav-ink" style={{ viewTransitionName: "nav-ink" }} aria-hidden="true" />}
          </Link>;
        })}
        <MoreMenu pathname={pathname} />
      </nav>
      <div className="topbar-tools">
        <button type="button" className="search-trigger" onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_EVENT))} aria-label={t("Search races, states and pages")}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" /></svg><span>{t("Search")}</span><kbd>⌘K</kbd>
        </button>
        <div className="update-pill"><i /> {t("Live data")} {today && <span>· {today}</span>}</div>
        <LanguageSwitch pathname={pathname} />
      </div>
      <span className="scroll-progress" aria-hidden="true" />
    </header>
  );
}

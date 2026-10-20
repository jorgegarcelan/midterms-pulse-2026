"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "@/components/i18n/link";
import { useT } from "@/components/i18n/locale-provider";

type Item = { href: string; label: string; note: string };
// A group with `href` is a direct link in the top bar (the two models); its items still list its pages in
// the footer and the mobile menu.
type Group = { key: string; label: string; items: Item[]; href?: string };

export const NAV_GROUPS: Group[] = [
  { key: "races", label: "Races", items: [
    { href: "/races", label: "Races: map and list", note: "All 470 House and Senate races" },
    { href: "/key-races", label: "Key races", note: "Calle 14's guide, with the four readings" },
    { href: "/states", label: "States", note: "Each state's Senate race and House districts" },
    { href: "/candidates", label: "Candidates", note: "Every 2026 nominee" },
  ] },
  { key: "mp26", label: "MP-26", href: "/model", items: [
    { href: "/model", label: "Forecast", note: "House and Senate odds from polls and fundamentals" },
    { href: "/how-it-works", label: "How it works", note: "The model, stage by stage" },
    { href: "/validation", label: "Validation", note: "How it would have done in 2018 and 2022" },
    { href: "/methodology", label: "Sources", note: "Data, pipeline and status" },
  ] },
  { key: "census26", label: "Census-26", href: "/census", items: [
    { href: "/census", label: "Forecast", note: "House and Senate from demographics alone, no polls" },
    { href: "/census/how-it-works", label: "How it works", note: "What it reads, twin districts, play the model" },
    { href: "/census/validation", label: "Validation", note: "House and Senate 2016–2024, predicted blind" },
    { href: "/census/vs-polls", label: "Census vs polls", note: "Where demographics and MP-26 disagree" },
    { href: "/census/limits", label: "Limits", note: "Gerrymanders, candidates and the size of the wave" },
    { href: "/census/sources", label: "Sources", note: "Data and pipeline" },
  ] },
  { key: "data", label: "Data", items: [
    { href: "/polls", label: "Polls", note: "Generic ballot, Senate and House polls" },
    { href: "/markets", label: "Markets", note: "Prediction markets against the model" },
    { href: "/changes", label: "Latest", note: "Headlines, new polls, market swings and what moved" },
  ] },
  { key: "understand", label: "Understand", items: [
    { href: "/geography", label: "Geography", note: "Seven axes of the American vote, county by county" },
    { href: "/history", label: "History", note: "Seat changes and past cycles" },
    { href: "/gerrymandering", label: "Gerrymandering", note: "How drawing lines decides elections" },
    { href: "/glossary", label: "Glossary", note: "Every term, in plain words" },
    { href: "/about", label: "About", note: "Who builds Midterm Pulse" },
  ] },
  { key: "tools", label: "Tools", items: [
    { href: "/playground", label: "Playground", note: "Scenarios, map builder and data lab" },
    { href: "/stream", label: "Stream mode", note: "Full-screen scenes for OBS" },
  ] },
];

// Midnight Eastern on election day, so the count reads whole days left.
const ELECTION = Date.parse("2026-11-03T05:00:00Z");
export const isActivePath = (href: string, pathname: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

function useDaysLeft() {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setDays(Math.max(0, Math.ceil((ELECTION - Date.now()) / 86_400_000))), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return days;
}

/*
  Grouped main navigation. Desktop: menus that open on hover or click with a one-line note per page, the
  two models as direct links, plus Home and an election-night shortcut. Mobile: a Menu button that opens
  every group as a sheet.
*/
export function MainNav({ pathname }: { pathname: string }) {
  const t = useT();
  const days = useDaysLeft();
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef(0);
  const hoverOpened = useRef(0);

  // Close everything on navigation, outside clicks and Escape.
  useEffect(() => { const timer = window.setTimeout(() => { setOpen(null); setSheet(false); }, 0); return () => window.clearTimeout(timer); }, [pathname]);
  useEffect(() => {
    if (!open && !sheet) return;
    const onPointer = (event: PointerEvent) => { const target = event.target as Node; if (!root.current?.contains(target) && !sheetRef.current?.contains(target)) { setOpen(null); setSheet(false); } };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(null); setSheet(false); } };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("pointerdown", onPointer); window.removeEventListener("keydown", onKey); };
  }, [open, sheet]);
  useEffect(() => { document.documentElement.classList.toggle("nav-sheet-open", sheet); }, [sheet]);

  const hover = (key: string | null, stamp = 0) => {
    window.clearTimeout(closeTimer.current);
    if (key) { if (open !== key) hoverOpened.current = stamp; setOpen(key); }
    else closeTimer.current = window.setTimeout(() => setOpen(null), 160);
  };
  const activeGroup = NAV_GROUPS.find((group) => group.items.some((item) => isActivePath(item.href, pathname)))?.key;
  const ink = <i className="nav-ink" style={{ viewTransitionName: "nav-ink" }} aria-hidden="true" />;
  const nightActive = isActivePath("/election-night", pathname);

  return <div className="main-nav" ref={root}>
    <nav aria-label={t("Main navigation")} className="main-nav-bar">
      <Link href="/" className={`main-nav-link${pathname === "/" ? " active" : ""}`} aria-current={pathname === "/" ? "page" : undefined}>{t("Dashboard")}{pathname === "/" && ink}</Link>
      {NAV_GROUPS.map((group) => {
        if (group.href) return <Link key={group.key} href={group.href} className={`main-nav-link${activeGroup === group.key ? " active" : ""}`} aria-current={activeGroup === group.key ? "page" : undefined}>{t(group.label)}{activeGroup === group.key && ink}</Link>;
        const isOpen = open === group.key;
        return <div key={group.key} className={`main-nav-group${isOpen ? " open" : ""}`} onPointerEnter={(event) => event.pointerType === "mouse" && hover(group.key, event.timeStamp)} onPointerLeave={(event) => event.pointerType === "mouse" && hover(null)}>
          <button type="button" className={`main-nav-link${activeGroup === group.key ? " active" : ""}`} aria-expanded={isOpen} aria-controls={`nav-${group.key}`} onClick={(event) => setOpen(isOpen && event.timeStamp - hoverOpened.current > 500 ? null : group.key)}
            onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(group.key); window.requestAnimationFrame(() => root.current?.querySelector<HTMLAnchorElement>(`#nav-${group.key} a`)?.focus()); } }}>
            {t(group.label)}<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
            {activeGroup === group.key && ink}
          </button>
          <div id={`nav-${group.key}`} className="main-nav-panel" role="menu" hidden={!isOpen}>
            {group.items.map((item) => {
              const active = isActivePath(item.href, pathname);
              return <Link key={item.href} href={item.href} role="menuitem" className={active ? "active" : ""} aria-current={active ? "page" : undefined}><b>{t(item.label)}</b><span>{t(item.note)}</span></Link>;
            })}
          </div>
        </div>;
      })}
      <Link href="/election-night" className={`main-nav-night${nightActive ? " active" : ""}`} aria-current={nightActive ? "page" : undefined}>
        <i aria-hidden="true" />{t("Election night")}{days !== null && days > 0 && <small>{t("{n} d", { n: days })}</small>}
      </Link>
    </nav>

    <button type="button" className="main-nav-burger" aria-expanded={sheet} aria-controls="nav-sheet" onClick={() => setSheet((value) => !value)}>
      <span aria-hidden="true"><i /><i /><i /></span><b>{sheet ? t("Close") : t("Menu")}</b>
    </button>
    {/* The top bar's backdrop-filter would trap a fixed sheet inside it, so the sheet renders on <body>. */}
    {sheet && createPortal(<div id="nav-sheet" className="main-nav-sheet" ref={sheetRef}>
      <Link href="/" className={pathname === "/" ? "active" : ""}><b>{t("Dashboard")}</b></Link>
      <Link href="/election-night" className={`sheet-night${nightActive ? " active" : ""}`}><b>{t("Election night")}</b>{days !== null && days > 0 && <span>{t("{n} days to go", { n: days })}</span>}</Link>
      {NAV_GROUPS.map((group) => <section key={group.key}>
        <p className="eyebrow">{t(group.label)}</p>
        {group.items.map((item) => <Link key={item.href} href={item.href} className={isActivePath(item.href, pathname) ? "active" : ""}><b>{t(item.label)}</b><span>{t(item.note)}</span></Link>)}
      </section>)}
    </div>, document.body)}
  </div>;
}

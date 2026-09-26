"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Dashboard" },
  { href: "/model", label: "Model" },
  { href: "/districts", label: "Map" },
  { href: "/races", label: "Races" },
  { href: "/polls", label: "Polls" },
  { href: "/markets", label: "Markets" },
  { href: "/live", label: "Live" },
  { href: "/history", label: "History" },
];

function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [today, setToday] = useState("");
  const current = navigation.findIndex((item) => isActive(item.href, pathname));

  useEffect(() => {
    const timer = window.setTimeout(() => setToday(new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <header className="topbar" style={{ viewTransitionName: "site-header" }}>
      <Link className="brand" href="/" aria-label="Midterm Pulse 2026 home" transitionTypes={["nav-back"]}>
        <span className="brand-mark" aria-hidden="true"><i /><i /><b /></span>
        <span className="brand-name">Midterm <em>Pulse</em><small>2026</small></span>
      </Link>
      <nav aria-label="Main navigation">
        {navigation.map((item, index) => {
          const active = index === current;
          return <Link className={active ? "active" : ""} href={item.href} key={item.href} transitionTypes={[current !== -1 && index < current ? "nav-back" : "nav-forward"]} aria-current={active ? "page" : undefined}>
            {item.label}
            {active && <i className="nav-ink" style={{ viewTransitionName: "nav-ink" }} aria-hidden="true" />}
          </Link>;
        })}
      </nav>
      <div className="update-pill"><i /> Live data {today && <span>· {today}</span>}</div>
      <span className="scroll-progress" aria-hidden="true" />
    </header>
  );
}

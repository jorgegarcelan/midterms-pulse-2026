"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Dashboard" },
  { href: "/workspace", label: "Workspace" },
  { href: "/explore", label: "Explore" },
  { href: "/polls", label: "Polls" },
  { href: "/markets", label: "Markets" },
  { href: "/live", label: "Live" },
  { href: "/history", label: "History" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Midterm Pulse 2026 home">
        <span className="brand-mark" aria-hidden="true"><i /><i /><b /></span>
        <span className="brand-name">Midterm <em>Pulse</em><small>2026</small></span>
      </Link>
      <nav aria-label="Main navigation">
        {navigation.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link className={active ? "active" : ""} href={item.href} key={item.href}>{item.label}</Link>;
        })}
      </nav>
      <div className="update-pill"><i /> Live data <span>· Sep 20</span></div>
    </header>
  );
}

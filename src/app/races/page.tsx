import type { Metadata } from "next";
import { RacesExplorer } from "@/components/races-explorer";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "Race Directory — Midterm Pulse 2026", description: "Search every modeled 2026 U.S. House and Senate race." };

export default function RacesPage() {
  return <main className="page-main"><div className="content-shell races-shell"><RacesExplorer /><SiteFooter /></div></main>;
}

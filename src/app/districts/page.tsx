import type { Metadata } from "next";
import { DistrictMap } from "@/components/district-map";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "Congressional District Map — Midterm Pulse 2026", description: "Interactive 119th Congress district map with Midterm Pulse race forecasts." };

export default function DistrictsPage() {
  return <main className="page-main"><div className="content-shell district-shell"><DistrictMap /><SiteFooter /></div></main>;
}

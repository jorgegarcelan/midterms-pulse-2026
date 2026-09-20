import type { Metadata } from "next";
import { ModelDashboard } from "@/components/model-dashboard";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "Forecast Model — Midterm Pulse 2026", description: "Explore the assumptions and distributions behind the Midterm Pulse experimental forecast." };

export default function ModelPage() {
  return <main className="page-main"><div className="content-shell model-shell"><ModelDashboard /><SiteFooter /></div></main>;
}

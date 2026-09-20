import type { Metadata } from "next";
import { RaceProfile } from "@/components/race-profile";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "Race Profile — Midterm Pulse 2026", description: "Detailed 2026 congressional race profile with model, candidates, finance, polls and geography." };

export default async function RaceProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main className="page-main"><div className="content-shell race-profile-shell"><RaceProfile slug={slug} /><SiteFooter /></div></main>;
}

import type { Metadata } from "next";
import { RaceProfile } from "@/components/race-profile";
import { SiteFooter } from "@/components/site-footer";
import { parseRaceSlug, raceName } from "@/lib/races";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const parsed = parseRaceSlug((await params).slug);
  const name = parsed ? raceName(parsed) : "Race profile";
  const title = `${name} forecast — Midterm Pulse 2026`;
  const description = `${name}: 2026 win probability, projected margin, polls, prediction markets, election history and Census profile.`;
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default async function RaceProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main className="page-main"><div className="content-shell race-profile-shell"><RaceProfile slug={slug} /><SiteFooter /></div></main>;
}

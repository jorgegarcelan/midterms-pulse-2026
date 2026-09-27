import type { Metadata } from "next";
import { InteractiveWorkspace } from "@/components/interactive-workspace";
import { SiteFooter } from "@/components/site-footer";
import { StateProfile } from "@/components/state/state-profile";
import { stateByCode } from "@/data/geography";

export async function generateMetadata({ params }: PageProps<"/states/[code]">): Promise<Metadata> {
  const name = stateByCode.get((await params).code.toUpperCase())?.name || "State";
  const title = `${name} 2026 midterms — Midterm Pulse 2026`;
  const description = `${name}: House and Senate forecasts, closest districts, Census profile and presidential history.`;
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default async function StatePage({ params }: PageProps<"/states/[code]">) {
  const { code } = await params;
  return <main className="page-main"><div className="content-shell workspace-shell"><InteractiveWorkspace initialStateCode={code} /><StateProfile code={code} /><SiteFooter /></div></main>;
}

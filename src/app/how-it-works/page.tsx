import type { Metadata } from "next";
import { ModelExplainer } from "@/components/explainer/model-explainer";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "How the Model Works — Midterm Pulse 2026",
  description: "The MP-26 forecast pipeline step by step: inputs, poll weighting, movement, race odds, error budget, 50,000 simulations and outputs.",
};

export default function HowItWorksPage() {
  return <main className="page-main"><div className="content-shell explainer-shell"><ModelExplainer /><SiteFooter /></div></main>;
}

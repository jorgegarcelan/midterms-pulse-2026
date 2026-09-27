import type { Metadata } from "next";
import { GlossaryList } from "@/components/glossary/glossary-list";
import { SiteFooter } from "@/components/site-footer";
import { GLOSSARY } from "@/data/glossary";

export const metadata: Metadata = {
  title: "Glossary — Midterm Pulse 2026",
  description: "Plain-language definitions of the election and forecasting terms used across Midterm Pulse: generic ballot, tipping point, margin, win probability and more.",
};

export default function GlossaryPage() {
  return (
    <main className="page-main">
      <div className="content-shell glossary-shell">
        <section className="page-intro glossary-intro">
          <div><p className="eyebrow">GLOSSARY · {GLOSSARY.length} TERMS</p><h1>Every term, in plain words.</h1><p>What the numbers and labels on this site mean, with an example and a link to where you will meet each one.</p></div>
        </section>
        <GlossaryList terms={GLOSSARY} />
        <SiteFooter />
      </div>
    </main>
  );
}

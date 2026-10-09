import type { Metadata } from "next";
import Link from "@/components/i18n/link";
import { SiteFooter } from "@/components/site-footer";
import { isLocale, type Locale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import "./about.css";

// Facts come from the author's public site (jorgegarcelan.com) and GitHub profile.
const LINKS = [
  { label: "Website", href: "https://jorgegarcelan.com/", handle: "jorgegarcelan.com" },
  { label: "X", href: "https://x.com/jgarcelan", handle: "@jgarcelan" },
  { label: "LinkedIn", href: "https://linkedin.com/in/jgarcelan", handle: "in/jgarcelan" },
  { label: "GitHub", href: "https://github.com/jorgegarcelan", handle: "jorgegarcelan" },
  { label: "Instagram", href: "https://www.instagram.com/jorge.garcelan/", handle: "@jorge.garcelan" },
];

const PATH = [
  { when: "2026", what: "Solutions Architect", where: "Multiverse Computing" },
  { when: "2024 –", what: "Graduate AI Researcher", where: "Universidad Carlos III de Madrid" },
  { when: "2025", what: "Solutions Architect Intern", where: "Amazon Web Services" },
  { when: "2023 – 2024", what: "Network & IT Internal Audit Intern", where: "Telefónica" },
  { when: "2023", what: "Machine Learning and AI Researcher", where: "Data Science and Policy Lab, Georgia Tech" },
  { when: "", what: "Co-founder", where: "Uniwords" },
];

const PAPERS = [
  { venue: "AVI 2026", title: "An AI Tool for Gender Bias Analysis in News Publications" },
  { venue: "Interspeech 2025", title: "Beyond Conventional Metrics: using Entropic Triangles to Explain Balancing Methods in Acoustic Scene Classification" },
  { venue: "womENcourage 2025", title: "Analyzing Women's Representation and Gender Bias in AI Media Coverage" },
  { venue: "AAAI 2023", title: "Generative AI and Discovery of Preferences for Single-Use Plastics Regulations" },
];

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "es");

export async function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  const t = getT(localeOf((await params).lang));
  return { title: t("About — Midterm Pulse 2026"), description: t("Midterm Pulse is an independent project by Jorge Garcelán, AI engineer and researcher based in Madrid.") };
}

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const t = getT(localeOf((await params).lang));
  return <main className="page-main"><div className="content-shell about-shell">
    <section className="about-hero">
      {/* eslint-disable-next-line @next/next/no-img-element -- a single small remote avatar; no image optimisation needed */}
      <img className="about-photo" src="https://avatars.githubusercontent.com/u/94297829?v=4&s=320" alt="Jorge Garcelán" width={160} height={160} />
      <div>
        <p className="eyebrow">{t("ABOUT")}</p>
        <h1>{t("Made by Jorge Garcelán")}</h1>
        <p className="about-lede">{t("AI engineer and researcher based in Madrid. Graduate AI researcher at Universidad Carlos III de Madrid, former Solutions Architect at AWS and co-founder of Uniwords.")}</p>
        <div className="about-links">{LINKS.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer"><b>{link.label}</b><span>{link.handle} ↗</span></a>)}</div>
      </div>
    </section>

    <section className="about-grid">
      <article className="panel about-card">
        <p className="eyebrow">{t("THE PROJECT")}</p>
        <h2>{t("Why Midterm Pulse")}</h2>
        <p>{t("Midterm Pulse is an independent, open forecast of the 2026 US midterms, written for Spanish-speaking readers and journalists. Every number on the site can be traced: the model's coefficients are public, every race shows its sources, and the expert ratings sit next to the model so you can see where they disagree.")}</p>
        <p>{t("It is not affiliated with any party, campaign or media outlet. The model is experimental and has not been backtested; treat it as one more signal, not a prediction of certainty.")}</p>
        <div className="about-actions"><Link href="/how-it-works">{t("How the model works →")}</Link><Link href="/methodology">{t("Sources and methodology →")}</Link></div>
      </article>
      <article className="panel about-card">
        <p className="eyebrow">{t("HOW IT IS BUILT")}</p>
        <h2>{t("Data, model and code")}</h2>
        <ul className="about-list">
          <li><b>{t("Model")}</b><span>{t("MP-26: 50,000 simulations of all 470 races, built on the Vote-Scope public benchmark and the generic-ballot polling average.")}</span></li>
          <li><b>{t("Data")}</b><span>{t("FEC filings, Census ACS, MIT Election Lab and county results, Cook / Inside Elections / Sabato ratings and Polymarket prices.")}</span></li>
          <li><b>{t("Code")}</b><span>{t("Next.js and TypeScript; the forecast is archived daily so every change can be audited.")}</span></li>
        </ul>
        <div className="about-actions"><a href="https://github.com/jorgegarcelan/midterms-pulse-2026" target="_blank" rel="noreferrer">{t("Source code on GitHub ↗")}</a></div>
      </article>
    </section>

    <section className="about-grid">
      <article className="panel about-card">
        <p className="eyebrow">{t("PATH")}</p>
        <h2>{t("Experience")}</h2>
        <ol className="about-timeline">{PATH.map((item) => <li key={item.what + item.where}><span>{item.when}</span><b>{t(item.what)}</b><small>{item.where}</small></li>)}</ol>
        <p className="about-note">{t("M.Sc. in Applied AI and B.Sc. in Data Science and Engineering at UC3M, with an exchange year at Georgia Tech.")}</p>
      </article>
      <article className="panel about-card">
        <p className="eyebrow">{t("RESEARCH")}</p>
        <h2>{t("Selected papers")}</h2>
        <p>{t("NLP, gender bias in the media and AI for public policy, including tools that help journalists analyse coverage.")}</p>
        <ul className="about-papers">{PAPERS.map((paper) => <li key={paper.title}><span>{paper.venue}</span><b>{paper.title}</b></li>)}</ul>
        <div className="about-actions"><a href="https://jorgegarcelan.com/" target="_blank" rel="noreferrer">{t("More on jorgegarcelan.com ↗")}</a></div>
      </article>
    </section>
    <SiteFooter />
  </div></main>;
}

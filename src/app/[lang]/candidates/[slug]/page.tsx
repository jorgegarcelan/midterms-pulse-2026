import type { Metadata } from "next";
import { notFound } from "next/navigation";
import directory from "../../../../../public/data/candidates-2026.json";
import { CandidateProfile } from "@/components/candidates/candidate-profile";
import { SiteFooter } from "@/components/site-footer";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { candidateState, raceKey, sharesParty, type Candidate, type CandidateData } from "@/lib/candidates";
import { raceName } from "@/lib/races";

// Server-only: the full directory stays on the server and the page receives one candidate's slice.
const data = directory as unknown as CandidateData;
const bySlug = new Map(data.candidates.map((candidate) => [candidate.slug, candidate]));

function lookup(slug: string) {
  const candidate = bySlug.get(slug.toLowerCase());
  if (!candidate) return null;
  const race = data.races[raceKey({ chamber: candidate.chamber, code: candidate.race })];
  const opponents = race.candidates.filter((item) => item !== candidate.slug).flatMap((item) => bySlug.get(item) || []);
  return { candidate, race, opponents };
}

const PARTY_WORD: Record<Candidate["party"], string> = { D: "Democratic", R: "Republican", I: "Independent", L: "Libertarian", G: "Green", O: "" };

export async function generateMetadata({ params }: PageProps<"/[lang]/candidates/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  const found = lookup(slug);
  if (!found) return { title: t("Candidate not found — Midterm Pulse 2026") };
  const { candidate } = found;
  const race = raceName({ chamber: candidate.chamber, code: candidate.race, state: candidateState(candidate) }, t);
  const title = t("{name} — {race} candidate · Midterm Pulse 2026", { name: candidate.name, race });
  const description = candidate.incumbent
    ? t("{name} ({party}), incumbent, is running for re-election in {race} on 3 November 2026: forecast, expert ratings, opponents and campaign finance.", { name: candidate.name, party: candidate.party, race })
    : t("{name} ({party}) is on the ballot in {race} on 3 November 2026: forecast, expert ratings, opponents and campaign finance.", { name: candidate.name, party: candidate.party, race });
  const path = `/candidates/${candidate.slug}`;
  return { title, description, openGraph: { title, description, type: "profile" }, twitter: { card: "summary", title, description }, alternates: { languages: { es: path, en: `/en${path}` } }, keywords: [candidate.name, race, t(PARTY_WORD[candidate.party] || candidate.partyLabel)] };
}

export default async function CandidatePage({ params }: PageProps<"/[lang]/candidates/[slug]">) {
  const { slug } = await params;
  const found = lookup(slug);
  if (!found) notFound();
  const sharedParty = sharesParty(found.candidate, found.race, bySlug);
  return <main className="page-main"><div className="content-shell cand-shell">
    <CandidateProfile candidate={found.candidate} race={found.race} opponents={found.opponents} retrieved={data.retrieved} sharedParty={sharedParty} />
    <SiteFooter />
  </div></main>;
}

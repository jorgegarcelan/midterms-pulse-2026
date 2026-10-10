import type { ForecastRace } from "@/lib/forecast";
import { expertBook, type ExpertBook } from "@/lib/expert-ratings";

/*
  General-election candidates (scripts/build-candidates.mjs → public/data/candidates-2026.json).
  Client components fetch the file from CANDIDATES_URL; server pages import it directly. Nothing here
  imports the JSON, so the ~450 KB directory never lands in a client bundle.
*/

export const CANDIDATES_URL = "/data/candidates-2026.json";

export type CandidateParty = "D" | "R" | "I" | "L" | "G" | "O";
export type BallotSystem = "partisan" | "top-two" | "top-four" | "jungle";

export type Candidate = {
  slug: string;
  name: string;
  party: CandidateParty;
  partyLabel: string;
  race: string;
  chamber: "house" | "senate";
  incumbent: boolean;
  wikipedia: string | null;
  bioguide: string | null;
  fecIds: string[];
  currentOffice: string | null;
};

export type CandidateRace = {
  code: string;
  chamber: "house" | "senate";
  state: string;
  special: boolean;
  system: BallotSystem;
  open: boolean;
  incumbents: { name: string; party: "D" | "R" | "I" | null; status: string; wikipedia: string | null; redistrictedFrom: string | null }[];
  notes: string[];
  candidates: string[];
};

export type CandidateData = {
  source: string;
  sourceUrls: string[];
  retrieved: string;
  coverage: { races: number; house: number; senate: number; candidates: number; bothMajorParties: number; sittingMembers: number };
  anomalies: string[];
  races: Record<string, CandidateRace>;
  candidates: Candidate[];
};

export const raceKey = (race: { chamber: "house" | "senate"; code: string }) => `${race.chamber}:${race.code}`;
export const candidateState = (candidate: Pick<Candidate, "race">) => candidate.race.slice(0, 2);

let pending: Promise<CandidateData> | null = null;
// One request per page view, shared by every component that needs the directory.
export function loadCandidates() {
  pending ??= fetch(CANDIDATES_URL).then((response) => {
    if (!response.ok) throw new Error("Candidate directory unavailable");
    return response.json() as Promise<CandidateData>;
  }).catch((error) => { pending = null; throw error; });
  return pending;
}

// Official, public-domain House/Senate portraits from the unitedstates/images project.
export const portraitUrl = (bioguide: string) => `https://unitedstates.github.io/images/congress/225x275/${bioguide}.jpg`;
export const wikipediaUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
export const fecCandidateUrl = (id: string) => `https://www.fec.gov/data/candidate/${id}/?cycle=2026&election_full=true`;
export const fecSearchUrl = (name: string) => `https://www.fec.gov/data/candidates/?election_year=2026&q=${encodeURIComponent(name)}`;

export function initials(name: string) {
  const parts = name.replace(/\([^)]*\)|"[^"]*"/g, "").split(/\s+/).filter((part) => /^[\p{L}]/u.test(part) && !/^(Jr|Sr|II|III|IV)\.?$/.test(part));
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// CSS modifier for the party colour: dem / rep / ind (independents and third parties).
export const partyTone = (party: CandidateParty) => party === "D" ? "dem" : party === "R" ? "rep" : party === "I" ? "ind" : "other";
export const PARTY_NAMES: Record<CandidateParty, string> = { D: "Democratic", R: "Republican", I: "Independent", L: "Libertarian", G: "Green", O: "Other parties" };

// Democratic win probability (0–100) from the model's leader probability.
export const demProbability = (race: Pick<ForecastRace, "leader" | "winProbability">) => race.leader === "D" ? race.winProbability : 100 - race.winProbability;

// A party's chance in this race; null for third parties and when the party has several candidates.
export function partyProbability(candidate: Pick<Candidate, "party">, race: ForecastRace | undefined, sharedParty: boolean) {
  if (!race || sharedParty || (candidate.party !== "D" && candidate.party !== "R")) return null;
  return candidate.party === "D" ? demProbability(race) : 100 - demProbability(race);
}

const CLOSE_RATINGS = /Toss-up|Tilt|Lean/;
// Competitive: the model gives either side 25–75 %, or any handicapper rates it Lean, Tilt or Toss-up.
export function isCompetitive(race: ForecastRace | undefined) {
  if (!race) return false;
  const p = demProbability(race);
  if (p >= 25 && p <= 75) return true;
  const book = expertBook(race)?.book;
  return Boolean(book && Object.values(book).some((rating) => rating && CLOSE_RATINGS.test(rating)));
}

export const expertRatings = (race: ForecastRace | undefined): ExpertBook | null => race ? expertBook(race)?.book || null : null;

// Distance from a coin flip: 0 = dead even, 50 = certain. Unknown races sort last.
export const competitiveness = (race: ForecastRace | undefined) => race ? Math.abs(demProbability(race) - 50) : 99;

// Another candidate of the same party is on this ballot (top-two, top-four or jungle races): the model
// forecasts parties, so its probability cannot be read as this person's chance.
export function sharesParty(candidate: Pick<Candidate, "slug" | "party">, race: CandidateRace, candidates: Map<string, Candidate>) {
  return race.candidates.some((slug) => slug !== candidate.slug && candidates.get(slug)?.party === candidate.party);
}

const nameTokens = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
  .replace(/\b(JR|SR|II|III|IV|MR|MRS|MS|DR|HON)\b\.?/g, " ").replace(/[^A-Z ]/g, " ").split(/\s+/).filter((token) => token.length > 1);

// Common nicknames on ballots against the legal names the FEC records.
const NICKNAMES: Record<string, string[]> = {
  BOB: ["ROBERT"], ROB: ["ROBERT"], BOBBY: ["ROBERT"], BILL: ["WILLIAM"], WILL: ["WILLIAM"], BILLY: ["WILLIAM"], JIM: ["JAMES"], JIMMY: ["JAMES"],
  MIKE: ["MICHAEL"], NICK: ["NICHOLAS"], TOM: ["THOMAS"], JOE: ["JOSEPH"], DICK: ["RICHARD"], RICK: ["RICHARD"], RICH: ["RICHARD"],
  TED: ["EDWARD", "THEODORE"], TONY: ["ANTHONY"], LIZ: ["ELIZABETH"], BETH: ["ELIZABETH"], BETSY: ["ELIZABETH"], KATIE: ["KATHERINE", "KATHRYN", "CATHERINE"],
  KATE: ["KATHERINE", "KATHRYN", "CATHERINE"], ANDY: ["ANDREW"], DREW: ["ANDREW"], JACK: ["JOHN"], CHUCK: ["CHARLES"], CHARLIE: ["CHARLES"], HANK: ["HENRY"],
  JERRY: ["GERALD", "JEROME"], GREG: ["GREGORY"], JEFF: ["JEFFREY"], BEN: ["BENJAMIN"], ED: ["EDWARD"], ABE: ["ABRAHAM"], PEGGY: ["MARGARET"], MAGGIE: ["MARGARET"],
  PEG: ["MARGARET"], SANDY: ["SANDRA"], SUE: ["SUSAN"], SUZIE: ["SUSAN"], VAL: ["VALERIE"], ZACH: ["ZACHARY"], JON: ["JONATHAN"], LARRY: ["LAWRENCE"], HARRY: ["HAROLD", "HENRY"],
};

/*
  FEC names read "MACKENZIE, RYAN EDWARD". A filing matches when the surname tokens agree and the
  first name (a shortened form such as Dan/Daniel, or a known nickname such as Bob/Robert) appears
  among the given names.
*/
export function fecNameMatches(fecName: string, name: string) {
  const [lastPart, firstPart = ""] = fecName.split(",");
  const fecLast = nameTokens(lastPart);
  const fecFirst = nameTokens(firstPart);
  const tokens = nameTokens(name);
  if (!tokens.length || !fecLast.length) return false;
  const last = tokens[tokens.length - 1];
  if (!fecLast.includes(last) && !fecLast.join("").endsWith(last)) return false;
  const first = tokens[0];
  const forms = [first, ...(NICKNAMES[first] || [])];
  return fecFirst.some((token) => forms.some((form) => token === form || (token.length >= 3 && form.length >= 3 && (token.startsWith(form) || form.startsWith(token)))));
}

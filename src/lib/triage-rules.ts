import { states } from "@/data/geography";

export type Triage = { topic: string; relevance: number; urgency: number; confidence: number };

// Transparent keyword rules: the fallback for /api/triage and the auto-tagger for the live wire.
export function ruleTriage(content: string): Triage {
  const text = content.toLowerCase();
  const topic = /\bpolls?\b|survey|poll(ing|ster)/.test(text) ? "polling"
    : /\bresults?\b|\bcalled\b|projects?\b|recount|concede/.test(text) ? "results"
      : /\bvot(e|ing|ers?)\b|turnout|ballot|registration|early voting/.test(text) ? "turnout"
        : /redistrict|district map|\bmaps?\b/.test(text) ? "redistricting"
          : "campaign";
  const relevance = Math.min(.96, .52 + ["senate", "house", "midterm", "election", "poll", "vote", "congress", "campaign", "candidate", "gop", "democrat", "republican"].filter((word) => text.includes(word)).length * .08);
  const urgency = /breaking|just in|\bcalled\b|concede|announces|drops out|withdraw/.test(text) ? .9 : /\bnew\b|today|tonight|latest/.test(text) ? .68 : .36;
  return { topic, relevance, urgency, confidence: .58 };
}

const STRONG = /\b(midterms?|elections?|electoral|polls?|polling|pollsters?|voters?|voting|votes?|campaigns?|candidates?|races?|primar(y|ies)|runoffs?|redistricting|district maps?|maps?|ballots?|seats?|districts?|swing|battleground|endorse\w*|fundrais\w*)\b/i;
const CONTEXT = /\b(senate|senators?|house|congress(ional)?|gop|republicans?|democrats?|dems|speaker|majority)\b/gi;

// Election-desk relevance for headlines: one strong election term, or two political-context terms.
// "White House" is removed first so executive-branch stories do not read as House races.
export function isElectionHeadline(title: string) {
  const text = title.replace(/white house/gi, "");
  return STRONG.test(text) || (text.match(CONTEXT) || []).length >= 2;
}

const STATE_PATTERN = new RegExp(`\\b(${states.map((state) => state.name).sort((a, b) => b.length - a.length).join("|")})\\b`, "g");
const DISTRICT_PATTERN = /\b([A-Z]{2})-(\d{1,2}|AL)\b/g;

// State and district mentions, so wire items can link to race pages.
export function mentions(text: string) {
  const found = new Set<string>();
  for (const match of text.matchAll(STATE_PATTERN)) {
    const state = states.find((item) => item.name === match[1]);
    if (state) found.add(state.code);
  }
  const districts = [...text.matchAll(DISTRICT_PATTERN)].map((match) => `${match[1]}-${match[2] === "AL" ? "00" : match[2].padStart(2, "0")}`);
  return { states: [...found], districts };
}

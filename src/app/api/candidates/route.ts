import { NextRequest, NextResponse } from "next/server";

type FecCommittee = { committee_id: string; name: string; designation: string };
type FecCandidate = {
  candidate_id: string; name: string; party: string; party_full: string; candidate_status: string;
  incumbent_challenge: string; incumbent_challenge_full: string; has_raised_funds: boolean;
  principal_committees?: FecCommittee[];
};
type FecTotal = {
  candidate_id: string; candidate_election_year: number; coverage_end_date: string; receipts: number; disbursements: number;
  last_cash_on_hand_end_period: number; last_debts_owed_by_committee: number; individual_contributions: number;
};

const FEC_API = "https://api.open.fec.gov/v1";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state")?.toUpperCase() || "";
  const office = request.nextUrl.searchParams.get("office")?.toUpperCase() || "H";
  const district = request.nextUrl.searchParams.get("district") || "";
  if (!/^[A-Z]{2}$/.test(state) || !["H", "S"].includes(office) || (office === "H" && !/^\d{2}$/.test(district))) {
    return NextResponse.json({ error: "Invalid state, office, or district" }, { status: 400 });
  }

  const apiKey = process.env.FEC_API_KEY || "DEMO_KEY";
  const url = new URL(`${FEC_API}/candidates/search/`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("election_year", "2026");
  url.searchParams.set("office", office);
  url.searchParams.set("state", state);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("sort", "name");
  if (office === "H") url.searchParams.set("district", district);

  try {
    const response = await fetch(url, { next: { revalidate: 21_600 } });
    if (!response.ok) throw new Error("FEC unavailable");
    const payload = await response.json() as { results: FecCandidate[] };
    const active = payload.results.filter((candidate) => candidate.candidate_status === "C").slice(0, 16);
    const totalsUrl = new URL(`${FEC_API}/candidates/totals/`);
    for (const [key, value] of [["api_key", apiKey], ["election_year", "2026"], ["cycle", "2026"], ["office", office], ["state", state], ["per_page", "100"], ["election_full", "true"]]) totalsUrl.searchParams.set(key, value);
    if (office === "H") totalsUrl.searchParams.set("district", district);
    let totals: FecTotal[] = [];
    try {
      const totalsResponse = await fetch(totalsUrl, { next: { revalidate: 21_600 } });
      if (totalsResponse.ok) totals = ((await totalsResponse.json()) as { results: FecTotal[] }).results;
    } catch { /* Candidate identity remains useful when finance is rate-limited. */ }
    const latestTotal = new Map<string, FecTotal>();
    for (const total of totals.filter((item) => item.candidate_election_year === 2026)) {
      const current = latestTotal.get(total.candidate_id);
      if (!current || (total.coverage_end_date || "") > (current.coverage_end_date || "")) latestTotal.set(total.candidate_id, total);
    }
    const candidates = active.map((candidate) => {
      const committee = candidate.principal_committees?.find((item) => item.designation === "P") || candidate.principal_committees?.[0];
      const finance = latestTotal.get(candidate.candidate_id);
      return {
        id: candidate.candidate_id,
        name: candidate.name,
        party: candidate.party,
        partyName: candidate.party_full,
        status: candidate.incumbent_challenge_full,
        incumbentChallenge: candidate.incumbent_challenge,
        committee: committee ? { id: committee.committee_id, name: committee.name } : null,
        finance: finance ? {
          receipts: finance.receipts || 0,
          disbursements: finance.disbursements || 0,
          cashOnHand: finance.last_cash_on_hand_end_period || 0,
          debt: finance.last_debts_owed_by_committee || 0,
          individualContributions: finance.individual_contributions || 0,
          through: finance.coverage_end_date || null,
        } : null,
        profileUrl: `https://www.fec.gov/data/candidate/${candidate.candidate_id}/?cycle=2026&election_full=true`,
      };
    });
    return NextResponse.json({ candidates, source: "Federal Election Commission", sourceUrl: "https://www.fec.gov/data/candidates/", updated: new Date().toISOString() });
  } catch {
    return NextResponse.json({ candidates: [], source: "Federal Election Commission", sourceUrl: "https://www.fec.gov/data/candidates/", unavailable: true }, { status: 200 });
  }
}

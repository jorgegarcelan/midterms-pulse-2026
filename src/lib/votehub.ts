import { pollWeight } from "@/lib/mp26";
import { pollPopulation } from "@/lib/poll-index";

/*
  Governor polls from VoteHub's public polling API (https://votehub.com/polls/api/, licensed CC BY 4.0;
  credit VoteHub wherever the numbers appear). Only governors: House and Senate polls come from the
  Vote-Scope index, so the two sources never count the same poll twice.
*/

type VoteHubPoll = {
  id: string; poll_type: string; sample_size: number | null; population: string; url: string; end_date: string;
  pollster: string; internal: boolean; answers: { choice: string; pct: number }[];
};
export type GovernorAverage = { candidates: { name: string; pct: number }[]; polls: number; latest: string };

const WINDOW_DAYS = 180;

export async function governorPolls(stateName: string): Promise<VoteHubPoll[]> {
  const url = `https://api.votehub.com/polls?poll_type=governor&subject=${encodeURIComponent(`2026 ${stateName}`)}`;
  const response = await fetch(url, { headers: { "User-Agent": "midterm-pulse-2026" }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`VoteHub ${response.status}`);
  return await response.json() as VoteHubPoll[];
}

// Each named candidate's weighted average share (same weighting as the race polls); campaign internals left out.
export function governorAverage(polls: VoteHubPoll[], names: string[], today: string): GovernorAverage | null {
  const oldest = new Date(Date.parse(`${today}T00:00:00Z`) - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const surname = (name: string) => name.split(" ").at(-1)!.toLowerCase();
  const usable = polls.filter((poll) => !poll.internal && poll.end_date >= oldest);
  const sums = names.map(() => ({ value: 0, weight: 0 }));
  let latest = "";
  let counted = 0;
  for (const poll of usable) {
    const shares = names.map((name) => poll.answers.find((answer) => answer.choice.toLowerCase().includes(surname(name)))?.pct);
    if (shares.filter((share) => share !== undefined).length < 2) continue;
    const { weight } = pollWeight({ endDate: poll.end_date, sample: poll.sample_size || 0, population: pollPopulation(poll.population) }, today);
    shares.forEach((share, index) => { if (share !== undefined) { sums[index].value += share * weight; sums[index].weight += weight; } });
    counted += 1;
    if (poll.end_date > latest) latest = poll.end_date;
  }
  if (!counted) return null;
  return { candidates: names.map((name, index) => ({ name, pct: sums[index].weight ? sums[index].value / sums[index].weight : NaN })).filter((row) => Number.isFinite(row.pct)), polls: counted, latest };
}

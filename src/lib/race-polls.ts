import { isTwoPartyTopline, pollWeight } from "@/lib/mp26";
import { pollDistrict, pollPopulation, type IndexPoll } from "@/lib/poll-index";
import { fetchVoteScope } from "@/lib/vote-scope";

/*
  Polling average for one race, weighted like MP-26 weights the generic ballot: recency (30-day
  half-life) × sample size × population (LV > RV > adults). The indexes list some polls twice (two
  question versions, or LV and RV); each poll counts once, using its likely-voter version when there
  is one. Polls from before this cycle's last 180 days are left out.
*/

export type RaceAverage = { dem: number; rep: number; margin: number; polls: number; latest: string };

const WINDOW_DAYS = 180;

export async function loadRacePolls() {
  const load = (chamber: "house" | "senate") => fetchVoteScope<{ polls: IndexPoll[] }>(`us-${chamber}/polls/index.json`).then((index) => index.polls).catch(() => [] as IndexPoll[]);
  const [house, senate] = await Promise.all([load("house"), load("senate")]);
  const byRace = new Map<string, IndexPoll[]>();
  const add = (key: string, poll: IndexPoll) => byRace.set(key, [...(byRace.get(key) || []), poll]);
  for (const poll of house) { const district = pollDistrict(poll); if (district) add(`house:${district}`, poll); }
  for (const poll of senate) { const state = poll.geography?.province; if (state) add(`senate:${state}`, poll); }
  return byRace;
}

export function raceAverage(polls: IndexPoll[] | undefined, today: string): RaceAverage | null {
  const oldest = new Date(Date.parse(`${today}T00:00:00Z`) - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const usable = (polls || []).filter((poll) => poll.field_end >= oldest && isTwoPartyTopline(poll.topline.us_dem, poll.topline.us_rep));
  const once = new Map<string, IndexPoll>();
  for (const poll of usable) {
    const key = `${poll.firm_name}|${poll.field_end}`;
    const kept = once.get(key);
    if (!kept || (pollPopulation(poll.population) === "LV" && pollPopulation(kept.population) !== "LV")) once.set(key, poll);
  }
  let dem = 0, rep = 0, total = 0, latest = "";
  for (const poll of once.values()) {
    const { weight } = pollWeight({ endDate: poll.field_end, sample: poll.sample_size || 0, population: pollPopulation(poll.population) }, today);
    dem += poll.topline.us_dem! * weight;
    rep += poll.topline.us_rep! * weight;
    total += weight;
    if (poll.field_end > latest) latest = poll.field_end;
  }
  if (!total) return null;
  return { dem: dem / total, rep: rep / total, margin: (dem - rep) / total, polls: once.size, latest };
}

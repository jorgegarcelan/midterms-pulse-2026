import { NextRequest, NextResponse } from "next/server";
import { electionSnapshot } from "@/data/election";
import { seedPolls } from "@/data/polls";
import { isTwoPartyTopline } from "@/lib/mp26";
import { isGenericBallotPoll, pollDistrict, pollPopulation, type IndexPoll } from "@/lib/poll-index";

type PollIndex = { meta: { run_date: string; n_polls: number; latest_field_end: string }; polls: IndexPoll[] };

export async function GET(request: NextRequest) {
  // Callers may ask for a longer history (the model explainer); the default keeps the feed light.
  const limit = Math.min(400, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 150));
  // ?kind=generic returns only national generic-ballot polls (the model explainer); the default mixes all three kinds.
  const genericOnly = request.nextUrl.searchParams.get("kind") === "generic";
  try {
    const load = async (chamber: "house" | "senate") => {
      const response = await fetch(`https://vote-scope.com/web_data/us-${chamber}/polls/index.json`, { next: { revalidate: 900 } });
      if (!response.ok) throw new Error("Poll source unavailable");
      return response.json() as Promise<PollIndex>;
    };
    const [house, senate] = await Promise.all([load("house"), load("senate").catch(() => null)]);
    const usable = (list: IndexPoll[]) => list.filter((poll) => isTwoPartyTopline(poll.topline.us_dem, poll.topline.us_rep));
    const generic = usable(house.polls).filter(isGenericBallotPoll);

    // The trend is national generic-ballot polls only, averaged by week.
    const weekly = new Map<string, { dem: number; rep: number; count: number }>();
    for (const poll of generic) {
      const date = new Date(`${poll.field_end}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - date.getUTCDay());
      const key = date.toISOString().slice(0, 10);
      const bucket = weekly.get(key) || { dem: 0, rep: 0, count: 0 };
      bucket.dem += poll.topline.us_dem || 0;
      bucket.rep += poll.topline.us_rep || 0;
      bucket.count += 1;
      weekly.set(key, bucket);
    }
    const trend = [...weekly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-26)
      .map(([date, bucket]) => ({ date, dem: bucket.dem / bucket.count, rep: bucket.rep / bucket.count, margin: (bucket.dem - bucket.rep) / bucket.count, polls: bucket.count }));

    const row = (poll: IndexPoll, chamber: "Generic" | "House" | "Senate", race: string, state: string) => ({
      id: poll.poll_id, pollster: poll.firm_name, race, state, chamber,
      dem: poll.topline.us_dem || 0, rep: poll.topline.us_rep || 0, sample: poll.sample_size || 0,
      population: pollPopulation(poll.population), endDate: poll.field_end, startDate: poll.field_start, source: poll.source_url,
    });
    const rows = [
      ...generic.map((poll) => row(poll, "Generic", "Generic ballot", "US")),
      ...(genericOnly ? [] : usable(house.polls).flatMap((poll) => { const code = pollDistrict(poll); return code ? [row(poll, "House", code, code.slice(0, 2))] : []; })),
      ...(genericOnly || !senate ? [] : usable(senate.polls).filter((poll) => poll.geography?.province).map((poll) => row(poll, "Senate", poll.geography!.province!, poll.geography!.province!))),
    ].sort((a, b) => b.endDate.localeCompare(a.endDate)).slice(0, limit);
    const meta = { ...house.meta, n_polls: genericOnly ? generic.length : house.meta.n_polls + (senate?.meta.n_polls ?? 0), n_generic: generic.length };
    return NextResponse.json({ meta, polls: rows, trend, source: "Vote-Scope" });
  } catch {
    const trend = electionSnapshot.genericBallot.history.map((point) => ({
      date: point.date,
      dem: electionSnapshot.genericBallot.dem,
      rep: electionSnapshot.genericBallot.dem - point.margin,
      margin: point.margin,
      polls: 0,
    }));
    return NextResponse.json({
      meta: { run_date: "2026-09-19", n_polls: seedPolls.length, latest_field_end: "2026-09-18" },
      polls: seedPolls,
      trend,
      source: "Dated local snapshot",
      stale: true,
    });
  }
}

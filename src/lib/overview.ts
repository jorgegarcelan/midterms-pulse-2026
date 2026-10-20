import { stateByCode } from "@/data/geography";
import { consensus } from "@/lib/expert-ratings";
import type { ForecastRace } from "@/lib/forecast";
import type { ModelResult } from "@/lib/model";
import { fetchWinnerMarket, HOUSE_CONTROL_SLUG, SENATE_CONTROL_SLUG, senateWinnerSlug } from "@/lib/polymarket";
import { loadRacePolls, raceAverage } from "@/lib/race-polls";
import { sideOf } from "@/lib/readings";
import { seatsNotUp } from "@/lib/senate-sim";
import type { ChamberOverview, Overview, RaceOverview } from "@/lib/overview-shared";

/*
  The general layer of the site: what the polls, the markets and the expert raters say, race by race
  and for each chamber. No model numbers here; MP-26 and Census-26 live in their own sections and in
  the four readings of a race profile. Race facts (state, special, 2024 margin) come from the forecast
  feed, which carries them for every race.
*/

const key = (race: Pick<ForecastRace, "chamber" | "code">) => `${race.chamber}:${race.code}`;
const toDemSide = (market: { side: "D" | "R"; probability: number } | null) => market && (market.side === "D" ? market.probability : 1 - market.probability);

export async function overview(model: ModelResult): Promise<Overview> {
  const today = new Date().toISOString().slice(0, 10);
  const senate = model.races.filter((race) => race.chamber === "senate");
  const [polls, houseMarket, senateMarket, ...raceMarkets] = await Promise.all([
    loadRacePolls(),
    fetchWinnerMarket(HOUSE_CONTROL_SLUG, { history: false }).catch(() => null),
    fetchWinnerMarket(SENATE_CONTROL_SLUG, { history: false }).catch(() => null),
    ...senate.map((race) => fetchWinnerMarket(senateWinnerSlug(stateByCode.get(race.state)?.name || race.state), { history: false }).catch(() => null)),
  ]);
  const marketByKey = new Map(senate.map((race, index) => [key(race), toDemSide(raceMarkets[index])]));

  const races: RaceOverview[] = model.races.map((race) => {
    const average = raceAverage(polls.get(key(race)), today);
    return {
      key: key(race), chamber: race.chamber, code: race.code, state: race.state, special: race.special, side: sideOf(race),
      baseline: race.baselineMargin, rating: consensus(race),
      polls: average && { margin: average.margin, polls: average.polls, latest: average.latest },
      market: marketByKey.get(key(race)) ?? null,
    };
  });

  const tally = (chamber: "house" | "senate") => {
    const counts = { D: 0, toss: 0, R: 0 };
    for (const race of races.filter((item) => item.chamber === chamber)) {
      const score = race.rating?.score ?? 0;
      counts[score >= .25 ? "D" : score <= -.25 ? "R" : "toss"] += 1;
    }
    return counts;
  };
  const notUp = seatsNotUp(senate.map((race) => ({ code: race.code, leader: race.leader, margin: race.margin, winProbability: race.winProbability, incumbentParty: race.incumbentParty })));
  const senateRaces = races.filter((race) => race.chamber === "senate");
  const pollLeaders = {
    D: senateRaces.filter((race) => race.polls && race.polls.margin > 0 && race.side === "D").length,
    I: senateRaces.filter((race) => race.polls && race.polls.margin > 0 && race.side === "I").length,
    R: senateRaces.filter((race) => race.polls && race.polls.margin < 0).length,
    none: senateRaces.filter((race) => !race.polls).length,
  };

  const house: ChamberOverview = {
    seats: 435, majority: 218,
    polls: { margin: model.genericBallot.margin, kind: "generic" },
    market: houseMarket && { p: toDemSide(houseMarket)!, url: houseMarket.url },
    ratings: tally("house"), notUp: null, pollLeaders: null,
  };
  const senateChamber: ChamberOverview = {
    seats: 100, majority: 51,
    polls: null,
    market: senateMarket && { p: toDemSide(senateMarket)!, url: senateMarket.url },
    ratings: tally("senate"), notUp, pollLeaders,
  };
  return { updated: new Date().toISOString(), races, house, senate: senateChamber };
}

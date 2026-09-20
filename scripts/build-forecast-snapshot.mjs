import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const [housePath, senatePath, outputPath = "src/data/forecast-snapshot.json"] = process.argv.slice(2);
if (!housePath || !senatePath) {
  throw new Error("Usage: node scripts/build-forecast-snapshot.mjs <house.json> <senate.json> [output.json]");
}

const [house, senate] = await Promise.all([
  readFile(housePath, "utf8").then(JSON.parse),
  readFile(senatePath, "utf8").then(JSON.parse),
]);

function chamberSummary(payload) {
  const dem = payload.parties.find((party) => party.party === "us_dem");
  const rep = payload.parties.find((party) => party.party === "us_rep");
  return {
    demMajority: Math.round((dem?.p_majority || 0) * 100),
    demSeats: Math.round(dem?.seats_projected ?? dem?.seats_median ?? 0),
    repSeats: Math.round(rep?.seats_projected ?? rep?.seats_median ?? 0),
    interval: [Math.round(dem?.seats_ci_low_80 ?? 0), Math.round(dem?.seats_ci_high_80 ?? 0)],
    polls: payload.meta.n_polls,
  };
}

function races(payload, chamber) {
  return payload.ridings.map((race) => ({
    code: chamber === "house" ? race.name_en.replace(/-(\d)$/, "-0$1") : race.province,
    state: race.province,
    name: race.name_en,
    chamber,
    leader: race.projection.winner === "us_dem" ? "D" : "R",
    margin: Math.abs(race.projection.mean_margin),
    signedMargin: race.projection.winner === "us_dem" ? Math.abs(race.projection.mean_margin) : -Math.abs(race.projection.mean_margin),
    winProbability: Math.round(race.projection.p_winner * 100),
    closeProbability: Math.round((race.projection.p_close_race || 0) * 100),
    rating: race.projection.rating?.label_en || "Unrated",
    demVote: race.projection.vote_mean?.us_dem ?? null,
    repVote: race.projection.vote_mean?.us_rep ?? null,
    baselineDem: race.baseline_result?.us_dem_pct ?? null,
    baselineRep: race.baseline_result?.us_rep_pct ?? null,
    pollCount: race.poll_count ?? null,
    incumbentParty: race.incumbent_party === "us_dem" ? "D" : race.incumbent_party === "us_rep" ? "R" : null,
    special: Boolean(race.is_special),
  }));
}

const snapshot = {
  updated: house.meta.run_date > senate.meta.run_date ? house.meta.run_date : senate.meta.run_date,
  house: chamberSummary(house),
  senate: chamberSummary(senate),
  districts: races(house, "house"),
  senateRaces: races(senate, "senate"),
  source: "Vote-Scope",
  sourceUrl: "https://vote-scope.com/api/",
};

await writeFile(path.resolve(outputPath), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${snapshot.districts.length} House and ${snapshot.senateRaces.length} Senate races.`);

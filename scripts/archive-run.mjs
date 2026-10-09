import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchExpertRatings } from "./build-expert-ratings.mjs";

/*
  Archives today's published forecast and the handicappers' ratings, so the site can show how the
  race has moved. Run daily by .github/workflows/archive-forecast.yml on the forecast-archive branch:

    node scripts/archive-run.mjs <archive-dir> [model-url]

  Writes <archive-dir>/runs/YYYY-MM-DD.json (one compact record per race) and keeps
  <archive-dir>/index.json as the list of runs with their chamber-level numbers.
*/
const [archiveDir = "archive", modelUrl = "https://midterm-pulse-2026.vercel.app/api/model"] = process.argv.slice(2);

const response = await fetch(modelUrl, { headers: { "user-agent": "midterm-pulse-2026 archive" } });
if (!response.ok) throw new Error(`Model ${response.status}`);
const model = await response.json();
if (!model.version || !Array.isArray(model.races)) throw new Error("Unexpected model payload");
const ratings = await fetchExpertRatings().catch((error) => { console.warn(`Ratings skipped: ${error.message}`); return null; });

const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;
const chamber = (outlook) => ({ p: outlook.demMajority, seats: outlook.demSeats, low: outlook.interval80[0], high: outlook.interval80[1] });
const date = model.runDate;
const run = {
  date,
  version: model.version,
  ballot: round(model.genericBallot.margin),
  house: chamber(model.house),
  senate: chamber(model.senate),
  // [chamber, code, signed margin (D +), Democratic win probability %]
  races: model.races.map((race) => [race.chamber === "senate" ? "S" : "H", race.code, round(race.signedMargin), race.leader === "D" ? race.winProbability : 100 - race.winProbability]),
  ratings: ratings && { dates: { house: ratings.house.dates, senate: ratings.senate.dates }, house: ratings.house.races, senate: ratings.senate.races },
};

await mkdir(path.join(archiveDir, "runs"), { recursive: true });
await writeFile(path.join(archiveDir, "runs", `${date}.json`), `${JSON.stringify(run)}\n`);

const indexPath = path.join(archiveDir, "index.json");
const index = await readFile(indexPath, "utf8").then(JSON.parse).catch(() => ({ runs: [] }));
const entry = { date, version: run.version, ballot: run.ballot, house: run.house, senate: run.senate };
index.runs = [...index.runs.filter((item) => item.date !== date), entry].sort((a, b) => a.date.localeCompare(b.date));
index.updated = new Date().toISOString();
await writeFile(indexPath, `${JSON.stringify(index, null, 1)}\n`);
console.log(`Archived ${date}: House ${run.house.p}% · Senate ${run.senate.p}% · ${run.races.length} races · ${index.runs.length} runs`);

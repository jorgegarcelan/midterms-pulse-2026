import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import Papa from "papaparse";

/*
  Builds compact election-history files for race and state pages.

  House  (2000–2024, by district) and Senate (1976–2024, by state):
         FiveThirtyEight election-results (CC BY 4.0), election_results_house.csv / election_results_senate.csv
         https://github.com/fivethirtyeight/election-results
  President (1976–2024, by state):
         MIT Election Data and Science Lab, 1976-2024-president.csv
         https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/42MVDX

  Usage: node scripts/build-election-history.mjs <538-house.csv> <538-senate.csv> <mit-president.csv> [outDir]
  Output: <outDir>/house/<ST>.json, <outDir>/senate.json, <outDir>/president.json
*/
const [housePath, senatePath, presidentPath, outDir = "public/data/history"] = process.argv.slice(2);
if (!housePath || !senatePath || !presidentPath) throw new Error("Usage: node scripts/build-election-history.mjs <538-house.csv> <538-senate.csv> <mit-president.csv> [outDir]");

const AT_LARGE = new Set(["AK", "DE", "ND", "SD", "VT", "WY"]);
const round1 = (value) => Math.round(value * 10) / 10;
const parse = async (file) => Papa.parse(await readFile(file, "utf8"), { header: true, skipEmptyLines: true }).data;

// Two-party summary of one contest: top Democrat vs top Republican as shares of all votes cast.
function summarize(candidates) {
  const total = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
  const top = (party) => candidates.filter((candidate) => candidate.party === party).sort((a, b) => b.votes - a.votes)[0];
  const dem = top("D");
  const rep = top("R");
  const winner = candidates.find((candidate) => candidate.winner) || [...candidates].sort((a, b) => b.votes - a.votes)[0];
  const contested = candidates.filter((candidate) => candidate.votes > 0).length >= 2;
  const dp = dem && total ? dem.votes / total * 100 : 0;
  const rp = rep && total ? rep.votes / total * 100 : 0;
  // Unopposed seats often report no votes at all: record them as ±100 so the chart shows a safe seat.
  const m = total && contested ? dp - rp : winner?.party === "D" ? 100 : winner?.party === "R" ? -100 : 0;
  return { dp: round1(dp), rp: round1(rp), m: round1(m), w: winner?.party || "O", n: winner?.name || "", ...(contested ? {} : { u: 1 }) };
}

/*
  FiveThirtyEight rows → one summary per contest. A runoff decides the seat when there is one;
  otherwise the general (or Louisiana's November jungle primary). Ranked-choice contests use the
  final round, and fusion lines (e.g. New York's WFP/CON) are summed per candidate.
*/
function contests538(rows, keyOf) {
  const contests = new Map();
  for (const row of rows) {
    if (!["general", "jungle primary", "runoff"].includes(row.stage)) continue;
    const key = keyOf(row);
    if (!key) continue;
    const contest = contests.get(key) || new Map();
    const stage = contest.get(row.stage) || { rows: [], maxRound: 0 };
    stage.rows.push(row);
    stage.maxRound = Math.max(stage.maxRound, Number(row.ranked_choice_round) || 0);
    contest.set(row.stage, stage);
    contests.set(key, contest);
  }
  return [...contests].map(([key, contest]) => {
    const stage = contest.get("runoff") || contest.get("general") || contest.get("jungle primary");
    const byCandidate = new Map();
    for (const row of stage.rows.filter((item) => (Number(item.ranked_choice_round) || 0) === stage.maxRound)) {
      const name = row.candidate_name || row.alt_result_text || "Other";
      const candidate = byCandidate.get(name) || { name, votes: 0, party: "O", winner: false };
      candidate.votes += Number(row.votes) || 0;
      if (row.ballot_party === "DEM" || row.ballot_party === "DFL") candidate.party = "D";
      else if (row.ballot_party === "REP" && candidate.party !== "D") candidate.party = "R";
      candidate.winner ||= row.winner === "true";
      byCandidate.set(name, candidate);
    }
    return { key, ...summarize([...byCandidate.values()]) };
  });
}

// ---------- House: 2000–2024 regular elections, keyed like the model (AK-00, PA-07) ----------
const house = {};
for (const contest of contests538(await parse(housePath), (row) => {
  const year = Number(row.cycle);
  if (year < 2000 || year % 2 || row.special === "true") return null;
  const number = Number(row.office_seat_name.replace("District ", ""));
  return `${year}|${row.state_abbrev}-${AT_LARGE.has(row.state_abbrev) || number === 0 ? "00" : String(number).padStart(2, "0")}`;
})) {
  const [year, code] = contest.key.split("|");
  const { key: _key, ...summary } = contest;
  ((house[code.slice(0, 2)] ??= {})[code] ??= []).push({ y: Number(year), ...summary });
}

// ---------- Senate: 1976–2024, regular and special contests per state ----------
const senate = {};
for (const contest of contests538(await parse(senatePath), (row) => `${row.cycle}|${row.state_abbrev}|${row.special === "true" ? 1 : 0}|${row.office_seat_name}`)) {
  const [year, state, special] = contest.key.split("|");
  const { key: _key, ...summary } = contest;
  (senate[state] ??= []).push({ y: Number(year), ...(special === "1" ? { s: 1 } : {}), ...summary });
}

// ---------- President: 1976–2024 by state, plus the national popular vote ----------
const presidentRows = await parse(presidentPath);
const president = {};
const byState = new Map();
const national = new Map();
for (const row of presidentRows) {
  const votes = Number(row.candidatevotes) || 0;
  const key = `${row.year}|${row.state_po}`;
  const state = byState.get(key) || { d: 0, r: 0, total: Number(row.totalvotes) || 0 };
  if (row.party_simplified === "DEMOCRAT") state.d += votes;
  if (row.party_simplified === "REPUBLICAN") state.r += votes;
  byState.set(key, state);
}
for (const [key, state] of byState) {
  const [year, code] = key.split("|");
  const entry = national.get(year) || { d: 0, r: 0, total: 0 };
  entry.d += state.d; entry.r += state.r; entry.total += state.total;
  national.set(year, entry);
  (president[code] ??= []).push({ y: Number(year), dp: round1(state.d / state.total * 100), rp: round1(state.r / state.total * 100), m: round1((state.d - state.r) / state.total * 100), w: state.d > state.r ? "D" : "R" });
}
president.US = [...national].map(([year, entry]) => ({ y: Number(year), dp: round1(entry.d / entry.total * 100), rp: round1(entry.r / entry.total * 100), m: round1((entry.d - entry.r) / entry.total * 100), w: entry.d > entry.r ? "D" : "R" }));

const sortYears = (record) => { for (const key of Object.keys(record)) record[key].sort((a, b) => a.y - b.y || (a.s || 0) - (b.s || 0)); };
sortYears(senate);
sortYears(president);

await mkdir(path.join(outDir, "house"), { recursive: true });
for (const [state, districts] of Object.entries(house)) {
  sortYears(districts);
  await writeFile(path.join(outDir, "house", `${state}.json`), `${JSON.stringify({ source: "FiveThirtyEight election-results (CC BY 4.0)", districts })}\n`);
}
await writeFile(path.join(outDir, "senate.json"), `${JSON.stringify({ source: "FiveThirtyEight election-results (CC BY 4.0)", states: senate })}\n`);
await writeFile(path.join(outDir, "president.json"), `${JSON.stringify({ source: "MIT Election Data and Science Lab, U.S. President 1976–2024", states: president })}\n`);
console.log(`House: ${Object.values(house).reduce((sum, districts) => sum + Object.keys(districts).length, 0)} district histories · Senate: ${Object.keys(senate).length} states · President: ${Object.keys(president).length} states`);

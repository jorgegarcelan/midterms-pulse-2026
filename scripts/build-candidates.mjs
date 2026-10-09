import { writeFile } from "node:fs/promises";

/*
  General-election candidates for every 2026 House district and Senate race.

  Source: the per-state tables on the Wikipedia pages "2026 United States House of Representatives
  elections" and "2026 United States Senate elections" (raw wikitext). After the primaries those
  tables list the candidates on the November ballot; we keep exactly what they list and never fill
  gaps. Sitting members of Congress are matched to their bioguide id through the
  unitedstates/congress-legislators dataset (by Wikipedia title, then by name + state), which also
  gives their official, public-domain portrait.

  Ballot systems that change what "nominee" means:
  - California and Washington: top-two primary, so two candidates of one party can meet in November.
  - Alaska: top-four primary with a ranked-choice general.
  - Louisiana House (2026 only): primaries were cancelled after Louisiana v. Callais; every
    candidate runs in a November 3 jungle election with a December 12 runoff. The Louisiana Senate
    race kept its closed party primaries.
*/

const HOUSE_PAGE = "2026_United_States_House_of_Representatives_elections";
const SENATE_PAGE = "2026_United_States_Senate_elections";
const LEGISLATORS = "https://unitedstates.github.io/congress-legislators/legislators-current.json";
// Served as a static file (fetched by the client directory and race widgets, imported by server pages).
const OUT = new URL("../public/data/candidates-2026.json", import.meta.url);

const STATES = { Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY" };
// Seats per state after the 2020 apportionment (435 total).
const SEATS = { AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, FL: 28, GA: 14, HI: 2, ID: 2, IL: 17, IN: 9, IA: 4, KS: 4, KY: 6, LA: 6, ME: 2, MD: 8, MA: 9, MI: 13, MN: 8, MS: 4, MO: 8, MT: 2, NE: 3, NV: 4, NH: 2, NJ: 12, NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2, SC: 7, SD: 1, TN: 9, TX: 38, UT: 4, VT: 1, VA: 11, WA: 10, WV: 2, WI: 8, WY: 1 };

async function wikitext(title) {
  const response = await fetch(`https://en.wikipedia.org/w/index.php?title=${title}&action=raw`, { headers: { "user-agent": "midterm-pulse-2026 data build" } });
  if (!response.ok) throw new Error(`${title}: ${response.status}`);
  return response.text();
}

// Remove <ref>…</ref>, <ref …/> and {{efn|…}} so cells and candidate lines are plain.
function stripNotes(text) {
  let out = text.replace(/<ref[^>]*\/>/g, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
  for (let index = out.search(/\{\{efn\|/i); index >= 0; index = out.search(/\{\{efn\|/i)) {
    let depth = 0, end = index;
    for (; end < out.length; end++) {
      if (out.startsWith("{{", end)) { depth++; end++; } else if (out.startsWith("}}", end)) { depth--; end++; if (!depth) break; }
    }
    out = out.slice(0, index) + out.slice(end + 1);
  }
  return out.replace(/<!--[\s\S]*?-->/g, "");
}

const plain = (text) => text
  .replace(/\{\{(?:nowrap|small)\|([^{}]*)\}\}/gi, "$1")
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
  .replace(/\{\{[^{}]*\}\}/g, "")
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/'''?/g, "")
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const PARTY_CODES = [[/^Democratic|^DFL$/, "D"], [/^Republican$/, "R"], [/^Independent$/, "I"], [/^Libertarian$/, "L"], [/Green$/, "G"]];
const partyCode = (label) => PARTY_CODES.find(([pattern]) => pattern.test(label))?.[1] || "O";

const normalizeName = (name) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
const slugify = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// "*{{Party stripe|Democratic Party (US)}}{{Aye}} '''[[Title|Name]]''' (Democratic) 52%"
function parseCandidate(line) {
  const body = line.replace(/^\*\s*\{\{Party stripe\|[^}]*\}\}/i, "").replace(/\{\{Aye\}\}/g, "").trim();
  const label = body.match(/\(([^()]+)\)[^()]*$/)?.[1]?.trim() || "";
  const nameMarkup = body.slice(0, body.lastIndexOf(`(${label})`)).trim();
  const link = nameMarkup.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  const name = plain(link ? (link[2] || link[1]) : nameMarkup);
  return { name, partyLabel: label, party: partyCode(label), wikipedia: link ? link[1].replace(/&nbsp;|_/g, " ").trim() : null };
}

// Bullets can start mid-line ("{{Plainlist |*{{Party stripe|…") and the template name's case varies.
const candidateLines = (lines) => lines.flatMap((line) => line.match(/\*\s*\{\{party stripe\|.*$/i) || []).map(parseCandidate);

// {{sortname|First|Last|dab=x}} or {{sortname|First|Last|Link target}} or [[Title|Name]].
function parseMember(cell) {
  const sortname = cell.match(/\{\{sortname\|([^|}]*)\|([^|}]*)((?:\|[^|}]*)*)\}\}/i);
  if (sortname) {
    const name = plain(`${sortname[1]} ${sortname[2]}`);
    const extra = sortname[3].split("|").filter(Boolean);
    const dab = extra.find((part) => part.startsWith("dab="))?.slice(4);
    const target = extra.find((part) => !part.includes("="));
    const nolink = extra.some((part) => /^nolink=/.test(part));
    return { name, wikipedia: nolink ? null : target || (dab ? `${name} (${dab})` : name) };
  }
  const link = cell.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  if (link && !/elections? in|congressional district/i.test(link[1])) return { name: plain(link[2] || link[1]), wikipedia: link[1].trim() };
  return null;
}

// A table cell line: drop the leading "|" and any attribute block ("style=… |", "{{Party shading/Hold}} |").
function cellContent(line) {
  let text = line.replace(/^\|/, "");
  text = text.replace(/^\s*\{\{Party shading\/[^}]*\}\}[^|]*\|(?!\|)/, "");
  const attrs = text.match(/^((?:\s*(?:style="[^"]*"|rowspan=\d+|colspan=\d+|nowrap|data-sort-value=\S+|class="[^"]*"))+)\s*\|(?!\|)/);
  return attrs ? text.slice(attrs[0].length).trim() : text.trim();
}

const memberParty = (cell) => /Democratic/.test(cell) ? "D" : /Republican/.test(cell) ? "R" : /Independent/.test(cell) ? "I" : null;

function parseHouse(raw) {
  const text = stripNotes(raw);
  const races = [];
  const sections = text.split(/\n==([^=\n]+)==\n/);
  for (let index = 1; index < sections.length; index += 2) {
    const stateName = sections[index].trim();
    const state = STATES[stateName];
    if (!state) continue;
    const body = sections[index + 1];
    const tableStart = body.indexOf("{|");
    const table = body.slice(tableStart, body.indexOf("\n|}", tableStart));
    const rows = table.split(/\n\|-[^\n]*/).map((row) => row.split("\n").filter((line) => line.trim()));
    let current = null;
    for (const lines of rows) {
      const header = lines.find((line) => line.startsWith("!") && /\{\{ushr\|/i.test(line));
      const cells = lines.filter((line) => line.startsWith("|") && !line.startsWith("|}"));
      if (header) {
        const match = header.match(/\{\{ushr\|([A-Z]{2})\|(\w+)/i);
        const district = /^\d+$/.test(match[2]) ? match[2].padStart(2, "0") : "00";
        current = { code: `${state}-${district}`, state, chamber: "house", special: false, incumbents: [], statusNotes: [], candidates: [] };
        races.push(current);
        // cells: PVI, member, party, first elected, status, candidates — or PVI, "colspan=3 |Vacant", status, candidates.
        const memberCells = cells.slice(1);
        if (/colspan=3\s*\|\s*Vacant/i.test(memberCells[0] || "")) current.statusNotes.push(plain(cellContent(memberCells[1] || "")) || "Vacant");
        else addIncumbent(current, memberCells);
      } else if (current && cells.length && !lines.some((line) => line.startsWith("!"))) {
        addIncumbent(current, cells);
      } else continue;
      current.candidates.push(...candidateLines(lines));
    }
  }
  return races;
}

function addIncumbent(race, cells) {
  const member = parseMember(cells[0] || "");
  if (!member) return;
  const status = plain(cellContent(cells[3] || ""));
  race.incumbents.push({ ...member, party: memberParty(cells[1] || ""), status, redistrictedFrom: (cells[0].match(/Redistricted from the \{\{ushr\|([A-Z]{2})\|(\w+)/i) || []).slice(1).join("-") || null });
}

function parseSenate(raw) {
  const text = stripNotes(raw);
  const start = text.indexOf("=== Special elections during the preceding Congress ===");
  const end = text.indexOf("\n== Alabama ==");
  const rows = text.slice(start, end).split(/\n\|-[^\n]*/);
  const races = [];
  for (const row of rows) {
    const lines = row.split("\n").filter((line) => line.trim());
    const header = lines.find((line) => /^!\s*\[\[2026 United States Senate (special )?election in /.test(line));
    if (!header) continue;
    const stateName = header.match(/election in ([^|\]]+)/)[1].trim();
    const cells = lines.filter((line) => /^\|(?![-}])/.test(line));
    const member = parseMember(cells[1] || "");
    const statusCell = cells.find((cell) => /Incumbent|appointee|Retiring|retiring/.test(cell)) || "";
    const race = { code: STATES[stateName], state: STATES[stateName], chamber: "senate", special: /special election/.test(header), incumbents: [], statusNotes: [], candidates: [] };
    if (member) race.incumbents.push({ ...member, party: memberParty(cells[2] || ""), status: plain(cellContent(statusCell)), redistrictedFrom: null });
    race.candidates.push(...candidateLines(lines));
    races.push(race);
  }
  return races;
}

function ballotSystem(race) {
  if (["CA", "WA"].includes(race.state)) return "top-two";
  if (race.state === "AK") return "top-four";
  if (race.state === "LA" && race.chamber === "house") return "jungle";
  return "partisan";
}

async function main() {
  const [house, senate, legislators] = await Promise.all([
    wikitext(HOUSE_PAGE).then(parseHouse),
    wikitext(SENATE_PAGE).then(parseSenate),
    fetch(LEGISLATORS).then((response) => { if (!response.ok) throw new Error(`legislators: ${response.status}`); return response.json(); }),
  ]);

  const byWiki = new Map(legislators.filter((person) => person.id.wikipedia).map((person) => [person.id.wikipedia, person]));
  const byName = new Map();
  for (const person of legislators) {
    const state = person.terms.at(-1).state;
    for (const full of new Set([person.name.official_full, `${person.name.nickname || person.name.first} ${person.name.last}`, `${person.name.first} ${person.name.last}`].filter(Boolean))) byName.set(`${state}|${normalizeName(full)}`, person);
  }
  const findLegislator = (candidate, state) => (candidate.wikipedia && byWiki.get(candidate.wikipedia)) || byName.get(`${state}|${normalizeName(candidate.name)}`) || null;

  const races = [...senate, ...house];
  const anomalies = [];
  const candidates = [];
  const slugs = new Set();
  const raceIndex = {};

  for (const race of races) {
    const system = ballotSystem(race);
    const incumbentIds = race.incumbents.map((member) => ({ wiki: member.wikipedia, bioguide: findLegislator(member, race.state)?.id.bioguide || null }));
    const seen = new Set();
    const list = [];
    for (const candidate of race.candidates) {
      if (!candidate.name) { anomalies.push(`${race.code}${race.chamber === "senate" ? " Senate" : ""}: unreadable candidate line`); continue; }
      const key = `${candidate.wikipedia || candidate.name}|${candidate.party}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Match the incumbent by article or by bioguide id (redirected links), never by a loose name,
      // so a namesake ("Dan J. Sullivan" against Sen. Dan S. Sullivan) is not mistaken for them.
      const legislator = findLegislator(candidate, race.state);
      const isIncumbent = incumbentIds.some((member) => (candidate.wikipedia && member.wiki === candidate.wikipedia) || (member.bioguide && member.bioguide === legislator?.id.bioguide));
      const term = legislator?.terms.at(-1);
      const raceSlug = race.chamber === "senate" ? `${race.code.toLowerCase()}-senate` : race.code.toLowerCase();
      let slug = `${slugify(candidate.name)}-${raceSlug}`;
      for (let n = 2; slugs.has(slug); n++) slug = `${slugify(candidate.name)}-${raceSlug}-${n}`;
      slugs.add(slug);
      list.push(slug);
      candidates.push({
        slug,
        name: candidate.name,
        party: candidate.party,
        partyLabel: candidate.partyLabel,
        race: race.code,
        chamber: race.chamber,
        incumbent: isIncumbent,
        wikipedia: candidate.wikipedia,
        bioguide: legislator?.id.bioguide || null,
        fecIds: legislator?.id.fec || [],
        // Sitting members running for another office keep their portrait; their current seat is noted.
        currentOffice: term ? (term.type === "sen" ? `${term.state} Senate` : `${term.state}-${String(term.district).padStart(2, "0")}`) : null,
      });
    }
    const parties = candidates.filter((item) => list.includes(item.slug)).map((item) => item.party);
    const hasIncumbent = candidates.some((item) => list.includes(item.slug) && item.incumbent);
    raceIndex[`${race.chamber}:${race.code}`] = {
      code: race.code,
      chamber: race.chamber,
      state: race.state,
      special: race.special,
      system,
      open: !hasIncumbent,
      incumbents: race.incumbents.map(({ name, party, status, wikipedia, redistrictedFrom }) => ({ name, party, status, wikipedia, redistrictedFrom })),
      notes: race.statusNotes,
      candidates: list,
    };
    const label = `${race.code}${race.chamber === "senate" ? ` Senate${race.special ? " (special)" : ""}` : ""}`;
    if (!list.length) anomalies.push(`${label}: no candidates listed`);
    if (!parties.includes("D") && list.length) anomalies.push(`${label}: no Democratic candidate`);
    if (!parties.includes("R") && list.length) anomalies.push(`${label}: no Republican candidate`);
    if (system === "partisan") for (const party of ["D", "R"]) {
      const count = parties.filter((item) => item === party).length;
      if (count > 1) anomalies.push(`${label}: ${count} ${party} candidates listed in a partisan-primary state`);
    }
    if (list.length === 1) anomalies.push(`${label}: uncontested (one candidate)`);
  }

  // Coverage: every House seat and the 35 Senate races.
  const houseCodes = new Set(house.map((race) => race.code));
  for (const [state, seats] of Object.entries(SEATS)) for (let district = seats === 1 ? 0 : 1; district <= (seats === 1 ? 0 : seats); district++) {
    const code = `${state}-${String(district).padStart(2, "0")}`;
    if (!houseCodes.has(code)) anomalies.push(`${code}: missing from the source table`);
  }
  const raceList = Object.values(raceIndex);
  const bothParties = raceList.filter((race) => {
    const parties = race.candidates.map((slug) => candidates.find((item) => item.slug === slug).party);
    return parties.includes("D") && parties.includes("R");
  }).length;

  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    source: "Wikipedia state-by-state candidate tables; portraits and bioguide ids from the unitedstates/congress-legislators project",
    sourceUrls: [`https://en.wikipedia.org/wiki/${HOUSE_PAGE}`, `https://en.wikipedia.org/wiki/${SENATE_PAGE}`, "https://github.com/unitedstates/congress-legislators"],
    retrieved: today,
    coverage: { races: raceList.length, house: house.length, senate: senate.length, candidates: candidates.length, bothMajorParties: bothParties, sittingMembers: candidates.filter((item) => item.bioguide).length },
    anomalies,
    races: raceIndex,
    candidates,
  };
  // One race or candidate per line keeps the file compact and its diffs readable.
  const { races: raceMap, candidates: list, ...meta } = payload;
  const head = JSON.stringify(meta, null, 1).slice(0, -2);
  const raceLines = Object.entries(raceMap).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(",\n");
  const candidateLines = list.map((item) => `  ${JSON.stringify(item)}`).join(",\n");
  await writeFile(OUT, `${head},\n "races": {\n${raceLines}\n },\n "candidates": [\n${candidateLines}\n ]\n}\n`);
  console.log(`Wrote ${candidates.length} candidates in ${raceList.length} races (${house.length} House, ${senate.length} Senate).`);
  console.log(`${bothParties}/${raceList.length} races have at least one Democrat and one Republican; ${payload.coverage.sittingMembers} candidates are sitting members.`);
  console.log(`${anomalies.length} anomalies:\n  ${anomalies.join("\n  ")}`);
}

main().catch((error) => { console.error(error); process.exit(1); });

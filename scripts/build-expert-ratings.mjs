import { writeFile } from "node:fs/promises";

// Cook, Inside Elections and Sabato ratings, read from the Wikipedia tables that track every
// handicapper's latest call with its date. Races missing from the House table are not on any
// rater's competitive list, so they are stored as absent rather than guessed.
const RATERS = { cook: /Cook/, ie: /\|IE\]\]/, sabato: /Sabato/ };
const PAGES = {
  house: "2026_United_States_House_of_Representatives_election_ratings",
  senate: "2026_United_States_Senate_elections",
};
const STATES = { Alabama: "AL", Alaska: "AK", Arkansas: "AR", Colorado: "CO", Delaware: "DE", Florida: "FL", Georgia: "GA", Idaho: "ID", Illinois: "IL", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Montana: "MT", Nebraska: "NE", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "North Carolina": "NC", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Virginia: "VA", "West Virginia": "WV", Wyoming: "WY" };
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

async function wikitext(title) {
  const response = await fetch(`https://en.wikipedia.org/w/index.php?title=${title}&action=raw`, { headers: { "user-agent": "midterm-pulse-2026 data build" } });
  if (!response.ok) throw new Error(`${title}: ${response.status}`);
  return response.text();
}

// {{USRaceRating|Lean|D|flip}} -> "Lean D"; {{USRaceRating|Tossup}} -> "Toss-up". Cook says Solid where Sabato says Safe.
function rating(cell) {
  const match = cell.match(/USRaceRating\|([^|}]+)(?:\|([DRI]))?/i);
  if (!match) return null;
  const level = match[1].trim().toLowerCase();
  if (level.startsWith("toss")) return "Toss-up";
  const tier = { safe: "Safe", solid: "Safe", likely: "Likely", lean: "Lean", tilt: "Tilt" }[level];
  return tier && match[2] ? `${tier} ${match[2].toUpperCase()}` : null;
}

function headerDate(header) {
  const match = header.match(/small\|([A-Z][a-z]{2})[a-z.]*\s*(\d{1,2}),<br\s*\/?>\s*(\d{4})/);
  return match ? `${match[3]}-${String(MONTHS[match[1]]).padStart(2, "0")}-${match[2].padStart(2, "0")}` : null;
}

// The first sortable table whose header lists the raters; returns rows as arrays of cell strings.
function ratingsTable(text) {
  const start = text.lastIndexOf("{|", text.search(/!\s*'*\[\[(The )?Cook Political Report\|Cook/));
  const pieces = text.slice(start, text.indexOf("\n|}", start)).split(/\n\|-[^\n]*/);
  const first = pieces.findIndex((piece) => piece.includes("USRaceRating"));
  const headers = pieces.slice(0, first).flatMap((piece) => piece.split("\n")).filter((line) => line.startsWith("!") && !/colspan/.test(line));
  return { headers, rows: pieces.slice(first).map((row) => row.split("\n").filter(Boolean)) };
}

function parse(text, chamber) {
  const { headers, rows } = ratingsTable(text);
  const ratingHeaders = headers.slice(4);
  const columns = Object.fromEntries(Object.entries(RATERS).map(([key, pattern]) => {
    const index = ratingHeaders.findIndex((header) => pattern.test(header));
    if (index < 0) throw new Error(`${chamber}: no ${key} column`);
    return [key, { index, date: headerDate(ratingHeaders[index]) }];
  }));
  const races = {};
  for (const cells of rows) {
    const label = cells[0];
    let code;
    if (chamber === "house") {
      const match = label.match(/ushr\|([A-Z]{2})\|(\w+)/i);
      if (!match) continue;
      code = `${match[1].toUpperCase()}-${/^\d+$/.test(match[2]) ? match[2].padStart(2, "0") : "00"}`;
    } else {
      const match = label.match(/\|([A-Z][A-Za-z ]+?)(?: \(special\))?\]\]/);
      if (!match || !STATES[match[1]]) continue;
      code = STATES[match[1]];
    }
    const ratingCells = cells.filter((cell) => cell.includes("USRaceRating"));
    races[code] = Object.fromEntries(Object.entries(columns).map(([key, column]) => [key, rating(ratingCells[column.index] || "")]));
  }
  return { dates: Object.fromEntries(Object.entries(columns).map(([key, column]) => [key, column.date])), races };
}

export async function fetchExpertRatings() {
  const [house, senate] = await Promise.all([wikitext(PAGES.house), wikitext(PAGES.senate)]);
  return {
    source: "Wikipedia rating tables (Cook Political Report, Inside Elections, Sabato's Crystal Ball)",
    sourceUrls: Object.values(PAGES).map((page) => `https://en.wikipedia.org/wiki/${page}`),
    retrieved: new Date().toISOString().slice(0, 10),
    house: parse(house, "house"),
    senate: parse(senate, "senate"),
  };
}

// Run directly (npm run data:ratings) to refresh the copy bundled with the site.
if (import.meta.url === `file://${process.argv[1]}`) {
  const output = await fetchExpertRatings();
  await writeFile("src/data/expert-ratings.json", `${JSON.stringify(output, null, 1)}\n`);
  console.log(`House: ${Object.keys(output.house.races).length} rated, Senate: ${Object.keys(output.senate.races).length} rated`, output.house.dates, output.senate.dates);
}

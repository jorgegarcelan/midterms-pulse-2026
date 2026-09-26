import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/*
  Census demographics for every congressional district (119th Congress), every state and the US,
  from the American Community Survey via the Census Reporter API (no key required).
  https://censusreporter.org · https://api.censusreporter.org

  Usage: node scripts/build-demographics.mjs [output.json]
*/
const outputPath = process.argv[2] || "public/data/demographics.json";
const TABLES = ["B01003", "B01002", "B19013", "B17001", "B15003", "B03002", "B23025", "B25003", "B05002", "B21001"];
const FIPS = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA",
  "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ",
  "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC",
  "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY",
};

async function fetchGeos(geoIds) {
  const url = `https://api.censusreporter.org/1.0/data/show/latest?table_ids=${TABLES.join(",")}&geo_ids=${encodeURIComponent(geoIds)}`;
  const response = await fetch(url, { headers: { "User-Agent": "midterm-pulse-2026 data build (https://github.com/jorgegarcelan/midterms-pulse-2026)" } });
  if (!response.ok) throw new Error(`Census Reporter ${response.status} for ${geoIds}`);
  return response.json();
}

const round = (value, digits = 1) => Number.isFinite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null;
const pct = (part, whole) => whole ? round(part / whole * 100) : null;

function profile(tables) {
  const e = (table, column) => tables[table]?.estimate?.[`${table}${column}`] ?? null;
  const race = e("B03002", "001");
  const white = e("B03002", "003");
  const black = e("B03002", "004");
  const asian = e("B03002", "006");
  const hispanic = e("B03002", "012");
  return {
    population: e("B01003", "001"),
    medianAge: round(e("B01002", "001")),
    medianIncome: e("B19013", "001"),
    poverty: pct(e("B17001", "002"), e("B17001", "001")),
    bachelors: pct(["022", "023", "024", "025"].reduce((sum, column) => sum + (e("B15003", column) || 0), 0), e("B15003", "001")),
    unemployment: pct(e("B23025", "005"), e("B23025", "003")),
    ownerOccupied: pct(e("B25003", "002"), e("B25003", "001")),
    foreignBorn: pct(e("B05002", "013"), e("B05002", "001")),
    veterans: pct(e("B21001", "002"), e("B21001", "001")),
    race: {
      white: pct(white, race), black: pct(black, race), hispanic: pct(hispanic, race), asian: pct(asian, race),
      other: pct(race - white - black - hispanic - asian, race),
    },
  };
}

// Sequential with a pause: the public API rejects bursts of parallel requests.
const pause = () => new Promise((resolve) => setTimeout(resolve, 1500));
const districtsPayload = await fetchGeos("500|01000US");
await pause();
const statesPayload = await fetchGeos("040|01000US");
await pause();
const usPayload = await fetchGeos("01000US");
const districts = {};
for (const [geoId, tables] of Object.entries(districtsPayload.data)) {
  const state = FIPS[geoId.slice(7, 9)];
  const number = geoId.slice(9, 11);
  if (!state || number === "98" || number === "ZZ") continue;
  districts[`${state}-${number}`] = profile(tables);
}
const states = {};
for (const [geoId, tables] of Object.entries(statesPayload.data)) {
  const state = FIPS[geoId.slice(7, 9)];
  if (state) states[state] = profile(tables);
}

const output = {
  source: "U.S. Census Bureau, American Community Survey via Census Reporter",
  release: districtsPayload.release?.name || "ACS",
  releaseId: districtsPayload.release?.id || null,
  retrieved: new Date().toISOString().slice(0, 10),
  us: profile(usPayload.data["01000US"]),
  states,
  districts,
};
await writeFile(path.resolve(outputPath), `${JSON.stringify(output)}\n`);
console.log(`${output.release}: ${Object.keys(districts).length} districts, ${Object.keys(states).length} states`);

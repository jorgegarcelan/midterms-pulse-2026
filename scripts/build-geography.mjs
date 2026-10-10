import { readFile, writeFile } from "node:fs/promises";
import Papa from "papaparse";

/*
  Compact county table for the geography explainer: 2016/2020/2024 presidential votes, population
  density and Census demographics, one row per county.
    node scripts/build-geography.mjs   (reads public/data, writes public/data/geography.json)
*/
const FIPS = { "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY" };

const csv = async (year) => Papa.parse(await readFile(`public/data/county-${year}.csv`, "utf8"), { header: true, skipEmptyLines: true }).data;
const [c16, c20, c24] = await Promise.all([csv(2016), csv(2020), csv(2024)]);
const shapes = JSON.parse(await readFile("public/data/counties.json", "utf8"));
const area = new Map(shapes.features.map((feature) => [`${feature.properties.STATE}${feature.properties.COUNTY}`, feature.properties.CENSUSAREA]));
const byFips = (rows) => new Map(rows.map((row) => [row.county_fips.padStart(5, "0"), row]));
const [m16, m20] = [byFips(c16), byFips(c20)];
const num = (value) => (value === undefined || value === "" ? null : Number(value));
const votes = (row) => (row ? [Math.round(num(row.votes_dem)), Math.round(num(row.votes_gop)), Math.round(num(row.total_votes))] : null);
const r1 = (value) => (value === null || Number.isNaN(value) ? null : Math.round(value * 10) / 10);

const counties = [];
let missingArea = 0;
for (const row of c24) {
  const fips = row.county_fips.padStart(5, "0");
  const state = FIPS[fips.slice(0, 2)];
  if (!state) continue;
  const pop = num(row.pop_total);
  const sqmi = area.get(fips);
  if (!sqmi) missingArea += 1;
  counties.push({
    f: fips, s: state, n: row.county.replace(/ (County|Parish|Borough|Census Area|Municipality|city and borough)$/i, ""),
    lat: Math.round(num(row.latitude) * 100) / 100, lon: Math.round(num(row.longitude) * 100) / 100,
    pop, den: sqmi && pop ? r1(pop / sqmi) : null,
    w: r1(num(row.white_rate)), b: r1(num(row.black_rate)), h: r1(num(row.hispanic_rate)), c: r1(num(row.bachelors_rate)), inc: num(row.median_income), age: r1(num(row.median_age)),
    v16: votes(m16.get(fips)), v20: votes(m20.get(fips)), v24: votes(row),
  });
}
/*
  The 2016 county file undercounts some states (California is missing ~2.3M late ballots). Scale each
  state's county D and R votes so the state's shares match the official result in history/president.json.
  The geographic pattern inside a state is kept; only its level is corrected.
*/
const president = JSON.parse(await readFile("public/data/history/president.json", "utf8")).states;
for (const [state, results] of Object.entries(president)) {
  const official = results.find((result) => result.y === 2016);
  const rows = counties.filter((county) => county.s === state);
  if (!official || !rows.length) continue;
  const [dem, rep, total] = rows.reduce((sum, county) => [sum[0] + county.v16[0], sum[1] + county.v16[1], sum[2] + county.v16[2]], [0, 0, 0]);
  const kD = official.dp / 100 / (dem / total);
  const kR = official.rp / 100 / (rep / total);
  for (const county of rows) county.v16 = [Math.round(county.v16[0] * kD), Math.round(county.v16[1] * kR), county.v16[2]];
}

await writeFile("public/data/geography.json", JSON.stringify({ source: "County presidential results 2016–2024 with ACS demographics; land area from Census county boundaries. 2016 county votes scaled to each state's official shares.", counties }));
const missing = (key) => counties.filter((county) => !county[key]).length;
console.log(`${counties.length} counties · missing area ${missingArea} · missing 2016 ${missing("v16")} · 2020 ${missing("v20")}`);

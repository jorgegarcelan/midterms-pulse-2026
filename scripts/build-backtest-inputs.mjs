import { mkdir, readFile, writeFile } from "node:fs/promises";
import Papa from "papaparse";

/*
  Final-day race expectations from FiveThirtyEight's published 2018 and 2022 House and Senate forecasts
  (CC BY 4.0), the inputs for the MP-26 backtest (scripts/backtest.ts).

  The original files lived on projects.fivethirtyeight.com, which is offline; they are preserved by the
  Internet Archive. Download them first, then point this script at the folder:
    https://web.archive.org/web/2023id_/https://projects.fivethirtyeight.com/congress-model-2018/house_district_forecast.csv
    https://web.archive.org/web/2023id_/https://projects.fivethirtyeight.com/congress-model-2018/senate_seat_forecast.csv
    https://web.archive.org/web/2023id_/https://projects.fivethirtyeight.com/congress-model-2018/house_national_forecast.csv
    https://web.archive.org/web/2023id_/https://projects.fivethirtyeight.com/2022-general-election-forecast-data/house_district_toplines_2022.csv
    https://web.archive.org/web/2023id_/https://projects.fivethirtyeight.com/2022-general-election-forecast-data/senate_state_toplines_2022.csv
    https://web.archive.org/web/2023id_/https://projects.fivethirtyeight.com/2022-general-election-forecast-data/house_national_toplines_2022.csv
    https://web.archive.org/web/2023id_/https://projects.fivethirtyeight.com/2022-general-election-forecast-data/senate_national_toplines_2022.csv

    node scripts/build-backtest-inputs.mjs <folder>   → data/backtest/inputs-2018.json, inputs-2022.json

  Each race keeps the Democratic side's and the Republican side's total mean vote share (summed over a
  party's candidates, which matters in jungle primaries such as Mississippi 2018 and Louisiana 2022) and
  538's own Democratic-side win probability. Independents who caucus with Democrats (King, Sanders) and the lone
  anti-incumbent independent where no Democrat ran (McMullin, Utah 2022) count as the Democratic side.
*/
const folder = process.argv[2];
if (!folder) throw new Error("Usage: node scripts/build-backtest-inputs.mjs <folder with the 538 CSV files>");
const MODEL = "classic"; // 538's headline model
const DEM_CAUCUS = new Set(["Angus S. King Jr.", "Bernard Sanders", "Bernie Sanders"]);
const AT_LARGE_2018 = new Set(["AK", "DE", "MT", "ND", "SD", "VT", "WY"]);
const AT_LARGE_2022 = new Set(["AK", "DE", "ND", "SD", "VT", "WY"]);

const csv = async (name) => Papa.parse(await readFile(`${folder}/${name}`, "utf8"), { header: true, skipEmptyLines: true }).data;
const num = (value) => (value === "" || value === undefined ? 0 : Number(value));
const houseCode = (state, district, atLarge) => `${state}-${atLarge.has(state) ? "00" : String(district).padStart(2, "0")}`;

async function from2018() {
  const final = (rows) => rows.filter((row) => row.forecastdate === "2018-11-06" && row.model === MODEL);
  const races = [];
  for (const [file, chamber] of [["house_district_forecast.csv", "house"], ["senate_seat_forecast.csv", "senate"]]) {
    const groups = new Map();
    for (const row of final(await csv(file))) {
      const key = chamber === "house" ? houseCode(row.state, row.district, AT_LARGE_2018) : `${row.state}${row.special === "true" ? "-special" : ""}`;
      (groups.get(key) ?? groups.set(key, []).get(key)).push(row);
    }
    for (const [code, rows] of groups) {
      const demSide = rows.filter((row) => row.party === "D" || DEM_CAUCUS.has(row.candidate));
      const rep = rows.filter((row) => row.party === "R");
      const total = (list) => (list.length ? list.reduce((sum, row) => sum + num(row.voteshare), 0) : null);
      races.push({ chamber, code, d: total(demSide), r: total(rep), p538: demSide.reduce((sum, row) => sum + num(row.win_probability), 0) });
    }
  }
  const national = (await csv("house_national_forecast.csv")).find((row) => row.forecastdate === "2018-11-06" && row.model === MODEL && row.party === "D");
  return { races, house538: { pD: num(national.win_probability), median: num(national.median_seats), low: num(national.p10_seats), high: num(national.p90_seats) } };
}

async function from2022() {
  const races = [];
  for (const [file, chamber] of [["house_district_toplines_2022.csv", "house"], ["senate_state_toplines_2022.csv", "senate"]]) {
    for (const row of await csv(file)) {
      if (row.forecastdate !== "11/8/22" || row.expression !== `_${MODEL}`) continue;
      const [state, seat] = row.district.split("-");
      const code = chamber === "house" ? houseCode(state, seat, AT_LARGE_2022) : `${state}${seat === "S2" ? "-special" : ""}`;
      const noDemocrat = !row.name_D1;
      const side = (party) => [1, 2, 3, 4].filter((index) => row[`name_${party}${index}`]).reduce((sum, index) => sum + num(row[`voteshare_mean_${party}${index}`]), 0);
      const d = noDemocrat ? (row.name_I1 ? num(row.voteshare_mean_I1) : null) : side("D");
      const pD = noDemocrat ? (row.name_I1 ? num(row.winner_I1) : 0) : num(row.winner_Dparty);
      races.push({ chamber, code, d, r: row.name_R1 ? side("R") : null, p538: pD });
    }
  }
  const pick = async (file) => (await csv(file)).find((row) => row.forecastdate === "11/8/22" && row.expression === `_${MODEL}`);
  const house = await pick("house_national_toplines_2022.csv");
  const senate = await pick("senate_national_toplines_2022.csv");
  return {
    races,
    house538: { pD: num(house.chamber_Dparty), median: num(house.median_seats_Dparty), low: num(house.p10_seats_Dparty), high: num(house.p90_seats_Dparty) },
    senate538: { pD: num(senate.chamber_Dparty), median: num(senate.median_seats_Dparty), low: num(senate.p10_seats_Dparty), high: num(senate.p90_seats_Dparty) },
  };
}

await mkdir("data/backtest", { recursive: true });
for (const [year, build] of [[2018, from2018], [2022, from2022]]) {
  const result = await build();
  const source = "FiveThirtyEight final forecasts (classic model), CC BY 4.0, via the Internet Archive";
  await writeFile(`data/backtest/inputs-${year}.json`, `${JSON.stringify({ year, source, ...result }, null, 1)}\n`);
  const count = (chamber) => result.races.filter((race) => race.chamber === chamber).length;
  console.log(`${year}: ${count("house")} House, ${count("senate")} Senate races`, JSON.stringify(result.house538), result.senate538 ? JSON.stringify(result.senate538) : "");
}

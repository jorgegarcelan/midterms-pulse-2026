/*
  The races picked by Mario Castroviejo's guide in Calle 14 (Spanish-language newsletter on U.S.
  politics). Only the selection is kept here; candidates, ads and polls are in the guide itself,
  which the page links to. Order follows the guide's index.
*/
export const KEY_RACES_GUIDE = {
  outlet: "Calle 14",
  author: "Mario Castroviejo",
  title: "Las 30 carreras clave de estas midterms",
  url: "https://www.calle14.com/p/guia-midterms-2026-carreras-clave",
  home: "https://www.calle14.com",
};

// Congressional races, as model keys (chamber:code).
export const KEY_RACES = [
  "senate:NE", "senate:NH", "senate:OH", "senate:TX",
  "house:AZ-02", "house:NC-01", "house:NC-11", "house:FL-27", "house:IA-02",
  "house:ME-02", "house:MI-07", "house:PA-01", "house:PA-08", "house:TX-15",
];

// Governor races are outside the model; the guide covers two.
export const KEY_GOVERNOR_RACES: { state: string; note?: string; candidates: { name: string; party: "D" | "R" }[] }[] = [
  { state: "AK", note: "Ranked-choice ballot: voters rank the candidates and the last-placed are eliminated until someone passes 50%.", candidates: [
    { name: "Jonathan Kreiss-Tomkins", party: "D" }, { name: "Bernadette Wilson", party: "R" }, { name: "Dave Bronson", party: "R" }, { name: "Treg Taylor", party: "R" },
  ] },
  { state: "IA", candidates: [{ name: "Rob Sand", party: "D" }, { name: "Zach Lahn", party: "R" }] },
];

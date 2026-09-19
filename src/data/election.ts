export type Race = {
  code: string;
  state: string;
  chamber: "house" | "senate";
  leader: "D" | "R";
  margin: number;
  winProbability: number;
};

export const electionSnapshot = {
  updatedShort: "SEP 19, 2026",
  updatedLong: "September 19, 2026 at 09:00 ET",
  daysToElection: 45,
  house: { demMajority: 99, demSeats: 231, repSeats: 204 },
  senate: { demMajority: 62, demSeats: 51, repSeats: 49 },
  genericBallot: {
    dem: 49.3,
    rep: 41.9,
    undecided: 8.8,
    margin: 7.4,
    history: [
      { date: "2026-05-08", margin: 5.8 },
      { date: "2026-06-15", margin: 5.5 },
      { date: "2026-07-15", margin: 6.0 },
      { date: "2026-08-31", margin: 6.4 },
      { date: "2026-09-18", margin: 7.4 },
    ],
  },
  races: [
    { code: "IA", state: "Iowa", chamber: "senate", leader: "R", margin: 2.7, winProbability: 55 },
    { code: "AK", state: "Alaska", chamber: "senate", leader: "R", margin: 2.6, winProbability: 72 },
    { code: "TX", state: "Texas", chamber: "senate", leader: "D", margin: 3.2, winProbability: 67 },
    { code: "ME", state: "Maine", chamber: "senate", leader: "D", margin: 3.2, winProbability: 59 },
    { code: "OH", state: "Ohio special", chamber: "senate", leader: "D", margin: 4.7, winProbability: 79 },
    { code: "CA-22", state: "California", chamber: "house", leader: "D", margin: 0.8, winProbability: 54 },
    { code: "NY-17", state: "New York", chamber: "house", leader: "D", margin: 1.2, winProbability: 57 },
    { code: "PA-07", state: "Pennsylvania", chamber: "house", leader: "R", margin: 1.6, winProbability: 59 },
    { code: "AZ-01", state: "Arizona", chamber: "house", leader: "D", margin: 2.1, winProbability: 62 },
    { code: "NE-02", state: "Nebraska", chamber: "house", leader: "D", margin: 2.4, winProbability: 64 },
  ] satisfies Race[],
} as const;

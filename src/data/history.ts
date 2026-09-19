export type ElectionCycle = {
  year: number;
  demSeats: number;
  repSeats: number;
  demChange: number;
  turnout: number;
  note: string;
};

export const electionCycles: ElectionCycle[] = [
  { year: 2010, demSeats: 193, repSeats: 242, demChange: -63, turnout: 41.8, note: "Republican wave" },
  { year: 2012, demSeats: 201, repSeats: 234, demChange: 8, turnout: 58.6, note: "Presidential cycle" },
  { year: 2014, demSeats: 188, repSeats: 247, demChange: -13, turnout: 36.7, note: "GOP expands majority" },
  { year: 2016, demSeats: 194, repSeats: 241, demChange: 6, turnout: 60.1, note: "Presidential cycle" },
  { year: 2018, demSeats: 235, repSeats: 199, demChange: 41, turnout: 50.3, note: "Democratic wave" },
  { year: 2020, demSeats: 222, repSeats: 213, demChange: -13, turnout: 66.8, note: "Presidential cycle" },
  { year: 2022, demSeats: 213, repSeats: 222, demChange: -9, turnout: 46.6, note: "Narrow GOP majority" },
  { year: 2024, demSeats: 215, repSeats: 220, demChange: 2, turnout: 63.9, note: "Narrow GOP hold" },
];

export const historicalMargins: Record<number, Record<string, number>> = {
  2010: { CA: 15, CO: -2, FL: -4, IA: -8, MI: -7, NC: -12, NV: -5, NY: 12, OH: -10, PA: -8, TX: -18, VA: -9, WI: -9 },
  2012: { AZ: -9, CA: 23, CO: 5, FL: 1, GA: -8, IA: 6, MI: 9, NC: -2, NV: 7, OH: 3, PA: 5, TX: -16, VA: 4, WI: 7 },
  2014: { AZ: -13, CA: 15, CO: -7, FL: -5, GA: -14, IA: -12, MI: -5, NC: -10, NV: -11, OH: -15, PA: -8, TX: -22, VA: -8, WI: -11 },
  2016: { AZ: -4, CA: 30, CO: 5, FL: -1, GA: -5, IA: -9, MI: 0, NC: -4, NV: 2, OH: -8, PA: -1, TX: -9, VA: 5, WI: -1 },
  2018: { AZ: 3, CA: 31, CO: 11, FL: 0, GA: -5, IA: 10, MI: 14, NC: 2, NV: 8, NY: 23, OH: 5, PA: 10, TX: -3, VA: 16, WI: 8 },
  2020: { AZ: 0.3, CA: 29, CO: 13, FL: -3.4, GA: 0.2, IA: -8.2, MI: 2.8, NC: -1.3, NV: 2.4, OH: -8, PA: 1.2, TX: -5.6, VA: 10.1, WI: 0.6 },
  2022: { AZ: 4, CA: 13, CO: 10, FL: -13, GA: -5, IA: -12, MI: 5, NC: -7, NV: 0, NY: 5, OH: -12, PA: 0, TX: -17, VA: -2, WI: -4 },
  2024: { AZ: -5.5, CA: 20.6, CO: 11, FL: -13.1, GA: -2.2, IA: -13.2, MI: -1.4, NC: -3.2, NV: -3.1, NY: 12.6, OH: -11.2, PA: -1.7, TX: -13.7, VA: 5.8, WI: -0.9 },
};

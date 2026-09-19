export type Poll = {
  id: string;
  pollster: string;
  race: string;
  state: string;
  chamber: "Generic" | "House" | "Senate";
  dem: number;
  rep: number;
  sample: number;
  population: "LV" | "RV" | "A";
  endDate: string;
  source: string;
};

export const seedPolls: Poll[] = [
  { id: "gb-0918", pollster: "Public polling average", race: "Generic ballot", state: "US", chamber: "Generic", dem: 49.3, rep: 41.9, sample: 0, population: "LV", endDate: "2026-09-18", source: "https://uspollingdata.com/polls/generic-ballot/" },
  { id: "ia-0917", pollster: "Midterm Pulse benchmark", race: "Iowa Senate", state: "IA", chamber: "Senate", dem: 46.1, rep: 48.8, sample: 1184, population: "LV", endDate: "2026-09-17", source: "https://vote-scope.com/en/us/senate/" },
  { id: "me-0916", pollster: "Midterm Pulse benchmark", race: "Maine Senate", state: "ME", chamber: "Senate", dem: 49.1, rep: 45.9, sample: 902, population: "LV", endDate: "2026-09-16", source: "https://vote-scope.com/en/us/senate/" },
  { id: "tx-0915", pollster: "Midterm Pulse benchmark", race: "Texas Senate", state: "TX", chamber: "Senate", dem: 49.0, rep: 45.8, sample: 1270, population: "LV", endDate: "2026-09-15", source: "https://vote-scope.com/en/us/senate/" },
  { id: "ak-0914", pollster: "Midterm Pulse benchmark", race: "Alaska Senate", state: "AK", chamber: "Senate", dem: 45.2, rep: 47.8, sample: 640, population: "RV", endDate: "2026-09-14", source: "https://vote-scope.com/en/us/senate/" },
  { id: "oh-0912", pollster: "Midterm Pulse benchmark", race: "Ohio Senate special", state: "OH", chamber: "Senate", dem: 50.0, rep: 45.3, sample: 1005, population: "LV", endDate: "2026-09-12", source: "https://vote-scope.com/en/us/senate/" },
];

export const pollMapMargins: Record<string, number> = {
  AK: -2.6, AZ: 1.1, CO: 7.8, FL: -5.2, GA: -0.4, IA: -2.7, ME: 3.2,
  MI: 2.9, MN: 5.4, NC: -0.8, NH: 4.1, NV: 1.3, OH: 4.7, PA: 2.2,
  TX: 3.2, VA: 4.5, WI: 1.8,
};

/*
  Poll closing times for 3 November 2026, in Eastern Time. US daylight time ends on 1 November and
  Spain's on 25 October, so on election night ET = UTC−5 and peninsular Spain = UTC+1: six hours apart.
  `close` is when the last polls in the state close (networks project after that); `firstClose` is set
  when most of the state closes earlier.
*/
export type ClosingState = { code: string; close: string; firstClose?: string };

export const ET_TO_SPAIN_HOURS = 6;

export const POLL_CLOSING: ClosingState[] = [
  { code: "GA", close: "19:00" }, { code: "IN", close: "19:00", firstClose: "18:00" }, { code: "KY", close: "19:00", firstClose: "18:00" },
  { code: "SC", close: "19:00" }, { code: "VA", close: "19:00" }, { code: "VT", close: "19:00" },
  { code: "NC", close: "19:30" }, { code: "OH", close: "19:30" }, { code: "WV", close: "19:30" },
  { code: "AL", close: "20:00" }, { code: "CT", close: "20:00" }, { code: "DE", close: "20:00" }, { code: "DC", close: "20:00" },
  { code: "FL", close: "20:00", firstClose: "19:00" }, { code: "IL", close: "20:00" }, { code: "ME", close: "20:00" },
  { code: "MD", close: "20:00" }, { code: "MA", close: "20:00" }, { code: "MS", close: "20:00" }, { code: "MO", close: "20:00" },
  { code: "NH", close: "20:00", firstClose: "19:00" }, { code: "NJ", close: "20:00" }, { code: "OK", close: "20:00" },
  { code: "PA", close: "20:00" }, { code: "RI", close: "20:00" }, { code: "TN", close: "20:00" },
  { code: "AR", close: "20:30" },
  { code: "AZ", close: "21:00" }, { code: "CO", close: "21:00" }, { code: "IA", close: "21:00" }, { code: "KS", close: "21:00", firstClose: "20:00" },
  { code: "LA", close: "21:00" }, { code: "MI", close: "21:00", firstClose: "20:00" }, { code: "MN", close: "21:00" },
  { code: "NE", close: "21:00" }, { code: "NM", close: "21:00" }, { code: "NY", close: "21:00" }, { code: "SD", close: "21:00", firstClose: "20:00" },
  { code: "TX", close: "21:00", firstClose: "20:00" }, { code: "WI", close: "21:00" }, { code: "WY", close: "21:00" },
  { code: "MT", close: "22:00" }, { code: "NV", close: "22:00" }, { code: "ND", close: "22:00", firstClose: "21:00" }, { code: "UT", close: "22:00" },
  { code: "CA", close: "23:00" }, { code: "ID", close: "23:00", firstClose: "22:00" }, { code: "OR", close: "23:00" }, { code: "WA", close: "23:00" },
  { code: "HI", close: "24:00" },
  { code: "AK", close: "25:00" },
];

// Structural reasons a state's result can take longer than the night (no candidate-specific claims).
export const COUNTING_NOTES: Record<string, string> = {
  ME: "Ranked-choice voting: if nobody passes 50%, the instant runoff is tabulated days later.",
  AK: "Ranked-choice general election and late-arriving mail ballots: the count usually takes about two weeks.",
  GA: "A candidate needs 50% to win; otherwise there is a runoff on 1 December.",
  AZ: "Large late mail-ballot drop-offs: the count usually takes several days.",
  NV: "Mail ballots postmarked by Election Day still count if they arrive within four days.",
  CA: "Almost all-mail election: close House races can take weeks to call.",
  PA: "Mail ballots cannot be processed before Election Day, so the in-person vote tends to report first.",
  WI: "Mail ballots are processed on Election Day; big cities can report them in one late batch.",
  MI: "Large mail-ballot share; Detroit-area totals often arrive late in the night.",
};

export const spainTime = (et: string) => {
  const [hours, minutes] = et.split(":").map(Number);
  const local = (hours + ET_TO_SPAIN_HOURS) % 24;
  return `${String(local).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export const etLabel = (et: string) => {
  const [hours, minutes] = et.split(":").map(Number);
  const hour = hours % 24;
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:${String(minutes).padStart(2, "0")} ${hour < 12 ? "a.m." : "p.m."} ET`;
};

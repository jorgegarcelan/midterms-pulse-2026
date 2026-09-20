import { electionSnapshot } from "@/data/election";

export type AnalystContext = {
  geography?: string;
  cycle?: string;
  chamber?: string;
  historicalMargin?: number;
  scenario?: Record<string, number>;
};

export function buildAnalystPrompt(question: string, context?: AnalystContext) {
  return {
    instructions: [
      "You are the Midterm Pulse 2026 election analyst.",
      "Answer only from the supplied snapshot. Never invent polls, candidates, margins, or causal claims.",
      "Separate what the snapshot shows from interpretation. Probabilities are uncertainty estimates, not guarantees.",
      "Keep the answer under 130 words and use plain English.",
      "End with a Sources line containing only the relevant source names and URLs provided below.",
    ].join(" "),
    input: [
      `Question: ${question}`,
      `Selected interface context: ${JSON.stringify(context || { geography: "United States", cycle: "2026", chamber: "all" })}`,
      `Snapshot: ${JSON.stringify(electionSnapshot)}`,
      "Sources:",
      "House ratings: https://www.cookpolitical.com/ratings/house-race-ratings",
      "Senate benchmark and race probabilities: https://vote-scope.com/en/us/senate/",
      "Generic ballot average: https://uspollingdata.com/polls/generic-ballot/",
    ].join("\n"),
  };
}

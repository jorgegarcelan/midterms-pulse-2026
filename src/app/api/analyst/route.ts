import { NextResponse } from "next/server";
import { buildAnalystPrompt } from "@/lib/analyst-prompt";

type OpenAIContent = { type?: string; text?: string };
type OpenAIOutput = { content?: OpenAIContent[] };

function fallbackAnswer(question: string) {
  const normalized = question.toLowerCase();
  if (normalized.includes("senate") || normalized.includes("closest")) {
    return "Iowa is the closest Senate contest in this snapshot: Republicans lead by 2.7 points with a 55% benchmark win probability. Alaska and Maine are also inside four points, leaving control sensitive to correlated national movement. Sources: Vote-Scope — https://vote-scope.com/en/us/senate/";
  }
  if (normalized.includes("62") || normalized.includes("probab")) {
    return "A 62% chance is an edge, not a call. Under comparable assumptions, a Democratic majority occurs about six times in ten and fails about four times in ten. Sources: Vote-Scope — https://vote-scope.com/en/us/senate/";
  }
  return "The House signal combines a Democratic generic-ballot advantage of 7.4 points with a public benchmark of 231 Democratic seats. District geography remains the main caveat because national movement does not translate evenly across all 435 seats. Sources: Cook Political Report — https://www.cookpolitical.com/ratings/house-race-ratings; U.S. Polling Data — https://uspollingdata.com/polls/generic-ballot/";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { question?: unknown } | null;
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!question || question.length > 500) {
    return NextResponse.json({ error: "Question must contain 1–500 characters." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ answer: fallbackAnswer(question), mode: "snapshot" });

  const prompt = buildAnalystPrompt(question);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-6-astra",
      reasoning: { effort: "low" },
      instructions: prompt.instructions,
      input: prompt.input,
      max_output_tokens: 350,
      store: false,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ answer: fallbackAnswer(question), mode: "snapshot" });
  }

  const result = (await response.json()) as { output_text?: string; output?: OpenAIOutput[] };
  const answer = result.output_text || result.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;

  return NextResponse.json({ answer: answer || fallbackAnswer(question), mode: answer ? "openai" : "snapshot" });
}

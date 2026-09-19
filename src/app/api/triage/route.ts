import { NextResponse } from "next/server";

type TriageAnswer = {
  topic: string;
  relevance: number;
  urgency: number;
  confidence: number;
};

function fallbackTriage(content: string): TriageAnswer {
  const text = content.toLowerCase();
  const topic = text.includes("poll") || text.includes("survey") ? "polling" : text.includes("result") || text.includes("call") ? "results" : text.includes("vote") || text.includes("turnout") ? "turnout" : "campaign";
  const relevance = Math.min(0.96, 0.52 + ["senate", "house", "midterm", "election", "poll", "vote"].filter((word) => text.includes(word)).length * 0.08);
  const urgency = text.includes("breaking") || text.includes("just in") || text.includes("called") ? 0.9 : text.includes("new") || text.includes("today") ? 0.68 : 0.36;
  return { topic, relevance, urgency, confidence: 0.58 };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 2000) return NextResponse.json({ error: "Content must contain 1–2,000 characters." }, { status: 400 });

  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) return NextResponse.json({ ...fallbackTriage(content), mode: "local-rules" });

  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      state: content,
      model: process.env.TYPESAFE_MODEL || "jev-latest",
      questions: {
        topic: {
          type: "choice",
          instructions: "Classify the primary election-news topic",
          criteria: {
            polling: "A poll, polling average, methodology, sample, or topline",
            results: "A result, projection, race call, recount, or seat control update",
            turnout: "Registration, turnout, early voting, or voting access",
            campaign: "Candidate, endorsement, debate, fundraising, advertising, or campaign event",
            other: "Election-adjacent but none of the other categories",
          },
        },
        relevance: { type: "noul", instructions: "This item is materially relevant to the 2026 United States congressional midterm elections" },
        urgency: { type: "noul", instructions: "This item warrants immediate attention in a live election monitoring desk" },
      },
    }),
  });

  if (!response.ok) return NextResponse.json({ ...fallbackTriage(content), mode: "local-rules" });
  const result = (await response.json()) as {
    answers?: {
      topic?: { choice?: string; confidence?: number };
      relevance?: { noul?: number };
      urgency?: { noul?: number };
    };
  };
  const topic = result.answers?.topic;
  return NextResponse.json({
    topic: topic?.choice || "other",
    relevance: result.answers?.relevance?.noul ?? 0.5,
    urgency: result.answers?.urgency?.noul ?? 0.5,
    confidence: topic?.confidence ?? 0.5,
    mode: "jev",
  });
}

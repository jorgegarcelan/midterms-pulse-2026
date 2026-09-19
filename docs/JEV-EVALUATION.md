# JEV evaluation for Midterm Pulse 2026

## Recommendation

Use Jev as an optional, server-side signal-triage service. Do not use it as the election forecast model or the narrative analyst.

Jev accepts unstructured state plus typed questions and returns structured decisions with probabilities. That shape is useful for high-volume, bounded tasks:

- Classify live posts as polling, results, turnout, campaign or other.
- Estimate whether an item is relevant to the 2026 congressional elections.
- Estimate urgency for an election-night monitoring queue.
- Flag possible duplicate polls before human review.
- Score whether poll metadata is complete enough to enter the model pipeline.

The TypeSafe documentation describes three primitives: `Choice`, `Score` and `Noul`. It recommends small atomic questions composed in code. The public model remains in early access, so Midterm Pulse keeps a deterministic fallback and treats the integration as an experiment.

## Implementation

`POST /api/triage` calls `https://api.typesafe.ai/v1/systemone` with `jev-latest` when `TYPESAFE_API_KEY` is configured. The browser never receives the key. Without a key, the route returns a transparent rules-based result so the Live page remains functional.

## Evaluation plan

Before using Jev to route production alerts:

1. Label at least 500 historical election posts across topic, relevance and urgency.
2. Compare Jev probabilities with a rules baseline and a conventional structured-output LLM.
3. Measure calibration, false-negative rate, latency and cost.
4. Define confidence thresholds for auto-route, review and ignore.
5. Log model version and question schema with every decision.

## Sources

- [TypeSafe AI introduction](https://docs.typesafe.ai/introduction)
- [TypeSafe AI quick start](https://docs.typesafe.ai/introduction/quickstart)
- [Introducing System One Models & Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)

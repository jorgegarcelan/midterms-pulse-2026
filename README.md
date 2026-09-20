# Midterm Pulse 2026

A transparent election intelligence dashboard for the 2026 U.S. House and Senate elections. The project turns the exploratory notebook workflow of `US-Elections` into a deployable Next.js application with source attribution, interactive scenarios, and an AI analyst constrained to the current data snapshot.

## Product surfaces

- **Dashboard** — House and Senate control benchmarks, generic-ballot trend, closest races, scenario lab and grounded AI analyst.
- **Explore** — national, state and county filters; a 3,000+ county map; 2016–2024 movement; county results and ACS context.
- **Live** — device-local X/Twitter watchlist with embedded public timelines and an experimental Jev signal-triage panel.
- **Polls** — live Vote-Scope polling index, weekly generic-ballot evolution, battleground tile map and a local poll-entry workflow.
- **Markets** — live Polymarket House, Senate and balance-of-power probabilities with daily price history.
- **History** — House seat-change chart, cycle comparison, turnout context and interactive historical map.
- **Methodology** — model pipeline, current limitations and source register.
- **Brand system** — original navigation mark, generated election-signal artwork, palette and typography guidance.

The control forecast is currently a **sourced benchmark**, not yet a proprietary Midterm Pulse model. Forecast values are attributed to Vote-Scope. House race ratings and the generic ballot are cross-checked against Cook Political Report and public polling aggregators. The next model phase will replace the benchmark with a reproducible, backtested pipeline.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## AI analyst

The app works without an API key. In that mode, `/api/analyst` returns deterministic answers grounded in the checked-in snapshot.

For live analysis, copy `.env.example` to `.env.local` and set:

```bash
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-6-astra
```

The API route uses the OpenAI Responses API, does not expose the key to the browser, sets `store: false`, and constrains responses to the snapshot and listed sources.

## Jev pilot

TypeSafe AI's Jev model is integrated as an optional signal-triage experiment on `/live`. It classifies an item's topic, 2026 relevance and urgency using typed probabilistic outputs. It is deliberately **not** used as the election forecast model or as a prose analyst.

```bash
TYPESAFE_API_KEY=your_key
TYPESAFE_MODEL=jev-latest
```

Without a key, `/api/triage` uses a transparent deterministic fallback. See [`docs/JEV-EVALUATION.md`](docs/JEV-EVALUATION.md) for the recommendation and evaluation plan.

## Live X timelines

The watchlist uses X's public embed script and saves account choices in local browser storage. The page always exposes a direct profile link because embeds can be restricted by browser privacy settings or X availability. A future server-side real-time feed can use the official X API once credentials and a usage budget are configured.

## Deploy to Vercel

The production preview is at [midterm-pulse-2026.vercel.app](https://midterm-pulse-2026.vercel.app). Import this repository into Vercel; Next.js is detected automatically. Add `OPENAI_API_KEY` and/or `TYPESAFE_API_KEY` in the project settings for live AI services. Every page remains functional without either variable.

## Repository map

```text
src/app/                  Next.js routes and dashboard
src/app/api/analyst/      Server-side AI endpoint
src/app/api/forecast/     Vote-Scope forecast adapter
src/app/api/markets/      Polymarket Gamma and CLOB adapter
src/app/api/polls/        Vote-Scope polling adapter
src/app/api/triage/       Optional Jev structured-decision endpoint
src/components/           Shared navigation, maps and interactive workbenches
src/data/                 Typed election snapshot
src/lib/                  Prompt construction and shared logic
docs/                     Methodology and data contracts
public/                   Static brand assets
```

## Data policy

Every displayed number must include a source, observation date, retrieval date, and transformation notes. Raw polls must preserve sponsor, population, sample size, field dates, mode, toplines, and source URL. See [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) and [`docs/DATA-PLATFORM.md`](docs/DATA-PLATFORM.md).

## Sources used in the prototype

- [Vote-Scope U.S. Senate forecast](https://vote-scope.com/en/us/senate/)
- [Vote-Scope public data API](https://vote-scope.com/api/)
- [Cook Political Report House ratings](https://www.cookpolitical.com/ratings/house-race-ratings)
- [U.S. Polling Data generic ballot](https://uspollingdata.com/polls/generic-ballot/)
- [Federal Election Commission API](https://api.open.fec.gov/developers/)
- [Census American Community Survey API](https://www.census.gov/programs-surveys/acs/data/data-via-api.html)
- [MIT Election Data + Science Lab](https://electionlab.mit.edu/data)
- [Polymarket market data](https://github.com/Polymarket/agent-skills/blob/main/market-data.md)
- [TypeSafe AI Jev documentation](https://docs.typesafe.ai/introduction)
- [X Developer Platform](https://docs.x.com/overview)

## License

Application code is intended for an MIT-licensed public repository. Upstream datasets retain their own terms and attribution requirements.

# Data platform

Midterm Pulse treats geography, time and signal type as separate dimensions. A poll, a forecast, a result and a prediction-market price must never be presented as interchangeable observations.

## Geographic hierarchy

| Level | Current coverage | Primary use |
| --- | --- | --- |
| National | House and Senate control, generic ballot, prediction markets | Overall environment and chamber control |
| State | Senate forecasts, polling margins, historical state context | State-level race analysis |
| District | All 435 voting districts from Census 119th Congress boundaries, joined to Vote-Scope and MP-26 v0.1 | Map and complete House race profiles |
| County | 2016, 2020 and 2024 presidential results plus ACS context | Vote, shift and demographic exploration |
| Precinct | Planned | Election-night and local reporting |

The county explorer uses FIPS as its stable geographic key. State and county names are labels, not join keys.

## Signal types

- **Polls:** individual public toplines and transparent weekly summaries. The source URL, pollster, sample, population and field dates remain attached to each observation.
- **Forecasts:** Vote-Scope public outputs remain the benchmark input. MP-26 v0.1 adds a reproducible 50,000-draw simulation layer and is labeled experimental until backtesting is complete.
- **Candidates and finance:** active filed candidates, principal committees and available totals from OpenFEC. Missing or rate-limited financial totals remain blank.
- **Boundaries:** 2024 Census Cartographic Boundary Files for the 119th Congress, generalized to 1:5,000,000 for the web map.
- **Prediction markets:** Polymarket Gamma metadata and CLOB daily price history. Prices are displayed as traded probabilities, never relabeled as voter intention.
- **Historical returns:** county-level presidential returns for 2016–2024, paired with Census ACS context for exploration rather than causal claims.

## Freshness and failure behavior

Live server routes cache forecasts and polls for 15 minutes and market metadata for 5 minutes. If a live source fails, the interface labels the failure or falls back to a clearly dated local snapshot. It does not silently invent or backfill current values.

## Next data layers

1. Archive the complete versioned race registry on every model run.
2. Add state and district poll averages with house effects and uncertainty intervals.
3. Add candidate-level fundamentals without letting finance data overwhelm electoral evidence.
4. Add precinct-level results where licensing and boundary compatibility allow it.
5. Store source snapshots and transformations in a warehouse so every chart is reproducible.

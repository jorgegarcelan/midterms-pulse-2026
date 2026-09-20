# Methodology roadmap

## Status

The interface now includes `MP-26 v0.1`, an owned, deterministic simulation layer built on public inputs. It is explicitly labeled experimental because historical calibration is not complete. The external Vote-Scope forecast remains the seat-level anchor and is identified wherever it is used.

## Data contract

Each poll record should contain:

- race and cycle
- pollster and sponsor
- start and end dates
- population (`A`, `RV`, or `LV`)
- sample size and mode
- Democratic, Republican, other, and undecided shares
- original source URL
- retrieval timestamp
- correction or exclusion notes

Each race record should contain its office, geography, nominees, incumbency, prior result, district partisanship, fundraising totals, expert ratings, and demographic features.

## Current v0.1 forecast

1. Estimate a national environment from generic-ballot polls with recency, sample-size and population weights.
2. Anchor expected chamber seats and individual races to the dated Vote-Scope public benchmark.
3. Add a shared national error and separate chamber error across 50,000 seeded simulations.
4. Publish seat distributions, majority probabilities, 80% intervals and adjusted race-level probabilities.
5. Keep every coefficient visible in [`MODEL-V0.1.md`](MODEL-V0.1.md).

Pollster house effects, candidate/fundraising fundamentals and historical calibration remain planned work.

## Validation gates

The first-party model should not be presented as production-ready until it has:

- reproducible dated snapshots
- holdout backtests
- Brier score and log-loss by forecast horizon
- calibration plots for probability buckets
- comparison with simple baselines
- documented manual overrides, ideally none
- an archived changelog for every methodology revision

## AI boundaries

The analyst receives a structured snapshot and explicit source list. It must distinguish observed data from interpretation, avoid adding unsupported facts, and describe forecast probabilities as uncertainty rather than certainty. The statistical model produces probabilities; the language model explains them.

## Attribution

The prototype forecast is attributed to Vote-Scope and links to the relevant forecast desk, following its API attribution guidance. Other source material remains subject to the publisher's terms.

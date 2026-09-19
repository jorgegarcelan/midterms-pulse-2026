# Methodology roadmap

## Status

The current interface is an MVP using dated public benchmarks. It deliberately does not label these numbers as a proprietary Midterm Pulse forecast. A first-party forecast should only replace them after the pipeline is reproducible and its historical calibration has been measured.

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

## Planned forecast

1. Estimate a national environment from generic-ballot polls with recency decay, sample-size weighting, population adjustments, and pollster house effects.
2. Estimate each race from local polls and a fundamentals prior built from prior vote, incumbency, fundraising, candidate experience, demographics, and the national environment.
3. Model correlated error across states and districts rather than treating races as independent.
4. Run Monte Carlo simulations and publish seat distributions, majority probabilities, intervals, and race-level win probabilities.
5. Backtest on the 2010–2024 midterm and presidential cycles without using information unavailable on each historical forecast date.

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

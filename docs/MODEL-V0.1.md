# Midterm Pulse model v0.1

## Status

`MP-26 v0.1` is an experimental, deterministic sensitivity model. It is the first owned modeling layer in the product, but it is not yet historically calibrated and must not be described as a production election forecast.

## Inputs

- Public generic-ballot polls from the Vote-Scope polling index, with a dated local fallback.
- Vote-Scope's public House and Senate seat-level forecast as the starting benchmark.
- The run date and 119th Congress district registry stored with the application.

## Poll weighting

Each generic-ballot poll receives a product of three weights:

1. **Recency:** exponential decay with a 30-day half-life.
2. **Sample:** square root of sample size relative to 1,000 respondents; the dated aggregate fallback receives a fixed 0.55 factor.
3. **Population:** `LV = 1.00`, `RV = 0.86`, and adults/other = `0.72`.

The weighted Democratic and Republican toplines produce the national margin. Version 0.1 does not yet estimate pollster house effects or correlated pollster error.

## Simulation

The application runs 50,000 deterministic Monte Carlo draws using a seeded pseudorandom generator. The public benchmark supplies the starting median. Every draw adds:

- a shared national error with a 2.75-point standard deviation;
- a House conversion of 2.15 Democratic seats per national point;
- a Senate conversion of 0.18 Democratic seats per national point;
- separate chamber noise of 4.2 House seats and 1.25 Senate seats.

District margins receive 70% of the difference between the current weighted generic ballot and the dated baseline. This is intentionally conservative about nationalization and does not yet estimate candidate quality, local fundraising, redistricting changes or district-specific polling.

## Outputs

- median Democratic and Republican seats;
- 80% seat intervals;
- probability of a Democratic majority;
- complete simulated seat distributions;
- adjusted race-level margins and win probabilities.

## Validation required for v1.0

- archive dated input snapshots;
- replay the model on 2010–2024 holdout dates;
- publish Brier score, log loss, mean absolute seat error and calibration curves;
- compare against simple baselines and the external benchmark;
- estimate pollster and mode effects without leaking future information;
- add explicit model-change notes and version every published run.

Until these gates are met, the interface labels the model **Experimental** and describes it as a sensitivity model rather than an election call.

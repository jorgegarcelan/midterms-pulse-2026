# Midterm Pulse model v0.2

## Status

`MP-26 v0.2` is an experimental, deterministic model built on the Vote-Scope public benchmark. It is not yet historically calibrated and must not be described as a production election forecast. It supersedes [v0.1](MODEL-V0.1.md).

## What changed from v0.1

v0.1 published a Senate majority probability that could not be reconciled with its own race odds: summing the race probabilities gave about 50 Democratic seats and a 43% majority, while the chamber number read 69%. Two defects caused it, and v0.2 fixes both.

1. **Spurious national movement.** v0.1 compared today's weighted generic ballot (Vote-Scope poll index, D+2.8) with a fixed `BASELINE_MARGIN` of 7.4 taken from a different source on a different date. The resulting −4.6 pt "movement" was applied to a benchmark that had already been rebuilt with today's polls. v0.2 measures movement like for like: the same poll index and the same weighting, evaluated today and at the benchmark's run date. A same-day benchmark receives essentially no adjustment; the dated fallback benchmark is moved by what the polls did since it was published.
2. **Two inconsistent Senate mechanisms.** Races absorbed 0.7 pts per national point, while the Senate chamber moved only 0.18 seats per point. v0.2 simulates the Senate bottom-up from its 35 races, so the chamber odds are by construction the aggregate of the published race odds.

Race win probabilities also move from a logistic curve (scale 3.15, effectively a 5–6 pt error) to a normal error calibrated to the benchmark (10 pts, see below). The old curve was markedly overconfident: a D+3.3 race showed 73%, where the benchmark gives 53–63%.

Effect on the 26 September 2026 run: House 82% → 99% (median 224 → 234 seats, now equal to the 234 districts leaning Democratic); Senate 69% → 68% (median 52, 80% interval 49–54, 51.5 expected seats). The Vote-Scope benchmark reads 97% and 63% respectively.

## Inputs

- Public generic-ballot polls from the Vote-Scope polling index, with a dated local fallback.
- Vote-Scope's public House and Senate race-level forecast as the benchmark.
- The 119th Congress: 47 Democratic-caucus and 53 Republican seats; 13 Democratic and 22 Republican seats are on the 2026 ballot (including the Ohio and Florida specials), leaving 34 D and 31 R not up.

## Poll weighting

Unchanged from v0.1. Each generic-ballot poll receives the product of a recency weight (30-day half-life), a sample weight (square root of sample size relative to 1,000; the dated aggregate fallback gets 0.55) and a population weight (`LV = 1.00`, `RV = 0.86`, adults/other `0.72`).

## Error budget

All constants live in `src/lib/mp26.ts` and are shared by the server model and the in-browser tools.

| Constant | Value | Meaning |
| --- | ---: | --- |
| `NATIONAL_SD` | 2.75 pts | Shared national error, in generic-ballot points |
| `NATIONALIZATION` | 0.70 | Share of national movement and national error a race absorbs |
| `RACE_SD` | 10 pts | Total error on a race margin |
| Race common error | 1.93 pts | `NATIONAL_SD × NATIONALIZATION` |
| Race local error | 9.81 pts | `√(RACE_SD² − common²)` |

`RACE_SD` is calibrated to the benchmark: the median error implied by Vote-Scope's own race odds (|margin| / Φ⁻¹(p)) was ≈9.8 pts for Senate races and ≈8.8 pts for House races in September 2026.

## Simulation

- **House (top-down):** 50,000 seeded draws of the benchmark seat count, plus 2.15 seats per point of (movement + national error), plus 4.2 seats of chamber noise.
- **Senate (bottom-up):** 50,000 seeded draws. Each open race draws expected margin + shared national error + local error; seats not on the ballot are fixed. Democrats need 51 seats; a 50–50 chamber goes to Republicans through the Vice President.
- **Races:** margin = benchmark margin + 0.7 × movement; win probability = Φ(margin / 10).

The Senate builder on the home page runs the same function with the same seed and run count, so with no races called it reproduces the published Senate forecast exactly.

## Known limitations

- The House is still top-down; a bottom-up House simulation would make it structurally identical to the Senate.
- Errors are normal. The benchmark uses fat-tailed (Student-t) local errors, one reason MP-26 is slightly more confident about the Senate than Vote-Scope.
- No pollster house effects, candidate quality or fundraising effects.

## Validation required for v1.0

- archive dated input snapshots;
- replay the model on 2010–2024 holdout dates;
- publish Brier score, log loss, mean absolute seat error and calibration curves;
- compare against simple baselines and the external benchmark;
- estimate pollster and mode effects without leaking future information;
- add explicit model-change notes and version every published run.

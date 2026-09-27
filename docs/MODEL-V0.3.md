# Midterm Pulse model v0.3

## Status

`MP-26 v0.3` is an experimental, deterministic model built on the Vote-Scope public benchmark. It is not yet historically calibrated and must not be described as a production election forecast. It supersedes [v0.2](MODEL-V0.2.md) and [v0.1](MODEL-V0.1.md).

## What changed

### v0.2 → v0.3

1. **The House is simulated bottom-up.** v0.2 still moved the benchmark's House seat count top-down (2.15 seats per national point plus 4.2 seats of chamber noise). Its median (234) equalled the number of districts where Democrats lead, but not the aggregate of its own race odds (245 expected seats). v0.3 simulates all 435 districts on the same engine as the Senate, so both chambers are exactly the aggregate of their race odds.
2. **National error is calibrated to the benchmark.** Simulating race by race makes the chamber spread depend on how correlated races are. With `NATIONAL_SD = 2.75` the House 80% interval was 233–257, far narrower than the benchmark's 226–268. v0.3 sets `NATIONAL_SD = 4.1`, so the shared part of a race's error (4.1 × 0.7 ≈ 2.87 pts) matches the common error the benchmark publishes in its race calibration (`common_sd` 2.867). The total error per race is unchanged at 10 pts, so race odds do not move.

Effect on the 26 September 2026 run:

| | v0.2 | v0.3 | Vote-Scope benchmark |
| --- | --- | --- | --- |
| House, D majority | 99%, median 234 (80%: 225–243) | 99%, median 244 (80%: 229–262) | 97%, median 245 (80%: 226–268) |
| Senate, D majority | 68%, median 52 (80%: 49–54) | 65%, median 51 (80%: 48–55) | 63%, median 51 (80%: 48–55) |

### v0.1 → v0.2

v0.1 published a Senate majority probability (69%) that disagreed with the aggregate of its own race odds (~43%). It compared today's generic ballot with a stale constant from another source (−4.6 pts of spurious movement) and applied that movement with two different conversions, 0.7 pts per race and 0.18 seats to the chamber. v0.2 measured movement like for like, simulated the Senate bottom-up and calibrated race error to the benchmark. See [MODEL-V0.2.md](MODEL-V0.2.md).

## Inputs

- Public generic-ballot polls from the Vote-Scope polling index, with a dated local fallback.
- Vote-Scope's public House and Senate race-level forecast as the benchmark: every race's expected margin.
- The 119th Congress: 47 Democratic-caucus and 53 Republican seats; 13 Democratic and 22 Republican seats are on the 2026 ballot (including the Ohio and Florida specials), leaving 34 D and 31 R not up.

## National movement

Each generic-ballot poll is weighted by recency (30-day half-life), sample size (square root relative to 1,000; the dated aggregate fallback gets 0.55) and population (`LV = 1.00`, `RV = 0.86`, adults/other `0.72`). Movement is the weighted ballot today minus the weighted ballot at the benchmark's run date, from the same poll index. A same-day benchmark gets essentially no adjustment; the dated fallback benchmark is moved by what the polls did since it was published. Races absorb 70% of that movement.

**Data quality filter (added 26 September 2026).** The generic-ballot index occasionally carries toplines that are not a D-vs-R generic ballot: one party coded 0 (single-party or primary questions) or state races with a strong independent. Polls are kept only when both parties have at least 20% and together at least 70%. On the 26 September run this removed 30 of 960 polls and moved the weighted ballot from D+2.8 to D+4.4. Chamber odds were unchanged, because movement is measured against the same filtered index at the benchmark date.

## Error budget

All constants live in `src/lib/mp26.ts` and are shared by the server model and the in-browser tools.

| Constant | Value | Meaning |
| --- | ---: | --- |
| `NATIONAL_SD` | 4.1 pts | Shared national error, in generic-ballot points |
| `NATIONALIZATION` | 0.70 | Share of national movement and national error a race absorbs |
| `RACE_SD` | 10 pts | Total error on a race margin |
| Race common error | 2.87 pts | `NATIONAL_SD × NATIONALIZATION`, matches the benchmark's `common_sd` |
| Race local error | 9.58 pts | `√(RACE_SD² − common²)` |

`RACE_SD` is calibrated to the benchmark: the median error implied by Vote-Scope's own race odds (|margin| / Φ⁻¹(p)) was ≈9.8 pts for Senate races and ≈8.8 pts for House races in September 2026.

## Simulation

One engine (`src/lib/chamber-sim.ts`) runs 50,000 seeded draws per chamber. Each run draws one national error for every race plus an independent local error per race; a race goes Democratic when its expected margin plus both errors is positive.

- **House:** all 435 districts; Democrats need 218.
- **Senate:** the 35 races on the ballot plus 34 D and 31 R seats not up; Democrats need 51, and a 50–50 chamber goes to Republicans through the Vice President.
- **Races:** margin = benchmark margin + 0.7 × movement; win probability = Φ(margin / 10).

The Senate builder on the home page calls the same function with the same seed and run count, so with no races called it reproduces the published Senate forecast exactly. The Model page re-simulates both chambers for its swing test (the House with 10,000 runs to stay interactive; at zero swing the published numbers show). The model API caches each run until its inputs change, since a House run is ~22 million race draws.

## Known limitations

- Errors are normal. The benchmark uses fat-tailed (Student-t) local errors, one reason the MP-26 House interval is still slightly narrower than the benchmark's.
- No pollster house effects, candidate quality, incumbency or fundraising effects beyond what the benchmark margins contain.
- A single national factor: no regional or demographic correlation between races.

## Validation required for v1.0

- archive dated input snapshots;
- replay the model on 2010–2024 holdout dates;
- publish Brier score, log loss, mean absolute seat error and calibration curves;
- compare against simple baselines and the external benchmark;
- estimate pollster and mode effects without leaking future information;
- add explicit model-change notes and version every published run.

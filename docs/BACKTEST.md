# MP-26 backtest: 2018 and 2022

Reproduce: `node scripts/build-backtest-inputs.mjs <folder>` (see the script header for the archived FiveThirtyEight files), then `npm run data:backtest` → `src/data/backtest.json`, shown at `/validation`.

## What is tested

Vote-Scope, MP-26’s benchmark, did not publish 2018 or 2022 forecasts, so the full pipeline cannot be replayed. The backtest checks MP-26’s own probability layer, imported from `src/lib` unchanged: the per-race error (`RACE_SD` = 7.5), the shared national error (2.87 pts) and the 50,000-run chamber simulation. Its input is each race’s final expected margin (Democratic side minus Republican side, party vote shares summed) from FiveThirtyEight’s published classic forecast the day before each election. Outcomes come from the race histories in `public/data/history`.

## Chambers

| | Actual D seats | MP-26 median | FiveThirtyEight median |
| --- | ---: | --- | --- |
| 2018 House | 235 | 235 (80%: 218–254), P(D) 90% | 233 (80%: 216–254), P(D) 88% |
| 2018 Senate | 47 | 48 (80%: 45–51), P(D) 14% | — |
| 2022 House | 213 | 203 (80%: 187–219), P(D) 13% | 204 (80%: 184–222), P(D) 18% |
| 2022 Senate | 51 | 50 (80%: 47–52), P(D) 51% | 49 (80%: 46–53), P(D) 49% |

All four results fall inside MP-26’s 80% interval; the favourite won all four chambers (the 2022 Senate by a hair: Democrats at 51%). 2022 Senate control needs 50 seats (Vice President Harris); 2018 needs 51 (Vice President Pence).

## Races

| | n | Brier MP-26 | Brier 538 | Log loss MP-26 | Log loss 538 | Accuracy |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| All races | 940 | 0.0315 | 0.0303 | 0.1048 | 0.101 | 96.1% |
| Competitive (5–95%) | 245 | 0.1206 | 0.1159 | 0.3924 | 0.377 | 84.9% |

Average margin miss (actual − expected, D positive): -1.91 pts in 2018, 1.28 pts in 2022; race-level RMSE 6.34 and 5.99 pts.

## Calibration and the per-race error

Competitive races, both years, binned by MP-26 probability:

| Forecast bin | n | Mean forecast | Observed D wins |
| --- | ---: | ---: | ---: |
| 0–10% | 24 | 7% | 4% |
| 10–20% | 32 | 15% | 6% |
| 20–30% | 32 | 24% | 9% |
| 30–40% | 17 | 35% | 41% |
| 40–50% | 22 | 45% | 46% |
| 50–60% | 30 | 55% | 77% |
| 60–70% | 25 | 65% | 76% |
| 70–80% | 14 | 74% | 93% |
| 80–90% | 23 | 85% | 100% |
| 90–100% | 26 | 93% | 100% |

Favourites won more often than the engine said: with day-before inputs, ±7.5 is too cautious. Log loss by `RACE_SD` on all contested races:

| RACE_SD | Brier | Log loss |
| ---: | ---: | ---: |
| 4 | 0.0311 | 0.1013 |
| 5 | 0.0314 | 0.1013 |
| 6 | 0.0322 | 0.1048 |
| 7 | 0.0333 | 0.11 |
| 7.5 | 0.034 | 0.113 |
| 8 | 0.0347 | 0.1161 |
| 9 | 0.0362 | 0.1228 |
| 10 | 0.0378 | 0.1298 |
| 12 | 0.0412 | 0.1445 |

`RACE_SD` stays at 7.5: it is fitted to the benchmark’s own race odds weeks before the election, when uncertainty is larger than the day before. Revisit closer to 3 November.

## Limits

- Tests the probability engine, not the Vote-Scope benchmark or the generic-ballot movement step.
- Two elections, both with fairly small national polling misses.
- Inputs and outcomes: FiveThirtyEight (CC BY 4.0); the 538 forecast files are preserved by the Internet Archive.

# Midterm Pulse model v0.4

## Status

`MP-26 v0.4` is an experimental, deterministic model built on the Vote-Scope public benchmark. It is not yet historically calibrated and must not be described as a production election forecast. It supersedes [v0.3](MODEL-V0.3.md); everything not listed below is unchanged from v0.3.

## What changed: v0.3 → v0.4

1. **Race margins now read the right field.** Every earlier version took a race's margin from the benchmark's `projection.mean_margin` and gave it the projected winner's sign. That field is the expected *size of the winning margin*, E|D − R|, not the expected D − R margin. A dead-even race with ±5 pts of uncertainty reports ≈4, so every toss-up became a ~4–5 point lead for whoever was ahead by a few tenths. Example (9 Oct 2026): Kansas Senate has mean vote shares of D 49.88 / R 49.72 (D+0.2) and a benchmark win probability of 51%; v0.3 used D+4.7 and published 68%.
   v0.4 uses the difference of the mean vote shares, `vote_mean.us_dem − vote_mean.us_rep`, which agrees in sign with the projected winner in all 470 races. `mean_margin` is kept only as a fallback when vote shares are missing.
2. **Race error refitted.** `RACE_SD` had been calibrated on the wrong field (|mean_margin| / Φ⁻¹(p) ≈ 9.8). Refitted against the benchmark's race odds with the expected D − R margin, for races between 3% and 97%:

   | `RACE_SD` | Senate, mean odds error | House, mean odds error |
   | ---: | ---: | ---: |
   | 6.0 | 4.2 pts | 4.1 pts |
   | 7.5 | 5.5 pts | 1.2 pts |
   | 8.0 | 5.9 pts | 1.1 pts |
   | 10 (v0.3, old field) | 8.1 pts | 6.2 pts |

   v0.4 uses **7.5** for both chambers so one engine and every explainer keep a single constant. The shared part stays 4.1 × 0.7 ≈ 2.87 pts; the local part is now √(7.5² − 2.87²) ≈ 6.93 pts.

Effect on the 9 October 2026 run (movement 0, same-day benchmark):

| | v0.3 | v0.4 | Vote-Scope benchmark |
| --- | --- | --- | --- |
| House, D majority | 100%, median 249 (80%: 233–266) | 99%, median 248 (80%: 231–268) | 98%, median 248 (80%: 228–273) |
| Senate, D majority | 71%, median 52 (80%: 49–55) | 61%, median 51 (80%: 48–55) | 64%, median 52 (80%: 48–55) |
| Kansas Senate | D+4.7 · 68% | D+0.2 · 51% | 51% D |
| Iowa Senate | D+4.5 · 67% | D+0.4 · 52% | 53% D |

## Expert ratings alongside the model

Race profiles and the race directory now show the Cook Political Report, Inside Elections and Sabato's Crystal Ball ratings next to the model (`npm run data:ratings`, read from the dated Wikipedia rating tables). House races missing from those tables are on no rater's competitive list and are shown as Safe for the 2024 winner. A race is flagged when the model's rating band (Toss-up < 60%, Lean < 75%, Likely < 90%, Safe) is two or more steps from the raters' average, or favours the other party outside the toss-up band. Ratings are displayed, never used as a model input.

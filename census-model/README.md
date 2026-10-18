# Census-only House model (phase 1)

A House forecast that never looks at polls or markets: every district's margin comes from its
American Community Survey profile, and the national level comes from election history alone.

```
margin(district, year) = national(year) + structural(ACS profile, Census division)
```

- **structural**: XGBoost (Ridge and Random Forest kept for comparison) trained on two-party House
  margins relative to each year's mean contested margin, 2012–2024. Each ACS 5-year release is
  paired with the election fought on the same district lines. Recent cycles weigh more (4-year half-life).
- **national**: previous election's level moved by the mean midterm swing against the president's
  party, 2002–2022 (sd from the spread of those swings).
- **simulation**: one national draw plus an independent local draw per district, 20,000 runs.

## Run

```bash
python3 -m venv census-model/.venv && census-model/.venv/bin/pip install -r census-model/requirements.txt
census-model/.venv/bin/python census-model/fetch_acs.py        # needs CENSUS_API_KEY in .env.local
census-model/.venv/bin/python census-model/build_dataset.py
census-model/.venv/bin/python census-model/train_backtest.py
```

District areas come from the Census Gazetteer files in `data/gazetteer/` (113th–119th Congress).

## Outputs

- `output/backtest.csv`: rolling-origin backtest, 2016–2024, every model.
- `output/house-2026.json`: 2026 margins, win probabilities and seat distribution on the 2024 lines.
- `output/feature-importance.csv`: Ridge coefficients and XGBoost gain of the final model.

## Known limits

- Ten states redrew for 2026 (TX, FL, OH, NC, MO, TN, LA, AL, CA, UT); their districts are still
  scored on the 2024 lines and flagged `redrawn`.
- The target is the House result, so incumbency and candidate quality sit in the residual.
- Trees recognise districts they have seen before: error on unseen states (~17–19 pts) is much
  higher than on the next cycle of known districts (~8–10 pts).

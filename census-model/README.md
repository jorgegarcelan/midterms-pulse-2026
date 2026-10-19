# Census-only House model (phase 3)

A House forecast that never looks at polls or markets: every district's margin comes from its
American Community Survey profile, and the national level comes from election history alone.

```
margin(district, year) = national(year) + structural(ACS profile, Census division)
```

- **national**: the two-party House popular vote (`national.py`). For a midterm it is predicted as
  the previous popular vote moved by the mean swing against the president's party, 2002–2022
  (+7.8 points, sd 7.4). Phase 1 used the mean margin of contested districts instead; that number
  moves with which seats get contested (2018: D+4.4 vs a D+8.7 popular vote) and caused most of
  the 2018 miss.
- **structural**: margin relative to the popular vote, learned from ACS features and the Census
  division on 2012–2024 (each ACS 5-year release paired with the election on the same lines,
  recent cycles weighted more). The model used is the one with the lowest backtest Brier score,
  currently `blend`: the mean of XGBoost and a two-stage model (Ridge, then XGBoost on its
  residuals, see `structural.py`).
- **simulation**: one national draw plus an independent local draw per district, 20,000 runs.
  The local spread is the model's error on the previous cycle, predicted blind.

## Run

```bash
python3 -m venv census-model/.venv && census-model/.venv/bin/pip install -r census-model/requirements.txt
census-model/.venv/bin/python census-model/fetch_acs.py        # needs CENSUS_API_KEY in .env.local
census-model/.venv/bin/python census-model/national.py         # downloads 538 House results into data/raw/
census-model/.venv/bin/python census-model/build_dataset.py
census-model/.venv/bin/python census-model/redistrict.py build-2026   # 2026 maps of the redrawn states
census-model/.venv/bin/python census-model/train_backtest.py
census-model/.venv/bin/python census-model/phase2_experiments.py   # optional: structural variants
```

District areas come from the Census Gazetteer files in `data/gazetteer/` (113th–119th Congress).

## Backtest (blend, each year predicted only from earlier cycles)

| | 2016 | 2018 | 2020 | 2022 | 2024 |
|---|---|---|---|---|---|
| Actual D seats | 194 | 235 | 217 | 213 | 215 |
| With the real popular vote | 199 | 222 | 212 | 215 | 216 |
| Blind: simulated median | 189 | 224 | 239 | 203 | 219 |
| Blind: P(D majority) | 1% | 56% | 93% | 32% | 54% |
| Brier (538 / MP-26 in brackets) | 0.040 | 0.061 (0.027) | 0.051 | 0.057 (0.032) | 0.035 |

## What did not work

`phase2_experiments.py` tries linear drift in each feature's effect (feature × year) and a
midterm interaction (feature × midterm, signed by the president's party or not). None helps
consistently: with two or three cycles to learn from, the drift over-extrapolates and a single
earlier midterm (2014, before the education realignment) teaches the wrong midterm pattern.
The ~13 seats still missing in 2018 are suburbs that swung beyond what their 2012–2016 profile said.

## Outputs

- `output/backtest.csv`: every model and year, oracle and blind.
- `output/house-2026.json`: 2026 margins, win probabilities and seat distribution on the November 2026 maps, plus the same model on the 2024 lines (`house2024Lines`) and the redraw effect by state.
- `output/feature-importance.csv`, `output/two-stage-coefficients.csv`: what the models lean on.
- `output/phase2-experiments.csv`: structural variants scored with the real popular vote.

## 2026 maps (phase 3)

Nine states vote on new lines in November 2026: AL, CA, FL, LA, NC, OH, TN, TX, UT. Missouri's
2025 map is blocked by a referendum, so it keeps its 2022 lines. Plans come from the Census
Bureau's 120th Congress block equivalency file (`cd120.zip`, 7 Oct 2026). `redistrict.py`
rebuilds ACS profiles for the 173 new districts from tract counts, split by 2020 block population.

Checks of the method:
- `redistrict.py validate` rebuilds the 2024 districts of those states from block-group centres:
  shares (education, race, poverty…) are off by ~0.1 points on average, ~1% of their spread
  across districts; medians are approximate (median age ±0.7 years, income ±2.6%).
- `redistrict.py check-blocks` rebuilds Missouri from the block file and matches the official
  tables, which also confirms Missouri's November lines are the 2024 ones.
- Feeding rebuilt instead of official profiles moves the blend's predicted margin by 1.6 points
  on average; that is added to the local spread of redrawn districts, on top of the 2022 error
  (the last cycle where every map was new).

**What it shows:** the census model barely moves when the maps change (+1.3 expected Democratic
seats across the nine states, against press estimates of up to ~10 net Republican). Maps are
drawn with past vote returns, exploiting exactly what demographics do not explain (Hispanic
South Texas voting Republican, for instance), and the trees lose their memory of how a district
voted once its lines are new. A census-only model cannot see a gerrymander.

## Known limits

- The redraw effect is invisible to census data (see above).
- The target is the House result, so incumbency and candidate quality sit in the residual.
- Trees recognise districts they have seen before: error on unseen states (~18–20 pts) is much
  higher than on the next cycle of known districts (~8–12 pts).
- The national prior is wide on purpose: since 2002 the swing against the president's party has
  ranged from −4.6 (2002) to +17.8 (2010).

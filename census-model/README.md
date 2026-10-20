# Census-26: the census-only House and Senate model

A House forecast that never looks at polls or markets: every district's margin comes from its
American Community Survey profile, and the national level comes from election history alone.

```
margin(district, year) = national(year) + structural(ACS profile, Census division)
```

**The main model is the census-only one** (`train_backtest.py`, outputs in `output/`). When it
predicts a district it sees nothing but that district's census profile and the national level;
it is trained on past House results to learn how demographics map to votes. The other feature
sets (phases 4–5: `census_pres`, `census_inc`, `census_pres_inc`, outputs in `output/<set>/`)
add the district's presidential lean and incumbency. They are kept only as benchmarks, to
measure how much those extra clues add over the census alone; they are not the forecast.

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
census-model/.venv/bin/python census-model/pres_by_cd.py                 # phase 4: presidential lean by district
census-model/.venv/bin/python census-model/train_backtest.py census_pres
census-model/.venv/bin/python census-model/incumbency.py               # phase 5: incumbents on the ballot
census-model/.venv/bin/python census-model/train_backtest.py census_pres_inc   # also census_inc
census-model/.venv/bin/python census-model/compare.py
census-model/.venv/bin/python census-model/build_geometry_2026.py    # public/data/congressional-districts-2026.geojson
census-model/.venv/bin/python census-model/export_web.py             # src/data/census-model.json for /census
census-model/.venv/bin/python census-model/senate.py                 # Senate: adds senate* keys to the same JSON
```

The web page `/census` (`src/app/[lang]/census`, `src/components/census`) reads only
`src/data/census-model.json`; rerun `export_web.py` after retraining to update it.

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

**What it shows:** the census model barely moves when the maps change (+1.6 expected Democratic
seats across the nine states, against press estimates of up to ~10 net Republican). Maps are
drawn with past vote returns, exploiting exactly what demographics do not explain (Hispanic
South Texas voting Republican, for instance), and the trees lose their memory of how a district
voted once its lines are new. A census-only model cannot see a gerrymander.

## Benchmark: census + presidential lean (phase 4)

`train_backtest.py census_pres` adds one feature: the district's last presidential result on the
same lines, relative to the national result (2008 pres for the 2012 House, …, 2024 pres for
2026), from The Downballot's presidential-by-district sheets (`pres_by_cd.py`). No polls or
markets are involved, but the model is no longer census-only. Missing source data (California
2008, Florida 2012 on the 2016 lines) is filled from the census profile and flagged.

| | Census only | Census + pres |
|---|---|---|
| Brier, mean 2016–2024 (blind) | 0.049 | 0.039 |
| District error (RMSE, pts) | 9.6 | 8.1 |
| Seat calls with the real popular vote | 93.6% | 95.0% |
| Seat total bias with the real popular vote | −2.0 | −7.0 |
| 2026: D median / P(D majority) | 239 / 75% | 235 / 73% |
| 2026: effect of the new maps (expected D seats) | +1.6 | −3.5 |

Every race gets sharper, and the new maps finally show (TX −2.4, FL −1.7, LA −1.0, TN −0.9,
AL −0.8, CA +2.9, UT +0.9), smaller than the press ceilings (net R+9) because a D+5
environment puts several of the new Republican seats back in play. The catch: with the real
popular vote the model undercounts Democratic seats by ~7 on average (16 in 2020, 10 in 2022),
so its chamber odds lean Republican. 538 and MP-26 remain clearly better per race (Brier
0.027–0.032 in 2018 and 2022 against 0.047–0.051).

## Benchmark: incumbency and the seat bias (phase 5)

The presidential-lean model missed 107 seats in the backtest; 40 of them were Democratic
incumbents who held seats the model gave to Republicans, against 4 the other way. `incumbency.py`
marks who defends each seat (+1 Democratic incumbent on the ballot, −1 Republican, 0 open or
member-vs-member), matching 538's politician_id against winners of the two previous years, so
members who moved district after a redraw still count. 2026 comes from the project's candidate list.

| Feature set (model chosen) | Brier | RMSE | Seat calls | Seat bias | 2026 D median (80%) | P(D majority) | Redraw effect |
|---|---|---|---|---|---|---|---|
| census (blend) | 0.049 | 9.6 | 93.6% | −2.0 | 239 (200–283) | 75% | +1.6 |
| census_inc (blend) | 0.041 | 9.1 | 95.2% | −6.2 | 233 (204–277) | 74% | +0.2 |
| census_pres (blend) | 0.039 | 8.1 | 95.0% | −7.0 | 235 (199–279) | 73% | −3.5 |
| census_pres_inc (ridge) | **0.034** | 8.2 | **95.7%** | −4.0 | 229 (200–278) | 67% | −2.7 |

Incumbency removes the systematic part: Democratic-incumbent misses fall from 40 to 4 and total
misses from 107 to 91. What is left is not a fixed bias. Across all contested races the mean
residual is about zero every year; the error sits in the close races, and its sign changes
by cycle (with incumbency: −5.7 points in 2016, +2.9 in 2018, −3.4 in 2020, +3.3 in 2022, +1.6
in 2024, mean −0.3). It is a shared "battleground" error, so the seat totals swing by 10–18
seats in either direction (2018 −18, 2020 +13, 2022 −12). The simulation still treats local
errors as independent; a shared error for competitive seats would widen the chamber odds.

Best per-race benchmark is census_pres_inc (Brier 0.049 and 0.039 in 2018 and 2022, against
538's 0.027 and 0.032). Its redraw effect is less reliable than the others': on the 2024 lines
incumbents are matched by name between the history files and the 2026 candidate list (271 of
~360 match), so some old-line seats count as open.

## Senate (`senate.py`)

The Senate reuses the House model unchanged: a state is the sum of its districts.

- **State margin**: the mean of the census-only margins of the state's districts on the November
  2026 maps (national House popular vote + each district's structural term). AK, DE, ND, SD, VT
  and WY have one district, so the state is that district.
- **Weights**: districts have equal population but not equal turnout, so the obvious refinement is
  to weight each district by votes cast. The script tries the total presidential vote cast in the
  last presidential election on the same lines (known in advance, no party information) against
  equal weights, and keeps whichever backtests better. They tie (mean Brier 0.0751 with votes,
  0.0742 equal), so the published version uses **equal weights**: within a state, census-predicted
  turnout differences between districts barely move the statewide margin.
- **Races scored**: every Senate contest 2014–2024 with a Democrat and a Republican on the ballot,
  specials included, runoffs where they decided the seat; except contests where D + R took under
  85% of the vote, because an independent, a third party or a split jungle-primary field was the
  real alternative and D − R does not measure the race (Maine 2018/2024 with King, Alaska 2016,
  Louisiana 2020/2022, North Dakota 2022, New Mexico 2018, South Dakota 2014).
- **State error, from the data**: residuals of earlier Senate races scored with the real national
  vote, pooled from 2014 (an expanding window: 2016 is calibrated on 2014 only, 2026 on
  2014–2024). It comes out at **±10.9 points for 2026**, against ±8.0 for a House district on
  unchanged lines: the candidate effect is larger statewide.
- **Probability and chamber**: P(D) = Φ(margin / √(state² + national²)); 20,000 simulations draw
  one national error shared by every state (same mean and spread as the House: D+4.8 ± 7.4) and an
  independent state error. Seats not up in 2026: D 34, R 31 (`src/lib/senate-sim.ts`); Democrats
  need 51, a 50–50 Senate is Republican through the Vice President.

| Blind backtest | 2016 | 2018 | 2020 | 2022 | 2024 |
|---|---|---|---|---|---|
| Races scored | 32 | 31 | 33 | 32 | 33 |
| Seats called | 96.9% | 83.9% | 93.9% | 90.6% | 93.9% |
| Mean miss (pts) | 9.6 | 9.0 | 7.2 | 8.0 | 5.7 |
| Brier | 0.061 | 0.133 | 0.066 | 0.062 | 0.049 |
| MP-26 Brier (polls) | – | 0.055 | – | 0.039 | – |

2018 is the weak year: Democratic incumbents held Montana and West Virginia, and lost North Dakota
by far less, against their states' demographics. **2026**: median 50 Democratic seats (80%: 45–55), 47% chance
of a Democratic majority. Nebraska has no Democrat (Dan Osborn runs as an independent), so its
census D − R margin is the demographic lean, not a race between those two parties.

Outputs: `output/senate-backtest.csv` (both weightings), `output/senate-races-scored.csv`,
`output/senate-state-margins.csv`; `senate`, `senateChamber` and `senateBacktest` in
`src/data/census-model.json` (other keys untouched; `export_web.py` keeps them on re-export).

## Known limits

- The redraw effect is invisible to census data alone (see above); the presidential lean recovers
  part of it.
- Candidate quality and money sit in the residual (incumbency only in the `_inc` feature sets).
- Trees recognise districts they have seen before: error on unseen states (~18–20 pts) is much
  higher than on the next cycle of known districts (~8–12 pts).
- The national prior is wide on purpose: since 2002 the swing against the president's party has
  ranged from −4.6 (2002) to +17.8 (2010).

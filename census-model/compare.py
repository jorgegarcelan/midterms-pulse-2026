"""
Feature sets side by side (census only, + presidential lean, + incumbency): backtest and 2026,
for the model each feature set selects. Run train_backtest.py in each mode first.

Usage: census-model/.venv/bin/python census-model/compare.py
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
MODES = {"census": ROOT / "output", **{mode: ROOT / "output" / mode for mode in ["census_inc", "census_pres", "census_pres_inc"]}}


def main():
    years, totals, forecasts = [], [], {}
    for mode, folder in MODES.items():
        forecast = json.loads((folder / "house-2026.json").read_text())
        main_model = forecast["mainModel"]
        backtest = pd.read_csv(folder / "backtest.csv")
        rows = backtest[backtest["model"] == main_model].assign(mode=mode)
        years.append(rows)
        totals.append({"mode": mode, "model": main_model, "brier": rows["brier_blind"].mean(), "rmse": rows["rmse"].mean(),
                       "accuracy": rows["oracle_accuracy"].mean(),
                       "seat_bias": (rows["oracle_dem_seats_pred"] - rows["oracle_dem_seats_actual"]).mean(),
                       "seat_mae": (rows["oracle_dem_seats_pred"] - rows["oracle_dem_seats_actual"]).abs().mean()})
        effect = forecast["redrawEffect"]
        forecasts[mode] = {**{k: v for k, v in forecast["house"].items() if k != "distribution"},
                           "redrawEffect": round(sum(v["expectedDemNew"] - v["expectedDemOld"] for v in effect.values()), 1),
                           **{f"effect_{s}": round(v["expectedDemNew"] - v["expectedDemOld"], 1) for s, v in effect.items()}}
    by_year = pd.concat(years).pivot(index="year", columns="mode", values=["brier_blind", "oracle_dem_seats_pred", "sim_median", "sim_dem_majority"])
    by_year[("actual", "")] = pd.concat(years).groupby("year")["oracle_dem_seats_actual"].first()
    by_year[("538", "brier")] = pd.concat(years).groupby("year")["brier_538"].first()
    pd.set_option("display.width", 220)
    print(pd.DataFrame(totals).round(3).to_string(index=False), "\n")
    print(by_year.round(3).to_string(), "\n")
    print(pd.DataFrame(forecasts).to_string())
    pd.DataFrame(forecasts).to_csv(ROOT / "output" / "comparison-2026.csv")
    pd.DataFrame(totals).to_csv(ROOT / "output" / "comparison-backtest.csv", index=False)


if __name__ == "__main__":
    main()

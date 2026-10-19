"""
Compact JSON for the /census page (src/data/census-model.json): the census-only forecast, its
backtest, what the model leans on, the redraw blind spot and the benchmark feature sets.

Run after train_backtest.py (all four feature sets) and compare.py.

Usage: census-model/.venv/bin/python census-model/export_web.py
"""
import json
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

import train_backtest as tb

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
OUT = PROJECT / "src" / "data" / "census-model.json"
SEED = 2026


def importance(data):
    """How much the 2024 blind prediction (trained on 2012–2022) degrades when one variable is shuffled."""
    train = data[(data["year"] < 2024) & (data["contested"] == 1)]
    test = data[(data["year"] == 2024) & (data["contested"] == 1)].copy()
    predictions, fitted, columns = tb.fit_predict(train, test)
    base = tb.rmse(test, predictions["blend"])

    def blend(frame):
        x = tb.design(frame, columns)
        return (fitted["xgboost"].predict(x) + fitted["two_stage"].predict(frame)) / 2

    rng = np.random.default_rng(SEED)
    rows = []
    for feature in tb.FEATURES + ["division"]:
        losses = []
        for _ in range(5):
            shuffled = test.copy()
            shuffled[feature] = rng.permutation(shuffled[feature].to_numpy())
            losses.append(tb.rmse(shuffled, blend(shuffled)) - base)
        direction = 0.0 if feature == "division" else float(np.corrcoef(test[feature], test["relative"])[0, 1])
        rows.append({"key": feature, "importance": round(float(np.mean(losses)), 2), "correlation": round(direction, 2)})
    return sorted(rows, key=lambda row: -row["importance"])


def main():
    data = tb.load("census")
    forecast = json.loads((ROOT / "output" / "house-2026.json").read_text())
    backtest = pd.read_csv(ROOT / "output" / "backtest.csv")
    main_rows = backtest[backtest["model"] == forecast["mainModel"]]
    mp26 = json.loads((PROJECT / "src" / "data" / "backtest.json").read_text())["years"]
    pres = json.loads((ROOT / "output" / "census_pres" / "house-2026.json").read_text())
    benchmarks = pd.read_csv(ROOT / "output" / "comparison-backtest.csv")
    outlook = pd.read_csv(ROOT / "output" / "comparison-2026.csv", index_col=0)
    national = tb.national_history()
    contested_2018 = data[(data["year"] == 2018) & (data["contested"] == 1)]["margin"].mean()

    house = forecast["house"]
    payload = {
        "generated": date.today().isoformat(),
        "acs": "ACS 2012–2024 5-year",
        "mainModel": forecast["mainModel"],
        "headline": {
            "accuracy": round(float(main_rows["oracle_accuracy"].mean()), 3),
            "years": [int(y) for y in main_rows["year"]],
            "rmse": round(float(main_rows["rmse"].mean()), 1),
            "stateHoldoutRmse": round(float(main_rows["state_holdout_rmse"].mean()), 1),
            "variables": len(tb.FEATURES),
        },
        "national": {"mean": forecast["national"]["mean"], "sd": forecast["national"]["sd"], "popularVote2024": forecast["national"]["popularVote2024"],
                     "swings": forecast["national"]["swings"]},
        "house": {"median": house["demMedian"], "p10": house["p10"], "p90": house["p90"], "pMajority": house["demMajority"], "expected": house["expectedDem"],
                  "distribution": [[int(k), round(v / 20000, 4)] for k, v in sorted(((int(k), v) for k, v in house["distribution"].items()))]},
        "backtest": [{
            "year": int(row["year"]), "actual": int(row["oracle_dem_seats_actual"]), "oracle": int(row["oracle_dem_seats_pred"]),
            "sim": int(row["sim_median"]), "p10": int(row["sim_p10"]), "p90": int(row["sim_p90"]), "pMajority": round(float(row["sim_dem_majority"]), 3),
            "accuracy": round(float(row["oracle_accuracy"]), 3), "brier": round(float(row["brier_blind"]), 3),
            "brier538": None if pd.isna(row.get("brier_538")) else round(float(row["brier_538"]), 3),
            "brierMp26": mp26.get(str(int(row["year"])), {}).get("house", {}).get("brier"),
            "nationalTrue": round(float(row["national_true"]), 1), "nationalBlind": round(float(row["national_blind"]), 1),
        } for _, row in main_rows.iterrows()],
        "lesson2018": {"meanContested": round(float(contested_2018), 1), "popularVote": round(float(national[2018]), 1)},
        "features": importance(data),
        "races": [[race["code"], race["margin"], race["pD"], int(race["redrawn"])] for race in forecast["races"]],
        "redraw": [{"state": state, "census": round(v["expectedDemNew"] - v["expectedDemOld"], 1),
                    "withPres": round(pres["redrawEffect"][state]["expectedDemNew"] - pres["redrawEffect"][state]["expectedDemOld"], 1)}
                   for state, v in forecast["redrawEffect"].items()],
        "benchmarks": [{"set": row["mode"], "brier": round(float(row["brier"]), 3), "accuracy": round(float(row["accuracy"]), 3),
                        "seatBias": round(float(row["seat_bias"]), 1), "median2026": int(outlook.loc["demMedian", row["mode"]]),
                        "pMajority2026": round(float(outlook.loc["demMajority", row["mode"]]), 3)} for _, row in benchmarks.iterrows()],
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False))
    print(f"{OUT.relative_to(PROJECT)}: {OUT.stat().st_size / 1024:.0f} KB")
    print(json.dumps({k: payload[k] for k in ("headline", "lesson2018", "redraw")}, indent=1))
    print(json.dumps(payload["features"][:8]))


if __name__ == "__main__":
    main()

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
from sklearn.linear_model import RidgeCV

import train_backtest as tb
from build_dataset import FIPS
from redistrict import REDRAWN_2026

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
OUT = PROJECT / "src" / "data" / "census-model.json"
SEED = 2026
# Variables shown on district cards, in the variable → vote chart and as sliders.
PROFILE = ["bachelors", "white_noncollege", "white", "black", "hispanic", "married", "median_age", "public_transport", "density", "income"]
SLIDERS = ["bachelors", "white", "black", "hispanic", "married", "median_age", "public_transport", "log_density"]
# Real 2024 districts used as starting points for "play the model".
PRESETS = ["NY-12", "VA-11", "TX-34", "VA-09", "GA-13", "WI-03"]


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


def raw_income(lines):
    """Median household income in dollars by district code, for the 2024 or the November 2026 lines."""
    official = pd.read_csv(ROOT / "data/acs/acs5_2024_cd.csv", dtype={"state": str, "cd": str})
    official = official[official["state"].isin(FIPS) & ~official["cd"].isin(["ZZ", "98"])]
    income = dict(zip(official["state"].map(FIPS) + "-" + official["cd"], official["median_income"]))
    if lines == "2026":
        redrawn = pd.read_csv(ROOT / "data/acs/acs5_2024_cd2026.csv")
        income = {code: value for code, value in income.items() if code[:2] not in REDRAWN_2026}
        income.update(dict(zip(redrawn["code"], redrawn["median_income"])))
    return income


def profiles(frame, lines):
    income = raw_income(lines)
    out = {}
    for row in frame.to_dict(orient="records"):
        values = {key: row[key] for key in PROFILE if key in row}
        values["density"] = 10 ** row["log_density"]
        values["income"] = income.get(row["code"], np.nan)
        out[row["code"]] = [None if pd.isna(values[key]) else round(float(values[key]), 1 if key not in ("density", "income") else 0) for key in PROFILE]
    return out


def residuals_2024(data, national):
    """Out-of-sample 2024 prediction (trained on 2012–2022) against the 2024 result, contested races only."""
    train = data[(data["year"] < 2024) & (data["contested"] == 1)]
    test = data[data["year"] == 2024].copy()
    predicted = tb.fit_predict(train, test)[0]["blend"] + national[2024]
    return [[code, round(float(p), 1), None if pd.isna(m) else round(float(m), 1)] for code, p, m in zip(test["code"], predicted, test["margin"])]


def twins(data):
    """Pairs of 2024 districts in different states with nearly the same census profile."""
    rows = data[(data["year"] == 2024) & (data["contested"] == 1)].reset_index(drop=True)
    z = ((rows[tb.FEATURES] - rows[tb.FEATURES].mean()) / rows[tb.FEATURES].std()).to_numpy()
    distance = np.sqrt(((z[:, None, :] - z[None, :, :]) ** 2).sum(axis=2))
    pairs = []
    for i in range(len(rows)):
        for j in range(i + 1, len(rows)):
            if rows.loc[i, "state"] != rows.loc[j, "state"] and rows.loc[i, "division"] != rows.loc[j, "division"]:
                pairs.append((distance[i, j], i, j))
    pairs.sort()
    chosen, used = [], set()
    for d, i, j in pairs:
        if i in used or j in used:
            continue
        gap = abs(rows.loc[i, "margin"] - rows.loc[j, "margin"])
        kind = "alike" if gap < 8 else "apart" if gap > 25 else None
        if kind and sum(1 for c in chosen if c["kind"] == kind) < (3 if kind == "alike" else 2):
            chosen.append({"kind": kind, "distance": round(float(d), 2),
                           "a": rows.loc[i, "code"], "b": rows.loc[j, "code"],
                           "marginA": round(float(rows.loc[i, "margin"]), 1), "marginB": round(float(rows.loc[j, "margin"]), 1)})
            used.update([i, j])
        if len(chosen) == 5:
            break
    return chosen


def linear_toy(data, national):
    """A ridge regression on eight readable variables and the region: the 'play the model' surrogate."""
    columns = SLIDERS + [c for c in tb.design(data).columns if c.startswith("division_")]

    def fit(train):
        x = pd.get_dummies(train[SLIDERS + ["division"]], columns=["division"], dtype=float).reindex(columns=columns, fill_value=0.0)
        mean, sd = x[SLIDERS].mean(), x[SLIDERS].std()
        x[SLIDERS] = (x[SLIDERS] - mean) / sd
        weights = 0.5 ** ((2026 - train["year"]) / tb.HALF_LIFE)
        return RidgeCV(alphas=np.logspace(-2, 3, 30)).fit(x, train["relative"], sample_weight=weights), mean, sd

    def predict(model, mean, sd, frame):
        x = pd.get_dummies(frame[SLIDERS + ["division"]], columns=["division"], dtype=float).reindex(columns=columns, fill_value=0.0)
        x[SLIDERS] = (x[SLIDERS] - mean) / sd
        return model.predict(x)

    contested = data[data["contested"] == 1]
    check, check_mean, check_sd = fit(contested[contested["year"] < 2024])
    test = contested[contested["year"] == 2024]
    toy_rmse = float(np.sqrt(np.mean((test["relative"] - predict(check, check_mean, check_sd, test)) ** 2)))
    model, mean, sd = fit(contested)
    latest = data[data["year"] == 2024].set_index("code")
    coefficient = dict(zip(columns, model.coef_))
    return {
        "intercept": round(float(model.intercept_), 3),
        "variables": [{"key": key, "mean": round(float(mean[key]), 3), "sd": round(float(sd[key]), 3), "coef": round(float(coefficient[key]), 3),
                       "min": round(float(latest[key].quantile(.01)), 1), "max": round(float(latest[key].quantile(.99)), 1)} for key in SLIDERS],
        "regions": {key.replace("division_", ""): round(float(coefficient[key]), 3) for key in columns if key.startswith("division_")},
        "rmse": round(toy_rmse, 1),
        "national2026": None,
        "presets": [{"code": code, "division": latest.loc[code, "division"], "margin2024": None if pd.isna(latest.loc[code, "margin"]) else round(float(latest.loc[code, "margin"]), 1),
                     "values": {key: round(float(latest.loc[code, key]), 2) for key in SLIDERS}} for code in PRESETS],
    }


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
        "profileKeys": PROFILE,
        "profiles2026": profiles(tb.frame_2026(data), "2026"),
        "profiles2024": profiles(data[data["year"] == 2024], "2024"),
        "results2024": residuals_2024(data, national),
        "twins": twins(data),
        "toy": {**linear_toy(data, national), "national2026": forecast["national"]["mean"]},
        "benchmarks": [{"set": row["mode"], "brier": round(float(row["brier"]), 3), "accuracy": round(float(row["accuracy"]), 3),
                        "seatBias": round(float(row["seat_bias"]), 1), "median2026": int(outlook.loc["demMedian", row["mode"]]),
                        "pMajority2026": round(float(outlook.loc["demMajority", row["mode"]]), 3)} for _, row in benchmarks.iterrows()],
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False))
    print(f"{OUT.relative_to(PROJECT)}: {OUT.stat().st_size / 1024:.0f} KB")
    print(json.dumps({k: payload[k] for k in ("headline", "lesson2018", "redraw")}, indent=1))
    print(json.dumps(payload["features"][:8]))
    print(json.dumps(payload["twins"], indent=1))
    print(json.dumps({k: v for k, v in payload["toy"].items() if k != "presets"}, indent=1)[:1800])


if __name__ == "__main__":
    main()

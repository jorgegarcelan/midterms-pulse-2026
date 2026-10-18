"""
Census-only House model: rolling-origin backtest and a first 2026 run.

The margin of a district in a given year is split in two:
    margin = national(year) + structural(district census profile)
- structural is learned by Ridge / Random Forest / XGBoost on margins relative to the year's
  national level (mean contested margin), using only ACS features and the Census division;
- national is not learned from census data. "Oracle" uses the real national level of the test
  year (isolates the census skill); "blind" uses what was known beforehand: the previous
  election's level moved by the historical midterm swing against the president's party.

Usage: census-model/.venv/bin/python census-model/train_backtest.py
"""
import json
import warnings
from math import erf, sqrt
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import RidgeCV
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
OUT = ROOT / "output"

PRESIDENT = {2000: "D", 2002: "R", 2004: "R", 2006: "R", 2008: "R", 2010: "D", 2012: "D", 2014: "D", 2016: "D",
             2018: "R", 2020: "R", 2022: "D", 2024: "D", 2026: "R"}  # party in the White House on election day
REDRAWN_2026 = {"TX", "FL", "OH", "NC", "MO", "TN", "LA", "AL", "CA", "UT"}
HALF_LIFE = 4  # years: recent cycles weigh more, the education realignment keeps moving
SEED = 2026
MAIN = "xgboost"  # best out-of-sample in every backtest year; the others are kept for comparison


def phi(x):
    return 0.5 * (1 + np.vectorize(erf)(np.asarray(x) / sqrt(2)))


def national_history():
    """Mean two-party margin of contested House races, 2000–2024, from the project's history files."""
    rows = []
    for file in (PROJECT / "public/data/history/house").glob("*.json"):
        for results in json.loads(file.read_text())["districts"].values():
            for r in results:
                if r["dp"] > 0 and r["rp"] > 0 and "u" not in r:
                    rows.append((r["y"], 100 * (r["dp"] - r["rp"]) / (r["dp"] + r["rp"])))
    return pd.DataFrame(rows, columns=["year", "margin"]).groupby("year")["margin"].mean()


def midterm_swings(national, before):
    """Swing toward the out-party in each midterm before `before`, in D−R points signed so + = against the president."""
    swings = {}
    for year in range(2002, before, 4):
        if year in national and year - 2 in national:
            change = national[year] - national[year - 2]
            swings[year] = change if PRESIDENT[year] == "R" else -change
    return pd.Series(swings)


def blind_national(national, year):
    previous = national[year - 2]
    if year % 4 == 0:
        return previous, 3.0
    swings = midterm_swings(national, year)
    toward_d = swings.mean() if PRESIDENT[year] == "R" else -swings.mean()
    return previous + toward_d, max(swings.std(ddof=1), 2.0)


def models():
    return {
        "ridge": make_pipeline(StandardScaler(), RidgeCV(alphas=np.logspace(-2, 3, 30))),
        "random_forest": RandomForestRegressor(n_estimators=500, min_samples_leaf=3, max_features=0.4, n_jobs=-1, random_state=SEED),
        "xgboost": XGBRegressor(n_estimators=700, learning_rate=0.03, max_depth=4, subsample=0.8, colsample_bytree=0.7,
                                min_child_weight=3, reg_lambda=1.0, random_state=SEED, n_jobs=4),
    }


def design(frame, columns=None):
    x = pd.get_dummies(frame[FEATURES + ["division"]], columns=["division"], dtype=float)
    return x.reindex(columns=columns, fill_value=0.0) if columns is not None else x


def fit_predict(train, test, weighted=True):
    x_train, y_train = design(train), train["relative"]
    x_test = design(test, x_train.columns)
    weights = 0.5 ** ((test["year"].iloc[0] - train["year"]) / HALF_LIFE) if weighted else None
    predictions, fitted = {}, {}
    for name, model in models().items():
        if name == "ridge":
            model.fit(x_train, y_train, ridgecv__sample_weight=weights)
        else:
            model.fit(x_train, y_train, sample_weight=weights)
        predictions[name] = model.predict(x_test)
        fitted[name] = model
    predictions["trees"] = np.mean([predictions[k] for k in ("random_forest", "xgboost")], axis=0)
    return predictions, fitted, x_train.columns


def state_holdout_rmse(train):
    """Error on states the model never saw: the pure census → vote skill, without district memory."""
    x, y = design(train), train["relative"]
    residuals = []
    for fold_train, fold_test in GroupKFold(n_splits=5).split(x, y, train["state"]):
        model = models()[MAIN].fit(x.iloc[fold_train], y.iloc[fold_train])
        residuals.append(y.iloc[fold_test] - model.predict(x.iloc[fold_test]))
    return float(np.sqrt(np.mean(np.concatenate(residuals) ** 2)))


def temporal_rmse(data, year):
    """Error predicting `year` blind from earlier cycles: the local spread used for the next cycle."""
    train = data[(data["year"] < year) & (data["contested"] == 1)]
    test = data[(data["year"] == year) & (data["contested"] == 1)]
    predictions, _, _ = fit_predict(train, test)
    return float(np.sqrt(np.mean((test["relative"].to_numpy() - predictions[MAIN]) ** 2)))


def seat_metrics(predicted_margin, test):
    called = test["winner"].isin(["D", "R"])
    predicted_d = predicted_margin > 0
    actual_d = test["winner"] == "D"
    return {
        "accuracy": float((predicted_d[called] == actual_d[called]).mean()),
        "dem_seats_pred": int(predicted_d.sum()),
        "dem_seats_actual": int(actual_d.sum()),
        "misses": int((predicted_d[called] != actual_d[called]).sum()),
    }


def simulate(structural, national_mean, national_sd, sd_local, runs=20000, seed=SEED):
    rng = np.random.default_rng(seed)
    national = rng.normal(national_mean, national_sd, size=(runs, 1))
    seats = ((structural[None, :] + national + rng.normal(0, sd_local, size=(runs, len(structural)))) > 0).sum(axis=1)
    return seats


def backtest(data, national):
    report = []
    for year in [2016, 2018, 2020, 2022, 2024]:
        train, test = data[data["year"] < year], data[data["year"] == year].copy()
        train = train[train["contested"] == 1]
        predictions, _, _ = fit_predict(train, test)
        mu_true = national[year]
        mu_blind, sd_nat = blind_national(national, year)
        sd_loc = temporal_rmse(data, year - 2)
        contested = test["contested"] == 1
        for name, structural in predictions.items():
            relative_true = test.loc[contested, "relative"].to_numpy()
            residual = relative_true - structural[contested.to_numpy()]
            row = {
                "year": year, "midterm": year % 4 == 2, "model": name,
                "rmse": float(np.sqrt(np.mean(residual ** 2))),
                "r2_relative": float(1 - residual.var() / relative_true.var()),
                "r2_margin": float(1 - np.mean(residual ** 2) / test.loc[contested, "margin"].var()),
            }
            oracle = seat_metrics(structural + mu_true, test)
            blind = seat_metrics(structural + mu_blind, test)
            row.update({f"oracle_{k}": v for k, v in oracle.items()})
            row.update({f"blind_{k}": v for k, v in blind.items()})
            row.update({"national_true": float(mu_true), "national_blind": float(mu_blind), "national_sd": float(sd_nat), "local_sd": sd_loc})
            if name == MAIN:
                row["state_holdout_rmse"] = state_holdout_rmse(train)
                p_d = phi((structural + mu_blind) / np.sqrt(sd_loc ** 2 + sd_nat ** 2))
                called = test["winner"].isin(["D", "R"]).to_numpy()
                row["brier_blind"] = float(np.mean((p_d[called] - (test["winner"] == "D").to_numpy()[called]) ** 2))
                seats = simulate(structural, mu_blind, sd_nat, sd_loc)
                row.update({"sim_median": int(np.median(seats)), "sim_p10": int(np.percentile(seats, 10)), "sim_p90": int(np.percentile(seats, 90)),
                            "sim_dem_majority": float((seats >= 218).mean())})
                compare_538(year, test, p_d, row)
            report.append(row)
    return pd.DataFrame(report)


def compare_538(year, test, p_d, row):
    path = PROJECT / "data/backtest" / f"inputs-{year}.json"
    if not path.exists():
        return
    feed = json.loads(path.read_text())
    p538 = {race["code"]: race["p538"] for race in feed["races"] if race["chamber"] == "house"}
    frame = test.assign(p_census=p_d, p538=test["code"].map(p538))
    frame = frame[frame["winner"].isin(["D", "R"]) & frame["p538"].notna()]
    actual = (frame["winner"] == "D").astype(float)
    row["brier_538"] = float(np.mean((frame["p538"] - actual) ** 2))
    row["brier_census_same_races"] = float(np.mean((frame["p_census"] - actual) ** 2))
    row["accuracy_538"] = float(((frame["p538"] > 0.5) == (actual == 1)).mean())
    row["seats_538_median"] = feed["house538"]["median"]
    row["majority_538"] = feed["house538"]["pD"]


def importance(fitted, columns):
    ridge = fitted["ridge"].named_steps["ridgecv"].coef_
    xgb = fitted["xgboost"].feature_importances_
    frame = pd.DataFrame({"feature": columns, "ridge_coef_per_sd": ridge, "xgb_gain_share": xgb})
    return frame.reindex(frame["ridge_coef_per_sd"].abs().sort_values(ascending=False).index)


def forecast_2026(data, national):
    train = data[data["contested"] == 1]
    test = data[data["year"] == 2024].copy()
    test["year"] = 2026
    predictions, fitted, columns = fit_predict(train, test)
    structural = predictions[MAIN]
    mu, sd_nat = blind_national(national, 2026)
    sd_loc = temporal_rmse(data, 2024)
    p_d = phi((structural + mu) / np.sqrt(sd_loc ** 2 + sd_nat ** 2))
    seats = simulate(structural, mu, sd_nat, sd_loc)
    races = [{
        "code": code, "structural": round(float(s), 1), "margin": round(float(s + mu), 1), "pD": round(float(p), 3),
        "ridge": round(float(r), 1), "randomForest": round(float(f), 1), "xgboost": round(float(x), 1),
        "won2024": won, "margin2024": None if np.isnan(m) else round(float(m), 1), "redrawn": code[:2] in REDRAWN_2026,
    } for code, s, p, r, f, x, won, m in zip(test["code"], structural, p_d, predictions["ridge"], predictions["random_forest"],
                                              predictions["xgboost"], test["winner"], test["margin"])]
    histogram = np.bincount(seats, minlength=436)
    output = {
        "model": "census-only House model, phase 1", "lines": "119th Congress (2024 maps)",
        "acs": "ACS 2024 5-year", "trainedOn": sorted(int(y) for y in train["year"].unique()),
        "national": {"mean": round(float(mu), 2), "sd": round(float(sd_nat), 2), "basis": "2024 mean contested margin + mean midterm swing against the president's party, 2002–2022",
                     "swings": {int(k): round(float(v), 2) for k, v in midterm_swings(national, 2026).items()}},
        "localSd": round(sd_loc, 2), "mainModel": MAIN,
        "house": {"demMedian": int(np.median(seats)), "p10": int(np.percentile(seats, 10)), "p90": int(np.percentile(seats, 90)),
                  "demMajority": round(float((seats >= 218).mean()), 3), "expectedDem": round(float(p_d.sum()), 1),
                  "distribution": {int(k): int(v) for k, v in enumerate(histogram) if v}},
        "redrawnStates": sorted(REDRAWN_2026), "races": races,
    }
    (OUT / "house-2026.json").write_text(json.dumps(output, indent=1))
    importance(fitted, columns).to_csv(OUT / "feature-importance.csv", index=False)
    return output


FEATURES = []


def main():
    global FEATURES
    OUT.mkdir(exist_ok=True)
    data = pd.read_csv(ROOT / "data" / "dataset.csv")
    FEATURES = [c for c in data.columns if c not in {"code", "year", "state", "division", "winner", "contested", "margin"}]
    national = national_history()
    year_level = data[data["contested"] == 1].groupby("year")["margin"].mean()
    data["relative"] = data["margin"] - data["year"].map(year_level)
    national.update(year_level)  # same definition on the years the model sees

    report = backtest(data, national)
    report.to_csv(OUT / "backtest.csv", index=False)
    pd.set_option("display.width", 220)
    print(report[["year", "model", "rmse", "r2_relative", "r2_margin", "oracle_accuracy", "oracle_dem_seats_pred", "oracle_dem_seats_actual",
                  "blind_accuracy", "blind_dem_seats_pred", "national_true", "national_blind"]].round(3).to_string(index=False))
    ens = report[report["model"] == MAIN]
    cols = [c for c in ["year", "state_holdout_rmse", "brier_blind", "sim_median", "sim_p10", "sim_p90", "sim_dem_majority", "local_sd", "national_sd",
                        "brier_538", "brier_census_same_races", "accuracy_538", "seats_538_median", "majority_538"] if c in ens]
    print(ens[cols].round(3).to_string(index=False))

    result = forecast_2026(data, national)
    house = {k: v for k, v in result["house"].items() if k != "distribution"}
    print(json.dumps({"national": result["national"], "localSd": result["localSd"], "house": house}, indent=1))


if __name__ == "__main__":
    main()

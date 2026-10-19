"""
Census-only House model: rolling-origin backtest and the 2026 run.

The margin of a district in a given year is split in two:
    margin = national(year) + structural(district census profile)
- structural is learned on margins relative to the national House popular vote, using only ACS
  features and the Census division. Several learners are compared (see models()); the one with the
  lowest mean Brier score across the backtest years is used for 2026, ties at three decimals
  broken by the error in the simulated Democratic seat total.
- national is not learned from census data. "Oracle" uses the real popular vote of the test year
  (isolates the census skill); "blind" uses what was known beforehand: the previous election's
  popular vote moved by the mean midterm swing against the president's party since 2002.

Feature sets: "census" (default) uses the ACS profile only; "census_pres" adds the district's
last presidential lean on the same lines (pres_by_cd.py) and writes to output/census_pres/.

Usage: census-model/.venv/bin/python census-model/train_backtest.py [census|census_pres]
"""
import sys
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

from build_dataset import STATE_DIVISION, features
from redistrict import REDRAWN_2026, official_2024
from structural import TwoStage

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
OUT = ROOT / "output"

PRESIDENT = {2000: "D", 2002: "R", 2004: "R", 2006: "R", 2008: "R", 2010: "D", 2012: "D", 2014: "D", 2016: "D",
             2018: "R", 2020: "R", 2022: "D", 2024: "D", 2026: "R"}  # party in the White House on election day
# Extra spread for redrawn districts: rebuilding ACS profiles from block groups moved the blend's
# predicted margin by 1.6 points on average when tested on the 2024 lines (see redistrict.py).
REAGGREGATION_SD = 1.6
HALF_LIFE = 4  # years: recent cycles weigh more, the education realignment keeps moving
SEED = 2026
BACKTEST_YEARS = [2016, 2018, 2020, 2022, 2024]
PRESIDENTIAL_YEAR_SD = 3.0  # national uncertainty when the previous level is carried forward unchanged
FEATURES = []


def phi(x):
    return 0.5 * (1 + np.vectorize(erf)(np.asarray(x) / sqrt(2)))


def national_history():
    """National House popular vote, two-party D − R margin, 2000–2024 (see national.py)."""
    return pd.read_csv(ROOT / "data" / "national-house-vote.csv").set_index("year")["margin"]


def midterm_swings(national, before):
    """Popular-vote swing in each midterm before `before`, signed so + = against the president's party."""
    swings = {}
    for year in range(2002, before, 4):
        if year in national and year - 2 in national:
            change = national[year] - national[year - 2]
            swings[year] = change if PRESIDENT[year] == "R" else -change
    return pd.Series(swings)


def blind_national(national, year):
    previous = national[year - 2]
    if year % 4 == 0:
        return previous, PRESIDENTIAL_YEAR_SD
    swings = midterm_swings(national, year)
    toward_d = swings.mean() if PRESIDENT[year] == "R" else -swings.mean()
    return previous + toward_d, swings.std(ddof=1)


def design(frame, columns=None):
    x = pd.get_dummies(frame[FEATURES + ["division"]], columns=["division"], dtype=float)
    return x.reindex(columns=columns, fill_value=0.0) if columns is not None else x


def models():
    """Learners of the structural layer. TwoStage takes the raw frame (it needs the year)."""
    return {
        "ridge": make_pipeline(StandardScaler(), RidgeCV(alphas=np.logspace(-2, 3, 30))),
        "random_forest": RandomForestRegressor(n_estimators=500, min_samples_leaf=3, max_features=0.4, n_jobs=-1, random_state=SEED),
        "xgboost": XGBRegressor(n_estimators=700, learning_rate=0.03, max_depth=4, subsample=0.8, colsample_bytree=0.7,
                                min_child_weight=3, reg_lambda=1.0, random_state=SEED, n_jobs=4),
        "two_stage": TwoStage(FEATURES, drift=False, midterm=None, seed=SEED),
        "two_stage_drift": TwoStage(FEATURES, drift=True, midterm=None, seed=SEED),
    }


def fit_predict(train, test):
    x_train, y_train = design(train), train["relative"]
    x_test = design(test, x_train.columns)
    weights = 0.5 ** ((test["year"].iloc[0] - train["year"]) / HALF_LIFE)
    predictions, fitted = {}, {}
    for name, model in models().items():
        if isinstance(model, TwoStage):
            model.fit(train, y_train, sample_weight=weights)
            predictions[name] = model.predict(test)
        else:
            fit_args = {"ridgecv__sample_weight": weights} if name == "ridge" else {"sample_weight": weights}
            model.fit(x_train, y_train, **fit_args)
            predictions[name] = model.predict(x_test)
        fitted[name] = model
    predictions["blend"] = (predictions["xgboost"] + predictions["two_stage"]) / 2
    return predictions, fitted, x_train.columns


def rolling(data):
    """Out-of-sample predictions for every cycle from 2014 on, each trained only on earlier cycles."""
    folds = {}
    for year in [2014] + BACKTEST_YEARS:
        train = data[(data["year"] < year) & (data["contested"] == 1)]
        test = data[data["year"] == year].copy()
        folds[year] = (train, test, fit_predict(train, test)[0])
    return folds


def rmse(test, structural):
    contested = (test["contested"] == 1).to_numpy()
    return float(np.sqrt(np.mean((test["relative"].to_numpy()[contested] - structural[contested]) ** 2)))


def state_holdout_rmse(train, name):
    """Error on states the model never saw: the pure census → vote skill, without district memory."""
    residuals = []
    for fold_train, fold_test in GroupKFold(n_splits=5).split(train, groups=train["state"]):
        a, b = train.iloc[fold_train], train.iloc[fold_test]
        predictions = fit_predict(a, b.assign(year=a["year"].max()))[0]
        residuals.append(b["relative"].to_numpy() - predictions[name])
    return float(np.sqrt(np.mean(np.concatenate(residuals) ** 2)))


def seat_metrics(predicted_margin, test):
    called = test["winner"].isin(["D", "R"])
    predicted_d = predicted_margin > 0
    actual_d = test["winner"] == "D"
    return {
        "accuracy": float((predicted_d[called] == actual_d[called]).mean()),
        "dem_seats_pred": int(predicted_d.sum()),
        "dem_seats_actual": int(actual_d.sum()),
    }


def simulate(structural, national_mean, national_sd, sd_local, runs=20000, seed=SEED):
    rng = np.random.default_rng(seed)
    national = rng.normal(national_mean, national_sd, size=(runs, 1))
    return ((structural[None, :] + national + rng.normal(0, sd_local, size=(runs, len(structural)))) > 0).sum(axis=1)


def win_probability(structural, mu, sd_nat, sd_loc):
    return phi((structural + mu) / np.sqrt(sd_loc ** 2 + sd_nat ** 2))


def backtest(data, national, folds):
    report = []
    for year in BACKTEST_YEARS:
        train, test, predictions = folds[year]
        mu_true = national[year]
        mu_blind, sd_nat = blind_national(national, year)
        called = test["winner"].isin(["D", "R"]).to_numpy()
        won_d = (test["winner"] == "D").to_numpy()
        for name, structural in predictions.items():
            sd_loc = rmse(folds[year - 2][1], folds[year - 2][2][name])  # error of the previous cycle, known in advance
            p_d = win_probability(structural, mu_blind, sd_nat, sd_loc)
            seats = simulate(structural, mu_blind, sd_nat, sd_loc)
            row = {"year": year, "midterm": year % 4 == 2, "model": name, "rmse": rmse(test, structural), "local_sd": sd_loc,
                   "national_true": float(mu_true), "national_blind": float(mu_blind), "national_sd": float(sd_nat),
                   "brier_blind": float(np.mean((p_d[called] - won_d[called]) ** 2)),
                   "sim_median": int(np.median(seats)), "sim_p10": int(np.percentile(seats, 10)), "sim_p90": int(np.percentile(seats, 90)),
                   "sim_dem_majority": float((seats >= 218).mean())}
            row.update({f"oracle_{k}": v for k, v in seat_metrics(structural + mu_true, test).items()})
            row.update({f"blind_{k}": v for k, v in seat_metrics(structural + mu_blind, test).items()})
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
    row["seats_538_median"] = feed["house538"]["median"]
    row["majority_538"] = feed["house538"]["pD"]


def summarize(report):
    report = report.assign(oracle_seat_error=report["oracle_dem_seats_pred"] - report["oracle_dem_seats_actual"],
                           sim_seat_error=report["sim_median"] - report["oracle_dem_seats_actual"])
    return report.groupby("model").agg(
        brier=("brier_blind", "mean"), rmse=("rmse", "mean"), oracle_accuracy=("oracle_accuracy", "mean"),
        oracle_seat_mae=("oracle_seat_error", lambda s: s.abs().mean()), oracle_seat_bias=("oracle_seat_error", "mean"),
        blind_seat_mae=("sim_seat_error", lambda s: s.abs().mean()),
    ).assign(brier_rank=lambda f: f["brier"].round(3)).sort_values(["brier_rank", "blind_seat_mae"]).drop(columns="brier_rank")


def importance(fitted, columns):
    ridge = fitted["ridge"].named_steps["ridgecv"].coef_
    xgb = fitted["xgboost"].feature_importances_
    frame = pd.DataFrame({"feature": columns, "ridge_coef_per_sd": ridge, "xgb_gain_share": xgb})
    return frame.reindex(frame["ridge_coef_per_sd"].abs().sort_values(ascending=False).index)


def frame_2026(data):
    """The 435 districts of November 2026: official ACS for unchanged lines, rebuilt profiles for redrawn states."""
    raw_2024 = pd.read_csv(ROOT / "data" / "acs" / "acs5_2024_cd.csv", dtype={"state": str, "cd": str})
    unchanged_states = sorted({c[:2] for c in data.loc[data["year"] == 2024, "code"]} - set(REDRAWN_2026))
    unchanged = official_2024(unchanged_states)
    redrawn = pd.read_csv(ROOT / "data" / "acs" / "acs5_2024_cd2026.csv").set_index("code")
    raw = pd.concat([unchanged[redrawn.columns.drop("acs_year")], redrawn.drop(columns="acs_year")])
    assert len(raw) == 435 and len(raw_2024) >= 435
    frame = features(raw)
    frame.insert(0, "code", frame.index)
    frame.insert(1, "year", 2026)
    frame.insert(2, "state", frame["code"].str[:2])
    frame.insert(3, "division", frame["state"].map(STATE_DIVISION))
    frame["redrawn"] = frame["state"].isin(REDRAWN_2026)
    last = data[data["year"] == 2024].set_index("code")
    frame["won2024"] = np.where(frame["redrawn"], None, frame["code"].map(last["winner"]))
    frame["margin2024"] = np.where(frame["redrawn"], np.nan, frame["code"].map(last["margin"]))
    if "pres_lean" in FEATURES:
        frame["pres_lean"] = frame["code"].map(pres_lean().query("year == 2026 and lines == 120").set_index("code")["pres_lean"])
    return frame.sort_values("code").reset_index(drop=True)


def seat_outlook(seats, p_d):
    return {"demMedian": int(np.median(seats)), "p10": int(np.percentile(seats, 10)), "p90": int(np.percentile(seats, 90)),
            "demMajority": round(float((seats >= 218).mean()), 3), "expectedDem": round(float(p_d.sum()), 1)}


def forecast_2026(data, national, folds, main, summary):
    train = data[data["contested"] == 1]
    test = frame_2026(data)
    predictions, fitted, columns = fit_predict(train, test)
    structural = predictions[main]
    mu, sd_nat = blind_national(national, 2026)
    sd_known = rmse(folds[2024][1], folds[2024][2][main])  # next cycle on the same lines
    sd_new = float(np.hypot(rmse(folds[2022][1], folds[2022][2][main]), REAGGREGATION_SD))  # 2022: every map was new
    sd_loc = np.where(test["redrawn"], sd_new, sd_known)
    p_d = win_probability(structural, mu, sd_nat, sd_loc)
    seats = simulate(structural, mu, sd_nat, sd_loc)

    # Same model on the 2024 lines, to isolate what the new maps change.
    old = data[data["year"] == 2024].assign(year=2026)
    if "pres_lean" in FEATURES:  # same presidential election (2024) as the new lines, so only the map differs
        old["pres_lean"] = old["code"].map(pres_lean().query("year == 2026 and lines == 119").set_index("code")["pres_lean"])
    old_structural = fit_predict(train, old)[0][main]
    old_p = win_probability(old_structural, mu, sd_nat, sd_known)
    old_seats = simulate(old_structural, mu, sd_nat, sd_known)
    by_state = pd.DataFrame({"state": test["state"], "new": p_d}).groupby("state")["new"].sum().to_frame() \
        .join(pd.DataFrame({"state": old["state"].to_numpy(), "old": old_p}).groupby("state")["old"].sum())
    redraw_effect = {state: {"expectedDemNew": round(float(row["new"]), 1), "expectedDemOld": round(float(row["old"]), 1)}
                     for state, row in by_state.loc[sorted(REDRAWN_2026)].iterrows()}

    races = [{
        "code": row["code"], "structural": round(float(s), 1), "margin": round(float(s + mu), 1), "pD": round(float(p), 3),
        **{name: round(float(values[i]), 1) for name, values in predictions.items()},
        "redrawn": bool(row["redrawn"]), "won2024": row["won2024"],
        "margin2024": None if pd.isna(row["margin2024"]) else round(float(row["margin2024"]), 1),
    } for i, (row, s, p) in enumerate(zip(test.to_dict(orient="records"), structural, p_d))]
    histogram = np.bincount(seats, minlength=436)
    output = {
        "model": "census-only House model, phase 3", "lines": "November 2026 maps (Census 120th Congress block file)",
        "acs": "ACS 2024 5-year; redrawn districts rebuilt from tracts and 2020 blocks",
        "trainedOn": sorted(int(y) for y in train["year"].unique()), "mainModel": main,
        "national": {"mean": round(float(mu), 2), "sd": round(float(sd_nat), 2),
                     "basis": "2024 House popular vote + mean midterm swing against the president's party, 2002–2022",
                     "popularVote2024": float(national[2024]),
                     "swings": {int(k): round(float(v), 2) for k, v in midterm_swings(national, 2026).items()}},
        "localSd": {"unchangedLines": round(sd_known, 2), "redrawn": round(sd_new, 2)},
        "house": {**seat_outlook(seats, p_d), "distribution": {int(k): int(v) for k, v in enumerate(histogram) if v}},
        "house2024Lines": seat_outlook(old_seats, old_p),
        "redrawEffect": redraw_effect,
        "backtest": summary.round(4).reset_index().to_dict(orient="records"),
        "redrawnStates": sorted(REDRAWN_2026), "races": races,
    }
    (OUT / "house-2026.json").write_text(json.dumps(output, indent=1))
    importance(fitted, columns).to_csv(OUT / "feature-importance.csv", index=False)
    fitted["two_stage"].coefficients(test).sort_values(key=abs, ascending=False).to_csv(OUT / "two-stage-coefficients.csv", header=["coef"])
    return output


def pres_lean():
    return pd.read_csv(ROOT / "data" / "pres-lean.csv")


def load(feature_set="census"):
    """Dataset with the margin relative to the national popular vote; also sets FEATURES and OUT."""
    global OUT
    OUT = ROOT / "output" if feature_set == "census" else ROOT / "output" / feature_set
    OUT.mkdir(parents=True, exist_ok=True)
    data = pd.read_csv(ROOT / "data" / "dataset.csv")
    if feature_set == "census_pres":
        lean = pres_lean().query("not (year == 2026 and lines == 119)")
        data = data.merge(lean[["year", "code", "pres_lean"]], on=["year", "code"], how="left")
        assert data["pres_lean"].notna().all()
    FEATURES[:] = [c for c in data.columns if c not in {"code", "year", "state", "division", "winner", "contested", "margin"}]
    data["relative"] = data["margin"] - data["year"].map(national_history())
    return data


def main():
    data = load(sys.argv[1] if len(sys.argv) > 1 else "census")
    national = national_history()
    folds = rolling(data)
    report = backtest(data, national, folds)
    summary = summarize(report)
    main_model = summary.index[0]
    for name in ["xgboost", main_model]:
        report.loc[report["model"] == name, "state_holdout_rmse"] = [state_holdout_rmse(folds[y][0], name) for y in BACKTEST_YEARS]
    report.to_csv(OUT / "backtest.csv", index=False)

    pd.set_option("display.width", 220)
    print(summary.round(3).to_string())
    print(f"\nmain model: {main_model}\n")
    cols = ["year", "rmse", "state_holdout_rmse", "local_sd", "national_true", "national_blind", "national_sd", "oracle_accuracy",
            "oracle_dem_seats_pred", "oracle_dem_seats_actual", "brier_blind", "sim_median", "sim_p10", "sim_p90", "sim_dem_majority",
            "brier_538", "seats_538_median", "majority_538"]
    print(report.loc[report["model"] == main_model, cols].round(3).to_string(index=False))

    result = forecast_2026(data, national, folds, main_model, summary)
    house = {k: v for k, v in result["house"].items() if k != "distribution"}
    print(json.dumps({k: result[k] for k in ("national", "localSd", "house2024Lines", "redrawEffect")} | {"house": house}, indent=1))


if __name__ == "__main__":
    main()

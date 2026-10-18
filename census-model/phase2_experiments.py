"""
Phase 2 experiments: which structural variant fixes the 2018 miss without breaking other years?
Every variant is scored on the same rolling-origin folds with the real national level ("oracle"),
so differences come from the district layer alone.

Usage: census-model/.venv/bin/python census-model/phase2_experiments.py
"""
import numpy as np
import pandas as pd

import train_backtest as tb
from structural import TwoStage

VARIANTS = {
    "xgboost (phase 1)": None,
    "ridge + trees": dict(drift=False, midterm=None),
    "drift": dict(drift=True, midterm=None),
    "midterm unsigned": dict(drift=False, midterm="unsigned"),
    "midterm signed": dict(drift=False, midterm="signed"),
    "drift + midterm unsigned": dict(drift=True, midterm="unsigned"),
    "drift + midterm signed": dict(drift=True, midterm="signed"),
    "drift + midterm unsigned, linear only": dict(drift=True, midterm="unsigned", trees=False),
}


def main():
    data = tb.load()
    national = tb.national_history()
    rows = []
    for year in [2016, 2018, 2020, 2022, 2024]:
        train = data[(data["year"] < year) & (data["contested"] == 1)]
        test = data[data["year"] == year]
        weights = 0.5 ** ((year - train["year"]) / tb.HALF_LIFE)
        level = national[year]
        for name, config in VARIANTS.items():
            if config is None:
                structural = tb.fit_predict(train, test)[0]["xgboost"]
            else:
                structural = TwoStage(tb.FEATURES, **config).fit(train, train["relative"], weights).predict(test)
            contested = (test["contested"] == 1).to_numpy()
            residual = test["relative"].to_numpy()[contested] - structural[contested]
            seats = tb.seat_metrics(structural + level, test)
            rows.append({"year": year, "variant": name, "rmse": np.sqrt(np.mean(residual ** 2)),
                         "accuracy": seats["accuracy"], "dem_pred": seats["dem_seats_pred"], "dem_actual": seats["dem_seats_actual"]})
    report = pd.DataFrame(rows)
    report.to_csv(tb.OUT / "phase2-experiments.csv", index=False)
    pd.set_option("display.width", 200)
    for metric in ["rmse", "accuracy", "dem_pred"]:
        table = report.pivot(index="variant", columns="year", values=metric).reindex(VARIANTS)
        if metric == "dem_pred":
            table.loc["actual"] = report.groupby("year")["dem_actual"].first()
        print(f"\n{metric}"); print(table.round(3).to_string())


if __name__ == "__main__":
    main()

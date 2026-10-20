"""
Census-26 for the Senate: state margins built from the House model's district predictions.

A state's census margin is the weighted mean of the census-only margins of its districts (the
House model, unchanged: national House popular vote + structural term from the ACS profile).
Single-district states (AK, DE, ND, SD, VT, WY) are their district.

Weights: districts have about the same population but not the same turnout, and a Senate race is
decided by the votes cast. Each district is weighted by the total presidential vote it cast in
the last presidential election on the same lines (known before the election, carries no party
information). Equal weights are kept as the alternative; the backtest picks between them.

Backtest: every Senate race 2016–2024 with both parties on the ballot (specials included, runoffs
where they decided the seat), except contests where the Democrat and the Republican together got
under 85% of the vote: there an independent, a third party or a split jungle-primary field was the
real alternative (Maine's King, Alaska 2016, Louisiana 2020/2022…) and D − R does not measure the
race. Each year is predicted only from earlier cycles: the House model is
refit on earlier House results, the national level is the blind historical one, and the local
(state) error is the RMSE of earlier Senate races scored with the real national vote, pooled
from 2014 on. 2026 uses every cycle 2014–2024.

Output: adds "senate", "senateChamber" and "senateBacktest" to src/data/census-model.json without
touching its other keys; full tables in output/senate-*.csv.

Usage: census-model/.venv/bin/python census-model/senate.py
"""
import json
from math import erf, sqrt
from pathlib import Path

import numpy as np
import pandas as pd

import train_backtest as tb
from build_dataset import STATE_DIVISION, features, load_acs
from pres_by_cd import PAIRS, sheet

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
WEB = PROJECT / "src" / "data" / "census-model.json"
YEARS = [2014, 2016, 2018, 2020, 2022, 2024]  # 2014 only feeds the error of later years
BACKTEST = [2016, 2018, 2020, 2022, 2024]
NOT_UP = {"D": 34, "R": 31}  # seats not on the ballot in 2026 (src/lib/senate-sim.ts, seatsNotUp)
MAJORITY = 51  # a 50–50 Senate is Republican through the Vice President
RUNS = 20000
TWO_PARTY_FLOOR = 85  # % of the vote D + R must reach for a race to count
SEED = 2026


def phi(x):
    return 0.5 * (1 + np.vectorize(erf)(np.asarray(x, dtype=float) / sqrt(2)))


def districts(year, data):
    """Every district of the year with census features (all states, so NC 2020 is included too)."""
    if year == 2026:
        return tb.frame_2026(data)
    frame = features(load_acs(year))
    frame.insert(0, "code", frame.index)
    frame.insert(1, "year", year)
    frame.insert(2, "state", frame["code"].str[:2])
    frame.insert(3, "division", frame["state"].map(STATE_DIVISION))
    return frame.reset_index(drop=True)


def turnout(year):
    """Total presidential vote by district in the last presidential election on the year's lines."""
    house_year, lines, _, column, _ = next(pair for pair in PAIRS if pair[0] == year and (year != 2026 or pair[1] == "120"))
    rows = sheet(lines)
    body = rows[rows[0].str.match(r"^[A-Z]{2}-(AL|\d\d)$")]
    total = pd.to_numeric(body[column + 2].str.replace(",", ""), errors="coerce")
    return dict(zip(body[0].str.replace("-AL", "-00"), total))


def state_margins(year, data):
    """Census structural margin by state, equal-weighted and vote-weighted, from a model trained on earlier cycles."""
    train = data[(data["contested"] == 1) & (data["year"] < year)]
    frame = districts(year, data)
    frame["structural"] = tb.fit_predict(train, frame)[0][tb_main()]
    votes = turnout(year)
    frame["votes"] = frame["code"].map(votes)
    rows = []
    for state, group in frame.groupby("state"):
        weights = group["votes"]
        # A state with a gap in the vote totals (FL 2012 on the 2016 lines) falls back to equal weights.
        weighted = np.average(group["structural"], weights=weights) if weights.notna().all() and weights.sum() > 0 else group["structural"].mean()
        rows.append({"year": year, "state": state, "districts": len(group), "equal": group["structural"].mean(), "votes": weighted,
                     "voteWeights": bool(weights.notna().all())})
    return pd.DataFrame(rows)


def tb_main():
    """The House model's chosen learner (blend), read from its 2026 output so both chambers use the same one."""
    return json.loads((ROOT / "output" / "house-2026.json").read_text())["mainModel"]


def senate_results():
    """Two-party Senate margins, 2014–2024, contests where D and R together took at least 85% of the vote."""
    history = json.loads((PROJECT / "public/data/history/senate.json").read_text())["states"]
    rows = []
    for state, results in history.items():
        for result in results:
            if result["y"] in YEARS and result["dp"] > 0 and result["rp"] > 0 and result["dp"] + result["rp"] >= TWO_PARTY_FLOOR:
                rows.append({"year": result["y"], "state": state, "special": bool(result.get("s")),
                             "actual": 100 * (result["dp"] - result["rp"]) / (result["dp"] + result["rp"]), "winner": result["w"]})
    return pd.DataFrame(rows)


def backtest(margins, results, national, weighting):
    scored = results.merge(margins[["year", "state", weighting]].rename(columns={weighting: "structural"}), on=["year", "state"])
    scored["oracle"] = scored["structural"] + scored["year"].map(national)
    scored["residual"] = scored["actual"] - scored["oracle"]
    rows = []
    for year in BACKTEST:
        earlier = scored[scored["year"] < year]
        sd_local = float(np.sqrt(np.mean(earlier["residual"] ** 2)))
        mu, sd_nat = tb.blind_national(national, year)
        races = scored[scored["year"] == year].copy()
        races["blind"] = races["structural"] + mu
        races["pD"] = phi(races["blind"] / np.sqrt(sd_local ** 2 + sd_nat ** 2))
        decided = races[races["winner"].isin(["D", "R"])]
        won_d = (decided["winner"] == "D").astype(float)
        rows.append({
            "year": year, "races": int(len(decided)), "localSd": round(sd_local, 2), "nationalSd": round(float(sd_nat), 2),
            "brier": round(float(np.mean((decided["pD"] - won_d) ** 2)), 4),
            "accuracy": round(float(((decided["blind"] > 0) == (won_d == 1)).mean()), 3),
            "accuracyRealVote": round(float(((decided["oracle"] > 0) == (won_d == 1)).mean()), 3),
            "meanAbsError": round(float(np.mean(np.abs(decided["actual"] - decided["blind"]))), 1),
            "meanAbsErrorRealVote": round(float(np.mean(np.abs(decided["actual"] - decided["oracle"]))), 1),
            "meanError": round(float(np.mean(decided["actual"] - decided["oracle"])), 1),
            "demWinsExpected": round(float(decided["pD"].sum()), 1), "demWins": int(won_d.sum()),
        })
    return pd.DataFrame(rows), scored


def mp26_senate_brier():
    years = json.loads((PROJECT / "src/data/backtest.json").read_text())["years"]
    return {int(year): body.get("senate", {}).get("brier") for year, body in years.items()}


def main():
    data = tb.load("census")
    national = tb.national_history()
    results = senate_results()
    margins = pd.concat([state_margins(year, data) for year in YEARS + [2026]], ignore_index=True)
    margins.to_csv(ROOT / "output" / "senate-state-margins.csv", index=False)

    reports = {weighting: backtest(margins, results, national, weighting) for weighting in ("votes", "equal")}
    for weighting, (report, _) in reports.items():
        report.insert(0, "weighting", weighting)
    summary = {weighting: report["brier"].mean() for weighting, (report, _) in reports.items()}
    weighting = min(summary, key=summary.get)
    report, scored = reports[weighting]
    pd.concat([r for r, _ in reports.values()]).to_csv(ROOT / "output" / "senate-backtest.csv", index=False)
    scored.to_csv(ROOT / "output" / "senate-races-scored.csv", index=False)

    # 2026: every earlier Senate race calibrates the state error; national level and spread as for the House.
    sd_local = float(np.sqrt(np.mean(scored["residual"] ** 2)))
    mu, sd_nat = tb.blind_national(national, 2026)
    races_2026 = sorted(json.loads((PROJECT / "src/data/forecast-snapshot.json").read_text())["senateRaces"], key=lambda race: race["code"])
    states = [race["code"] for race in races_2026]
    current = margins[margins["year"] == 2026].set_index("state").loc[states, weighting].to_numpy()
    margin = current + mu
    p_d = phi(margin / np.sqrt(sd_local ** 2 + sd_nat ** 2))
    rng = np.random.default_rng(SEED)
    draws = rng.normal(mu, sd_nat, size=(RUNS, 1)) + current[None, :] + rng.normal(0, sd_local, size=(RUNS, len(states)))
    seats = NOT_UP["D"] + (draws > 0).sum(axis=1)

    mp26 = mp26_senate_brier()
    senate = [{"state": state, "margin": round(float(m), 1), "pD": round(float(p), 3),
               **({"special": True} if race.get("special") else {})} for state, m, p, race in zip(states, margin, p_d, races_2026)]
    chamber = {"median": int(np.median(seats)), "p10": int(np.percentile(seats, 10)), "p90": int(np.percentile(seats, 90)),
               "pMajority": round(float((seats >= MAJORITY).mean()), 3), "expected": round(float(NOT_UP["D"] + p_d.sum()), 1),
               "notUp": NOT_UP, "localSd": round(sd_local, 2), "nationalSd": round(float(sd_nat), 2), "national": round(float(mu), 2),
               "weighting": weighting, "houseLocalSd": json.loads((ROOT / "output" / "house-2026.json").read_text())["localSd"]["unchangedLines"],
               "distribution": [[int(k), round(v / RUNS, 4)] for k, v in enumerate(np.bincount(seats)) if v]}
    backtest_rows = [{**row, "brierMp26": mp26.get(row["year"])} for row in report.drop(columns="weighting").to_dict(orient="records")]

    payload = json.loads(WEB.read_text())
    payload.update({"senate": senate, "senateChamber": chamber, "senateBacktest": backtest_rows})
    WEB.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False))

    pd.set_option("display.width", 200)
    for name, (r, _) in reports.items():
        print(f"\n{name} weights — mean Brier {summary[name]:.4f}")
        print(r.drop(columns="weighting").to_string(index=False))
    print(f"\nchosen: {weighting}; 2026 state error {sd_local:.2f} (House districts {chamber['houseLocalSd']}), national {mu:+.2f} ± {sd_nat:.2f}")
    print({k: v for k, v in chamber.items() if k != "distribution"})
    print(sorted(((s["state"], s["margin"], s["pD"]) for s in senate), key=lambda item: item[1]))


if __name__ == "__main__":
    main()

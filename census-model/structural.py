"""
Two-stage structural model: a linear layer that can extrapolate, then trees on what it leaves.

Stage 1, Ridge on standardised census features plus optional interactions:
  - drift:   feature × t, with t = (year − 2018) / 4. Lets each effect (education, density…) keep
             moving in the direction it moved in the training cycles; trees alone cannot do this.
  - midterm: feature × midterm. "unsigned" assumes the same midterm electorate effect whoever is
             president (turnout composition); "signed" flips it with the president's party.
Stage 2, XGBoost on the Ridge residuals, without time: district memory and non-linear shape.
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import RidgeCV
from xgboost import XGBRegressor

PRESIDENT = {2012: "D", 2014: "D", 2016: "D", 2018: "R", 2020: "R", 2022: "D", 2024: "D", 2026: "R"}


class TwoStage:
    def __init__(self, features, drift=True, midterm="unsigned", trees=True, seed=2026):
        self.features, self.drift, self.midterm, self.trees, self.seed = features, drift, midterm, trees, seed

    def _base(self, frame):
        x = pd.get_dummies(frame[self.features + ["division"]], columns=["division"], dtype=float)
        return x.reindex(columns=self.columns, fill_value=0.0) if hasattr(self, "columns") else x

    def _linear(self, frame):
        z = (frame[self.features] - self.mean) / self.std
        blocks = [z, self._base(frame).drop(columns=self.features)]
        if self.drift:
            t = (frame["year"] - 2018) / 4
            blocks.append(z.mul(t, axis=0).add_suffix("×t"))
        if self.midterm:
            midterm = (frame["year"] % 4 == 2).astype(float)
            if self.midterm == "signed":
                midterm = midterm * frame["year"].map(PRESIDENT).map({"R": 1.0, "D": -1.0})
            blocks.append(z.mul(midterm, axis=0).add_suffix("×midterm"))
        return pd.concat(blocks, axis=1).to_numpy()

    def fit(self, frame, y, sample_weight=None):
        self.mean, self.std = frame[self.features].mean(), frame[self.features].std()
        self.columns = self._base(frame).columns
        self.ridge = RidgeCV(alphas=np.logspace(-1, 4, 30)).fit(self._linear(frame), y, sample_weight=sample_weight)
        if self.trees:
            residual = y - self.ridge.predict(self._linear(frame))
            self.xgb = XGBRegressor(n_estimators=500, learning_rate=0.03, max_depth=4, subsample=0.8, colsample_bytree=0.7,
                                    min_child_weight=3, random_state=self.seed, n_jobs=4)
            self.xgb.fit(self._base(frame), residual, sample_weight=sample_weight)
        return self

    def predict(self, frame):
        linear = self.ridge.predict(self._linear(frame))
        return linear + self.xgb.predict(self._base(frame)) if self.trees else linear

    def coefficients(self, frame):
        names = list(self.features) + [c for c in self.columns if c not in self.features]
        if self.drift:
            names += [f"{f}×t" for f in self.features]
        if self.midterm:
            names += [f"{f}×midterm" for f in self.features]
        return pd.Series(self.ridge.coef_, index=names)

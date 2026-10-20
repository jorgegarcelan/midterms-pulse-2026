"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { useInView } from "@/components/explainer/use-in-view";
import { prefersReducedMotion, seeded } from "@/components/motion/motion-utils";
import { DistrictBoard } from "@/components/gerrymander/district-board";
import { useEnsemble } from "@/components/gerrymander/use-ensemble";

const RUN_MS = 5200;
const SEAT_VALUES = [0, 1, 2, 3, 4, 5];

/*
  Every legal map, flashed past in a shuffled order while the histogram of Blue seats fills in. The bars
  are the "normal" range; a real map that sits out in a thin tail is the red flag courts look for.
*/
export function EnsembleHistogram({ userSeats }: { userSeats: number | null }) {
  const t = useT();
  const intl = useIntlLocale();
  const ensemble = useEnsemble();
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: "0px 0px -25% 0px" });
  const [shown, setShown] = useState(0);
  const [run, setRun] = useState(0);
  const frame = useRef(0);

  const order = useMemo(() => {
    if (!ensemble) return [];
    const random = seeded(2026);
    const index = ensemble.maps.map((_, i) => i);
    for (let i = index.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [index[i], index[j]] = [index[j], index[i]]; }
    return index;
  }, [ensemble]);

  useEffect(() => {
    if (!inView || !ensemble) return;
    const total = ensemble.maps.length;
    if (prefersReducedMotion()) { frame.current = requestAnimationFrame(() => setShown(total)); return () => cancelAnimationFrame(frame.current); }
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / RUN_MS);
      // Slow at first so single maps are readable, then a rush to the end.
      setShown(Math.max(1, Math.round(total * p ** 2.4)));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [inView, ensemble, run]);

  const counts = useMemo(() => {
    const out = [0, 0, 0, 0, 0, 0];
    if (!ensemble) return out;
    for (let i = 0; i < shown; i++) out[ensemble.seats[order[i]]]++;
    return out;
  }, [ensemble, order, shown]);

  if (!ensemble) return <div className="gm-ensemble viz-empty" ref={ref}>{t("Listing every possible map…")}</div>;

  const total = ensemble.maps.length;
  const max = Math.max(...ensemble.counts);
  const current = shown > 0 ? Array.from(ensemble.maps[order[shown - 1]]) : null;
  const done = shown >= total;
  const share = (value: number) => (value / total * 100).toLocaleString(intl, { maximumFractionDigits: value / total < .01 ? 2 : 0 });
  const redMajority = ensemble.counts[0] + ensemble.counts[1] + ensemble.counts[2];

  return (
    <div className="gm-ensemble" ref={ref} data-done={done ? "" : undefined}>
      <div className="gm-ensemble-runner">
        {current && <DistrictBoard assign={current} className="gm-fast" ariaLabel={t("Map {n} of {total}", { n: shown, total })} />}
        <p className="gm-counter"><b>{shown.toLocaleString(intl)}</b> / {total.toLocaleString(intl)} <span>{t("maps drawn")}</span></p>
        <button type="button" className="viz-button" onClick={() => { setShown(0); setRun((value) => value + 1); }} disabled={!done}>{t("Run again")}</button>
      </div>

      <div className="gm-hist">
        <div className="gm-hist-bars">
          {SEAT_VALUES.map((seats) => {
            const height = counts[seats] / max;
            return (
              <div key={seats} className={`gm-hist-col ${seats >= 3 ? "blue" : "red"}${userSeats === seats ? " mine" : ""}`}>
                <span className="gm-hist-n">{counts[seats].toLocaleString(intl)}</span>
                <div className="gm-hist-track"><i style={{ transform: `scaleY(${Math.max(height, counts[seats] ? .012 : 0)})` }} /></div>
                {userSeats === seats && <em className="gm-hist-you">{t("your map")}</em>}
                <b>{seats}–{5 - seats}</b>
              </div>
            );
          })}
        </div>
        <p className="gm-hist-axis">{t("Result, Blue–Red seats")}</p>
        <div className="gm-hist-notes" data-on={done ? "" : undefined}>
          <p><b className="red">{share(redMajority)}%</b> {t("of all maps hand Red the majority ({count} maps). Every one of them needs packing and cracking.", { count: redMajority.toLocaleString(intl) })}</p>
          <p><b className="blue">{ensemble.counts[5]}</b> {t("maps out of {total} give Blue all five seats. A map like that is an extreme outlier.", { total: total.toLocaleString(intl) })}</p>
          <p><b>{share(ensemble.counts[3])}%</b> {t("land on 3–2, the result closest to the vote. That is the middle of the pack, where an innocent map usually falls.")}</p>
        </div>
      </div>
    </div>
  );
}

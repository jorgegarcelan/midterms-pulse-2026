"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { easeOutQuart, prefersReducedMotion } from "@/components/motion/motion-utils";
import { signedLabel, useInView } from "@/components/explainer/use-in-view";
import { DISTRICT_HUES } from "@/components/gerrymander/district-board";
import type { CityCase } from "@/lib/gerrymander-geo";

const COPY: Record<string, { tab: string; tag: string; title: string; body: string }> = {
  nashville: {
    tab: "Nashville", tag: "Cracking · Republicans, 2022", title: "Nashville: one city, three slices",
    body: "For decades Nashville elected a Democrat in TN-5. In 2022 the Republican legislature cut Davidson County into three wedges, each running from the city out into rural counties like a slice of pizza. In every slice the city's Democrats are outnumbered by the countryside, so a county that votes Democratic by {margin} points now sends three Republicans to Congress.",
  },
  "salt-lake": {
    tab: "Salt Lake City", tag: "Cracking · Republicans, 2021", title: "Salt Lake City: split four ways",
    body: "Salt Lake County, Utah's Democratic core, was divided among all four districts, each pairing a piece of the city with a large Republican rural area. UT-4, which a Democrat won in 2018, became safely Republican. In 2025 a state judge threw the map out for ignoring the anti-gerrymandering rules voters approved in 2018, and Utah votes in 2026 with a new map that includes a Democratic-leaning Salt Lake seat.",
  },
  austin: {
    tab: "Austin", tag: "Packing · Republicans, 2021", title: "Austin: give up one seat, save the rest",
    body: "In the 2010s Austin was cracked across five districts. As its suburbs turned blue those slices started to wobble: Republicans held TX-21 by under 3 points in 2018. So in 2021 they switched technique and packed Austin's Democrats into TX-37, a seat Democrats win by 50 points, and TX-35. Conceding those two made every neighbour safe.",
  },
  illinois: {
    tab: "Central Illinois", tag: "Linking · Democrats, 2021", title: "Illinois 13th: connect the dots",
    body: "Illinois Democrats did it the other way round. IL-13 threads through farmland to join Democratic neighbourhoods in Champaign–Urbana, Decatur, Springfield and the Metro East suburbs of St. Louis. Each city on its own is outvoted by the countryside around it; joined together they make a Democratic seat. A Republican held the old 13th; a Democrat has won the new one since 2022.",
  },
};

const marginClass = (m: number) => (m >= 0 ? "blue" : "red");

// Real cities cut into real districts: pick a case and the slices fly out from the city they split.
export function CitySlicer({ cases }: { cases: CityCase[] }) {
  const t = useT();
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: "0px 0px -20% 0px" });
  const [key, setKey] = useState(cases[0]?.key);
  const [hover, setHover] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);
  const item = cases.find((entry) => entry.key === key) ?? cases[0];

  // Glide the viewBox between the whole frame and the county close-up.
  useEffect(() => {
    const target = zoomed ? 1 : 0;
    const from = progress;
    if (from === target) return;
    if (prefersReducedMotion()) { frame.current = requestAnimationFrame(() => setProgress(target)); return () => cancelAnimationFrame(frame.current); }
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / 900);
      setProgress(from + (target - from) * easeOutQuart(p));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from wherever the glide currently is
  }, [zoomed]);

  if (!item) return null;
  const copy = COPY[item.key];
  const full = [0, 0, item.width, item.height];
  const box = item.zoom ? full.map((value, i) => value + (item.zoom![i] - value) * progress) : full;
  // Labels and dots keep their on-screen size while the map zooms.
  const unscale = box[2] / item.width;
  const pick = (next: string) => { setKey(next); setHover(null); setZoomed(false); setProgress(0); };

  return (
    <div className="gm-cities" ref={ref} data-in={inView ? "" : undefined}>
      <div className="gm-goals" role="tablist" aria-label={t("City")}>
        {cases.map((entry) => (
          <button key={entry.key} type="button" role="tab" aria-selected={entry.key === item.key} className={entry.key === item.key ? "on" : ""} onClick={() => pick(entry.key)}>
            {t(COPY[entry.key].tab)}
          </button>
        ))}
      </div>

      <div className="gm-cities-body">
        <div className="gm-city-frame">
        <svg key={item.key} viewBox={box.map((value) => value.toFixed(2)).join(" ")} className="gm-city-map" data-zoomed={progress > .5 ? "" : undefined} role="img" aria-label={t(copy.title)} style={{ "--ox": `${item.origin[0]}px`, "--oy": `${item.origin[1]}px` } as React.CSSProperties}>
          <g className="gm-city-others">{item.others.map((d, i) => <path key={i} d={d} />)}</g>
          <g className="gm-city-focus">
            {item.focus.map((district, i) => (
              <path
                key={district.code}
                d={district.d}
                className={hover && hover !== district.code ? "dim" : ""}
                style={{ "--hue": DISTRICT_HUES[i], "--i": i } as React.CSSProperties}
                onPointerEnter={() => setHover(district.code)}
                onPointerLeave={() => setHover(null)}
              />
            ))}
          </g>
          <g className="gm-city-county">{item.counties.map((d, i) => <path key={i} d={d} style={{ "--i": i } as React.CSSProperties} />)}</g>
          <g className="gm-city-labels">
            {item.focus.map((district, i) => (
              <g key={district.code} transform={`translate(${district.label[0].toFixed(1)} ${district.label[1].toFixed(1)}) scale(${unscale.toFixed(4)})`} style={{ "--i": i } as React.CSSProperties}>
                <rect x={-21} y={-11} width={42} height={22} rx={7} style={{ stroke: DISTRICT_HUES[i] }} />
                <text y={4.5}>{district.code.split("-")[1].replace(/^0/, "")}</text>
              </g>
            ))}
            {item.cities.map((city) => (
              <g key={city.name} className="gm-city-dot" transform={`translate(${city.x.toFixed(1)} ${city.y.toFixed(1)}) scale(${unscale.toFixed(4)})`}>
                <circle r={4.5} />
                <circle className="ping" r={4.5} />
                <text x={8} y={-7}>{city.name}</text>
              </g>
            ))}
          </g>
        </svg>
        {item.zoom && (
          <button type="button" className="gm-zoom viz-button" aria-pressed={zoomed} onClick={() => setZoomed((value) => !value)}>
            {zoomed ? t("Show the whole map") : t("Zoom into the city")}
          </button>
        )}
        </div>

        <div className="gm-city-copy" key={`copy-${item.key}`}>
          <p className="eyebrow">{t(copy.tag)}</p>
          <h3>{t(copy.title)}</h3>
          <p>{t(copy.body, { margin: Math.round(item.countyMargin ?? 0) })}</p>
          {item.county && item.countyMargin !== null && (
            <p className="gm-city-county-stat">
              <i />{t("{county} County", { county: item.county })}: <b className={marginClass(item.countyMargin)}>{signedLabel(item.countyMargin, 0)}</b> {t("for president in 2024")}
            </p>
          )}
          <table className="gm-city-table">
            <thead><tr><th>{t("District")}</th><th>{t("Old map")}</th><th /><th>{t("New map")}</th></tr></thead>
            <tbody>
              {item.focus.map((district, i) => (
                <tr key={district.code} className={hover === district.code ? "on" : ""} onPointerEnter={() => setHover(district.code)} onPointerLeave={() => setHover(null)} style={{ "--i": i } as React.CSSProperties}>
                  <td><i style={{ background: DISTRICT_HUES[i] }} />{district.code}</td>
                  <td>{district.before ? <><b className={marginClass(district.before.m)}>{signedLabel(district.before.m, 0)}</b> <small>{district.before.y}</small></> : <small>{t("new seat")}</small>}</td>
                  <td aria-hidden="true">→</td>
                  <td><b className={marginClass(district.after.m)}>{signedLabel(district.after.m, 0)}</b> <small>{district.after.y}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="gm-city-foot">{t("House results by district. Lines shown are the maps used in 2022 and 2024.")}</p>
        </div>
      </div>
      <p className="viz-note">{t("The same recipe keeps coming back: Tennessee's 2026 map splits Memphis three ways, and Missouri's 2025 map stretched Kansas City's district out into rural Missouri before a referendum petition put it on hold. Missouri votes on its 2022 lines this year.")}</p>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/i18n/link";
import { useRouter } from "next/navigation";
import { useLocale, useLocalePath, useT } from "@/components/i18n/locale-provider";
import { CountUp } from "@/components/motion/count-up";
import { Magnetic } from "@/components/motion/magnetic";
import { OdometerCountdown } from "@/components/motion/odometer-countdown";
import { ScrambleText } from "@/components/motion/scramble-text";
import { PulseEngine } from "@/components/pulse/pulse-engine";
import { ratingStrength, type ChamberOverview, type RaceOverview } from "@/lib/overview-shared";

type PulseStoryProps = { races: RaceOverview[]; house: ChamberOverview | null; senate: ChamberOverview | null };

const CHAPTER_TARGETS = [0, 1];
// The engine draws three phases (map, chamber, margin ladder); the home story stops at the chamber.
const ENGINE_SPAN = .5;
// The engine colours and orders seats by a margin; ratings are fed on that scale (Safe ≈ 21 points).
const RATING_TO_MARGIN = 7;
const lean = (margin: number) => `${margin >= 0 ? "D" : "R"}+${Math.abs(margin).toFixed(1)}`;
const pct = (p: number) => `${Math.round((p >= .5 ? p : 1 - p) * 100)}% ${p >= .5 ? "D" : "R"}`;

/*
  Two-chapter scroll story on one sticky canvas: the map, then the chamber. Seats are coloured and
  ordered by the expert raters' consensus (Cook, Inside Elections, Sabato), with the 2024 result only
  ordering seats inside the same rating. No model numbers: the hero bar shows markets and the polls.
*/
export function PulseStory({ races, house, senate }: PulseStoryProps) {
  const router = useRouter();
  const localize = useLocalePath();
  const locale = useLocale();
  const t = useT();
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PulseEngine | null>(null);
  const [chapter, setChapter] = useState(1);
  const [hovered, setHovered] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  const houseRaces = useMemo(() => races.filter((race) => race.chamber === "house"), [races]);
  const byCode = useMemo(() => new Map(houseRaces.map((race) => [race.code, race])), [houseRaces]);
  const complete = houseRaces.length >= 400;

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    if (!canvas || !section || !sticky) return;
    const engine = new PulseEngine(canvas);
    engine.locale = locale;
    engineRef.current = engine;
    engine.onHover = (hover) => {
      setHovered((current) => current === (hover?.code ?? null) ? current : hover?.code ?? null);
      if (hover && tooltipRef.current) tooltipRef.current.style.transform = `translate(${Math.round(hover.x)}px, ${Math.round(hover.y)}px)`;
    };
    const frame = requestAnimationFrame(() => setEngineReady(true));

    let scrollFrame = 0;
    let lastChapter = 0;
    const measure = () => {
      // The sticky stage sits under whatever header chrome is sticky at this width.
      const topbar = document.querySelector<HTMLElement>(".topbar");
      const context = document.querySelector<HTMLElement>(".context-bar");
      const contextSticky = context && getComputedStyle(context).position === "sticky";
      const chrome = (topbar?.offsetHeight || 0) + (contextSticky ? context!.offsetHeight : 0);
      section.style.setProperty("--chrome", `${chrome}px`);
      engine.resize();
      const hero = sticky.querySelector<HTMLElement>(".pulse-hero");
      const hud = sticky.querySelector<HTMLElement>(".pulse-hud");
      const top = hero ? hero.offsetTop + hero.offsetHeight + 16 : 230;
      const bottom = hud ? sticky.clientHeight - hud.offsetTop + 14 : 96;
      engine.setMapInsets(top, bottom);
      sticky.style.setProperty("--core-y", `${Math.round(top + (sticky.clientHeight - top - bottom) / 2)}px`);
    };
    const update = () => {
      scrollFrame = 0;
      const rect = section.getBoundingClientRect();
      const top = parseFloat(getComputedStyle(sticky).top) || 0;
      const total = section.offsetHeight - sticky.offsetHeight;
      const progress = total > 0 ? Math.max(0, Math.min(1, (top - rect.top) / total)) : 0;
      sticky.style.setProperty("--p", progress.toFixed(4));
      engine.setProgress(progress * ENGINE_SPAN);
      const next = progress < .45 ? 1 : 2;
      if (next !== lastChapter) { lastChapter = next; setChapter(next); }
    };
    const onScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(update); };
    const resizeObserver = new ResizeObserver(() => { measure(); update(); });
    resizeObserver.observe(sticky);
    const visibility = new IntersectionObserver(([entry]) => engine.setVisible(entry.isIntersecting));
    visibility.observe(section);
    measure();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
      visibility.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
    // The engine is built once; locale changes are pushed by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (engineRef.current) engineRef.current.locale = locale; }, [locale]);

  useEffect(() => {
    if (!complete) return;
    engineRef.current?.setMargins(new Map(houseRaces.map((race) => [race.code, ratingStrength(race) * RATING_TO_MARGIN])));
  }, [complete, houseRaces]);

  function pointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    engineRef.current?.setPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  function openHovered() {
    const code = engineRef.current?.hoveredCode();
    if (code) router.push(localize(`/races/${code.toLowerCase()}`));
  }

  function goTo(index: number) {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    if (!section || !sticky) return;
    const top = parseFloat(getComputedStyle(sticky).top) || 0;
    const start = section.getBoundingClientRect().top + window.scrollY - top;
    window.scrollTo({ top: start + CHAPTER_TARGETS[index] * (section.offsetHeight - sticky.offsetHeight) + 2, behavior: "smooth" });
  }

  const hoveredRace = hovered ? byCode.get(hovered) : undefined;
  const rotator = [t("Congress"), t("the House"), t("the Senate")];
  const rotatorSizer = rotator.reduce((longest, word) => word.length > longest.length ? word : longest);

  return (
    <>
      <section className="pulse-story" ref={sectionRef} data-motion data-chapter={chapter} data-engine={engineReady ? "on" : "off"} aria-label={t("The 2026 House, district by district")}>
        <div className="pulse-sticky" ref={stickyRef}>
          <span className="pulse-core" aria-hidden="true" />
          <canvas
            className="pulse-canvas"
            ref={canvasRef}
            aria-hidden="true"
            onPointerMove={pointer}
            onPointerLeave={() => engineRef.current?.setPointer(null)}
            onClick={openHovered}
            data-hovering={hovered ? "true" : undefined}
          />

          <div className="pulse-hero">
            <p className="eyebrow"><ScrambleText text={`${t("2026 U.S. MIDTERMS")} · ${t("POLLS, MARKETS AND RATINGS")}`} delay={250} /></p>
            <h1 className="kinetic" aria-label={t("The fight for Congress")}>
              {t("The fight for").split(" ").map((word, index) => <span className="w" aria-hidden="true" key={word}><span style={{ "--i": index } as React.CSSProperties}>{word}</span></span>)}
              <span className="w" aria-hidden="true"><span style={{ "--i": 3 } as React.CSSProperties}>
                <span className="rotator"><span className="rotator-sizer">{rotatorSizer}</span><span className="rotator-window"><span className="rotator-track"><span>{rotator[0]}</span><span>{rotator[1]}</span><span>{rotator[2]}</span><span>{rotator[0]}</span></span></span></span>
              </span></span>
            </h1>
            <p className="hero-deck">{t("Every dot is a slice of one of the 435 House districts, coloured by the expert ratings of Cook, Inside Elections and Sabato. Hover the map, then scroll.")}</p>
            <div className="hero-actions">
              <Magnetic><Link className="primary-action" href="/races?view=map" transitionTypes={["nav-forward"]}>{t("Explore 435 districts")}</Link></Magnetic>
              <Magnetic><Link className="secondary-action" href="/key-races" transitionTypes={["nav-forward"]}>{t("Key races")} <span>→</span></Link></Magnetic>
            </div>
          </div>

          <div className="pulse-hud">
            <div><span>{t("House · markets")}</span><strong className={house?.market ? house.market.p >= .5 ? "dem-text" : "rep-text" : ""}>{house?.market ? pct(house.market.p) : "—"}</strong></div>
            <div><span>{t("Senate · markets")}</span><strong className={senate?.market ? senate.market.p >= .5 ? "dem-text" : "rep-text" : ""}>{senate?.market ? pct(senate.market.p) : "—"}</strong></div>
            <div><span>{t("Generic ballot · polls")}</span>{house?.polls ? <strong className={house.polls.margin >= 0 ? "dem-text" : "rep-text"}>{house.polls.margin >= 0 ? "D" : "R"}+<CountUp value={Math.abs(house.polls.margin)} decimals={1} delay={1100} /></strong> : <strong>—</strong>}</div>
            <OdometerCountdown />
          </div>

          <article className="pulse-chapter pulse-chapter-2" aria-hidden={chapter !== 2}>
            <p className="eyebrow">{t("02 · The chamber")}</p>
            <h2>{t("435 seats. One majority.")}</h2>
            <p>{t("Each district collapses into its seat, ordered from the safest Democratic seat on the left to the safest Republican seat on the right.")}</p>
            <div className="pulse-tally">
              <div><strong className="dem-text">{house ? house.ratings.D : "—"}</strong><span>{t("favour D")}</span></div>
              <div><strong>{house ? house.ratings.toss : "—"}</strong><span>{t("toss-up")}</span></div>
              <div><strong className="rep-text">{house ? house.ratings.R : "—"}</strong><span>{t("favour R")}</span></div>
            </div>
            <small>{t("Seats by the consensus of Cook, Inside Elections and Sabato. 218 wins the House: the toss-ups decide it.")}</small>
          </article>

          <nav className="pulse-steps" aria-label={t("Story chapters")}>
            {["The map", "The chamber"].map((label, index) => (
              <button key={label} type="button" className={chapter === index + 1 ? "active" : ""} onClick={() => goTo(index)}><i />{t(label)}</button>
            ))}
          </nav>

          <div className="pulse-tooltip" ref={tooltipRef} data-visible={hoveredRace ? "true" : undefined} aria-hidden="true">
            {hoveredRace && <>
              <strong>{hoveredRace.code}</strong>
              <b className={(hoveredRace.rating?.score ?? 0) > 0 ? "dem-text" : (hoveredRace.rating?.score ?? 0) < 0 ? "rep-text" : "toss-text"}>{t(hoveredRace.rating?.label || "Unrated")}</b>
              <span>{hoveredRace.polls ? t("Polls {lean}", { lean: lean(hoveredRace.polls.margin) }) : t("No district polls")}{hoveredRace.baseline !== null ? ` · ${t("2024: {lean}", { lean: lean(hoveredRace.baseline) })}` : ""}</span>
              <small>{t("Click to open race")}</small>
            </>}
          </div>

          <a className="pulse-skip" href="#signals">{t("Skip to the dashboard ↓")}</a>
        </div>
      </section>
    </>
  );
}

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
import { ShareImageButton } from "@/components/share-image-button";
import { TippingExplainer } from "@/components/pulse/tipping-explainer";
import { NATIONALIZATION } from "@/lib/mp26";

export type StoryRace = { code: string; chamber: "house" | "senate"; leader: "D" | "R"; margin: number; signedMargin?: number; winProbability: number; rating?: string };
type Chamber = { demMajority: number; demSeats: number; repSeats: number };
type PulseStoryProps = {
  races: StoryRace[];
  live: boolean;
  house: Chamber;
  senate: Chamber;
  ballotMargin: number;
  swing: number;
  onSwing: (value: number) => void;
};

const CHAPTER_TARGETS = [0, .48, 1];
const signed = (race: StoryRace) => race.signedMargin ?? (race.leader === "D" ? race.margin : -race.margin);
const lean = (margin: number) => `${margin >= 0 ? "D" : "R"}+${Math.abs(margin).toFixed(1)}`;

// Three-chapter scroll story on one sticky canvas: the map, the chamber, the tipping point.
export function PulseStory({ races, live, house, senate, ballotMargin, swing, onSwing }: PulseStoryProps) {
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
  const shift = swing * NATIONALIZATION;
  const leanD = complete ? houseRaces.filter((race) => signed(race) + shift > 0).length : house.demSeats;
  const tipping = useMemo(() => complete ? [...houseRaces].sort((a, b) => signed(b) - signed(a))[217] : null, [complete, houseRaces]);
  const tippingMargin = tipping ? signed(tipping) + shift : 0;

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
      engine.setProgress(progress);
      const next = progress < .27 ? 1 : progress < .64 ? 2 : 3;
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
    engineRef.current?.setMargins(new Map(houseRaces.map((race) => [race.code, signed(race)])));
  }, [complete, houseRaces]);

  useEffect(() => { engineRef.current?.setSwing(swing); }, [swing]);

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
  const [decidesBefore, decidesAfter] = t("{code} decides the House.").split("{code}");

  const tippingWhy = tipping ? <TippingExplainer margins={houseRaces.map((race) => signed(race) + shift)} code={tipping.code} demMajority={swing ? null : house.demMajority} /> : null;

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
            <p className="eyebrow"><ScrambleText text={`${t("2026 U.S. MIDTERMS")} · ${t(live ? "LIVE MODEL" : "DATED SNAPSHOT")}`} delay={250} /></p>
            <h1 className="kinetic" aria-label={t("The fight for Congress")}>
              {t("The fight for").split(" ").map((word, index) => <span className="w" aria-hidden="true" key={word}><span style={{ "--i": index } as React.CSSProperties}>{word}</span></span>)}
              <span className="w" aria-hidden="true"><span style={{ "--i": 3 } as React.CSSProperties}>
                <span className="rotator"><span className="rotator-sizer">{rotatorSizer}</span><span className="rotator-window"><span className="rotator-track"><span>{rotator[0]}</span><span>{rotator[1]}</span><span>{rotator[2]}</span><span>{rotator[0]}</span></span></span></span>
              </span></span>
            </h1>
            <p className="hero-deck">{t("Every dot is a slice of one of the 435 House districts, coloured by today's forecast. Hover the map, then scroll.")}</p>
            <div className="hero-actions">
              <Magnetic><Link className="primary-action" href="/races?view=map" transitionTypes={["nav-forward"]}>{t("Explore 435 districts")}</Link></Magnetic>
              <Magnetic><Link className="secondary-action" href="/model" transitionTypes={["nav-forward"]}>{t("Inspect the model")} <span>→</span></Link></Magnetic>
            </div>
          </div>

          <div className="pulse-hud">
            <div><span>{t("House · D majority")}</span><strong><CountUp value={house.demMajority} delay={900} />%</strong></div>
            <div><span>{t("Senate · D majority")}</span><strong><CountUp value={senate.demMajority} delay={1000} />%</strong></div>
            <div><span>{t("Generic ballot")}</span><strong className={ballotMargin >= 0 ? "dem-text" : "rep-text"}>{ballotMargin >= 0 ? "D" : "R"}+<CountUp value={Math.abs(ballotMargin)} decimals={1} delay={1100} /></strong></div>
            <OdometerCountdown />
          </div>

          <article className="pulse-chapter pulse-chapter-2" aria-hidden={chapter !== 2}>
            <p className="eyebrow">{t("02 · The chamber")}</p>
            <h2>{t("435 seats. One majority.")}</h2>
            <p>{t("Each district collapses into its seat, ordered from the safest Democratic seat on the left to the safest Republican seat on the right.")}</p>
            <div className="pulse-tally">
              <div><strong className="dem-text"><CountUp value={leanD} duration={700} /></strong><span>{t("lean D")}</span></div>
              <i>{t("218 to win")}</i>
              <div><strong className="rep-text"><CountUp value={435 - leanD} duration={700} /></strong><span>{t("lean R")}</span></div>
            </div>
            <small>{t("Leads count who is ahead today. The model median, D {dem} – {rep} R across 50,000 simulations, also prices in the upsets each side is likely to pull off.", { dem: house.demSeats, rep: house.repSeats })}</small>
          </article>

          <article className="pulse-chapter pulse-chapter-3" aria-hidden={chapter !== 3}>
            <p className="eyebrow">{t("03 · The tipping point")}</p>
            <h2>{tipping ? <>{decidesBefore}<span className={tippingMargin >= 0 ? "dem-text" : "rep-text"}>{tipping.code}</span>{decidesAfter}</> : t("The seat that decides the House.")}</h2>
            {tippingWhy}
            {tipping && <Link className="tip-open" href={`/races/${tipping.code.toLowerCase()}`}>{t("Open the {code} race →", { code: tipping.code })}</Link>}
          </article>

          <div className="pulse-swing">
            <label htmlFor="pulse-swing">{t("National swing")} <output className={swing > 0 ? "dem-text" : swing < 0 ? "rep-text" : ""}>{swing === 0 ? t("Baseline") : `${swing > 0 ? "D" : "R"}+${Math.abs(swing)}`}</output></label>
            <div className="swing-range" style={{ "--pct": `${(swing + 5) * 10}%` } as React.CSSProperties}>
              <input id="pulse-swing" type="range" min="-5" max="5" step="0.5" value={swing} onChange={(event) => onSwing(Number(event.target.value))} />
              <span className="swing-shock go" key={swing} aria-hidden="true" />
            </div>
            <button type="button" onClick={() => onSwing(0)} disabled={swing === 0}>{t("Reset")}</button>
          </div>

          <nav className="pulse-steps" aria-label={t("Story chapters")}>
            {["The map", "The chamber", "Tipping point"].map((label, index) => (
              <button key={label} type="button" className={chapter === index + 1 ? "active" : ""} onClick={() => goTo(index)}><i />{t(label)}</button>
            ))}
            <ShareImageButton className="pulse-share" label={t(chapter === 2 ? "Save chamber" : "Save map")} href={`/api/share/${chapter === 2 ? "house" : "map"}${swing ? `?swing=${swing}` : ""}`} />
          </nav>

          <div className="pulse-tooltip" ref={tooltipRef} data-visible={hoveredRace ? "true" : undefined} aria-hidden="true">
            {hoveredRace && <>
              <strong>{hoveredRace.code}</strong>
              <b className={signed(hoveredRace) + shift >= 0 ? "dem-text" : "rep-text"}>{lean(signed(hoveredRace) + shift)}</b>
              <span>{t(hoveredRace.rating || "Unrated")} · {hoveredRace.winProbability}% {hoveredRace.leader}</span>
              <small>{t("Click to open race")}</small>
            </>}
          </div>

          <a className="pulse-skip" href="#signals">{t("Skip to the dashboard ↓")}</a>
        </div>
      </section>
      {/* On phones the sticky stage is too short for the explainer, so it follows the story instead. */}
      {tippingWhy && <div className="tip-why-mobile">{tippingWhy}</div>}
    </>
  );
}

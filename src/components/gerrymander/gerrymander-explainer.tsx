"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/i18n/link";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { useInView } from "@/components/explainer/use-in-view";
import { prefersReducedMotion } from "@/components/motion/motion-utils";
import { ScrambleText } from "@/components/motion/scramble-text";
import { DistrictBoard, type BoardLabel } from "@/components/gerrymander/district-board";
import { DrawGame } from "@/components/gerrymander/draw-game";
import { EnsembleHistogram } from "@/components/gerrymander/ensemble-histogram";
import { MapWar } from "@/components/gerrymander/map-war";
import { CitySlicer } from "@/components/gerrymander/city-slicer";
import { ShapeGallery } from "@/components/gerrymander/shape-gallery";
import { CELLS, EXAMPLE_MAPS, parseMap, tally, technique, type ExampleKey, type Party } from "@/lib/gerrymander";
import type { CityCase, DistrictShape } from "@/lib/gerrymander-geo";

const HERO_ORDER: ExampleKey[] = ["fair", "red", "blue"];
const HERO_COPY: Record<ExampleKey, { name: string; note: string }> = {
  fair: { name: "Map A · straight rows", note: "Blue wins 3–2, close to its 60% of the vote." },
  red: { name: "Map B · drawn for Red", note: "Red wins 3–2 with only 40% of the vote." },
  blue: { name: "Map C · drawn for Blue", note: "Blue takes all five seats with 60%." },
};
const MAPS = Object.fromEntries(HERO_ORDER.map((key) => [key, parseMap(EXAMPLE_MAPS[key])])) as Record<ExampleKey, number[]>;
const BLANK = new Array<number>(CELLS).fill(-1);

export const SECTIONS = [
  { id: "packing", label: "Packing & cracking" },
  { id: "draw", label: "Draw it yourself" },
  { id: "detect", label: "How it gets caught" },
  { id: "shapes", label: "Real shapes" },
  { id: "cities", label: "Slicing a city" },
  { id: "2026", label: "The 2026 map war" },
  { id: "fix", label: "Can it be fixed?" },
];

function Score({ seats }: { seats: { B: number; R: number } }) {
  const t = useT();
  return (
    <div className="gm-score" aria-live="polite">
      <span className="blue"><small>{t("Blue")}</small><b key={`b${seats.B}`}>{seats.B}</b></span>
      <i>–</i>
      <span className="red"><b key={`r${seats.R}`}>{seats.R}</b><small>{t("Red")}</small></span>
    </div>
  );
}

// Same 25 voters, three maps, three different winners. Cycles on its own until someone picks a map.
function Hero() {
  const t = useT();
  const intl = useIntlLocale();
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const key = HERO_ORDER[index];
  const seats = useMemo(() => tally(MAPS[key]).seats, [key]);

  useEffect(() => {
    if (!auto || prefersReducedMotion()) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % HERO_ORDER.length), 3600);
    return () => window.clearInterval(timer);
  }, [auto]);

  return (
    <section className="gm-hero">
      <div className="gm-hero-copy">
        <p className="eyebrow gm-pill"><ScrambleText text={t("EXPLAINER · REDISTRICTING")} delay={150} /></p>
        <h1>{t("Gerrymandering")}</h1>
        <p className="gm-deck">{t("Whoever draws the map can pick the winner before anyone votes. Same voters, same ballots: move the lines and the result flips.")}</p>
        <div className="gm-hero-stats">
          <div><b className="blue">{(.6).toLocaleString(intl, { style: "percent" })}</b><span>{t("of votes are Blue")}</span></div>
          <div><b className="red">{(.4).toLocaleString(intl, { style: "percent" })}</b><span>{t("of votes are Red")}</span></div>
          <div><b>5</b><span>{t("districts of 5 voters")}</span></div>
        </div>
        <nav className="gm-toc" aria-label={t("On this page")}>
          {SECTIONS.map((section, i) => <a key={section.id} href={`#${section.id}`} style={{ "--i": i } as React.CSSProperties}>{t(section.label)}</a>)}
        </nav>
      </div>
      <div className="gm-hero-stage">
        <div className="gm-hero-board">
          <DistrictBoard assign={MAPS[key]} ariaLabel={t("{name}: Blue {blue}, Red {red}", { name: t(HERO_COPY[key].name), blue: seats.B, red: seats.R })} />
        </div>
        <div className="gm-hero-readout">
          <Score seats={seats} />
          <p className="gm-map-name" key={key}><b>{t(HERO_COPY[key].name)}</b><span>{t(HERO_COPY[key].note)}</span></p>
          <div className="gm-map-pills" role="group" aria-label={t("Choose a map")}>
            {HERO_ORDER.map((option, i) => (
              <button key={option} type="button" className={option === key ? "on" : ""} aria-pressed={option === key} onClick={() => { setAuto(false); setIndex(i); }}>
                <i style={{ animationPlayState: auto && option === key ? "running" : "paused" }} data-run={auto && option === key ? "" : undefined} />
                {String.fromCharCode(65 + i)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// "Gerry" + "salamander": the middle of the lizard drops out and the two words snap together.
function Origin() {
  const t = useT();
  const [ref, inView] = useInView<HTMLElement>({ rootMargin: "0px 0px -30% 0px" });
  const [merged, setMerged] = useState(false);
  useEffect(() => {
    if (!inView) return;
    const timer = window.setTimeout(() => setMerged(true), 900);
    return () => window.clearTimeout(timer);
  }, [inView]);
  const letters = (text: string, cls: string, offset: number) => text.split("").map((char, i) => <span key={`${cls}${i}`} className={cls} style={{ "--i": i + offset } as React.CSSProperties}>{char}</span>);

  return (
    <section className="gm-origin" ref={ref} data-in={inView ? "" : undefined}>
      <p className="eyebrow">{t("1812 · WHERE THE WORD COMES FROM")}</p>
      <button type="button" className="gm-word" data-merged={merged ? "" : undefined} onClick={() => setMerged((value) => !value)} aria-label={t("Gerry plus salamander makes gerrymander. Tap to replay.")}>
        <span className="gm-word-part gerry">{letters("GERRY", "keep", 0)}</span>
        <span className="gm-word-plus" aria-hidden="true">+</span>
        <span className="gm-word-part sala">{letters("SALA", "drop", 5)}{letters("MANDER", "keep tail", 9)}</span>
      </button>
      <div className="gm-origin-copy">
        <p>{t("In 1812 the governor of Massachusetts, Elbridge Gerry, signed a state Senate map that twisted one district north of Boston into a long, clawed shape. The Boston Gazette drew it as a monster, half Gerry, half salamander, and the name stuck.")}</p>
        <p className="gm-aside">{t("Gerry said his own name with a hard G, like \"Gary\". The word kept the soft one.")}</p>
      </div>
    </section>
  );
}

type Step = { map: number[]; victim?: Party; show?: BoardLabel | "all"; highlight?: BoardLabel; wasted?: boolean; kicker: string; title: string; body: string };

const STEPS: Step[] = [
  { map: BLANK, kicker: "The voters", title: "25 voters. 15 Blue, 10 Red.", body: "Blue has 60% of the votes. The state must be cut into 5 districts of 5 voters, and each district elects one representative: whoever holds 3 of its 5 voters wins." },
  { map: MAPS.fair, kicker: "A plain map", title: "Straight rows: Blue 3, Red 2", body: "Nobody tried anything here. Blue gets 60% of the seats with 60% of the votes. Now let's draw the map for Red." },
  { map: MAPS.red, victim: "B", show: "packed", highlight: "packed", kicker: "Step 1 · Packing", title: "Pack the other side together", body: "Squeeze as many Blue voters as possible into a few districts. Blue wins those 5–0, but it only needed 3: two of every five votes there change nothing." },
  { map: MAPS.red, victim: "B", show: "cracked", highlight: "cracked", kicker: "Step 2 · Cracking", title: "Crack the rest apart", body: "Spread the remaining Blue voters thinly across districts where Red wins by a little. Blue is a real minority in each one, and loses all three." },
  { map: MAPS.red, victim: "B", show: "all", wasted: true, kicker: "The result", title: "40% of the votes, 60% of the seats", body: "Faded dots are wasted votes: votes for the loser, or winning votes beyond the 3 needed. Blue wastes 9, Red only 1. That gap is the fingerprint of a gerrymander." },
  { map: MAPS.blue, victim: "R", show: "all", wasted: true, kicker: "And the other way", title: "Or Blue takes everything, 5–0", body: "Same voters, a different pen. Every district is 3 Blue to 2 Red, so all 10 Red votes are wasted. Both parties do this wherever they hold the pen." },
];

function Scrolly() {
  const t = useT();
  const [active, setActive] = useState(0);
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = stepsRef.current;
    if (!root) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
    }, { rootMargin: "-45% 0px -50% 0px" });
    root.querySelectorAll("[data-step]").forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, []);

  const step = STEPS[active];
  const result = useMemo(() => tally(step.map), [step.map]);
  const labels = useMemo(() => {
    if (!step.victim || !step.show) return undefined;
    const out: Partial<Record<number, BoardLabel>> = {};
    for (const district of result.districts) {
      const kind = technique(district, step.victim);
      if (kind && (step.show === "all" || step.show === kind)) out[district.id] = kind;
    }
    return out;
  }, [result, step]);
  const highlight = step.highlight && labels ? Object.keys(labels).map(Number) : null;

  return (
    <section className="gm-section gm-scrolly" id="packing">
      <div className="gm-scrolly-stage">
        <div className="gm-scrolly-card">
          <DistrictBoard assign={step.map} wasted={step.wasted} labels={labels} highlight={highlight} ariaLabel={t(step.title)} />
          <div className="gm-scrolly-read" data-blank={result.valid ? undefined : ""}>
            <Score seats={result.seats} />
            <div className="gm-wasted-read" data-on={step.wasted ? "" : undefined}>
              <span>{t("Wasted votes")}</span>
              <b className="blue">{result.wasted.B}</b>
              <b className="red">{result.wasted.R}</b>
            </div>
          </div>
          <div className="gm-step-dots" aria-hidden="true">{STEPS.map((_, i) => <i key={i} className={i === active ? "on" : i < active ? "done" : ""} />)}</div>
        </div>
      </div>
      <div className="gm-steps" ref={stepsRef}>
        {STEPS.map((item, i) => (
          <article key={item.title} className={`gm-step${i === active ? " on" : ""}`} data-step={i}>
            <p className="eyebrow">{String(i + 1).padStart(2, "0")} · {t(item.kicker)}</p>
            <h2>{t(item.title)}</h2>
            <p>{t(item.body)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ id, n, kicker, title, deck }: { id?: string; n: string; kicker: string; title: string; deck: string }) {
  const t = useT();
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <header className="gm-head" id={id} ref={ref} data-in={inView ? "" : undefined}>
      <p className="eyebrow"><span>{n}</span> {t(kicker)}</p>
      <h2>{t(title)}</h2>
      <p>{t(deck)}</p>
    </header>
  );
}

const FIXES = [
  { tag: "Commissions", title: "Take the pen away from politicians", body: "States such as California, Arizona, Michigan and Colorado hand the map to independent citizen commissions. The catch: a state can take the pen back. California's voters set their commission map aside for 2026–2030 with Proposition 50." },
  { tag: "Courts", title: "Judges, but mostly state ones", body: "In Rucho v. Common Cause (2019) the U.S. Supreme Court said federal courts cannot police partisan gerrymanders. State courts and state constitutions still can: that is how Utah got a new map in 2025." },
  { tag: "Race", title: "Racial lines are a different rule", body: "Drawing districts by race is unconstitutional unless the Voting Rights Act requires it. In Louisiana v. Callais (April 2026) the Supreme Court narrowed what that law requires, and several Southern states redrew their maps within weeks." },
  { tag: "Math", title: "Measure it", body: "Compactness scores, wasted-vote counts and ensembles of thousands of computer-drawn maps turn \"this looks rigged\" into evidence a court can weigh." },
];

// The whole page. One toy state carries the explanation; real shapes and the 2026 redraws carry the stakes.
export function GerrymanderExplainer({ shapes, cities }: { shapes: DistrictShape[]; cities: CityCase[] }) {
  const t = useT();
  const [userSeats, setUserSeats] = useState<number | null>(null);

  return (
    <div className="gm" data-motion>
      <Hero />
      <Origin />
      <Scrolly />

      <SectionHead id="draw" n="02" kicker="Your turn" title="Draw the map yourself" deck="Paint five districts of five connected squares. Pick a goal, choose a district colour and drag across the board." />
      <DrawGame onValidMap={setUserSeats} />

      <SectionHead id="detect" n="03" kicker="How it gets caught" title="4,006 possible maps. Which ones are normal?" deck="There are exactly 4,006 ways to cut this little state into five connected districts. Researchers do the same with real states, using computers to draw thousands of legal maps and checking whether the enacted one is an outlier." />
      <EnsembleHistogram userSeats={userSeats} />

      <SectionHead id="shapes" n="04" kicker="Real shapes" title="Districts that look like ink spills" deck="A strange shape is not proof of a gerrymander, and a tidy one is no guarantee of fairness. But extreme shapes are often where the lines were bent hardest. The Polsby-Popper score compares a district with a circle: 1 is a perfect circle, 0 is a thread." />
      <ShapeGallery shapes={shapes} />

      <SectionHead id="cities" n="05" kicker="Slicing a city" title="Why the shapes look like that" deck="Cities vote Democratic, the countryside Republican. So the weird shapes usually follow one of three recipes: slice a city into wedges that each reach out into rural land, pack it into one seat, or stitch scattered cities together. Here are real examples, with the House results before and after the lines moved." />
      <CitySlicer cases={cities} />

      <SectionHead id="2026" n="06" kicker="The 2026 map war" title="Nine states vote on maps redrawn in the middle of the decade" deck="District lines are normally redrawn once every ten years, after the census. Ahead of 2026, Texas started an unusual mid-decade round at the White House's urging, and both parties answered state by state. Missouri redrew too, but a referendum petition has kept its new map from being used this year." />
      <MapWar />

      <SectionHead id="fix" n="07" kicker="Can it be fixed?" title="Who should hold the pen?" deck="There is no single fix. Each one moves the decision somewhere else." />
      <div className="gm-fixes">
        {FIXES.map((fix, i) => (
          <article key={fix.tag} className="gm-fix" style={{ "--i": i } as React.CSSProperties}>
            <span>{t(fix.tag)}</span>
            <h3>{t(fix.title)}</h3>
            <p>{t(fix.body)}</p>
          </article>
        ))}
      </div>

      <div className="gm-cta">
        <p>{t("Every one of these lines is on the ballot on November 3.")}</p>
        <div>
          <Link className="primary-action" href="/races?view=map">{t("Open the district map")}</Link>
          <Link className="secondary-action" href="/states">{t("Browse states")} <span>→</span></Link>
        </div>
      </div>
    </div>
  );
}

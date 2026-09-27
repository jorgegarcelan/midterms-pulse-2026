"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CountUp } from "@/components/motion/count-up";
import { useInView } from "@/components/explainer/use-in-view";

type Token = { text: string; kind?: "key" | "string" | "number" | "comment"; start?: number };
type OutputModel = {
  version: string; runDate: string; simulations: number;
  genericBallot: { margin: number; movement: number };
  house: { demMajority: number; demSeats: number; interval80: [number, number] };
  senate: { demMajority: number; demSeats: number; interval80: [number, number] };
  races: { code: string; chamber: string; signedMargin: number; winProbability: number; leader: string }[];
};

// Splits a JSON-ish string into highlighted tokens.
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?)|(\/\/[^\n]*)/g;
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index! > last) tokens.push({ text: source.slice(last, match.index) });
    if (match[1]) { tokens.push({ text: match[1], kind: match[2] ? "key" : "string" }); if (match[2]) tokens.push({ text: match[2] }); }
    else if (match[3]) tokens.push({ text: match[3], kind: "number" });
    else tokens.push({ text: match[4], kind: "comment" });
    last = match.index! + match[0].length;
  }
  tokens.push({ text: source.slice(last) });
  let offset = 0;
  return tokens.map((token) => { const start = offset; offset += token.text.length; return { ...token, start }; });
}

// What the pipeline hands to the rest of the product: the API response types itself out.
export function StageOutput({ model, tippingCode }: { model: OutputModel; tippingCode?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const [shown, setShown] = useState(0);
  const tipping = model.races.find((race) => race.code === tippingCode && race.chamber === "house");

  const source = useMemo(() => {
    const sample = tipping || model.races[0];
    return [
      `// GET /api/model · ${model.runDate}`,
      "{",
      `  "version": "${model.version}",`,
      `  "simulations": ${model.simulations},`,
      `  "genericBallot": { "margin": ${model.genericBallot.margin}, "movement": ${model.genericBallot.movement} },`,
      `  "house":  { "demMajority": ${model.house.demMajority}, "demSeats": ${model.house.demSeats}, "interval80": [${model.house.interval80.join(", ")}] },`,
      `  "senate": { "demMajority": ${model.senate.demMajority}, "demSeats": ${model.senate.demSeats}, "interval80": [${model.senate.interval80.join(", ")}] },`,
      `  "races": [`,
      `    { "code": "${sample.code}", "signedMargin": ${sample.signedMargin.toFixed(1)}, "winProbability": ${sample.winProbability} },`,
      `    // …${model.races.length - 1} more races`,
      "  ]",
      "}",
    ].join("\n");
  }, [model, tipping]);
  const tokens = useMemo(() => tokenize(source), [source]);

  useEffect(() => {
    if (!inView) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const next = reduced ? source.length : Math.min(source.length, Math.floor((now - start) / 1000 * 420));
      setShown(next);
      if (next < source.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, source]);

  const visible = tokens.filter((token) => token.start! < shown).map((token, index) => (
    <span key={index} className={token.kind ? `tok-${token.kind}` : undefined}>{token.text.slice(0, shown - token.start!)}</span>
  ));

  const cards = [
    { label: "House control", value: model.house.demMajority, suffix: "%", note: `D ${model.house.demSeats} median · 80% ${model.house.interval80.join("–")}` },
    { label: "Senate control", value: model.senate.demMajority, suffix: "%", note: `D ${model.senate.demSeats} median · 80% ${model.senate.interval80.join("–")}` },
    { label: "Race probabilities", value: model.races.length, suffix: "", note: "one per House district and Senate race" },
    { label: "Simulated elections", value: model.simulations * 2, suffix: "", note: `${model.simulations.toLocaleString("en-US")} per chamber, seeded`, locale: true },
  ];

  return (
    <div className="stage-viz output-viz" ref={ref} data-in={inView ? "true" : undefined}>
      <div className="output-cards">
        {cards.map((card, index) => (
          <article key={card.label} style={{ "--i": index } as React.CSSProperties}>
            <span>{card.label}</span>
            <strong><CountUp value={card.value} locale={card.locale} delay={index * 120} />{card.suffix}</strong>
            <small>{card.note}</small>
          </article>
        ))}
      </div>
      <pre className="api-code" aria-label="Example API response"><code>{visible}<i className="caret" /></code></pre>
      <div className="consumers">
        <span>Consumed by</span>
        <Link href="/">Home story</Link><Link href="/#senate">Senate builder</Link><Link href="/districts">District map</Link><Link href="/races">Race profiles</Link><Link href="/model">Model page</Link>
      </div>
    </div>
  );
}

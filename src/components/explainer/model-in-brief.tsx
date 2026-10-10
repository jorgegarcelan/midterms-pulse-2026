"use client";

import Link from "@/components/i18n/link";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { signedLabel } from "@/components/explainer/use-in-view";
import { NATIONALIZATION, RACE_COMMON_SD, RACE_SD, SIMULATIONS } from "@/lib/mp26";
import { raceName } from "@/lib/races";

type BriefModel = {
  genericBallot: { margin: number; movement: number; effectivePolls: number };
  house: { demMajority: number };
  senate: { demMajority: number };
  races: { code: string; chamber: "house" | "senate"; signedMargin: number }[];
};

// The whole model in five plain-language steps, each with today's live number.
export function ModelInBrief({ model }: { model: BriefModel | null }) {
  const t = useT();
  const intl = useIntlLocale();
  const closestSenate = model?.races.filter((race) => race.chamber === "senate").sort((a, b) => Math.abs(a.signedMargin) - Math.abs(b.signedMargin))[0];
  const favored = (demPct: number) => demPct >= 50 ? `${demPct}% D` : `${100 - demPct}% R`;
  const steps = [
    {
      title: t("Start from a forecast for every race"),
      body: t("An outside benchmark gives each of the 435 House districts and 35 Senate races an expected margin: who is ahead, and by how much."),
      value: closestSenate ? signedLabel(closestSenate.signedMargin) : "—",
      caption: closestSenate ? t("{race}, the closest Senate race", { race: t("{state} Senate", { state: t(raceName({ ...closestSenate, state: closestSenate.code.slice(0, 2) }).replace(/ Senate$/, "")) }) }) : t("e.g. one Senate race"),
    },
    {
      title: t("Take the country's temperature"),
      body: t("Average the national polls that ask which party people will vote for in Congress. Newer, bigger and likely-voter polls count more."),
      value: model ? signedLabel(model.genericBallot.margin) : "—",
      caption: model ? t("weighted average of {count} two-party polls", { count: model.genericBallot.effectivePolls.toLocaleString(intl) }) : t("weighted average of all two-party polls"),
    },
    {
      title: t("Nudge every race"),
      body: t("If the national average has moved since the benchmark was made, every race moves with it, by {pct}% of the change.", { pct: Math.round(NATIONALIZATION * 100) }),
      value: model ? (Math.abs(model.genericBallot.movement) < .05 ? "0.0" : signedLabel(model.genericBallot.movement)) : "—",
      caption: model && Math.abs(model.genericBallot.movement) < .05 ? t("no movement since the benchmark") : t("moved since the benchmark"),
    },
    {
      title: t("Admit what we don't know"),
      body: t("Any race can miss by around {sd} points. Part of that miss hits every race at once, because polls tend to be wrong in the same direction everywhere.", { sd: RACE_SD }),
      value: `±${RACE_SD}`,
      caption: t("points per race, ±{shared} of it shared nationally", { shared: RACE_COMMON_SD.toFixed(1) }),
    },
    {
      title: t("Play the election {count} times", { count: SIMULATIONS.toLocaleString(intl) }),
      body: t("Each run rolls the dice for the country and for every race, then counts the seats. The odds are simply how often each party wins a majority."),
      value: model ? favored(model.house.demMajority) : "—",
      caption: model ? t("House · Senate {odds}", { odds: favored(model.senate.demMajority) }) : t("House and Senate odds"),
    },
  ];

  return (
    <section className="brief" aria-labelledby="brief-title">
      <div className="brief-head">
        <p className="eyebrow">{t("The short version")}</p>
        <h2 id="brief-title">{t("Five steps, no math.")}</h2>
      </div>
      <ol className="brief-steps">
        {steps.map((step, index) => (
          <li key={step.title} style={{ "--i": index } as React.CSSProperties}>
            <span className="brief-n">{String(index + 1).padStart(2, "0")}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            <div className="brief-value"><strong>{step.value}</strong><small>{step.caption}</small></div>
          </li>
        ))}
      </ol>
      <p className="brief-foot">{t("Want the math? The seven steps below run on the live model. Unsure about a word?")} <Link href="/glossary">{t("Read the glossary")} →</Link></p>
    </section>
  );
}

"use client";

import { useRef, useState } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { DataLab } from "@/components/playground/data-lab";
import { MapBuilder } from "@/components/playground/map-builder";
import { ScenarioSimulator } from "@/components/playground/scenario-simulator";
import { patchUrl, TOOLS, type PlayRace, type Published, type ToolKey } from "@/lib/playground/types";

type Props = { races: PlayRace[]; published: Published; initialTool: ToolKey; initial: Record<string, string | undefined> };

const META: Record<ToolKey, { label: string; blurb: string; icon: React.ReactNode }> = {
  scenario: {
    label: "Scenario simulator", blurb: "Swing the map, re-run the model",
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2.2" /><circle cx="10" cy="17" r="2.2" /></svg>,
  },
  map: {
    label: "Map builder", blurb: "Paint your own House or Senate",
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" /><path d="M9 4v13.5M15 6.5V20" /></svg>,
  },
  lab: {
    label: "Data lab", blurb: "Cross any two variables",
    icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4v16h16" /><circle cx="9" cy="14" r="1.6" /><circle cx="13" cy="10" r="1.6" /><circle cx="17" cy="7" r="1.6" /><circle cx="15" cy="14" r="1.6" /></svg>,
  },
};

// Three tools behind one tab strip. The active tool lives in ?tool=; visited tools stay mounted so their state survives.
export function Playground({ races, published, initialTool, initial }: Props) {
  const t = useT();
  const [tool, setTool] = useState<ToolKey>(initialTool);
  const [visited, setVisited] = useState<ToolKey[]>([initialTool]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(next: ToolKey, focus = false) {
    setTool(next);
    setVisited((current) => current.includes(next) ? current : [...current, next]);
    patchUrl({ tool: next === "scenario" ? null : next });
    if (focus) tabs.current[TOOLS.indexOf(next)]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const index = TOOLS.indexOf(tool);
    const move = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (move) { event.preventDefault(); select(TOOLS[(index + move + TOOLS.length) % TOOLS.length], true); }
    if (event.key === "Home") { event.preventDefault(); select(TOOLS[0], true); }
    if (event.key === "End") { event.preventDefault(); select(TOOLS[TOOLS.length - 1], true); }
  }

  return <div className="pg">
    <div className="pg-tabs" role="tablist" aria-label={t("Playground tools")} onKeyDown={onKeyDown} style={{ "--tab": TOOLS.indexOf(tool) } as React.CSSProperties}>
      <span className="pg-tab-glow" aria-hidden="true" />
      {TOOLS.map((key, index) => <button
        key={key}
        ref={(node) => { tabs.current[index] = node; }}
        type="button"
        role="tab"
        id={`pg-tab-${key}`}
        aria-controls={`pg-panel-${key}`}
        aria-selected={tool === key}
        tabIndex={tool === key ? 0 : -1}
        className={tool === key ? "active" : ""}
        onClick={() => select(key)}
      >
        <span className="pg-tab-icon">{META[key].icon}</span>
        <span><strong>{t(META[key].label)}</strong><small>{t(META[key].blurb)}</small></span>
      </button>)}
    </div>
    {TOOLS.map((key) => visited.includes(key) && <section key={key} id={`pg-panel-${key}`} role="tabpanel" aria-labelledby={`pg-tab-${key}`} hidden={tool !== key} className="pg-panel">
      {key === "scenario" && <ScenarioSimulator races={races} published={published} initial={initial} />}
      {key === "map" && <MapBuilder races={races} initial={initial} />}
      {key === "lab" && <DataLab races={races} initial={initial} />}
    </section>)}
  </div>;
}

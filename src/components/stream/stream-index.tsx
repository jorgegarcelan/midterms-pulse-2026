"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalePath, useT } from "@/components/i18n/locale-provider";
import { useStreamModel } from "@/components/stream/stream-stage";
import { stateByCode } from "@/data/geography";
import { raceSlug } from "@/lib/races";

// Scene catalogue for OBS: each scene's URL, an overlay variant and a race picker.
export function StreamIndex() {
  const t = useT();
  const localize = useLocalePath();
  const model = useStreamModel();
  const [origin, setOrigin] = useState("");
  const [race, setRace] = useState("pa-07");
  const [copied, setCopied] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => setOrigin(window.location.origin), 0); return () => window.clearTimeout(timer); }, []);

  const races = useMemo(() => (model?.races || []).filter((item) => item.chamber === "senate" || item.winProbability < 80).sort((a, b) => (a.chamber === b.chamber ? a.code.localeCompare(b.code) : a.chamber === "senate" ? -1 : 1)), [model]);
  const label = (item: (typeof races)[number]) => item.chamber === "senate" ? t("{state} Senate", { state: t(stateByCode.get(item.state)?.name || item.state) }) : item.code;

  const scenes = [
    { key: "control", title: t("Control scoreboard"), body: t("House and Senate odds, seat medians, the generic ballot and the days left. Refreshes every five minutes."), path: "/stream/control" },
    { key: "senate", title: t("Senate builder"), body: t("Click states to call them live and watch control move. Interact with it in OBS via Interact (right click on the source)."), path: "/stream/senate" },
    { key: "geography", title: t("Geography of the vote"), body: t("The county map story in presentation mode: move between axes with the arrow keys, Esc to leave."), path: "/geography?present" },
    { key: "race", title: t("Race card"), body: t("One race full screen: model margin, win probability and the Cook, Inside Elections and Sabato ratings."), path: `/stream/race/${race}` },
  ];
  async function copy(url: string) { await navigator.clipboard?.writeText(url); setCopied(url); window.setTimeout(() => setCopied(""), 1600); }

  return <>
    <section className="page-intro"><div>
      <p className="eyebrow">{t("STREAM MODE")}</p>
      <h1>{t("Scenes for your stream")}</h1>
      <p>{t("Full-screen 1920×1080 views without menus, made for an OBS browser source. Add ?bg=transparent to any scene to use it as an overlay on top of your camera.")}</p>
    </div></section>
    <ol className="stream-howto"><li>{t("In OBS: Sources → + → Browser.")}</li><li>{t("Paste the scene URL, set width 1920 and height 1080.")}</li><li>{t("Tick “Refresh browser when scene becomes active”. Data updates on its own every five minutes.")}</li></ol>
    <div className="stream-scenes">
      {scenes.map((scene) => {
        const url = `${origin}${localize(scene.path)}`;
        const overlay = `${url}${url.includes("?") ? "&" : "?"}bg=transparent`;
        return <article key={scene.key} className="panel stream-scene">
          <h2>{scene.title}</h2><p>{scene.body}</p>
          {scene.key === "race" && <label className="stream-picker">{t("Race")}<select value={race} onChange={(event) => setRace(event.target.value)}>{races.map((item) => <option key={raceSlug(item)} value={raceSlug(item)}>{label(item)}</option>)}</select></label>}
          <code>{url}</code>
          <div className="stream-scene-actions">
            <a href={localize(scene.path)} target="_blank" rel="noreferrer">{t("Open")} ↗</a>
            <button type="button" onClick={() => copy(url)}>{copied === url ? t("Copied") : t("Copy URL")}</button>
            <button type="button" onClick={() => copy(overlay)}>{copied === overlay ? t("Copied") : t("Copy overlay URL")}</button>
          </div>
        </article>;
      })}
    </div>
  </>;
}

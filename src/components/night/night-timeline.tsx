"use client";

import { Fragment, useMemo } from "react";
import Link from "@/components/i18n/link";
import { useT } from "@/components/i18n/locale-provider";
import { NightBoard } from "@/components/night/night-board";
import { useNight, useRehearsalFlag } from "@/components/night/use-night";
import { FIRST_CLOSE, spainClock, type Winner } from "@/lib/night";

export type TimelineRace = {
  key: string; href: string; name: string; special: boolean; cook: string | null;
  rating: { label: string; score: number } | null; polls: string | null; pollsLean: number;
};
const tone = (lean: number) => (lean > 0 ? "dem-text" : lean < 0 ? "rep-text" : "toss-text");
export type TimelineSlot = {
  close: string; closeAt: number; primary: string; secondary: string;
  states: { code: string; name: string; title?: string; small?: string }[];
  races: TimelineRace[]; keys: string[]; notes: { name: string; text: string }[];
};

// The board appears three hours before the first polls close and stays once the night has started.
const BOARD_FROM = FIRST_CLOSE - 3 * 3_600_000;

const untilLabel = (ms: number, t: ReturnType<typeof useT>) => {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return minutes < 60 ? t("in {m} min", { m: minutes }) : t("in {h} h {m} min", { h: Math.floor(minutes / 60), m: minutes % 60 });
};

export function NightTimeline({ slots, names }: { slots: TimelineSlot[]; names: Record<string, string> }) {
  const t = useT();
  const rehearsal = useRehearsalFlag();
  const { state, now } = useNight(rehearsal);
  const live = Boolean(state && now && (state.mode === "rehearsal" || state.calls.length > 0 || now >= BOARD_FROM));
  const called = useMemo(() => new Map<string, { winner: Winner; at: string }>((state?.calls ?? []).map((call) => [call.key, call])), [state]);
  const nextSlot = live ? slots.findIndex((slot) => slot.closeAt > now) : -1;

  return <>
    {live && state && <NightBoard state={state} now={now} nameOf={(key) => names[key] || key} />}
    <ol className="night-timeline">
      {slots.map((slot, index) => {
        const closed = live && now >= slot.closeAt;
        const done = slot.keys.filter((key) => called.has(key)).length;
        return <Fragment key={slot.close}>
          {index === nextSlot && <li className="night-now" aria-label={t("Now")}><span>{t("NOW")} · {spainClock(now)}</span></li>}
          <li className={`night-slot${closed ? " closed" : ""}${index === nextSlot ? " next" : ""}`}>
            <div className="night-time">
              <strong>{slot.primary}</strong><span>{slot.secondary}</span>
              {live && (closed
                ? <em className="night-status">{t("Polls closed")} · {t("{done} of {total} called", { done, total: slot.keys.length })}</em>
                : slot.closeAt - now < 3 * 3_600_000 && <em className="night-status soon">{untilLabel(slot.closeAt - now, t)}</em>)}
            </div>
            <div className="night-body">
              <div className="night-states">{slot.states.map((state) => <span key={state.code} className="night-state" title={state.title}>{state.name}{state.small && <small>{state.small}</small>}</span>)}</div>
              {slot.races.length > 0
                ? <div className="night-races">{slot.races.map((race) => {
                  const call = called.get(race.key);
                  return <Link key={race.key} href={race.href} className={`night-race${call ? ` called ${call.winner === "D" ? "dem" : "rep"}` : ""}`}>
                    <span className="night-race-name"><b>{race.name}</b>{race.special && <small>{t("special")}</small>}</span>
                    <span className={tone(Math.abs(race.rating?.score ?? 0) < .25 ? 0 : race.rating?.score ?? 0)}>{race.rating?.label ?? "—"}</span>
                    <span className={race.polls ? tone(race.pollsLean) : "night-quiet"}>{race.polls ? t("Polls {lean}", { lean: race.polls }) : t("No polls")}</span>
                    <span />
                    {call
                      ? <span className="night-call"><b>✓ {call.winner}</b> {spainClock(Date.parse(call.at))}</span>
                      : closed ? <span className="night-call pending">{t("Not yet called")}</span>
                        : <span className="night-cook">{race.cook ? `Cook: ${race.cook}` : ""}</span>}
                  </Link>;
                })}</div>
                : <p className="night-quiet">{t("No competitive races close in this slot.")}</p>}
              {slot.notes.map((note) => <p key={note.name} className="night-note"><b>{note.name}.</b> {note.text}</p>)}
            </div>
          </li>
        </Fragment>;
      })}
    </ol>
  </>;
}

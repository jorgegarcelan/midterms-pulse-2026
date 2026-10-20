import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getModel } from "@/lib/model-server";
import { clockNow, FIRST_CLOSE, SCENARIOS, type Baseline, type NightCall, type NightDoc, type NightState, type Scenario, type Winner } from "@/lib/night";
import { freezeBaseline, nightOutlook, simulateNight } from "@/lib/night-sim";
import { loadNight, saveNight, storeKind, type NightSlot } from "@/lib/night-store";

/*
  GET  /api/night               the public night: calls so far and chamber odds given them.
  GET  /api/night?rehearsal=1   the rehearsal instead, when one is running (never shown otherwise).
  POST /api/night               the call desk (Authorization: Bearer DESK_TOKEN).
*/

let memo: { key: string; value: ReturnType<typeof nightOutlook> }[] = [];
function outlook(baseline: Baseline, calls: NightCall[]) {
  const key = `${baseline.runDate}|${baseline.version}|${calls.map((call) => call.key + call.winner).sort().join(",")}`;
  const hit = memo.find((entry) => entry.key === key);
  if (hit) return hit.value;
  const value = nightOutlook(baseline, calls);
  memo = [{ key, value }, ...memo].slice(0, 12);
  return value;
}

async function stateOf(slot: NightSlot, doc: NightDoc | null): Promise<NightState> {
  const baseline = doc?.baseline ?? freezeBaseline(await getModel());
  const realNow = Date.now();
  const now = clockNow(doc?.clock ?? null, realNow);
  const iso = new Date(now).toISOString();
  const visible = (doc?.calls ?? []).filter((call) => call.at <= iso).sort((a, b) => b.at.localeCompare(a.at));
  const { house, senate, shift } = outlook(baseline, visible);
  return {
    mode: slot, serverNow: new Date(realNow).toISOString(), now: iso, clock: doc?.clock ?? null, scenario: doc?.scenario ?? null,
    calls: visible, house, senate, shift, baseline: { runDate: baseline.runDate, version: baseline.version },
  };
}

export async function GET(request: NextRequest) {
  const wantsRehearsal = request.nextUrl.searchParams.get("rehearsal") === "1";
  const rehearsal = wantsRehearsal ? await loadNight("rehearsal").catch(() => null) : null;
  const slot: NightSlot = rehearsal ? "rehearsal" : "live";
  const doc = rehearsal ?? await loadNight("live").catch(() => null);
  const state = await stateOf(slot, doc);
  // A few seconds at the edge: a TV audience hitting the page at once costs one function call, not thousands.
  return NextResponse.json(state, { headers: { "Cache-Control": `public, s-maxage=${slot === "rehearsal" ? 5 : 10}, stale-while-revalidate=30` } });
}

const digest = (value: string) => createHash("sha256").update(value).digest();
function authorized(request: NextRequest) {
  const expected = process.env.DESK_TOKEN;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return Boolean(expected) && timingSafeEqual(digest(given), digest(expected!));
}

type Action =
  | { action: "state"; slot: NightSlot }
  | { action: "call"; slot: NightSlot; calls: { key: string; winner: Winner }[] }
  | { action: "uncall"; slot: NightSlot; keys: string[] }
  | { action: "rehearse"; scenario: Scenario; speed: number; seed?: number }
  | { action: "clock"; speed?: number; jump?: string }
  | { action: "stop" }
  | { action: "freeze" }
  | { action: "reset"; confirm: string }
  | { action: "restore"; calls: NightCall[] };

const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  if (!process.env.DESK_TOKEN) return fail(503, "DESK_TOKEN is not set on the server.");
  if (!authorized(request)) return fail(401, "Wrong desk token.");
  const body = await request.json().catch(() => null) as Action | null;
  if (!body?.action) return fail(400, "Missing action.");

  try {
    let slot: NightSlot = "slot" in body && body.slot === "rehearsal" ? "rehearsal" : "live";
    let doc = await loadNight(slot);
    // The desk asks for the rehearsal after it has ended: show it the live night instead.
    if (body.action === "state" && slot === "rehearsal" && !doc) { slot = "live"; doc = await loadNight("live"); }

    if (body.action === "call" || body.action === "uncall") {
      if (slot === "rehearsal" && !doc) return fail(409, "No rehearsal is running.");
      doc ??= { calls: [], baseline: freezeBaseline(await getModel()), updated: "" };
      const known = new Set(doc.baseline!.races.map((race) => race.key));
      const at = new Date(clockNow(doc.clock ?? null)).toISOString();
      const touched = new Set(body.action === "call" ? body.calls.map((call) => call.key) : body.keys);
      if ([...touched].some((key) => !known.has(key))) return fail(400, "Unknown race.");
      if (body.action === "call" && body.calls.some((call) => call.winner !== "D" && call.winner !== "R")) return fail(400, "Winner must be D or R.");
      doc.calls = doc.calls.filter((call) => !touched.has(call.key));
      if (body.action === "call") doc.calls.push(...body.calls.map((call) => ({ key: call.key, winner: call.winner, at })));
      doc.updated = new Date().toISOString();
      await saveNight(slot, doc);
    } else if (body.action === "rehearse") {
      if (!SCENARIOS.includes(body.scenario)) return fail(400, "Unknown scenario.");
      const speed = Math.min(120, Math.max(1, Number(body.speed) || 20));
      const baseline = freezeBaseline(await getModel());
      const seed = Number.isFinite(body.seed) ? Number(body.seed) : Math.floor(Math.random() * 2 ** 31);
      const { calls } = simulateNight(baseline, body.scenario, seed);
      slot = "rehearsal";
      doc = {
        calls, baseline, updated: new Date().toISOString(), scenario: body.scenario,
        // Start a quarter of an hour before the first polls close (00:00 in Spain).
        clock: { simStart: new Date(FIRST_CLOSE - 15 * 60_000).toISOString(), realStart: new Date().toISOString(), speed },
      };
      await saveNight(slot, doc);
    } else if (body.action === "clock") {
      slot = "rehearsal";
      doc = await loadNight(slot);
      if (!doc?.clock) return fail(409, "No rehearsal is running.");
      const simNow = body.jump ? Date.parse(body.jump) : clockNow(doc.clock);
      if (!Number.isFinite(simNow)) return fail(400, "Bad time.");
      doc.clock = { simStart: new Date(simNow).toISOString(), realStart: new Date().toISOString(), speed: Math.min(120, Math.max(0, body.speed ?? doc.clock.speed)) };
      doc.updated = new Date().toISOString();
      await saveNight(slot, doc);
    } else if (body.action === "stop") {
      await saveNight("rehearsal", null);
      slot = "live";
      doc = await loadNight("live");
    } else if (body.action === "freeze") {
      slot = "live";
      doc = await loadNight("live") ?? { calls: [], baseline: null, updated: "" };
      doc.baseline = freezeBaseline(await getModel());
      doc.updated = new Date().toISOString();
      await saveNight(slot, doc);
    } else if (body.action === "reset") {
      if (body.confirm !== "RESET") return fail(400, "Type RESET to clear the live calls.");
      await saveNight("live", null);
      slot = "live";
      doc = null;
    } else if (body.action === "restore") {
      // Puts back the desk's own copy of the live calls after the store lost them; never over existing calls.
      slot = "live";
      doc = await loadNight("live") ?? { calls: [], baseline: null, updated: "" };
      if (doc.calls.length) return fail(409, "The live night already has calls: nothing to restore.");
      doc.baseline ??= freezeBaseline(await getModel());
      const known = new Set(doc.baseline.races.map((race) => race.key));
      const now = new Date().toISOString();
      const calls = Array.isArray(body.calls) ? body.calls : [];
      if (calls.some((call) => !known.has(call.key) || (call.winner !== "D" && call.winner !== "R") || !Number.isFinite(Date.parse(call.at)) || call.at > now)) return fail(400, "The backup does not look valid.");
      doc.calls = calls.map((call) => ({ key: call.key, winner: call.winner, at: call.at }));
      doc.updated = now;
      await saveNight(slot, doc);
    } else if (body.action !== "state") {
      return fail(400, "Unknown action.");
    }

    // The desk also sees how many scripted rehearsal calls are still ahead, where calls are stored and whether a rehearsal runs.
    const state = await stateOf(slot, doc);
    const rehearsalActive = slot === "rehearsal" || Boolean(await loadNight("rehearsal"));
    return NextResponse.json({ ...state, pending: (doc?.calls.length ?? 0) - state.calls.length, store: storeKind, rehearsalActive }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(500, error instanceof Error ? error.message : "Store error.");
  }
}

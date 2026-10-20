/*
  A timed dress rehearsal of election night against a running site:

    DESK_TOKEN=… node scripts/rehearse-night.mjs [base-url] [scenario] [step-minutes]

  Starts a rehearsal (a simulated night, visible only with ?rehearsal=1), walks its clock from 00:45 to
  10:00 in Spanish time, and at every step reads the public endpoint the way the guide and the stream
  scene do. Each step checks that calls only accumulate, seat counts add up and odds stay in range,
  and reports what a viewer would see. Ends the rehearsal when done, so nothing is left behind.
  Scenarios: forecast, dem-wave, rep-wave, random. Defaults: http://localhost:3100, random, 30.
*/
const [base = "http://localhost:3100", scenario = "random", stepArg = "30"] = process.argv.slice(2);
const token = process.env.DESK_TOKEN;
if (!token) { console.error("Set DESK_TOKEN (the same value as on the server)."); process.exit(1); }
const step = Number(stepArg) * 60_000;

async function desk(body) {
  const response = await fetch(`${base}/api/night`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await response.json();
  if (!response.ok) throw new Error(`${body.action}: ${json.error}`);
  return json;
}
async function publicView(rehearsal) {
  const started = performance.now();
  const response = await fetch(`${base}/api/night${rehearsal ? "?rehearsal=1" : ""}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`GET ${response.status}`);
  return { state: await response.json(), ms: Math.round(performance.now() - started) };
}
const spain = (iso) => new Date(iso).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
const pct = (value) => `${Math.round(value * 100)}%`.padStart(4);

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const live = (await publicView(false)).state;
const started = await desk({ action: "rehearse", scenario, speed: 0 });
console.log(`Rehearsal "${scenario}" on ${base} · baseline ${started.baseline.version} of ${started.baseline.runDate} · ${started.pending} scripted calls\n`);
console.log("Spain   calls  House D–R   P(D)   Senate D–R  P(D)   shift   GET");

let previous = new Set();
const first = Date.parse(started.now);
const end = Date.UTC(2026, 10, 4, 9, 0);
try {
  for (let at = first + step; at <= end; at += step) {
    await desk({ action: "clock", jump: new Date(at).toISOString(), speed: 0 });
    const { state, ms } = await publicView(true);
    const keys = new Set(state.calls.map((call) => call.key));
    check(state.mode === "rehearsal", `${spain(state.now)}: public view is not showing the rehearsal`);
    check([...previous].every((key) => keys.has(key)), `${spain(state.now)}: a call disappeared`);
    check(state.calls.every((call) => call.at <= state.now), `${spain(state.now)}: a call from the future is visible`);
    for (const [name, chamber] of [["House", state.house], ["Senate", state.senate]]) {
      check(chamber.locked.D + chamber.locked.R + chamber.uncalled === chamber.seats, `${spain(state.now)}: ${name} seats do not add up`);
      check(chamber.controlD >= 0 && chamber.controlD <= 1, `${spain(state.now)}: ${name} odds out of range`);
      if (chamber.locked.D >= chamber.majority) check(chamber.controlD === 1, `${spain(state.now)}: ${name} majority called but odds below 100%`);
      if (chamber.locked.R > chamber.seats - chamber.majority) check(chamber.controlD === 0, `${spain(state.now)}: ${name} lost but odds above 0%`);
    }
    check(ms < 3000, `${spain(state.now)}: slow response (${ms} ms)`);
    previous = keys;
    const { house: h, senate: s } = state;
    console.log(`${spain(state.now)}   ${String(state.calls.length).padStart(4)}  ${`${h.locked.D}–${h.locked.R}`.padStart(9)}  ${pct(h.controlD)}   ${`${s.locked.D}–${s.locked.R}`.padStart(9)}  ${pct(s.controlD)}   ${state.shift === null ? "  —  " : `${state.shift >= 0 ? "D" : "R"}+${Math.abs(state.shift).toFixed(1)}`}  ${String(ms).padStart(5)} ms`);
  }
  // The real night must be untouched by the rehearsal.
  const after = (await publicView(false)).state;
  check(after.mode === "live" && after.calls.length === live.calls.length, "the rehearsal leaked into the live night");
} finally {
  await desk({ action: "stop" });
}
const gone = (await publicView(true)).state;
check(gone.mode === "live", "the rehearsal did not end");

console.log(failures.length ? `\n${failures.length} problem(s):\n- ${failures.join("\n- ")}` : "\nAll checks passed. Rehearsal ended.");
process.exit(failures.length ? 1 : 0);

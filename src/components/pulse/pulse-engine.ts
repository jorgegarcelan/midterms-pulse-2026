import dotsData from "@/data/map-dots.json";
import { NATIONALIZATION } from "@/lib/mp26";
import { parliamentLayout } from "@/lib/parliament";

/*
  Canvas particle engine for the home story.
  Every dot is a grid cell owned by one of the 435 districts. Dots burst out of a single point into
  the map, take their colour as "results come in" east → west, then morph with scroll into the
  House hemicycle (each district collapses onto its seat) and into a ranked margin ladder that
  exposes the tipping-point seat. Design space is 1000 × 620; each layout is fitted into its own
  screen region and dots interpolate between fully projected positions.
*/

type Region = { x: number; y: number; w: number; h: number };
type Frame = { s: number; ox: number; oy: number };
export type PulseHover = { code: string; x: number; y: number } | null;

const W = 1000;
const H = 620;
const SEATS = 435;
const MAJORITY_RANK = 217; // zero-based rank of the 218th seat
const STEPS = 12;
const ALPHA_LEVELS = 6;
const D_RGB = [91, 134, 255];
const R_RGB = [255, 90, 110];
const PALE = [238, 241, 248];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const easeInOut = (t: number) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;
const range = (value: number, start: number, end: number) => clamp01((value - start) / (end - start));
// Margin ladder y: asinh keeps the competitive band around zero wide and compresses safe seats.
const ladderY = (margin: number) => 310 - Math.asinh(Math.max(-60, Math.min(60, margin)) / 4) / Math.asinh(15) * 262;

function rgb(mix: number, party: number[]) {
  return `rgb(${[0, 1, 2].map((channel) => Math.round(PALE[channel] + (party[channel] - PALE[channel]) * mix)).join(",")})`;
}

// Bucket 0 = unrevealed, 1 = flash, then D strengths, then R strengths (pale = close race).
const PALETTE = ["rgba(210,216,230,1)", "rgb(255,255,255)",
  ...Array.from({ length: STEPS }, (_, index) => rgb(.3 + .7 * (index / (STEPS - 1)), D_RGB)),
  ...Array.from({ length: STEPS }, (_, index) => rgb(.3 + .7 * (index / (STEPS - 1)), R_RGB)),
];

function colorBucket(margin: number) {
  const strength = Math.min(STEPS - 1, Math.floor(Math.min(1, Math.abs(margin) / 22) * STEPS));
  return margin >= 0 ? 2 + strength : 2 + STEPS + strength;
}

export class PulseEngine {
  private ctx: CanvasRenderingContext2D;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private n: number;
  private readonly codes: string[];
  private mapX: Float32Array;
  private mapY: Float32Array;
  private owner: Uint16Array;
  private leader: Uint8Array;
  private jitter: Float32Array;
  private burstDelay: Float32Array;
  private ctrlX: Float32Array;
  private ctrlY: Float32Array;
  private drawX: Float32Array;
  private drawY: Float32Array;
  private drawA: Float32Array;
  private sizes: Float32Array;
  private revealAt: Float32Array;
  private keys: Uint16Array;
  private order: Uint32Array;
  private margins = new Float32Array(SEATS);
  private rank = new Uint16Array(SEATS);
  private byRank = new Uint16Array(SEATS);
  private bucketOf = new Uint8Array(SEATS);
  private seatX: Float32Array;
  private seatY: Float32Array;
  private seatDot: number;
  private hasData = false;
  private progress = 0;
  private swing = 0;
  private swingTarget = 0;
  private pointer: { x: number; y: number } | null = null;
  private hovered = -1;
  private started = 0;
  private introDone = false;
  private revealEnd = 0;
  private frameId = 0;
  private visible = true;
  private reduced: boolean;
  private monoFont = "monospace";
  private destroyed = false;
  private wakeTimer = 0;
  // Hover lens: dots near the cursor grow in place (no displacement, so what you point at stays put).
  private lens = 0;
  private lensPoint = { x: 0, y: 0 };
  private mapInsets = { top: 230, bottom: 96 };
  onHover: (hover: PulseHover) => void = () => undefined;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.codes = dotsData.codes;
    const total = dotsData.cells.reduce((sum, cells) => sum + cells.length, 0);
    this.n = total;
    this.mapX = new Float32Array(total);
    this.mapY = new Float32Array(total);
    this.owner = new Uint16Array(total);
    this.leader = new Uint8Array(total);
    this.jitter = new Float32Array(total);
    this.burstDelay = new Float32Array(total);
    this.ctrlX = new Float32Array(total);
    this.ctrlY = new Float32Array(total);
    this.drawX = new Float32Array(total);
    this.drawY = new Float32Array(total);
    this.drawA = new Float32Array(total);
    this.sizes = new Float32Array(total);
    this.revealAt = new Float32Array(total).fill(Infinity);
    this.keys = new Uint16Array(total);
    this.order = new Uint32Array(total);

    let index = 0;
    const { step, cols } = dotsData;
    dotsData.cells.forEach((cells, district) => {
      // The dot closest to the district centroid survives the collapse into a seat.
      const [cx, cy] = dotsData.centroids[district];
      let best = index;
      let bestDistance = Infinity;
      for (const cell of cells) {
        const x = (cell % cols) * step + step / 2;
        const y = Math.floor(cell / cols) * step + step / 2;
        this.mapX[index] = x;
        this.mapY[index] = y;
        this.owner[index] = district;
        const distance = (x - cx) ** 2 + (y - cy) ** 2;
        if (distance < bestDistance) { bestDistance = distance; best = index; }
        const heading = Math.random() * Math.PI * 2;
        const reach = 120 + Math.random() * 320;
        this.ctrlX[index] = Math.cos(heading) * reach;
        this.ctrlY[index] = Math.sin(heading) * reach;
        this.burstDelay[index] = Math.random() * 260 + Math.hypot(x - W / 2, y - H / 2) * .35;
        this.jitter[index] = Math.random();
        index += 1;
      }
      this.leader[best] = 1;
    });

    const { seats, dot } = parliamentLayout(SEATS, 12, .36);
    this.seatX = new Float32Array(seats.map((seat) => W / 2 + seat.x * 470));
    this.seatY = new Float32Array(seats.map((seat) => 560 + seat.y * 470));
    this.seatDot = dot * 470;
    for (let district = 0; district < SEATS; district += 1) { this.rank[district] = district; this.byRank[district] = district; }

    this.monoFont = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() || "monospace";
    if (this.reduced) { this.introDone = true; this.revealAt.fill(0); }
    this.started = performance.now();
    this.resize();
  }

  destroy() { this.destroyed = true; cancelAnimationFrame(this.frameId); window.clearTimeout(this.wakeTimer); }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = rect.width;
    this.cssH = rect.height;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.wake();
  }

  // Screen space the DOM overlay leaves free for the map (hero copy above, HUD below).
  setMapInsets(top: number, bottom: number) { this.mapInsets = { top, bottom }; this.wake(); }
  setVisible(visible: boolean) { this.visible = visible; if (visible) this.wake(); }
  setProgress(progress: number) { if (Math.abs(progress - this.progress) > .0005) { this.progress = progress; this.wake(); } }
  setSwing(swing: number) { this.swingTarget = swing; this.wake(); }
  setPointer(point: { x: number; y: number } | null) { this.pointer = point; this.wake(); }
  hoveredCode() { return this.hovered >= 0 ? this.codes[this.hovered] : null; }

  setMargins(margins: Map<string, number>) {
    const first = !this.hasData;
    this.codes.forEach((code, district) => { this.margins[district] = margins.get(code) ?? 0; });
    const ranked = Array.from({ length: SEATS }, (_, district) => district).sort((a, b) => this.margins[b] - this.margins[a]);
    ranked.forEach((district, position) => { this.rank[district] = position; this.byRank[position] = district; });
    this.hasData = true;
    if (first && !this.reduced) {
      // Polls close in the East first: colour sweeps from right to left across the map.
      const base = Math.max(performance.now(), this.started + 1250);
      for (let index = 0; index < this.n; index += 1) {
        this.revealAt[index] = base + (1 - this.mapX[index] / W) * 950 + this.jitter[index] * 140;
      }
      this.revealEnd = base + 1250;
    } else if (first) this.revealAt.fill(0);
    this.wake();
  }

  private wake() {
    if (this.destroyed || this.frameId || !this.visible) return;
    this.frameId = requestAnimationFrame(this.tick);
  }

  private regionFor(kind: "map" | "chamber"): Region {
    const mobile = this.cssW < 760;
    if (kind === "map") {
      const { top, bottom } = this.mapInsets;
      return { x: 12, y: top, w: this.cssW - 24, h: Math.max(120, this.cssH - top - bottom) };
    }
    if (mobile) return { x: 8, y: this.cssH * .4, w: this.cssW - 16, h: this.cssH * .44 };
    // Leave the caption column on the left and the chapter rail on the right.
    const left = Math.min(this.cssW * .38, 520);
    return { x: left, y: 60, w: this.cssW - left - 150, h: this.cssH - 170 };
  }

  private fit(region: Region): Frame {
    const s = Math.min(region.w / W, region.h / H);
    return { s, ox: region.x + (region.w - W * s) / 2, oy: region.y + (region.h - H * s) / 2 };
  }

  private tick = (now: number) => {
    this.frameId = 0;
    if (this.destroyed) return;
    const animating = this.draw(now);
    if (animating) this.wake();
  };

  private draw(now: number) {
    const { ctx, n } = this;
    const elapsed = Math.max(0, now - this.started);
    if (!this.introDone && this.progress > .06) this.introDone = true;
    const intro = !this.introDone;
    if (intro && elapsed > 2300) this.introDone = true;

    const swingDelta = this.swingTarget - this.swing;
    this.swing = Math.abs(swingDelta) < .01 ? this.swingTarget : this.swing + swingDelta * .1;
    const shift = this.swing * NATIONALIZATION;

    const t1 = easeInOut(range(this.progress, .1, .42));
    const t2 = easeInOut(range(this.progress, .55, .86));
    const mapFrame = this.fit(this.regionFor("map"));
    const chamberFrame = this.fit(this.regionFor("chamber"));
    const lensTarget = this.pointer && !intro ? 1 - range(this.progress, 0, .08) : 0;
    if (this.pointer) this.lensPoint = this.pointer;
    this.lens = Math.abs(lensTarget - this.lens) < .01 ? lensTarget : this.lens + (lensTarget - this.lens) * .22;

    for (let district = 0; district < SEATS; district += 1) this.bucketOf[district] = colorBucket(this.margins[district] + shift);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (intro && elapsed < 2100) {
      // Motion trails during the burst: fade the previous frame instead of clearing it.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,.26)";
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      ctx.globalCompositeOperation = "source-over";
    } else ctx.clearRect(0, 0, this.cssW, this.cssH);

    const centerX = mapFrame.ox + W / 2 * mapFrame.s;
    const centerY = mapFrame.oy + H / 2 * mapFrame.s;
    if (intro && elapsed < 900) this.drawShockwave(centerX, centerY, elapsed);

    let moving = intro || t1 * (1 - t1) > 0 || t2 * (1 - t2) > 0 || this.swing !== this.swingTarget || this.lens !== lensTarget;
    const mapSize = dotsData.step * .56 * mapFrame.s;
    const seatSize = this.seatDot * chamberFrame.s;
    const ladderSize = Math.max(1.6, 3.1 * chamberFrame.s);

    for (let index = 0; index < n; index += 1) {
      const district = this.owner[index];
      const rank = this.rank[district];
      const lead = this.leader[index] === 1;
      const margin = this.margins[district] + shift;
      // Stagger the morph by seat rank so the chamber fills left to right.
      const wave = rank / SEATS * .55 + this.jitter[index] * .12;
      const e1 = easeInOut(clamp01(t1 * 1.67 - wave));
      const e2 = easeInOut(clamp01(t2 * 1.67 - wave));

      let x = mapFrame.ox + this.mapX[index] * mapFrame.s;
      let y = mapFrame.oy + this.mapY[index] * mapFrame.s;
      let size = mapSize;
      let alpha = 1;

      if (intro) {
        const local = clamp01((elapsed - this.burstDelay[index]) / 1050);
        if (local <= 0) { this.drawA[index] = 0; this.keys[index] = 0; continue; }
        const u = easeOutQuart(local);
        const cx = centerX + this.ctrlX[index] * mapFrame.s;
        const cy = centerY + this.ctrlY[index] * mapFrame.s;
        x = (1 - u) * (1 - u) * centerX + 2 * (1 - u) * u * cx + u * u * x;
        y = (1 - u) * (1 - u) * centerY + 2 * (1 - u) * u * cy + u * u * y;
        alpha = Math.min(1, local * 3);
      }

      if (this.lens > 0) {
        const distance = Math.hypot(x - this.lensPoint.x, y - this.lensPoint.y);
        if (distance < 70) size *= 1 + (1 - distance / 70) ** 2 * .75 * this.lens;
      }

      if (e1 > 0) {
        const seat = rank;
        const hx = chamberFrame.ox + this.seatX[seat] * chamberFrame.s;
        const hy = chamberFrame.oy + this.seatY[seat] * chamberFrame.s;
        let tx = hx;
        let ty = hy;
        let targetSize = seatSize;
        if (e2 > 0) {
          const lx = chamberFrame.ox + (40 + rank / (SEATS - 1) * 920) * chamberFrame.s;
          const ly = chamberFrame.oy + ladderY(margin) * chamberFrame.s;
          tx = hx + (lx - hx) * e2;
          ty = hy + (ly - hy) * e2;
          targetSize = seatSize + (ladderSize - seatSize) * e2;
        }
        x += (tx - x) * e1;
        y += (ty - y) * e1;
        size += (targetSize - size) * e1;
        if (!lead) alpha *= 1 - e1;
      }

      this.drawX[index] = x;
      this.drawY[index] = y;
      this.drawA[index] = alpha;
      const revealed = now >= this.revealAt[index];
      const bucket = !revealed ? 0 : now - this.revealAt[index] < 240 ? 1 : this.bucketOf[district];
      if (revealed && now - this.revealAt[index] < 240) moving = true;
      this.keys[index] = bucket * ALPHA_LEVELS + Math.round(alpha * (ALPHA_LEVELS - 1));
      this.sizes[index] = size;
    }
    if (now < this.revealEnd) moving = true;

    this.paintBuckets();
    this.paintGuides(chamberFrame, t1, t2, shift);
    this.updateHover(t1);
    return moving && this.visible;
  }

  private paintBuckets() {
    const { ctx, n, keys, order } = this;
    const bucketCount = PALETTE.length * ALPHA_LEVELS;
    const counts = new Uint32Array(bucketCount + 1);
    for (let index = 0; index < n; index += 1) counts[keys[index] + 1] += 1;
    for (let bucket = 0; bucket < bucketCount; bucket += 1) counts[bucket + 1] += counts[bucket];
    const cursor = counts.slice();
    for (let index = 0; index < n; index += 1) order[cursor[keys[index]]++] = index;

    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const start = counts[bucket];
      const end = counts[bucket + 1];
      if (start === end) continue;
      const alpha = (bucket % ALPHA_LEVELS) / (ALPHA_LEVELS - 1);
      if (alpha <= 0) continue;
      const color = Math.floor(bucket / ALPHA_LEVELS);
      ctx.globalAlpha = color === 0 ? alpha * .5 : alpha;
      ctx.fillStyle = PALETTE[color];
      ctx.beginPath();
      for (let slot = start; slot < end; slot += 1) {
        const index = order[slot];
        const size = this.sizes[index];
        const x = this.drawX[index];
        const y = this.drawY[index];
        if (size >= 2.4) { ctx.moveTo(x + size, y); ctx.arc(x, y, size, 0, Math.PI * 2); }
        else ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.hovered >= 0) {
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(160,190,255,.9)";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let index = 0; index < n; index += 1) {
        if (this.owner[index] !== this.hovered || this.drawA[index] < .3) continue;
        const size = this.sizes[index] * 1.15;
        ctx.moveTo(this.drawX[index] + size, this.drawY[index]);
        ctx.arc(this.drawX[index], this.drawY[index], size, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  private paintGuides(frame: Frame, t1: number, t2: number, shift: number) {
    const { ctx } = this;
    const px = (value: number) => frame.ox + value * frame.s;
    const py = (value: number) => frame.oy + value * frame.s;
    ctx.font = `500 11px ${this.monoFont}`;
    ctx.lineWidth = 1;

    const chamberAlpha = t1 * (1 - t2);
    if (chamberAlpha > .01) {
      ctx.globalAlpha = chamberAlpha * .7;
      ctx.strokeStyle = "#fff";
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(px(W / 2), py(575)); ctx.lineTo(px(W / 2), py(560 - 470 - 26)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#9a9ea8";
      ctx.textAlign = "center";
      ctx.fillText("218 FOR MAJORITY", px(W / 2), py(560 - 470 - 34));
    }

    if (t2 > .01) {
      const tipping = this.byRank[MAJORITY_RANK];
      const margin = this.margins[tipping] + shift;
      const x = px(40 + MAJORITY_RANK / (SEATS - 1) * 920);
      const y = py(ladderY(margin));
      ctx.globalAlpha = t2 * .45;
      ctx.strokeStyle = "#fff";
      ctx.beginPath(); ctx.moveTo(px(20), py(310)); ctx.lineTo(px(980), py(310)); ctx.stroke();
      ctx.fillStyle = "#8b8f99";
      ctx.textAlign = "left";
      ctx.fillText("EVEN", px(22), py(302));
      ctx.globalAlpha = t2 * .18;
      ctx.setLineDash([2, 6]);
      for (const guide of [-20, -5, 5, 20]) { ctx.beginPath(); ctx.moveTo(px(20), py(ladderY(guide))); ctx.lineTo(px(980), py(ladderY(guide))); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.globalAlpha = t2 * .45;
      for (const guide of [-20, -5, 5, 20]) ctx.fillText(`${guide > 0 ? "D" : "R"}+${Math.abs(guide)}`, px(22), py(ladderY(guide)) - 6);
      ctx.textAlign = "right";
      ctx.fillText("SAFER D ↑", px(980), py(40));
      ctx.textAlign = "left";
      ctx.fillText("SAFER R ↓", px(22), py(592));
      ctx.globalAlpha = t2 * .8;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(x, py(20)); ctx.lineTo(x, py(600)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = t2;
      ctx.strokeStyle = margin >= 0 ? "#9fb8ff" : "#ff9eaa";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 9 + Math.sin(performance.now() / 260) * 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = "#fff";
      ctx.textAlign = x > this.cssW * .7 ? "right" : "left";
      ctx.fillText(`218TH SEAT · ${this.codes[tipping]}`, x + (ctx.textAlign === "right" ? -16 : 16), y - 14);
    }
    ctx.globalAlpha = 1;
    // The tipping-point ring breathes while the ladder is on screen.
    if (t2 > .5 && this.visible) this.wakeSoon();
  }

  private wakeSoon() {
    if (this.wakeTimer) return;
    this.wakeTimer = window.setTimeout(() => { this.wakeTimer = 0; this.wake(); }, 32);
  }

  private updateHover(t1: number) {
    const pointer = this.pointer;
    let found = -1;
    if (pointer) {
      let best = (t1 > .5 ? 14 : 10) ** 2;
      for (let index = 0; index < this.n; index += 1) {
        if (this.drawA[index] < .5) continue;
        const distance = (this.drawX[index] - pointer.x) ** 2 + (this.drawY[index] - pointer.y) ** 2;
        if (distance < best) { best = distance; found = this.owner[index]; }
      }
    }
    if (found !== this.hovered) {
      this.hovered = found;
      this.wake();
    }
    this.onHover(found >= 0 && pointer ? { code: this.codes[found], x: pointer.x, y: pointer.y } : null);
  }

  private drawShockwave(x: number, y: number, elapsed: number) {
    const { ctx } = this;
    const progress = elapsed / 900;
    const radius = easeOutQuart(progress) * Math.max(this.cssW, this.cssH) * .75;
    ctx.globalAlpha = (1 - progress) * .55;
    ctx.strokeStyle = "#b9ccff";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke();
    const core = ctx.createRadialGradient(x, y, 0, x, y, 70);
    core.addColorStop(0, `rgba(255,255,255,${(1 - progress) * .9})`);
    core.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = core;
    ctx.fillRect(x - 70, y - 70, 140, 140);
  }
}

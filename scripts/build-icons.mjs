// Builds the app icons from the Midterm Pulse mark: src/app/icon.svg, favicon.ico and apple-icon.png.
// The mark is a pulse trace drawn as an "M": Democratic blue on the left, Republican red on the right,
// meeting at a white tipping-point dot. Keep the geometry in sync with src/components/brand-mark.tsx.
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const BLUE = "#5b86ff";
const RED = "#ff5a6e";
const INK = "#06070b";

// `bleed` fills the whole square (iOS rounds the corners itself); otherwise a rounded tile.
function markSvg({ bleed = false, stroke = 5.5, dot = 4.6, glow = true } = {}) {
  const tile = bleed
    ? `<rect width="64" height="64" fill="${INK}"/>`
    : `<rect width="64" height="64" rx="14" fill="${INK}"/><rect x=".75" y=".75" width="62.5" height="62.5" rx="13.25" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1.5"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="split" gradientUnits="userSpaceOnUse" x1="7" y1="0" x2="57" y2="0">
      <stop offset=".4" stop-color="${BLUE}"/><stop offset=".6" stop-color="${RED}"/>
    </linearGradient>
    <radialGradient id="glow" cx="32" cy="37" r="20" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#a78bfa" stop-opacity=".32"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${tile}
  ${glow ? `<circle cx="32" cy="37" r="20" fill="url(#glow)"/>` : ""}
  <path d="M7 43H16L23.5 17L32 37L40.5 17L48 43H57" fill="none" stroke="url(#split)" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="32" cy="37" r="${dot}" fill="#fff"/>
</svg>
`;
}

const png = (svg, size) => sharp(Buffer.from(svg), { density: 72 * size / 64 * 4 }).resize(size, size).png().toBuffer();

// ICO container holding PNG frames (supported by every current browser).
function ico(frames) {
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, data }, index) => {
    const entry = 6 + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...frames.map((frame) => frame.data)]);
}

const icon = markSvg();
// At 16 px the stroke and dot are thickened and the glow dropped so the trace survives the downsample.
const small = markSvg({ stroke: 7, dot: 4.8, glow: false });
writeFileSync("src/app/icon.svg", icon);
writeFileSync("src/app/favicon.ico", ico([
  { size: 16, data: await png(small, 16) },
  { size: 32, data: await png(icon, 32) },
  { size: 48, data: await png(icon, 48) },
]));
writeFileSync("src/app/apple-icon.png", await png(markSvg({ bleed: true }), 180));
console.log("Wrote src/app/icon.svg, src/app/favicon.ico, src/app/apple-icon.png");

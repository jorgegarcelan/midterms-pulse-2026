# Midterm Pulse 2026 brand system

## Idea

**Election intelligence with a pulse.** The identity combines the restraint of a serious election desk with the immediacy of a live signal monitor. It is intentionally related to the visual language of the earlier County by County project without copying its wordmark.

## Logo system

The mark is a **pulse trace drawn as an "M"**: a flat baseline that spikes twice, Democratic blue on the left and Republican red on the right, meeting at a white **tipping-point dot** in the middle valley. One stroke carries the three ideas of the site: Midterm, pulse and a divided chamber decided at the margin.

- **Wordmark:** "Midterm Pulse" set in Geist, followed by a mono "2026" tag. It is typeset live in the interface, never rasterised.
- **Header mark** (`src/components/brand-mark.tsx`): the trace draws on at load, then a white spark runs along the "M" every few seconds. The dot beats and ripples as the spark passes it. Hovering the logo speeds the cycle up. With reduced motion, the mark stays static.
- **App icons:** the mark sits on a dark rounded tile. `npm run brand:icons` (`scripts/build-icons.mjs`) writes `src/app/icon.svg`, `src/app/favicon.ico` (16/32/48 px) and `src/app/apple-icon.png` (180 px). Next.js picks these up through its file conventions. The 16 px frame uses a heavier stroke and no glow, so the trace stays legible. Keep the geometry in the script and in the component in sync.

The generated hero artwork in `public/brand/midterm-pulse-signal.png` extends the pulse into a waveform, U.S. outline and data bars. It contains no text, so it stays reusable and accessible behind HTML copy.

## Palette

| Token | Hex | Use |
|---|---:|---|
| Ink | `#0b0d0f` | Page background |
| Carbon | `#13171d` | Panels |
| Ivory | `#f1ede4` | Primary text |
| Muted | `#9299a6` | Secondary text |
| Signal blue | `#4d7fe1` | Democratic data |
| Signal red | `#e0525d` | Republican data |
| Live green | `#63d69b` | Freshness / system status |

## Typography

- **Editorial display:** Georgia, Times New Roman, serif. Used for headlines, probabilities and narrative data callouts.
- **Interface:** Arial, Helvetica, sans-serif. Used for navigation, controls, tables and metadata.
- **Data labels:** the interface stack in uppercase with generous tracking.

The system-font approach removes font-loading latency and keeps Vercel previews deterministic.

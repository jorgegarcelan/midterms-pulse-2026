# Midterm Pulse 2026 brand system

## Idea

**Election intelligence with a pulse.** The identity combines the restraint of a serious election desk with the immediacy of a live signal monitor. It is intentionally related to the visual language of the earlier County by County project without copying its wordmark.

## Logo system

The primary wordmark is typeset in the interface: **Midterm Pulse 2026**. The mark combines two party-color dots with a short neutral pulse line. It works at favicon and navigation scale without relying on AI-rendered lettering.

The generated hero artwork in `public/brand/midterm-pulse-signal.png` extends the mark into a waveform, U.S. outline and data bars. It contains no text so it remains reusable and accessible behind HTML copy.

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

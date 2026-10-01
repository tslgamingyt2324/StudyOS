# StudyOS brand

## The idea
A solid **circle** (the *O*) with two pill-shaped **slots** cut in from opposite sides. The material that is
left snakes through the circle as an **S** — the S exists only as negative space, and the silhouette stays a
perfect circle. One symbol spells **OS**; the circle is also focus and completeness. The slots are tilted 10°
upward: forward motion, progress.

Why it works: recognisable as a silhouette, still an S at 16 px and in greyscale, and it needs no text.

## Construction (1024-unit grid, centre 512,512)
| Part | Value |
|---|---|
| Disc radius | 310 (diameter ≈ 60 % of the tile) |
| Slot thickness | 64, round-ended |
| Slot offset from centre | ±114 (top slot enters from the right, bottom from the left) |
| Strip thickness | ≈164 (top / spine / bottom), connectors 150 |
| Tilt | −10° |
| Favicon cut (16–48 px) | R 372, slot 88, offset ±138 — optically heavier so it survives tiny sizes |

The mark is emitted as **one closed path** (no masks or holes), so the slots are truly transparent: it works as a
favicon, an Android notification badge, an embossed/mono print mark, etc.

## Colour
| Token | Hex | Use |
|---|---|---|
| StudyOS Blue | `#2E6CFF` | brightest point of the tile gradient |
| Deep Blue | `#1B3FB4` | gradient midpoint |
| Midnight | `#0A1236` | gradient end; also the mark in 1-colour use on light backgrounds |
| Ice | `#FFFFFF → #CCDEFF` | the disc (top → bottom) |

The tile gradient (top-left → bottom-right) is the app's own accent blue (`--accent`, `#0A6CE0`) deepening into
midnight, so the icon and the interface read as one product. The app UI colours were intentionally **not** changed.

## Wordmark
"StudyOS" set in Inter SemiBold (SIL OFL, included in `scripts/brand/fonts`), kerned with HarfBuzz and converted
to outlines (tracking −1.2 %). Lockup: mark diameter = 1.55 × cap height, gap = 0.55 × cap height, mark centred
on the capitals.

## Files
| File | Purpose |
|---|---|
| `public/icon-192.png`, `icon-512.png` | PWA icons (`any`) |
| `public/icon-maskable-192.png`, `icon-maskable-512.png` | PWA maskable (full-bleed, mark inside the 80 % safe circle) |
| `public/apple-touch-icon.png` | iOS Home Screen (180 px, opaque — iOS applies its own mask) |
| `public/favicon.ico`, `favicon-16/32.png`, `icon.svg` | browser tab |
| `public/badge-96.png` | Android notification badge (white mark, transparent slots) |
| `public/brand/app-icon.svg`, `app-icon-1024.png` | master app icon |
| `public/brand/mark*.svg` | bare symbol: `currentColor`, black, white |
| `public/brand/wordmark.svg`, `logo.svg` | wordmark and horizontal lockup (`currentColor`) |
| `src/components/brand/Logo.tsx` | `<Logo />`, `<AppIcon />`, `<LogoMark />`, `<Wordmark />` |
| `src/components/brand/paths.ts` | **generated** path data used by the components |

## Usage
- Clear space around the mark/lockup: at least half the disc radius.
- Minimum size: 16 px (use `favicon-*`/`icon.svg` below 48 px); lockup no smaller than 80 px wide.
- On photos or busy backgrounds use the white or black mark, never the gradient tile.
- Don't rotate, outline, recolour the gradient, add effects, or re-draw the slots.

## Regenerating
Everything above is generated from one script — edit geometry/colours there, never the outputs.

```bash
pip install -r scripts/brand/requirements.txt
python3 scripts/brand/build_brand.py      # from the project root
```

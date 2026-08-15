# DressPTL

Match clothing, jewelry, shoes, watches, socks, and hair color to your skin tone.

Upload a photo (analyzed entirely client-side, never uploaded anywhere) or
pick your tone from a swatch grid. DressPTL classifies your skin into a
**depth** (fair → deep) and **undertone** (warm / cool / neutral) using
CIE Lab color space, then recommends a full look pulled from a seed catalog
of clothing lines.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript
- Tailwind CSS v4
- No backend/database — skin tone analysis runs in the browser via `<canvas>`;
  the outfit catalog is static seed data in `src/lib/catalog.ts`

## How it works

- `src/lib/color.ts` — sRGB → XYZ → Lab conversion, depth (ITA°) and
  undertone classification
- `src/lib/photoAnalysis.ts` — samples skin-colored pixels from an uploaded
  photo using a YCbCr skin-detection rule
- `src/lib/catalog.ts` — seed catalog of items tagged by undertone fit and
  intensity (soft/medium/bold)
- `src/lib/matcher.ts` — scores catalog items per category and picks the
  best match + alternates for a given depth/undertone
- `src/components/AnalyzeFlow.tsx` — the upload/pick/results flow

## Development

```bash
npm install
npm run dev
```

## Roadmap

- Native mobile app (React Native), sharing the color-matching and catalog
  logic from `src/lib/`
- Real product data instead of seed catalog
- Face-shape-aware hairstyle recommendations (currently hair suggestions are
  color-only, matched to undertone)

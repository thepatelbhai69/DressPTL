# DressPTL — AI Dresser App: Plan and As-Built Notes

> **Status: implemented.** This document was written as a pre-implementation
> plan. It has since been updated to record the five design decisions that
> changed during the build, so it describes what actually exists rather than
> what was originally proposed. See "Corrections made during implementation".

## Context

DressPTL started as an empty repo. The goal: a user uploads photos of
themselves wearing outfits they love, a Mistral vision model analyses those
photos, and the app learns their favourite colour combinations to generate
personalised outfit recommendations — factoring in body proportions and
user-entered height.

Two decisions shaped this from the start:

1. **Sensitive attributes.** The original idea included inferring "nativity"
   (ethnicity) from photos. This was deliberately **dropped**. Inferring
   race/ethnicity from an image is protected-class classification with real
   bias, fairness, and biometric-privacy-law exposure for very little product
   value. Instead the app derives **skin undertone (warm/cool/neutral)** — the
   same technique fashion "colour season" tools use — which is what colour
   matching actually needs, without inferring or storing ethnicity.
2. **Key isolation.** The Mistral API key must never reach the client. A
   dedicated Worker holds the key and is the only thing that talks to Mistral.

## Corrections made during implementation

These are the plan's original claims that turned out to be wrong, and what
replaced them.

| # | Original plan | Problem | As built |
|---|---------------|---------|----------|
| 1 | Next.js on **Cloudflare Pages** via `@cloudflare/next-on-pages` | Superseded — Cloudflare's current guidance is Workers + the OpenNext adapter | Next.js 15 on **Workers** via `@opennextjs/cloudflare` |
| 2 | Photos served via **R2 presigned URLs** | Presigned URLs need S3 API credentials; a Worker with an R2 *binding* has none | Authenticated route streams from the binding — stricter, since every request is authorised and no URL keeps working once shared |
| 3 | **Auth.js (NextAuth v5)** + D1 adapter, "sessions in KV" | Internally contradictory: NextAuth's Credentials provider forces JWT sessions, so DB/KV sessions can't work as described; beta-on-workerd is fragile | Hand-rolled PBKDF2 (Web Crypto) + session table in D1, ~100 lines, fully edge-native and unit-tested |
| 4 | Hardcoded model IDs | Mistral's lineup moves fast (Medium 3.5, Large 3 shipped in 2026) | Model IDs are env-configurable with known-good defaults |
| 5 | **Drizzle ORM**; KV for sessions | Extra build machinery for marginal benefit at this schema size; KV sessions can't be enumerated for cascade delete | Plain SQL migrations + typed query layer; sessions in D1; KV reserved for rate limiting, where TTL genuinely helps |

## Architecture

```
apps/web/              Next.js 15 App Router on Workers (OpenNext)
workers/mistral-proxy/ Worker holding MISTRAL_API_KEY — workers_dev = false, no route
packages/shared/       Colour science, profile aggregation, Zod contracts, prompts
```

- **D1** — users, sessions, photos, analyses, style profiles, recommendations
- **R2** — private photo storage, served only through an authenticated route
- **KV** — per-user rate-limit counters on the proxy
- **Service binding** `web → mistral-proxy` — the proxy has no public URL at
  all, so the key has no internet-facing surface; a shared-secret header guards
  the binding as defence in depth

The proxy never touches R2 or D1. It takes bytes, returns validated JSON. A
compromise there exposes the key's blast radius, not user data.

## Colour learning (the actual product IP)

In `packages/shared`:

- Conversions sRGB → linear → CIEXYZ → **CIELAB**, because perceptual distance
  is what makes colour-family bucketing behave like a human would answer it.
  Naive RGB distance collapses navy into black.
- ~35 curated wardrobe colours ("camel", "burgundy") as the naming buckets.
- `buildStyleProfile` accumulates colour weight by prominence with **recency
  half-life** weighting, so recent uploads steer recommendations more.
- **Blend detection** — unordered pairs of leading colours within each outfit,
  accumulated across uploads. This is the "favourite colour blends" claim, and
  it is tracked separately from raw colour frequency.
- `describeHarmony` classifies pairs with stylist vocabulary (complementary,
  analogous, neutral-anchored…).
- `suggestPaletteAdditions` ranks unworn colours by harmony with existing
  favourites and undertone fit. Runs without the LLM, and doubles as the
  fallback when the model is unavailable.

## Privacy enforcement

Not just intent — four mechanisms:

1. Prompts explicitly forbid inferring ethnicity, race, nationality, age,
   gender, religion, disability.
2. Zod schemas are `.strict()` — unexpected keys fail the parse.
3. `assertNoSensitiveFields` deep-scans model output for protected-attribute
   keys (with spelling normalisation) and fails closed with a **422** before
   anything is persisted.
4. No column exists for any of it.

Plus: explicit consent before first upload, private R2, authenticated image
delivery, and account deletion that removes R2 objects and every row.

## Verification performed

- **79 unit tests passing** — colour conversion round-trips, LAB bucketing,
  harmony classification, profile aggregation and recency weighting, malformed
  model input, Zod contract enforcement, proxy routing/authz/rate limiting,
  retry-on-invalid-JSON, sensitive-field rejection, PBKDF2 hash/verify, and
  multi-megabyte base64 encoding.
- **Typecheck clean** across all three packages.
- **`next build` succeeds** — 17 routes, authenticated pages correctly dynamic.
- **`opennextjs-cloudflare build` succeeds** — produces `.open-next/worker.js`.
- **Secret scan clean** — no key material in shipped output; the only
  "Mistral" string in client bundles is the consent copy.

**Not verified:** a live end-to-end run against the real Mistral API, which
needs a paid key and provisioned Cloudflare resources. `MISTRAL_STUB=1` exists
so the full flow can be exercised without one. The image payload shape
(`image_url` as `{url}`) follows the OpenAI-compatible form Mistral accepts;
confirm against a live call on first deploy.

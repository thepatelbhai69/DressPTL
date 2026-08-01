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
| 6 | **Direct Mistral API with a secret key** | An API key is a liability you have to keep managing; Workers AI hosts a vision-capable Mistral model behind an account-scoped binding | **Workers AI is the default** (`@cf/mistralai/mistral-small-3.1-24b-instruct`) — *no key exists in the system*. The direct API remains a one-variable switch for larger models |

### Inference providers

`AI_PROVIDER` selects the backend behind one `AiProvider` interface:

- **`workers-ai` (default)** — `@cf/mistralai/mistral-small-3.1-24b-instruct`
  via the `AI` binding. Vision-capable and 128k context, so a single model
  serves both photo analysis and outfit generation. No credentials at all;
  runs inside Workers AI's free daily allocation. Uses **constrained decoding**
  (`response_format: json_schema`), which cuts the corrective-retry rate versus
  merely asking for JSON.
- **`mistral-api`** — Pixtral Large / Mistral Large on `api.mistral.ai`,
  needing `MISTRAL_API_KEY` as a Worker secret.

Providers deliberately return *raw* JSON. The privacy guardrail inspects model
output **before** Zod coerces it into our types — enforcement has to see what
the model actually said, not a cleaned-up version of it.

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

## Provisioned resources

| Resource | Name | ID | State |
|---|---|---|---|
| D1 | `dressptl` | `4105c84b-5cf8-4361-81b8-d6e8f2a1e349` | Created; schema applied and verified (6 tables, 5 indexes) |
| KV | `dressptl-rate-limit` | `2a71eb53a6354eafa214c71c6e21368a` | Created |
| R2 | `dressptl-photos` | ENAM / Standard | Created and verified |

All IDs are committed in the `wrangler.toml` files. R2 needed a one-time
dashboard enablement first — it is gated behind a billing-profile
confirmation, so no API path exists for that step.

## Verification performed

- **89 unit tests passing** — colour conversion round-trips, LAB bucketing,
  harmony classification, profile aggregation and recency weighting, malformed
  model input, Zod contract enforcement, proxy routing/authz/rate limiting,
  provider selection, Workers AI payload handling (object vs JSON string vs
  fenced), quota→429 mapping, corrective-retry behaviour, sensitive-field
  fail-closed, PBKDF2 hash/verify, and multi-megabyte base64 encoding.
- **Typecheck clean** across all three packages.
- **`next build` succeeds** — 17 routes, authenticated pages correctly dynamic.
- **`opennextjs-cloudflare build` succeeds** — produces `.open-next/worker.js`.
- **D1 schema verified live** through the Cloudflare API.
- **Secret scan clean** — no credential material in shipped output; the only
  "Mistral" string in client bundles is the consent copy.

**Not verified:** a live inference call. The test suite mocks the `AI`
binding, so it cannot confirm that Workers AI accepts our multimodal payload
shape (OpenAI-style `image_url` content parts) for Mistral Small 3.1.

`scripts/verify-inference.mjs` closes that gap without a deploy: it hits the
Workers AI REST API with an inline-generated solid-navy PNG and asks the model
to name the colour, which separates "payload accepted" from "model actually
saw the image". Run it before deploying, and again after changing
`WORKERS_AI_MODEL`.

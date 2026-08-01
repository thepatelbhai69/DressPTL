# DressPTL — AI Dresser App: Implementation Plan

## Context

DressPTL is currently an empty repo (just a placeholder README). The goal is an
app where a user uploads photos of themselves wearing outfits they love. A
Mistral vision model analyzes those photos to learn the user's favorite color
combinations and, over time, generate personalized outfit/color
recommendations — also factoring in body proportions and user-entered height.

Two decisions shape this plan, made with the user before writing it:

1. **Sensitive attributes**: the original idea included inferring "nativity"
   (ethnicity) from photos to drive recommendations. This was deliberately
   **dropped**. Inferring race/ethnicity from an image is a protected-class
   classification with real bias, fairness, and biometric-privacy-law exposure
   for very little product value. Instead, the app derives **skin
   undertone (warm/cool/neutral)** from visible skin pixels — the same
   technique fashion "color season" tools use — which is enough to drive
   color recommendations without ever inferring or storing ethnicity/race.
2. **Key isolation**: the Mistral API key must never reach the client. A
   dedicated Cloudflare Worker holds the key as a secret and is the only
   thing that talks to the Mistral API. The Next.js app talks to that Worker
   over a Service Binding (same-account, no public network hop, no CORS
   surface, no way for the key to leak into a browser bundle).

## Architecture

**Monorepo (pnpm workspaces)**, everything deployed on Cloudflare:

```
apps/
  web/            Next.js 14 (App Router) on Cloudflare Pages (@cloudflare/next-on-pages)
  mistral-proxy/  Cloudflare Worker — holds MISTRAL_API_KEY, only thing that calls Mistral
packages/
  db/             Drizzle ORM schema + migrations for D1
  shared/         Zod schemas shared between web and worker (API contracts)
```

**Cloudflare resources**:
- **D1** — relational data (users, photos, analyses, style profiles, recommendations)
- **R2** — private bucket for uploaded photos, accessed via signed URLs, never public
- **KV** — session tokens + a per-user request counter for basic rate limiting on the Mistral proxy
- **Service Binding** — `web` → `mistral-proxy`, so the proxy is unreachable from the public internet at all; it's only invokable from the web app's own Worker runtime

**Why this shape**: it fulfills "the key is never exposed" literally (not just
"hidden in an env var the client can't see," but structurally unreachable
except through the web app's server-side code), keeps everything in one
vendor/bill as requested, and matches Next.js-on-Pages' Workers runtime so no
separate hosting is needed for the frontend.

## Mistral integration (in `apps/mistral-proxy`)

Two endpoints, both callable only via the service binding:
- `POST /analyze-photo` — takes photo bytes (base64) + mime type. Calls a
  Pixtral vision model (`pixtral-large-latest`) with a strict prompt and
  `response_format: {type: "json_object"}` requesting: detected garments,
  dominant colors (hex + name), a color-harmony description, skin undertone
  (warm/cool/neutral, from visible skin only — the prompt explicitly forbids
  guessing ethnicity/age/gender), and a rough body-silhouette category.
  Returns validated JSON (parsed against a Zod schema from `packages/shared`;
  reject/retry once on schema mismatch).
- `POST /generate-recommendations` — takes the user's aggregated style
  profile (palette + tags + height + silhouette category) and calls a text
  model (`mistral-large-latest`) to produce 3-5 structured outfit
  suggestions (garment types, color combo, silhouette guidance, one-line
  rationale).

The web app fetches photo bytes from R2 itself and passes them to the proxy
in the service-binding request — the proxy never touches R2 or D1 directly,
keeping its blast radius limited to "talks to Mistral."

## Data model (D1, via Drizzle — `packages/db`)

```
users(id, email, password_hash, name, height_cm, created_at)
photos(id, user_id, r2_key, status, uploaded_at)
photo_analyses(id, photo_id, garments_json, colors_json, skin_undertone,
                body_silhouette, raw_model_output_json, created_at)
style_profiles(id, user_id, favorite_palette_json, style_tags_json, updated_at)
recommendations(id, user_id, content_json, created_at)
```

`style_profiles` is recomputed after each new `photo_analyses` row: cluster
the accumulated hex colors (simple nearest-neighbor bucketing into a
human-readable palette, no ML needed) and take frequency-ranked style tags.

## Auth

Auth.js (NextAuth v5) with a D1/Drizzle adapter. Use **Web Crypto PBKDF2**
for password hashing (edge-runtime compatible — `bcrypt` needs native
bindings Workers don't have). Google OAuth as an optional second provider to
sidestep password UX entirely for users who want it. Session tokens in KV.

## Frontend pages (Next.js App Router)

- `/signup`, `/login`
- `/onboarding` — enter height, consent checkbox (explicitly states photos
  are analyzed by an AI model), first photo upload
- `/upload` — add more outfit photos, shows per-photo analysis once ready
- `/profile` — style profile dashboard: learned color palette swatches,
  style tags, thumbnail history of analyzed photos
- `/recommendations` — generated outfit suggestions with a "regenerate" action

## Privacy & security (must-implement, not optional)

- R2 bucket is private; all photo access goes through short-lived signed URLs scoped to the owning user
- No ethnicity/race field anywhere in the schema or prompts — enforced by the Zod response schema rejecting extra/unexpected fields
- Explicit consent copy before the first upload
- Account deletion cascades: delete D1 rows + R2 objects for that user
- Rate limit `mistral-proxy` per user (KV counter) to bound API cost/abuse
- `MISTRAL_API_KEY` set via `wrangler secret put`, never committed, never in any client bundle — verify by grepping the built `apps/web` output for the key prefix as a CI check

## Build order for the implementing session

1. Scaffold monorepo (pnpm workspaces, `wrangler.toml` for both `web` and `mistral-proxy`, Drizzle config)
2. D1 schema + migrations, R2 bucket, KV namespace — provision via `wrangler.toml` bindings
3. Auth (signup/login/session) + base layout/nav
4. `mistral-proxy` Worker: both endpoints, Zod-validated I/O, service binding wired into `web`
5. Photo upload flow: client → R2 → invoke `/analyze-photo` → persist `photo_analyses` → recompute `style_profiles`
6. Profile dashboard UI (palette + tags + history)
7. Recommendation generation flow + `/recommendations` UI
8. Onboarding polish (height input, consent, empty/loading/error states)
9. Deploy docs: `wrangler pages deploy` for web, `wrangler deploy` for the proxy, secret provisioning steps in README

## Verification

- Local dev: `wrangler pages dev` + `wrangler dev` for the proxy, `.dev.vars` for a local `MISTRAL_API_KEY`, `--local` D1/R2 emulation
- Manual end-to-end pass (must actually run in a browser before calling this done, not just type-check): signup → onboarding (enter height, consent, first photo) → upload 2-3 more outfit photos → confirm each gets an analysis and the profile palette updates → generate recommendations and sanity-check the output → delete account → confirm R2/D1 rows are gone
- Confirm via the built Pages output (or a quick `grep` of the deployed bundle) that no Mistral key or raw API traffic is reachable from the client

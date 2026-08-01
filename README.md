# DressPTL

An AI dresser. Upload photos of outfits you like wearing; DressPTL learns the
colours and — more usefully — the *colour pairings* you actually reach for, and
recommends new looks built on them.

## How it works

1. You upload an outfit photo. It goes to a private R2 bucket.
2. The web app reads the image and hands the bytes to a **separate Worker**
   that calls a Mistral vision model. That Worker is the only thing holding the
   API key.
3. The model returns garments, colours with prominence, a skin *undertone*
   (warm/cool/neutral, for colour matching), and a silhouette category.
4. Colours are snapped to a wardrobe palette in CIELAB space, accumulated with
   recency weighting, and co-occurrence within each outfit is tracked to learn
   your favourite blends.
5. Recommendations come from a text model seeded with your learned profile plus
   deterministic palette suggestions — and fall back to those suggestions alone
   if the model is unavailable.

## Architecture

```
apps/web/              Next.js 15 (App Router) on Cloudflare Workers via OpenNext
workers/mistral-proxy/ Worker holding MISTRAL_API_KEY — no public route
packages/shared/       Colour science, profile aggregation, Zod contracts, prompts
```

**Why the key is genuinely not exposed:** the proxy Worker is deployed with
`workers_dev = false` and no route, so it has no public URL at all. The web app
reaches it only through a **service binding**, which is an internal RPC channel
on the same account. Even if someone learns the Worker's name, there is nothing
on the internet to call. A shared-secret header guards the binding itself.

The proxy never touches R2 or D1 — it only takes bytes and returns JSON — so
compromising it exposes the key's blast radius, not user data.

**Storage:** D1 for relational data, R2 (private) for photos, KV for rate-limit
counters. Sessions live in D1 rather than KV so they can be enumerated and
genuinely cascade-deleted when an account is removed.

## Privacy

The app derives skin **undertone** — whether warm, cool, or neutral colours
flatter you — because that is what colour matching actually needs. It does
**not** infer ethnicity, race, nationality, age, or gender. This is enforced,
not just intended:

- The prompts forbid it explicitly.
- Zod schemas are `.strict()`, so unexpected keys fail the parse.
- `assertNoSensitiveFields` deep-scans model output for protected-attribute
  keys and fails closed with a 422 before anything is stored.
- There is no column for any of it in the schema.

Photos are private to the account and served through an authenticated route
(never a public or shareable URL). Account deletion removes R2 objects and
every database row.

## Local development

```bash
pnpm install

# Create the local resources
cd apps/web
npx wrangler d1 create dressptl          # put the id in wrangler.toml
npx wrangler r2 bucket create dressptl-photos
npx wrangler kv namespace create RATE_LIMIT   # put the id in wrangler.toml
pnpm db:migrate:local

# Secrets
cp .dev.vars.example .dev.vars
```

Run the app without a Mistral key by setting `MISTRAL_STUB=1` on the proxy —
it returns deterministic analyses derived from the image bytes, which is enough
to exercise palette learning, blends, and recommendations end to end.

```bash
# Terminal 1 — proxy
cd workers/mistral-proxy && MISTRAL_STUB=1 npx wrangler dev

# Terminal 2 — web app
cd apps/web && pnpm dev
```

## Deploy

```bash
# 1. Proxy first — the web app's service binding depends on it existing.
cd workers/mistral-proxy
npx wrangler secret put MISTRAL_API_KEY
npx wrangler secret put PROXY_SHARED_SECRET
npx wrangler deploy

# 2. Web app
cd ../../apps/web
npx wrangler secret put PROXY_SHARED_SECRET   # same value as above
pnpm db:migrate
pnpm deploy
```

Set `MISTRAL_VISION_MODEL` / `MISTRAL_TEXT_MODEL` in the proxy's `wrangler.toml`
to pin newer models as Mistral's lineup changes.

## Checks

```bash
pnpm test        # 79 unit tests
pnpm typecheck
pnpm build
pnpm check:no-secrets   # fails if an API key reaches shipped output
```

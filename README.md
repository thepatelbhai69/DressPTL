# DressPTL

An AI dresser. Upload photos of outfits you like wearing; DressPTL learns the
colours and — more usefully — the *colour pairings* you actually reach for, and
recommends new looks built on them.

## How it works

1. You upload an outfit photo. It goes to a private R2 bucket.
2. The web app reads the image and hands the bytes to a **separate Worker**
   that runs a Mistral vision model. By default that is **Workers AI**
   (`@cf/mistralai/mistral-small-3.1-24b-instruct`) over Cloudflare's
   account-scoped `AI` binding — so there is **no API key anywhere in the
   system**.
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

### Inference providers

| `AI_PROVIDER` | Backend | Credentials |
|---|---|---|
| `workers-ai` (default) | `@cf/mistralai/mistral-small-3.1-24b-instruct` via the `AI` binding — vision-capable, so one model covers analysis *and* generation | **None.** Account-scoped binding, free daily allocation |
| `mistral-api` | Pixtral Large / Mistral Large on `api.mistral.ai` | `MISTRAL_API_KEY` as a Worker secret |

Start on Workers AI; switch to the direct API only if you need a bigger model.

**Why credentials are genuinely not exposed:** on the default path there is no
key to expose — the `AI` binding is only usable from inside a Worker on the
owning account. On the optional `mistral-api` path, the key lives solely on
this proxy Worker, which deploys with `workers_dev = false` and no route, so it
has no public URL at all; the web app reaches it only through a **service
binding**, an internal RPC channel. A shared-secret header guards that binding.

The proxy never touches R2 or D1 — it only takes bytes and returns JSON — so
compromising it exposes inference, not user data.

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

All three resources are provisioned and their IDs are already recorded in the
`wrangler.toml` files — nothing to edit:

| Resource | Name | ID |
|---|---|---|
| D1 | `dressptl` | `4105c84b-5cf8-4361-81b8-d6e8f2a1e349` (schema applied) |
| KV | `dressptl-rate-limit` | `2a71eb53a6354eafa214c71c6e21368a` |
| R2 | `dressptl-photos` | ENAM, Standard |

```bash
pnpm install
cd apps/web
pnpm db:migrate:local   # local replica of the schema
cp .dev.vars.example .dev.vars
```

Run the whole app with no inference at all by setting `MISTRAL_STUB=1` on the
proxy — it returns deterministic analyses derived from the image bytes, enough
to exercise palette learning, blends, and recommendations end to end.

```bash
# Terminal 1 — proxy
cd workers/mistral-proxy && MISTRAL_STUB=1 npx wrangler dev

# Terminal 2 — web app
cd apps/web && pnpm dev
```

## Deploy

### Why Cloudflare and not GitHub Pages

Pages serves static files only. Every route in this app is server-rendered
(`force-dynamic`) and reaches for D1, R2, KV, and a service binding at request
time — there is no static subset to split out, since even `/` redirects based
on the session cookie. Cloudflare Workers is the only target that can run it,
and it is where the data already lives.

### One-time setup

Worker secrets are set once and persist across deploys, so they stay out of CI:

```bash
npx wrangler login

cd workers/mistral-proxy
npx wrangler secret put PROXY_SHARED_SECRET   # any random string

cd ../../apps/web
npx wrangler secret put PROXY_SHARED_SECRET   # the same value
```

### Automated deploys

`.github/workflows/deploy.yml` deploys both Workers on every push to `main`
(or on demand via *Actions → Deploy to Cloudflare → Run workflow*). It applies
D1 migrations, deploys the proxy, then the web app — in that order, because the
web Worker's service binding needs the proxy to exist.

Add two repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard → Workers & Pages → right sidebar |
| `CLOUDFLARE_API_TOKEN` | My Profile → API Tokens → *Edit Cloudflare Workers* template, plus **D1: Edit** |

### Manual deploy

```bash
# Proxy first — the web app's service binding depends on it existing.
cd workers/mistral-proxy
npx wrangler deploy          # no MISTRAL_API_KEY needed on the default path

cd ../../apps/web
pnpm db:migrate
pnpm run deploy:cf
```

Note `pnpm run deploy:cf`, not `pnpm deploy` — `deploy` is a built-in pnpm
command that silently shadows package scripts of the same name.

To switch to the direct Mistral API later, set `AI_PROVIDER = "mistral-api"` in
the proxy's `wrangler.toml`, run `wrangler secret put MISTRAL_API_KEY`, and
optionally pin `MISTRAL_VISION_MODEL` / `MISTRAL_TEXT_MODEL`. Change
`WORKERS_AI_MODEL` to pin a different Workers AI model.

## Checks

```bash
pnpm test        # 79 unit tests
pnpm typecheck
pnpm build
pnpm check:no-secrets   # fails if an API key reaches shipped output
```

# ARAWAN

A single-owner, mobile-first loan and daily-collection tracker. Nuxt 4 (SPA)
+ Supabase (Postgres, Auth, RLS) + Nitro, deployable to Vercel or any
Node-compatible host.

This build covers the core app: authentication, borrowers/loans, the
payment ledger (with reversals and opening-balance reconciliation),
Overview metrics, and an installable PWA with ARAWAN branding. The Excel
import wizard and Excel export are a deliberate follow-up -- see
"What's not built yet" below.

## Setup

### Local development (default)

Runs entirely against a local Supabase stack (Postgres + Auth + Storage in
Docker) so nothing ever touches production. Requires
[Docker Desktop](https://www.docker.com/products/docker-desktop/) (on
Windows, with WSL2 -- `wsl --install`, reboot, then install Docker Desktop).

```
npm install
cp .env.example .env       # the local-stack section is already filled in
npm run db:start            # boots the local stack (first run pulls images, ~10-20 min)
npm run db:reset             # applies supabase/migrations/*.sql, then supabase/seed.sql
npm run dev
```

`db:reset` provisions the single owner account for you (`supabase/seed.sql`)
-- sign in at `/login` with `owner@arawan.local` / `arawan-local-dev` (both
already in `.env.example`). No dashboard step, no `psql`. Studio (a web UI
for the local DB) is at `http://127.0.0.1:54323`.

`npm run db:stop` shuts the stack down; `npm run db:reset` re-applies
migrations + seed at any point (e.g. after pulling a new migration).

### Hosted project (production)

```
npm install
cp .env.example .env
# uncomment and fill in the "Hosted project" section instead
ARAWAN_ALLOW_PROD=1 npm run db:push   # applies supabase/migrations/*.sql (needs `supabase link` first)
```

`npm run db:push` on its own **refuses to run** -- this repo is linked to
production (`supabase/.temp/linked-project.json`), so
`scripts/guard-remote.mjs` blocks it and every other remote-targeting
Supabase CLI command unless `ARAWAN_ALLOW_PROD=1` is set. That's deliberate,
not a bug.

Then provision exactly one owner account in the Supabase dashboard
(Authentication -> Add user) with public signup left **disabled**, and seed
their `profiles` row:

```
psql "$SUPABASE_DB_URL" -v owner_id="'<the-owner-auth-user-uuid>'" -f supabase/seed-owner.sql
```

```
npm run dev
```

## Production build

The service worker, the pre-boot splash template, and the PWA manifest only
exist in a production build:

```
npm run build
node .output/server/index.mjs
```

## Testing

```
npm run test:e2e
```

Runs against a production build on a fixed port (`scripts/e2e-server.mjs`).
Specs that need a real signed-in owner self-skip if `ARAWAN_OWNER_EMAIL` /
`ARAWAN_OWNER_PASSWORD` aren't set in `.env`, or if sign-in against them
fails -- so this is safe to run before the local stack is up; it just won't
exercise the authenticated flows yet. With `npm run db:start && npm run
db:reset` done first (see "Local development" above), `.env`'s local owner
credentials sign in for real and the full suite runs.

## Regenerating brand assets

`public/icons/`, `public/splash/`, `public/brand/`, and `public/favicon.ico`
are generated from the single source logo, not hand-drawn:

```
node scripts/generate-brand-assets.mjs "path/to/arawan-logo.png"
```

It detects the emblem and wordmark bands in the source image automatically
(no hand-picked crop coordinates), then emits emblem-only app icons and
full-logo (emblem + wordmark) Apple startup images. See the script's header
comment and `docs/workbook-analysis.md`'s sibling note for what's verified
vs. best-effort (Apple startup image dimensions specifically still need
real-device verification).

## What's not built yet

- **Excel import/export** (spec phase 4). `docs/workbook-analysis.md`
  records everything verified about the real source workbook in advance --
  including three corrections to the written spec -- so this doesn't need
  to be re-derived when it's picked up.
- **Editing an unlocked loan's financial terms** through the UI. The server
  already enforces that terms lock once any payment exists
  (`server/api/loans/[id].patch.ts`); only inline borrower-name editing
  ships in the UI this pass.
- **Real-device verification** of the Apple PWA startup images.

## Project docs

- `CLAUDE.md` -- architecture map and conventions, for whoever (human or
  agent) works on this next.
- `docs/workbook-analysis.md` -- verified facts about the source
  `ARAWAN copy.xlsx`, including corrections to the original spec.
- `docs/performance.md` -- the anti-sluggishness architecture and how it's
  verified.

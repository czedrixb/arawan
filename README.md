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

```
npm install
cp .env.example .env   # fill in your Supabase project's URL + anon key
npm run db:push          # applies supabase/migrations/*.sql (needs `supabase link` first)
```

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
fails -- so this is safe to run before a dev Supabase project exists;
it just won't exercise the authenticated flows yet.

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

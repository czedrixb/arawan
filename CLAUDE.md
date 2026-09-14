# ARAWAN

Single-owner loan and daily-collection tracker. Nuxt 4 SPA + Supabase + Nitro.
Full spec: `C:\Users\czedr\Documents\Codex\2026-09-12\referenced-chatgpt-conversation-this-is-an\outputs\ARAWAN-implementation-plan.md`
(referred to below as "the spec"). This build covers spec phases 1, 2, 3, 5,
6 -- the Excel import wizard and exports (phase 4) are a deliberate
follow-up, not yet started.

## Stack and architecture

- **`ssr: false`** (SPA). Nitro exists only to serve `/api/**` and static
  assets -- there is no server-rendered page. See `docs/performance.md` for
  why, and read it before changing anything cache/fetch-related.
- **`@nuxtjs/supabase`**, with the module's own redirect disabled
  (`supabase.redirect: false` in `nuxt.config.ts`) in favor of a hand-rolled
  launch state machine: `app/plugins/auth-ready.client.ts` resolves the
  initial session before the first route middleware runs, and
  `app/middleware/auth.global.ts` + `app/app.vue` + `AppLaunchScreen.vue`
  handle the rest. Don't re-enable the module's redirect without removing
  this machinery first.
- **Tailwind 4** via `@tailwindcss/vite` (not the `@nuxtjs/tailwindcss`
  module). All design tokens live in one `@theme` block:
  `app/assets/css/tokens.css`. Every color/radius/shadow/motion value there
  traces to the spec §4 table -- don't add ad-hoc colors elsewhere.
- **reka-ui**, used only for `Dialog` (via `AppDialog.vue`/`AppSheet.vue`).
  Everything else is hand-rolled. Do not add `@nuxt/ui`.
- **`shared/`** is the Nuxt 4 shared-code directory: `shared/utils/*` and
  `shared/types/*` auto-import into both `app/` and `server/` with zero
  import statements; `shared/schemas/*` needs an explicit `#shared/schemas/...`
  import. Money math, date math, and the loan-summary types live here so the
  client form preview and the server handler can never disagree.
- **Money** is always integer centavos (`shared/utils/money.ts`). Never let
  a float touch a peso amount.
- **Dates** are `YYYY-MM-DD` strings evaluated against Asia/Manila
  (`shared/utils/dates.ts`, `supabase/migrations/0005_loan_summary_view.sql`'s
  `display_status` case). Never use `new Date()`'s local timezone for
  business-date logic.

## The database is the source of truth for balances

`loan_summary` (a Postgres view, `security_invoker`) derives
`remaining_centavos`/`progress_pct`/`display_status` etc. from `loans` +
`opening_balances` + `payment_entries`. **There is no second stored balance
column anywhere.** Ledger writes go exclusively through three `SECURITY
DEFINER` RPCs (`supabase/migrations/0006_rpc_financial.sql`):
`record_payment`, `reverse_payment`, `confirm_opening_balance`. Client
`INSERT`/`UPDATE`/`DELETE` on `payment_entries`/`opening_balances`/
`audit_events` is revoked (`0007_rls_grants.sql`) -- if a new ledger-adjacent
feature seems to need a direct write to one of those tables, it needs a new
RPC instead, following the same lock -> idempotency-check -> write -> audit
-> return-authoritative-row pattern already there.

Custom Postgres error codes (`ARW01`/`ARW04`/`ARW09`/`ARW22`) map to HTTP
401/404/409/422 in `server/utils/errors.ts`. Keep using them for new RPCs
rather than inventing new codes.

## Workbook facts

`docs/workbook-analysis.md` records what was actually verified in the real
`ARAWAN copy.xlsx` (42 rows, 40 borrowers) by parsing its raw XML directly --
including **three corrections to the spec** (B43 is not corrupted, the total
row is column-misaligned, H4 is provably a typo). Read it before touching
anything import-related; don't re-derive these facts from scratch.

## Commands

```
npm run dev              # nuxt dev
npm run build             # production build (required for PWA/SW to exist)
npm run typecheck         # vue-tsc via `nuxt typecheck`
npm run db:start          # boots the local Supabase stack (Docker)
npm run db:stop           # stops it
npm run db:status         # local stack URLs/keys (Studio, API, DB, ...)
npm run db:reset          # (re)applies supabase/migrations/*.sql + supabase/seed.sql, LOCAL only
npm run db:push           # supabase db push -- BLOCKED unless ARAWAN_ALLOW_PROD=1, see below
npm run gen:types         # regenerates app/types/database.types.ts from the LOCAL db
npm run seed:workbook -- "path/to/ARAWAN copy.xlsx"   # dev-only, see the script's header comment
npm run generate:brand -- "path/to/arawan-logo.png"   # regenerate public/icons, public/splash, public/brand
npm run test:e2e          # playwright test (builds + boots .output itself)
```

`.env` (gitignored) needs `NUXT_PUBLIC_SUPABASE_URL` / `NUXT_PUBLIC_SUPABASE_KEY`
for the app, and `ARAWAN_OWNER_EMAIL`/`ARAWAN_OWNER_PASSWORD` for
`tests/e2e/global-setup.ts` and `scripts/seed-workbook.mjs`'s owner lookup.
See `.env.example` -- it ships filled in for the local stack by default; the
hosted-project values are commented out below it.

## Local Supabase stack

This repo is **linked to the production project**
(`supabase/.temp/linked-project.json`), so `supabase db push` and friends
target it by default with no further confirmation. `npm run db:push` (and
`gen:types`, which also shells out to the CLI) route through
`scripts/guard-remote.mjs`, which refuses any command that would hit the
linked/remote project (`db push`, `db pull`, `link`, anything with
`--linked`/`--project-ref`) unless `ARAWAN_ALLOW_PROD=1` is set. Don't
"fix" a blocked `db push` by calling `supabase db push` directly -- set
`ARAWAN_ALLOW_PROD=1` only when you actually mean production.

`supabase/seed.sql` provisions the local owner account by inserting directly
into `auth.users` + `auth.identities` (plus `public.profiles`). Several
`auth.users` text columns (`confirmation_token`, `recovery_token`, the
email/phone-change token columns, `reauthentication_token`) are written as
`''` rather than left `NULL` -- GoTrue reads them as non-nullable strings,
and a `NULL` there breaks password sign-in with a generic error that makes
every authenticated e2e spec silently self-skip instead of failing loudly.
Read that file's own comments before changing it. `supabase/seed-owner.sql`
is the equivalent for a **hosted** project, where the owner's auth user id
isn't known ahead of time (created by hand in the dashboard) -- keep both.

## Testing

Every authenticated Playwright spec self-skips via `tests/e2e/helpers.ts`'s
`hasSession()` when no dev Supabase project/owner is configured -- this is
intentional, not a bug, so `npm run test:e2e` stays runnable in an
environment with no real backend. Don't remove those guards; add real
coverage behind them once a dev project exists. With `npm run db:start &&
npm run db:reset` done first, `.env`'s local owner credentials sign in for
real (`supabase/seed.sql` provisions the account) and these specs run
instead of skipping.

## Not built yet (tracked, not forgotten)

- Excel import wizard + export (spec phase 4). `import_batches`/`import_rows`
  tables and `loans.source_import_row_id` already exist in the schema so
  this doesn't require another migration to bolt on.
- A full "edit loan terms" form (only inline borrower-name editing exists
  today, in `app/components/loans/NameEditor.vue`). The server already
  enforces the terms-lock-once-ledger-exists rule
  (`server/api/loans/[id].patch.ts`); the UI for editing an unlocked loan's
  terms doesn't exist yet.
- Real Apple `apple-touch-startup-image` device verification
  (`config/apple-splash-devices.mjs` is a best-effort table, flagged as such
  in its own comment).

# ARAWAN — session handoff (2026-09-12)

Context dump for continuing this work in a different session/tool. Written
because the current session is being handed off mid-verification.

## What ARAWAN is

Single-owner loan and daily-collection tracker replacing an Excel workbook.
Nuxt 4 SPA (`ssr: false`) + Supabase (Postgres/Auth/RLS) + Nitro. This build
covers spec phases 1, 2, 3, 5, 6 from
`ARAWAN-implementation-plan.md` (Excel import/export, phase 4, is a
deliberate follow-up, not started). Full architecture/conventions are in
`CLAUDE.md` at the repo root — read that first for the map of the codebase.

## Current state: built, connected, mostly green

- **Supabase is fully connected and live.** Project ref
  `hxdqmrjgsuvhiikdwpvj`. All 9 migrations (`supabase/migrations/0001`
  through `0009`) are pushed. Real generated types are in
  `app/types/database.types.ts` (via `supabase gen types typescript
  --linked`) — no longer a stub.
- **Owner account provisioned:** `admin@arawan.test`, profile row seeded.
  Credentials are in `.env` (gitignored) as `ARAWAN_OWNER_EMAIL` /
  `ARAWAN_OWNER_PASSWORD`, used by `tests/e2e/global-setup.ts` to sign in
  for the Playwright suite.
- **Build/typecheck are clean:** `npx nuxt typecheck` → 0 errors,
  `npm run build` → clean production build.
- **Playwright suite: fully green.** 8 spec files, 32 test instances (16
  per browser project × mobile/desktop) → **30 passed, 2 skipped** (the 2
  skips are the intentional "workbook not seeded" self-skip in
  `07-a11y.spec.ts`'s accented-search test — not a failure). Confirmed on
  the isolated port 4287 after fixing the port collision described below.
  This is a real, clean result — not aspirational.

## Real bugs found and fixed during this session (in order)

These were found by actually running the app against the live Supabase
project and a real Playwright suite, not by inspection. Worth knowing about
before touching the related code:

1. **Component auto-import silently broken app-wide.** Every custom
   component under `app/components/{shell,loans,payments,shared}/*.vue`
   was referenced by its bare filename (`<PageHeader>`) in templates, but
   Nuxt's default auto-import prefixes nested-folder components with the
   directory name (`<ShellPageHeader>`). Every single one of these
   components was rendering as an unresolved, empty custom element —
   confirmed via a real signed-in page dump showing `<pageheader
   title="Overview"></pageheader>` with no children. **Fix:** `nuxt.config.ts`
   now has `components: [{ path: '~/components', pathPrefix: false }]`.

2. **`serverSupabaseUser()` returns decoded JWT claims (`sub`), not the
   `User` object (`id`) its type declares.** `user.id` was `undefined` on
   every server route, causing `invalid input syntax for type uuid:
   "undefined"` on any query filtering by owner. **Fix:**
   `server/utils/auth.ts`'s `requireOwner()` normalizes
   `id = rawUser.id ?? rawUser.sub` once, so every route can keep using
   `user.id`.

3. **`pgcrypto`'s `digest()` lives in the `extensions` schema on this
   Supabase project, not `public`.** `record_payment` and `reverse_payment`
   both hash a payload with `digest(...)`, and their locked-down
   `search_path = public, pg_temp` (a deliberate security hardening)
   excluded it — every real payment and every real reversal failed with
   `42883 function digest(text, unknown) does not exist`. **Fix:**
   `supabase/migrations/0009_qualify_digest_calls.sql` fully-qualifies the
   call as `extensions.digest(...)` instead of touching `search_path`.
   (`0008_optional_rpc_arg_defaults.sql` is a separate, smaller fix for the
   same two functions — PostgREST can't always resolve an RPC overload
   when a JSON `null` is sent for an optional `text` param, so
   `record_payment`'s `p_method`/`p_note` now have SQL defaults and
   `server/services/payment-service.ts` omits those keys instead of
   sending `null`.)

4. **The single biggest one: `useCachedFetch`'s `getCachedData` silently
   turned every manual refresh into a no-op.** Nuxt calls `getCachedData`
   not just on first mount but on every `refresh()`/`refreshNuxtData()`
   call too (`cause: 'refresh:manual' | 'refresh:hook'`). The original
   implementation returned cached data unconditionally, so
   `refreshNuxtData()` after recording a payment, reversing a payment, or
   renaming a borrower always resolved instantly with the **old** cached
   value and never hit the network. This is why a rename or a reversal
   would appear to silently "not take" in the UI despite the server-side
   write succeeding. **Fix:** `app/composables/useCachedFetch.ts`'s
   `getCachedData` now returns `undefined` unless `ctx.cause === 'initial'`,
   so only the very first mount can paint from cache — every explicit
   refresh now genuinely refetches.

5. **Consequence of fixing #4: a "zero refetch" architectural promise broke
   for the wrong reason.** `docs/performance.md` documents that navigating
   Records → detail → Back should trigger zero `/api/loans` refetches,
   verified by `tests/e2e/08-performance.spec.ts`. That test was passing
   *before* fix #4 only because the caching bug was ALSO suppressing this
   refetch — for the wrong reason. Once #4 was fixed, Back navigation
   started genuinely refetching, because Vue Router hands out a **new**
   `route.query` object reference on every navigation even when content is
   identical, and `useLoanList`'s `filters` computed (and its
   `watch: [filters]`) compared by reference. **Fix:**
   `app/composables/useRecordFilters.ts`'s `filters` computed now memoizes
   by serialized content and returns the *same* object reference when
   nothing actually changed, so `useFetch`'s built-in reactive `query`
   watching (which happens automatically, independent of any `watch` array
   passed in) no longer fires spuriously. `useLoans.ts`'s `useLoanList`
   also watches a derived `filtersKey` string as defense in depth.

6. **`NameEditor.vue`'s rename could double-fire.** Both
   `@keydown.enter="save"` and `@blur="save"` were wired; pressing Enter can
   also trigger a blur, firing two concurrent PATCH requests with the same
   pre-edit `version` — the loser gets a 409. Depending on timing this
   could make a rename appear to silently fail. **Fix:** `save()` now
   guards against re-entry with `if (!editing.value || saveState.value ===
   'saving') return`.

7. **A real accessibility bug that also broke `getByLabel` in every form
   test:** every `<label>` across `LoanFormSheet.vue`, `PaymentFormSheet.vue`,
   `OpeningBalanceForm.vue`, `ReversalDialog.vue`, `LoanFilters.vue`, and
   `settings.vue`'s motion selector had no `for`/`id` pairing with its
   input. Fixed by adding matching `id`/`for` attributes throughout.

8. **A genuinely broken button:** the mobile "+ Add" button in
   `app/pages/records.vue` had both `hidden` and `lg:hidden` classes,
   making it permanently invisible at every viewport width. Removed the
   stray `hidden`.

9. **Records' zero-search-results state was indistinguishable from a
   genuinely empty account.** Spec §6 explicitly wants a distinct "no
   records match these filters, Clear filters" state. Added
   `hasActiveSearchOrFilter` + a second `EmptyState` branch + `clearFilters()`
   in `app/pages/records.vue`.

10. **Test-authoring bugs (not app bugs), fixed in the specs themselves:**
    a few Playwright locators matched both the mobile list AND the desktop
    table simultaneously (only one is actually visible per viewport via a
    `lg:` breakpoint) — fixed with `:visible` / `:has-text()` scoping in
    `tests/e2e/03-loans.spec.ts` and `08-performance.spec.ts`. A toast
    "Payment saved" collided with the sheet's own inline "Payment saved."
    status text under non-exact `getByText` matching — fixed with
    `{ exact: true }` in `04-ledger.spec.ts`. Added `data-testid=
    "loan-detail-record-payment"` to disambiguate the sticky detail button
    from the swipe-reveal list button with the same accessible name.

## Environment gotcha: port collision with a DIFFERENT project

**`D:/Submit/czed-czhan-store` (a separate, unrelated project on this same
machine) also hardcodes port 3211 for its own Playwright e2e server**
(`playwright.config.ts` → `baseURL: 'http://localhost:3211'`, and its own
`scripts/e2e-server.ts`). I had copied that exact port number when writing
ARAWAN's own `scripts/e2e-server.mjs` early in this session, not realizing
it would collide.

**Confirmed via `Get-CimInstance Win32_Process`:** an OpenAI Codex agent was
actively running `czed-czhan-store`'s `npm run test:e2e` on this same
machine *while ARAWAN's own suite was running*, both bound to port 3211.
This caused real, confusing failures that looked like app bugs but weren't:
intermittent `ERR_CONNECTION_REFUSED`, and — the tell — one run where
`/manifest.webmanifest` came back with `"name": "Sari-Sari Store"` (that
project's own manifest) instead of `"ARAWAN"`.

**Fix applied:** ARAWAN's test port was moved from `3211` to `4287` across
`playwright.config.ts`, `scripts/e2e-server.mjs`, and
`tests/e2e/global-setup.ts` (a plain `sed` replace, already committed —
check `git log` if it isn't). **If you see mysterious cross-project-looking
failures again, check for other processes on whatever port ARAWAN is
currently using** (`Get-CimInstance Win32_Process | Where CommandLine -match
'e2e-server'` or similar) before assuming it's an app bug.

## Outstanding, not yet done

- **All fixes described above are committed locally, but the working tree
  had not been checked/committed at the exact moment this handoff was
  written** — run `git status` first thing. Recent work spans several
  commits (component pathPrefix fix, RPC/digest migrations 0008-0009,
  getCachedData fix, stable-filters-reference fix, label/a11y fixes, the
  port change 3211→4287, this handoff doc itself) — check `git log
  --oneline -20` for the exact list before assuming anything is uncommitted
  vs. already landed.
- **PR was requested but not created yet.** Nothing has been pushed to a
  branch or opened as a PR as of this handoff. Next step: create a branch,
  push, and open the PR against `czedrixb/arawan` (that's the remote
  already configured — check `git remote -v`). Since the full suite is
  confirmed green (30/32, 2 intentional skips), the PR description can
  state that directly rather than hedging.
- **Excel import/export (spec phase 4)** — not started, deliberately
  deferred. `docs/workbook-analysis.md` already has the verified facts
  about the real source workbook (including 3 corrections to the written
  spec) so this doesn't need to be re-derived.
- **Editing an existing loan's financial terms** has no UI — only inline
  borrower-name editing exists (`NameEditor.vue`). The server-side
  lock-once-ledger-exists rule is already enforced
  (`server/api/loans/[id].patch.ts`).
- **Real-device verification of Apple `apple-touch-startup-image` sizes**
  — `config/apple-splash-devices.mjs` is a best-effort table, flagged as
  such.
- The dev database currently has ~50 accumulated test/debug loans and
  borrowers from this session's manual repro scripts (named things like
  "Repro...", "Ledger Test...", "Exact Test..."). Harmless for
  correctness, but worth knowing about if you're eyeballing the dev
  Overview/Records screens and wondering why there's so much data. Clean
  up with a direct SQL delete against the dev project if it bothers you —
  don't touch the `profiles` row for the owner.

## Key files if you need to reorient fast

- `CLAUDE.md` — architecture map, conventions, commands.
- `docs/performance.md` — the anti-sluggishness design (now actually
  correct after fix #4/#5 above).
- `docs/workbook-analysis.md` — verified real-workbook facts for phase 4.
- `supabase/migrations/0001` through `0009` — schema, RLS, RPCs, in order.
  Read them in order; later ones patch earlier ones (0008/0009 patch 0006).

# Performance architecture

The user's explicit requirement beyond the written spec: **the app must not
feel sluggish on every click.** This is treated as an architectural
constraint, checked by `tests/e2e/08-performance.spec.ts`, not a polish pass.
Six mechanisms:

1. **SPA mode (`ssr: false`, `nuxt.config.ts`).** Every in-app navigation is
   client-side -- no server render, no hydration pause, no Nitro cold start on
   a route change. The one-time cost (a blank first paint) is covered by the
   splash: `app/spa-loading-template.html` (pre-boot, inline, no network) and
   `AppLaunchScreen.vue` (in-app, while the Supabase session resolves).

2. **Stale-while-revalidate (`app/composables/useCachedFetch.ts`).** Every
   fetch goes through this wrapper, which supplies `getCachedData` reading
   `nuxtApp.payload.data`/`nuxtApp.static.data` by a caller-supplied key.
   Returning to Records or reopening a loan paints instantly from cache and
   revalidates behind `TopProgress.vue`'s thin bar -- never a full skeleton
   wipe. Callers must pass an explicit `key` (see the file's own comment for
   why the default auto-key isn't reliable with a reactive `query` object).

3. **Optimistic mutations.** `app/composables/usePayments.ts`'s
   `recordPayment`/`reversePayment` patch the loan-detail cache immediately
   with the predicted balance, then reconcile with the server's authoritative
   `loan_summary` row on response, rolling back on error.
   `app/composables/useLoans.ts`'s `setLoanArchived` does the same for
   archive/restore. The server result is always what finally renders.

4. **One query per screen.** The `loan_summary` Postgres view
   (`supabase/migrations/0005_loan_summary_view.sql`) derives collected /
   remaining / progress / status server-side. Records and the loan detail
   each hit one endpoint; Overview does two consolidated queries
   (`server/services/overview-service.ts`) instead of one per metric.

5. **Nested-route architecture removes a whole class of refetches.**
   `app/pages/records.vue` (parent, holds the list) + `app/pages/records/[id].vue`
   (child, rendered via the parent's `<NuxtPage />`) means opening a loan
   detail never unmounts the list -- it's a sibling overlay, not a
   navigation away and back. Mobile Back-button scroll/filter preservation
   falls out of this for free, with no explicit `<KeepAlive>` needed.
   `BottomTabBar.vue` uses `@touchend.prevent` + `touch-manipulation` to cut
   the ~300ms mobile tap delay.

6. **No layout shift.** `AppSkeleton.vue` renders shape-matched fixed-height
   placeholders (`list`/`stat-grid`/`card`/`line`), money uses
   `.tabular-money` (tabular-nums, right-aligned), and status pills reserve
   their width. Search inputs debounce ~250ms and their results are keyed so
   an in-flight stale request never overwrites a newer one.

Motion stays inside spec §4's budget (100-140ms press, 160-200ms fade,
260-320ms sheet, opacity/transform only) and is fully disabled by
`app/composables/useReducedMotion.ts`, which combines the OS
`prefers-reduced-motion` media query with an explicit Settings override.
**No animation ever gates a save** -- every submit button disables itself and
shows "Saving..." text, not a blocking transition.

## Verification

`tests/e2e/08-performance.spec.ts` asserts the concrete claim: navigating
Records -> detail -> Back performs **zero** requests to `/api/loans` on the
Back leg, and the detail view paints within a bound generous enough for CI
while the architectural target (warm cache, same-process) is roughly 100ms.

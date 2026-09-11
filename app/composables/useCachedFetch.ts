// Central stale-while-revalidate wrapper (see docs/performance.md). Every
// data fetch in the app should go through this, not raw useFetch, so
// Records -> detail -> Back always paints from cache instantly and
// revalidates behind TopProgress instead of a full skeleton wipe.
//
// Callers MUST pass an explicit `key` when the request has reactive
// query/params (filters, pagination, :id) so each combination gets its
// own cache slot -- Nuxt's auto-generated key does not reliably vary with
// a `query` object the way it does with the URL itself.
import type { UseFetchOptions } from 'nuxt/app'

export function useCachedFetch<T>(url: string | (() => string), opts: UseFetchOptions<T> & { key: string | (() => string) }) {
  const progress = useTopProgress()
  return useFetch(url, {
    ...opts,
    // Nuxt consults getCachedData on EVERY execute() call, including an
    // explicit refresh()/refreshNuxtData() (cause: 'refresh:manual' /
    // 'refresh:hook'), not just the first load -- returning a value
    // unconditionally here made every such refresh a silent no-op: it
    // resolved instantly with the OLD cached data and never touched the
    // network. Confirmed against a real payment/reversal/rename each
    // failing to show up until a full page reload. Only serve the cache
    // on the initial mount; every explicit refresh must hit the network.
    getCachedData(key, nuxtApp, ctx) {
      if (ctx.cause !== 'initial') return undefined
      return (nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]) as T | undefined
    },
    onRequest() {
      progress.start()
    },
    onResponse() {
      progress.finish()
    },
    onRequestError() {
      progress.finish()
    },
  })
}

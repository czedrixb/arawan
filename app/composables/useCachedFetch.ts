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
    getCachedData(key, nuxtApp) {
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

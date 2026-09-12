/**
 * Keep the screens derived from loan records coherent after a mutation.
 *
 * A dashboard and a Records list can be unmounted when a change happens.
 * Refreshing every Nuxt async-data handler made mutations progressively
 * slower as more searches/pages were visited, while refreshing only the
 * mounted screen left an old cached dashboard behind. Refresh active views
 * and discard inactive record caches so their next visit fetches once.
 */
export async function syncRecordData(options: { loanId?: string; payments?: boolean } = {}) {
  const nuxtApp = useNuxtApp()
  const matches = (key: string) =>
    key === 'overview' ||
    key.startsWith('loans:') ||
    key.startsWith('loan:') ||
    (options.payments && key.startsWith(`payments:${options.loanId}:`))

  const keys = Object.keys(nuxtApp._asyncData).filter(matches)
  const activeKeys = keys.filter((key) => nuxtApp._asyncData[key]?._init)
  const inactiveKeys = keys.filter((key) => !nuxtApp._asyncData[key]?._init)

  if (inactiveKeys.length) clearNuxtData(inactiveKeys)
  if (activeKeys.length) await refreshNuxtData(activeKeys)
}

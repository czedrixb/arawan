// Resolves the initial Supabase session before the router's first
// navigation guard runs, so auth.global.ts never redirects to /login on a
// user ref that simply hasn't loaded yet. Nuxt awaits plugins before the
// initial route resolves, so this ordering is safe in SPA mode.
export default defineNuxtPlugin(async () => {
  const client = useSupabaseClient()
  const ready = useAuthReady()
  try {
    await client.auth.getSession()
  } finally {
    ready.value = true
  }
})

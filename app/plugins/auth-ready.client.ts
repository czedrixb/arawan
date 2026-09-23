// Resolves the initial Supabase session before the router's first
// navigation guard runs, so auth.global.ts never redirects to /login on a
// user ref that simply hasn't loaded yet. Nuxt awaits plugins before the
// initial route resolves, so this ordering is safe in SPA mode.
export default defineNuxtPlugin(async () => {
  const ready = useAuthReady()
  try {
    if (useRuntimeConfig().public.backendMode === 'native-postgres') {
      const response = await $fetch<{ user: ArawanUser | null }>('/api/auth/session')
      useState<ArawanUser | null>('arawan-user').value = response.user
    } else {
      await useSupabaseClient().auth.getSession()
    }
  } finally {
    ready.value = true
  }
})

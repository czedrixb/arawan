// We drive our own redirect instead of the @nuxtjs/supabase module's
// (disabled via `supabase.redirect: false` in nuxt.config.ts) so it can
// wait on useAuthReady() -- see app/plugins/auth-ready.client.ts.
export default defineNuxtRouteMiddleware((to) => {
  const ready = useAuthReady()
  if (!ready.value) return // app.vue is showing AppLaunchScreen; decide nothing yet

  const user = useSupabaseUser()
  const isAuthRoute = to.path === '/login' || to.path.startsWith('/confirm')

  if (!user.value && !isAuthRoute) {
    return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined })
  }
  if (user.value && to.path === '/login') {
    return navigateTo('/')
  }
})

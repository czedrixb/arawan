import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { splashVariants } from './config/apple-splash-devices.mjs'

// ARAWAN is a single-owner SPA: every in-app navigation is client-side
// (no server render, no hydration pause) so Records/detail/back never pay
// a round trip -- see docs/performance.md. Nitro still serves /api/**.
export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',

  devtools: { enabled: false },

  ssr: false,

  srcDir: 'app/',
  serverDir: 'server/',
  dir: { public: '../public' },

  modules: ['@nuxtjs/supabase', '@vite-pwa/nuxt'],

  // Every component in app/components/{shell,loans,payments,shared}/ is
  // written and referenced by its bare filename (<PageHeader>, not
  // <ShellPageHeader>). Without this, Nuxt's default directory-prefixed
  // auto-import silently fails to resolve any of them -- confirmed via a
  // real signed-in render where they came through as empty, unresolved
  // custom elements with no console error (Vue only warns).
  components: [{ path: '~/components', pathPrefix: false }],

  css: ['~/assets/css/tokens.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  nitro: {
    // dir.public resolves against rootDir rather than srcDir on this
    // Nuxt/Nitro pairing, silently shipping a production build with NO
    // public assets (every icon/splash image 404s). Pin the real path.
    publicAssets: [{ dir: fileURLToPath(new URL('./public', import.meta.url)) }],
  },

  routeRules: {
    // Financial data must never be cached by a shared/CDN cache.
    '/api/**': { headers: { 'cache-control': 'no-store' } },
  },

  supabase: {
    // We drive our own auth state machine (AppLaunchScreen + auth.global.ts)
    // per spec §12's launch requirements, instead of the module's default
    // redirect-to-/login plugin.
    redirect: false,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
    },
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 30, // 30 days -- single-owner daily-use tool
      sameSite: 'lax',
      secure: true,
    },
  },

  pwa: {
    registerType: 'prompt',
    manifest: {
      id: '/',
      name: 'ARAWAN',
      short_name: 'ARAWAN',
      description: 'Loan and daily collection tracker',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#F7F8F5',
      theme_color: '#F7F8F5',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      // Never precache or serve private/API responses from the SW cache.
      navigateFallbackDenylist: [/^\/api\//, /^\/confirm/],
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
    },
    devOptions: {
      enabled: false,
    },
  },

  spaLoadingTemplate: 'spa-loading-template.html',

  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      meta: [{ name: 'theme-color', content: '#F7F8F5' }],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/favicon-32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/icons/apple-touch-icon-180.png' },
        ...splashVariants().map((v) => ({
          rel: 'apple-touch-startup-image' as const,
          href: v.file,
          media: v.media,
        })),
      ],
    },
    pageTransition: { name: 'fade', mode: 'out-in' },
  },

  typescript: {
    strict: true,
  },
})

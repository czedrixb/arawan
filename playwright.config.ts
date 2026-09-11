import { defineConfig, devices } from '@playwright/test'

// Runs against a production build (spec §14): the service worker,
// spaLoadingTemplate, and PWA manifest only exist in `.output/`, not in
// `nuxt dev`. scripts/e2e-server.mjs builds and boots that server.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalSetup: './tests/e2e/global-setup.ts',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3211',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'], storageState: './tests/e2e/.auth/storage-state.json' },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: './tests/e2e/.auth/storage-state.json' },
    },
  ],
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: 'http://localhost:3211/api/overview',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})

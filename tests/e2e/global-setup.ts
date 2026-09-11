// Signs in once as the provisioned owner (ARAWAN_OWNER_EMAIL/PASSWORD in
// .env) and saves storageState for every test project. If no dev
// Supabase project is configured yet, this writes an empty session so
// unauthenticated tests (redirect-to-login, PWA manifest, a11y on the
// public login page) still run -- individual specs that need a real
// session guard themselves with `test.skip(!hasSession(), ...)`.
import { chromium, type FullConfig } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const STORAGE_STATE_PATH = './tests/e2e/.auth/storage-state.json'

export default async function globalSetup(config: FullConfig) {
  mkdirSync('./tests/e2e/.auth', { recursive: true })
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:4287'
  const email = process.env.ARAWAN_OWNER_EMAIL
  const password = process.env.ARAWAN_OWNER_PASSWORD

  if (!email || !password) {
    console.warn('[global-setup] ARAWAN_OWNER_EMAIL/PASSWORD not set -- writing an empty session. Authenticated specs will skip themselves.')
    writeFileSync(STORAGE_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }))
    return
  }

  const browser = await chromium.launch()
  const page = await browser.newPage()
  try {
    await page.goto(`${baseURL}/login`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(`${baseURL}/`, { timeout: 15_000 })
    await page.context().storageState({ path: STORAGE_STATE_PATH })
  } catch (err) {
    console.warn('[global-setup] Sign-in failed -- writing an empty session. Authenticated specs will skip themselves.', err);
    writeFileSync(STORAGE_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }))
  } finally {
    await browser.close()
  }
}

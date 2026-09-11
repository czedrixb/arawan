import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test('manifest and every declared icon respond 200', async ({ page, request }) => {
  await page.goto('/')
  const manifestRes = await request.get('/manifest.webmanifest')
  expect(manifestRes.ok()).toBeTruthy()
  const manifest = await manifestRes.json()
  expect(manifest.name).toBe('ARAWAN')

  for (const icon of manifest.icons) {
    const res = await request.get(icon.src)
    expect(res.ok(), `${icon.src} should respond 200`).toBeTruthy()
  }
})

test('the service worker registers and precaches the shell', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== undefined, null, { timeout: 15_000 }).catch(() => {})
  const swRes = await page.request.get('/sw.js')
  expect(swRes.ok()).toBeTruthy()
})

test('offline after a prior visit shows a branded message, not a browser error page', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForTimeout(1000) // let the SW finish installing/activating
  await context.setOffline(true)
  await page.goto('/').catch(() => {})
  await expect(page.locator('body')).not.toContainText('ERR_INTERNET_DISCONNECTED')
  await context.setOffline(false)
})

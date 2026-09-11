import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test('320px reflows without horizontal page scroll (public login page)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/login')
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1) // +1 for sub-pixel rounding
})

test.describe('authenticated shell', () => {
  test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

  test('shows the bottom tab bar under 1024px and the sidebar at 1024px+', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Records' })).toBeVisible()

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.reload()
    await expect(page.getByText('ARAWAN', { exact: true })).toBeVisible()
  })
})

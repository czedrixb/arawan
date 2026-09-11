import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

// The user's explicit "must not feel sluggish" requirement, made into a
// pass/fail check rather than a vibe: Records -> detail -> Back must not
// refetch the list (docs/performance.md §2).
test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

test('Records -> detail -> Back performs zero list refetches on the Back leg', async ({ page }) => {
  await page.goto('/records')
  await page.waitForLoadState('networkidle')

  const rows = page.locator('a[href^="/records/"]')
  await expect(rows.first()).toBeVisible()

  let listRequests = 0
  page.on('request', (req) => {
    if (req.url().includes('/api/loans?') || req.url().endsWith('/api/loans')) listRequests++
  })

  const clickStart = Date.now()
  await rows.first().click()
  await page.waitForURL('**/records/*')
  await expect(page.locator('main, [role="tablist"]').first()).toBeVisible()
  const detailPaintMs = Date.now() - clickStart
  expect(detailPaintMs).toBeLessThan(1000) // generous CI bound; the architectural target is ~100ms on a warm cache

  listRequests = 0 // only count what happens on the Back leg itself
  await page.goBack()
  await page.waitForTimeout(300)
  expect(listRequests).toBe(0)
})

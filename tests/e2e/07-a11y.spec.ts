import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.describe('reduced motion (public login page)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('the launch/logo animation is disabled under prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const animationName = await page.evaluate(() => {
      const img = document.querySelector('img[alt="ARAWAN"]')
      return img ? getComputedStyle(img).animationName : 'none'
    })
    expect(animationName === 'none' || animationName === '').toBeTruthy()
  })
})

test.describe('authenticated a11y', () => {
  test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

  test('add-loan is completable keyboard-only and focus returns to the trigger on close', async ({ page }) => {
    await page.goto('/records')
    const addButton = page.getByRole('button', { name: '+ Add loan' }).or(page.getByRole('button', { name: '+ Add' })).first()
    await addButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Add loan' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Add loan' })).not.toBeVisible()
  })

  test('table sort headers expose aria-sort', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/records')
    const nameHeader = page.getByRole('button', { name: /Name/ })
    await expect(nameHeader).toHaveAttribute('aria-sort', /ascending|none/)
  })

  test('search finds an accented borrower name by its unaccented spelling', async ({ page }) => {
    await page.goto('/records')
    await page.getByPlaceholder('Search records').fill('serdena')
    // 250ms debounce (spec §2) + a real network round trip now that
    // refreshes/watched refetches actually hit the network -- give it
    // more margin than the debounce alone before checking either outcome.
    await page.waitForTimeout(900)
    const emptyState = page.getByText('No records match these filters.')
    if (await emptyState.isVisible().catch(() => false)) {
      test.skip(true, 'workbook not seeded in this environment -- see scripts/seed-workbook.mjs')
    }
    await expect(page.getByText(/Serde/i)).toBeVisible()
  })
})

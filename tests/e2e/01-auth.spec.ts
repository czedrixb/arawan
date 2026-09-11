import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.describe('auth', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('redirects a signed-out visitor to /login with no borrower data on the page', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL('**/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByAltText('ARAWAN')).toBeVisible()
    // Spec §6: no borrower data on the public login page.
    await expect(page.locator('body')).not.toContainText('₱')
  })

  test('signing in with the provisioned owner reaches the shell', async () => {
    test.skip(!process.env.ARAWAN_OWNER_EMAIL, 'requires ARAWAN_OWNER_EMAIL/PASSWORD against a real dev Supabase project')
  })
})

test.describe('auth (authenticated)', () => {
  test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

  test('an authenticated visit to /login redirects to the shell', async ({ page }) => {
    await page.goto('/login')
    await page.waitForURL('**/')
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  })
})

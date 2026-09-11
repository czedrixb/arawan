import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

test('create a loan, find it by search, open detail, edit the borrower name', async ({ page }, testInfo) => {
  const borrowerName = `Test Borrower ${Date.now()}`

  await page.goto('/records')
  await page.getByRole('button', { name: '+ Add loan' }).or(page.getByRole('button', { name: '+ Add' })).first().click()
  await page.getByRole('button', { name: 'New borrower' }).click()
  await page.getByPlaceholder('Full name').fill(borrowerName)
  await page.getByLabel('Principal (₱)').fill('5000')
  await page.getByLabel('Daily due (₱)').fill('100')
  await page.getByRole('button', { name: 'Save loan' }).click()
  await expect(page.getByText('Loan created')).toBeVisible()

  await page.goto('/records')
  await page.getByPlaceholder('Search records').fill(borrowerName)
  await page.waitForTimeout(400) // debounce
  // The mobile list and desktop table both render this row -- only one is
  // actually visible per viewport (the other is display:none via a `lg:`
  // breakpoint), so scope to :visible, same as tests/e2e/08-performance.spec.ts.
  const visibleRow = page.locator(`:visible:has-text("${borrowerName}")`)
  await expect(visibleRow.first()).toBeVisible()

  // Scope the click to the anchor itself (both the mobile list and desktop
  // table render the name inside a real <a>) so it actually navigates,
  // rather than a non-interactive ancestor that also matches :has-text.
  await page.locator(`a:visible:has-text("${borrowerName}")`).first().click()
  await page.waitForURL('**/records/*')

  await page.getByRole('button', { name: 'Edit borrower name' }).click()
  const renamed = `${borrowerName} Jr.`
  await page.getByRole('textbox').last().fill(renamed)
  await page.keyboard.press('Enter')
  await expect(page.locator(`:visible:has-text("${renamed}")`).first()).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('loan-detail-renamed.png'), fullPage: true })
})

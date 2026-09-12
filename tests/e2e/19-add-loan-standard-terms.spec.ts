import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

// Mirrors shared/utils/dates.ts's addDaysIso/formatDateDisplay exactly, so
// expectations are computed the same way the app computes them, without
// hardcoding a date that could drift.
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}
function formatDisplay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(y!, m! - 1, d!))
}

test('existing-borrower search is clickable, and standard terms auto-fill from principal + borrowed date', async ({ page }) => {
  const borrowerName = `Test Borrower ${Date.now()} A`

  // Seed a borrower to search for, via the same "New borrower" path 03-loans.spec.ts uses.
  await page.goto('/records')
  await page.getByRole('button', { name: '+ Add loan' }).or(page.getByRole('button', { name: '+ Add' })).first().click()
  await page.getByRole('button', { name: 'New borrower' }).click()
  await page.getByPlaceholder('Full name').fill(borrowerName)
  await page.getByLabel('Principal (₱)').fill('1000')
  await page.getByRole('button', { name: 'Save loan' }).click()
  await expect(page.getByText('Loan created')).toBeVisible()

  // Reopen the sheet -- fields must reset to the standard-terms defaults.
  await page.getByRole('button', { name: '+ Add loan' }).or(page.getByRole('button', { name: '+ Add' })).first().click()
  await expect(page.getByRole('heading', { name: 'Add loan' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Existing borrower' })).toHaveClass(/border-primary/)

  // Search and click a result -- it must be clickable and confirm the pick.
  await page.getByPlaceholder('Search borrowers').fill(borrowerName)
  await page.waitForTimeout(400) // debounce
  await page.getByRole('button', { name: borrowerName, exact: true }).click()
  await expect(page.getByText(`✓ ${borrowerName}`)).toBeVisible()
  await expect(page.getByPlaceholder('Search borrowers')).not.toBeVisible()

  // Change reopens the picker.
  await page.getByRole('button', { name: 'Change' }).click()
  await expect(page.getByText(`✓ ${borrowerName}`)).not.toBeVisible()
  await expect(page.getByPlaceholder('Search borrowers')).toBeVisible()
  await page.getByPlaceholder('Search borrowers').fill(borrowerName)
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: borrowerName, exact: true }).click()
  await expect(page.getByText(`✓ ${borrowerName}`)).toBeVisible()

  // Borrowed on -> payment start defaults to the next day.
  const borrowedOn = '2026-06-15'
  const expectedPaymentStart = addDays(borrowedOn, 1)
  const expectedDueOn = addDays(expectedPaymentStart, 59) // 60th collection day, all weekdays on
  await page.getByLabel('Borrowed on').fill(borrowedOn)
  await expect(page.getByLabel('Payment start')).toHaveValue(expectedPaymentStart)

  // Principal -> interest (20%) and daily due ((principal+interest)/60) auto-fill.
  await page.getByLabel('Principal (₱)').fill('5000')
  await expect(page.getByLabel('Interest (₱)')).toHaveValue('1000.00')
  await expect(page.getByLabel('Daily due (₱)')).toHaveValue('100.00')

  // Preview: fixed 60-day term, matching the auto-filled amounts.
  await expect(page.getByText('60 days')).toBeVisible()
  const preview = page.locator('section', { hasText: 'Preview' })
  await expect(preview.getByText('₱6,000.00')).toBeVisible()
  await expect(preview.locator('dd', { hasText: /^60$/ })).toBeVisible()
  await expect(preview.getByText(formatDisplay(expectedDueOn))).toBeVisible()

  // Overriding daily due must not change the fixed 60-installment term.
  await page.getByLabel('Daily due (₱)').fill('150.00')
  await expect(preview.locator('dd', { hasText: /^60$/ })).toBeVisible()

  await page.getByRole('button', { name: 'Save loan' }).click()
  await expect(page.getByText('Loan created')).toBeVisible()
})

test('a new loan is assigned a real record number in the Records table', async ({ page }, testInfo) => {
  const borrowerName = `Test Borrower ${Date.now()} B`

  await page.goto('/records')
  await page.getByRole('button', { name: '+ Add loan' }).or(page.getByRole('button', { name: '+ Add' })).first().click()
  await page.getByRole('button', { name: 'New borrower' }).click()
  await page.getByPlaceholder('Full name').fill(borrowerName)
  await page.getByLabel('Principal (₱)').fill('2000')
  await page.getByRole('button', { name: 'Save loan' }).click()
  await expect(page.getByText('Loan created')).toBeVisible()

  await page.goto('/records')
  await page.getByPlaceholder('Search records').fill(borrowerName)
  await page.waitForTimeout(400) // debounce

  if (testInfo.project.name === 'desktop-chrome') {
    // Desktop table: "#" is the first cell in the row containing the borrower name.
    const row = page.locator('table tbody tr', { hasText: borrowerName }).first()
    const numberCell = row.locator('td').first()
    await expect(numberCell).toBeVisible()
    await expect(numberCell).not.toHaveText('—')
    await expect(numberCell).toHaveText(/^\d+$/)
  } else {
    // Mobile list renders "<#>. <name>" inline instead of a separate column.
    const mobileRow = page.locator('li', { hasText: borrowerName }).first()
    await expect(mobileRow).toContainText(new RegExp(`^\\d+\\. ${borrowerName}`))
  }
})

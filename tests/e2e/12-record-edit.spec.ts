import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

test('edits and restores a workbook record from the Records row actions', async ({ page, request }, testInfo) => {
  const listResponse = await request.get('/api/loans?q=JINKY%20C.%20JUAMAN&pageSize=25')
  expect(listResponse.ok()).toBeTruthy()
  const list = await listResponse.json()
  const original = list.rows.find((row: any) => row.source_sequence === 1)
  expect(original).toBeTruthy()
  const originalDetails = {
    version: original.version,
    borrowerVersion: original.borrower_version,
    displayName: original.borrower_display_name,
    borrowedOn: original.borrowed_on,
    paymentStartOn: original.payment_start_on,
    dueOn: original.due_on,
    principalCentavos: original.principal_centavos,
    dailyDueCentavos: original.daily_due_centavos,
    interestCentavos: original.interest_centavos,
  }
  const editedName = `${originalDetails.displayName} Edited`

  try {
    await page.goto('/records?q=JINKY%20C.%20JUAMAN')
    const row = page.locator('tr:visible, li:visible').filter({ hasText: 'JINKY C. JUAMAN' }).first()
    if (testInfo.project.name === 'mobile-chrome') {
      await row.getByRole('button', { name: 'Show actions for JINKY C. JUAMAN' }).click()
      await row.getByRole('button', { name: 'Edit', exact: true }).click()
    } else {
      // The desktop kebab menu is portalled, so its items render outside
      // `row` -- query the menuitem at the page level, not row-scoped.
      await row.getByRole('button', { name: 'Actions for JINKY C. JUAMAN' }).click()
      await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
    }

    await expect(page.getByRole('heading', { name: 'Edit record' })).toBeVisible()
    await expect(page.getByLabel('Name')).toHaveValue('JINKY C. JUAMAN')
    await expect(page.getByLabel('Date Borrowed')).toHaveValue('2026-07-21')
    await expect(page.getByLabel('Payment Start')).toHaveValue('2026-07-22')
    await expect(page.getByLabel('Date Completed')).toHaveValue('2026-09-22')
    await expect(page.getByLabel('Amount (₱)')).toHaveValue('30000.00')
    await expect(page.getByLabel('Daily (₱)')).toHaveValue('600.00')
    await expect(page.getByLabel('Interest (₱)')).toHaveValue('1000.00')

    await page.getByLabel('Name').fill(editedName)
    await page.getByLabel('Date Borrowed').fill('2026-07-22')
    await page.getByLabel('Payment Start').fill('2026-07-23')
    await page.getByLabel('Date Completed').fill('2026-09-23')
    await page.getByLabel('Amount (₱)').fill('30001')
    await page.getByLabel('Daily (₱)').fill('601')
    await page.getByLabel('Interest (₱)').fill('1001')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Record updated')).toBeVisible()

    await page.goto(`/records?q=${encodeURIComponent(editedName)}`)
    const editedRow = page.locator('tr:visible, li:visible').filter({ hasText: editedName }).first()
    await expect(editedRow).toBeVisible()
    await expect(editedRow).toContainText('₱30,001.00')
    await expect(editedRow).toContainText('₱601.00')
    await expect(editedRow).toContainText('₱1,001.00')
    await page.screenshot({ path: testInfo.outputPath('record-edit-saved.png'), fullPage: true })
  } finally {
    const detailsResponse = await request.get(`/api/loans/${original.id}`)
    if (detailsResponse.ok()) {
      const { loan } = await detailsResponse.json()
      const restore = await request.patch(`/api/loans/${original.id}/details`, {
        data: { ...originalDetails, version: loan.version, borrowerVersion: loan.borrower_version },
      })
      expect(restore.ok()).toBeTruthy()
    }
  }
})

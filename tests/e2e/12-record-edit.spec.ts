import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

test('edits and restores a borrower phone from the Records row actions', async ({ page, request }, testInfo) => {
  const listResponse = await request.get('/api/loans?pageSize=25&archived=include')
  expect(listResponse.ok()).toBeTruthy()
  const list = await listResponse.json()
  const original = list.rows.find((row: any) => row.borrower_id && row.borrower_display_name)
  expect(original).toBeTruthy()

  const borrowerResponse = await request.get(`/api/borrowers/${original.borrower_id}`)
  expect(borrowerResponse.ok()).toBeTruthy()
  const originalBorrower = await borrowerResponse.json()
  const editedPhone = '+63 917 555 0123'
  const borrowerName = original.borrower_display_name

  try {
    await page.goto(`/records?q=${encodeURIComponent(borrowerName)}`)
    const row = page.locator('tr:visible, li:visible').filter({ hasText: borrowerName }).first()
    await expect(row).toBeVisible()
    if (testInfo.project.name === 'mobile-chrome') {
      await row.getByRole('button', { name: `Show actions for ${borrowerName}` }).click()
      await row.getByRole('button', { name: 'Edit', exact: true }).click()
    } else {
      await row.getByRole('button', { name: `Actions for ${borrowerName}` }).click()
      await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
    }

    await expect(page.getByRole('heading', { name: 'Edit record' })).toBeVisible()
    await expect(page.getByLabel('Name')).toHaveValue(borrowerName)
    await expect(page.getByLabel('Phone number')).toHaveValue(originalBorrower.phone ?? '')
    await page.screenshot({ path: testInfo.outputPath('record-edit-phone-before.png'), fullPage: true })

    await page.getByLabel('Phone number').fill(editedPhone)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Record updated')).toBeVisible()

    const savedBorrowerResponse = await request.get(`/api/borrowers/${original.borrower_id}`)
    expect(savedBorrowerResponse.ok()).toBeTruthy()
    const savedBorrower = await savedBorrowerResponse.json()
    expect(savedBorrower.phone).toBe(editedPhone)

    await page.goto(`/records?q=${encodeURIComponent(borrowerName)}`)
    const savedRow = page.locator('tr:visible, li:visible').filter({ hasText: borrowerName }).first()
    await expect(savedRow).toBeVisible()
    if (testInfo.project.name === 'mobile-chrome') {
      await savedRow.getByRole('button', { name: `Show actions for ${borrowerName}` }).click()
      await savedRow.getByRole('button', { name: 'Edit', exact: true }).click()
    } else {
      await savedRow.getByRole('button', { name: `Actions for ${borrowerName}` }).click()
      await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
    }
    await expect(page.getByLabel('Phone number')).toHaveValue(editedPhone)
    await page.screenshot({ path: testInfo.outputPath('record-edit-phone-after.png'), fullPage: true })
  } finally {
    const currentBorrowerResponse = await request.get(`/api/borrowers/${original.borrower_id}`)
    if (currentBorrowerResponse.ok()) {
      const currentBorrower = await currentBorrowerResponse.json()
      if (currentBorrower.phone !== originalBorrower.phone) {
        const restorePhone = await request.patch(`/api/borrowers/${original.borrower_id}`, {
          data: { version: currentBorrower.version, phone: originalBorrower.phone },
        })
        expect(restorePhone.ok()).toBeTruthy()
        const restoredBorrowerResponse = await request.get(`/api/borrowers/${original.borrower_id}`)
        expect(restoredBorrowerResponse.ok()).toBeTruthy()
        const restoredBorrower = await restoredBorrowerResponse.json()
        expect(restoredBorrower.phone).toBe(originalBorrower.phone)
      }
    }
  }
})

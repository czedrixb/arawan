import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

test('creates, loads, and clears an optional borrower co-maker', async ({ page, request }, testInfo) => {
  const borrowerName = `Co-maker Test ${Date.now()}`
  const coMakerName = 'MARIA SANTOS'

  await page.goto('/records')
  await page.getByRole('button', { name: '+ Add loan' }).or(page.getByRole('button', { name: '+ Add' })).first().click()
  await page.getByRole('button', { name: 'New borrower' }).click()
  await expect(page.getByPlaceholder('Co-maker (optional)')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('co-maker-add-loan-after.png'), fullPage: true })

  await page.getByPlaceholder('Full name').fill(borrowerName)
  await page.getByPlaceholder('Co-maker (optional)').fill(coMakerName)
  await page.getByLabel('Principal (₱)').fill('5000')

  const createResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/loans')
      && response.request().method() === 'POST'
      && response.status() === 201,
  )
  await page.getByRole('button', { name: 'Save loan' }).click()
  const createdLoan = await (await createResponsePromise).json()
  await expect(page.getByText('Loan created')).toBeVisible()

  const createdBorrowerResponse = await request.get(`/api/borrowers/${createdLoan.borrower_id}`)
  expect(createdBorrowerResponse.ok()).toBeTruthy()
  const createdBorrower = await createdBorrowerResponse.json()
  expect(createdBorrower.co_maker).toBe(coMakerName)

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

  const coMakerInput = page.getByRole('textbox', { name: 'Co-maker', exact: true })
  await expect(coMakerInput).toHaveValue(coMakerName)
  await page.screenshot({ path: testInfo.outputPath('co-maker-edit-record-after.png'), fullPage: true })

  await coMakerInput.clear()
  await page.screenshot({ path: testInfo.outputPath('co-maker-edit-record-cleared.png'), fullPage: true })
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Record updated')).toBeVisible()

  const clearedBorrowerResponse = await request.get(`/api/borrowers/${createdLoan.borrower_id}`)
  expect(clearedBorrowerResponse.ok()).toBeTruthy()
  const clearedBorrower = await clearedBorrowerResponse.json()
  expect(clearedBorrower.co_maker).toBeNull()
})

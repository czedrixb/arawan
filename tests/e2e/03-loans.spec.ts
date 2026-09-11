import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

test('create a loan, find it by search, open detail, edit the borrower name', async ({ page }) => {
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
  await expect(page.getByText(borrowerName)).toBeVisible()

  await page.getByText(borrowerName).first().click()
  await page.waitForURL('**/records/*')

  await page.getByRole('button', { name: 'Edit borrower name' }).click()
  const renamed = `${borrowerName} Jr.`
  await page.getByRole('textbox').last().fill(renamed)
  await page.keyboard.press('Enter')
  await expect(page.getByText(renamed)).toBeVisible()
})

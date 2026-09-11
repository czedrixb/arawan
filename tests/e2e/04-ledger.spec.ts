import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

test('partial payment, over-payment rejection, and reversal reopening', async ({ page, request }) => {
  // Seed a small loan directly through the API so this test doesn't
  // depend on 03-loans having run first.
  const created = await request.post('/api/loans', {
    data: {
      borrower: { newBorrower: { displayName: `Ledger Test ${Date.now()}` } },
      principalCentavos: 20000,
      dailyDueCentavos: 5000,
      interestMode: 'none',
      interestCentavos: 0,
      borrowedOn: new Date().toISOString().slice(0, 10),
      paymentStartOn: new Date().toISOString().slice(0, 10),
      dueOn: new Date().toISOString().slice(0, 10),
      collectionWeekdays: [1, 2, 3, 4, 5, 6, 7],
    },
  })
  expect(created.ok()).toBeTruthy()
  const loan = await created.json()

  await page.goto(`/records/${loan.id}`)
  await page.getByRole('button', { name: 'Record payment' }).click()
  await page.getByLabel('Amount (₱)').fill('50.00')
  await page.getByRole('button', { name: 'Save payment' }).click()
  await expect(page.getByText('Payment saved')).toBeVisible()

  // Over-payment beyond the remaining balance is rejected.
  await page.getByRole('button', { name: 'Record payment' }).click()
  await page.getByLabel('Amount (₱)').fill('999999')
  await page.getByRole('button', { name: 'Save payment' }).click()
  await expect(page.getByText(/exceeds/i)).toBeVisible()
  await page.keyboard.press('Escape')

  // Reversal reopens the loan for further payment.
  await page.getByRole('tab', { name: 'Payments' }).click()
  await page.getByRole('button', { name: 'Reverse' }).first().click()
  await page.getByPlaceholder('e.g. entered wrong amount').fill('test reversal')
  await page.getByRole('button', { name: 'Reverse payment' }).click()
  await expect(page.getByText('Payment reversed')).toBeVisible()
  await expect(page.getByText('(reversed)')).toBeVisible()
})

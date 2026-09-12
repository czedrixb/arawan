import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

test('a payment made in Records refreshes the cached dashboard totals', async ({ page, request }, testInfo) => {
  const today = new Date().toISOString().slice(0, 10)
  const created = await request.post('/api/loans', {
    data: {
      borrower: { newBorrower: { displayName: `Overview Test ${Date.now()}` } },
      principalCentavos: 10000,
      dailyDueCentavos: 2000,
      interestMode: 'none',
      interestCentavos: 0,
      borrowedOn: today,
      paymentStartOn: today,
      dueOn: today,
      collectionWeekdays: [1, 2, 3, 4, 5, 6, 7],
    },
  })
  expect(created.ok()).toBeTruthy()
  const loan = await created.json()

  await page.goto('/')
  const collected = page.getByText('Collected this month').locator('..').locator('p').nth(1)
  const before = await request.get('/api/overview').then((r) => r.json())
  await expect(collected).toContainText((before.collectedInPeriodCentavos / 100).toFixed(2))
  await page.screenshot({ path: testInfo.outputPath('dashboard-before-payment.png'), fullPage: true })

  await page.goto(`/records/${loan.id}`)
  await page.getByTestId('loan-detail-record-payment').click()
  await page.getByLabel('Amount (â‚±)').fill('20')
  await page.getByRole('button', { name: 'Save payment' }).click()
  await expect(page.getByText('Payment saved')).toBeVisible()

  // The dashboard was already cached before the record changed. Its next
  // navigation must render the new total, rather than serve that old cache.
  await page.goto('/')
  await expect(collected).toContainText(((before.collectedInPeriodCentavos + 2000) / 100).toFixed(2))
  await page.screenshot({ path: testInfo.outputPath('dashboard-after-payment.png'), fullPage: true })
})

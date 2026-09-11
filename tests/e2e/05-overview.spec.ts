import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

test('recording a payment updates Overview totals, not just the loan detail', async ({ page, request }) => {
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
  const loan = await created.json()

  await page.goto('/')
  const before = await request.get('/api/overview').then((r) => r.json())

  await request.post(`/api/loans/${loan.id}/payments`, {
    data: { amountCentavos: 2000, paidOn: today, idempotencyKey: crypto.randomUUID() },
  })

  await page.goto('/') // fresh navigation -- a real fetch, not a stale cache read
  const after = await request.get('/api/overview').then((r) => r.json())

  expect(after.collectedInPeriodCentavos).toBe(before.collectedInPeriodCentavos + 2000)
  await expect(page.getByText('Collected this month')).toBeVisible()
})

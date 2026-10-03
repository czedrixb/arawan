import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

test('a payment dated today updates Actual today on the Overview', async ({ page, request }, testInfo) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
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

  try {
    await page.goto('/')
    const actualToday = page.getByText('Actual today').locator('..').locator('p').nth(1)
    const before = await request.get('/api/overview').then((response) => response.json())
    await expect(actualToday).toContainText((before.collectedTodayCentavos / 100).toFixed(2))
    await expect(page.getByText('Needs review', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('overview-actual-today-before-payment.png'), fullPage: true })

    await page.goto(`/records/${loan.id}`)
    await page.getByTestId('loan-detail-record-payment').click()
    await page.getByLabel(/Amount/).fill('20')
    await page.getByRole('button', { name: 'Save payment' }).click()
    await expect(page.getByText('Payment saved', { exact: true })).toBeVisible()

    const after = await request.get('/api/overview').then((response) => response.json())
    expect(after.collectedTodayCentavos - before.collectedTodayCentavos).toBe(2000)

    // The dashboard was already cached before the record changed. Its next
    // navigation must render the new total, rather than serve that old cache.
    await page.goto('/')
    await expect(actualToday).toContainText((after.collectedTodayCentavos / 100).toFixed(2))
    await expect(page.getByText('Needs review', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('overview-actual-today-after-payment.png'), fullPage: true })
  } finally {
    const current = await request.get(`/api/loans/${loan.id}`).then((response) => response.json())
    await request.post(`/api/loans/${loan.id}/archive`, { data: { archived: true, version: current.loan.version } })
  }
})

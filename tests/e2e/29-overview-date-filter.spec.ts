import { test, expect, type APIRequestContext } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

const PHP_FORMATTER = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

function formatCentavos(centavos: number): string {
  return PHP_FORMATTER.format(centavos / 100)
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function overview(request: APIRequestContext, date?: string) {
  const suffix = date ? `?date=${date}` : ''
  const response = await request.get(`/api/overview${suffix}`)
  expect(response.ok()).toBeTruthy()
  return response.json()
}

const nonDailyKeys = [
  'principalRecordedCentavos',
  'interestRecordedCentavos',
  'totalPayableCentavos',
  'collectedInPeriodCentavos',
  'collectedTodayCentavos',
  'outstandingTodayCentavos',
  'outstandingExcludedCount',
  'activeCount',
  'overdueCount',
  'expectedTodayCentavos',
  'sixMonthChart',
  'recentActivity',
] as const

test('filters only the Overview daily metrics by a validated Manila date', async ({ page, request }, testInfo) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
  const selectedDate = addDays(today, -7)
  const futureDate = addDays(today, 7)
  const errorDate = addDays(today, -8)
  const baselineSelected = await overview(request, selectedDate)
  const baselineFuture = await overview(request, futureDate)

  const invalidFormat = await request.get('/api/overview?date=10-05-2026')
  expect(invalidFormat.status()).toBe(422)
  const impossibleDate = await request.get('/api/overview?date=2026-02-30')
  expect(impossibleDate.status()).toBe(422)
  const repeatedDate = await request.get(`/api/overview?date=${selectedDate}&date=${futureDate}`)
  expect(repeatedDate.status()).toBe(422)

  const borrowerName = `Overview Date Filter ${testInfo.project.name} ${Date.now()}`
  const createdResponse = await request.post('/api/loans', {
    data: {
      borrower: { newBorrower: { displayName: borrowerName } },
      principalCentavos: 10000,
      dailyDueCentavos: 200,
      interestMode: 'added',
      interestCentavos: 2000,
      borrowedOn: selectedDate,
      paymentStartOn: selectedDate,
      dueOn: addDays(selectedDate, 59),
      collectionWeekdays: [1, 2, 3, 4, 5, 6, 7],
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const loan = await createdResponse.json()
  expect(loan.readiness).toBe('ready')

  try {
    for (const amountCentavos of [120, 300]) {
      const payment = await request.post(`/api/loans/${loan.id}/payments`, {
        data: {
          amountCentavos,
          paidOn: selectedDate,
          idempotencyKey: crypto.randomUUID(),
        },
      })
      expect(payment.ok()).toBeTruthy()
    }

    const ledger = await request.get(`/api/loans/${loan.id}/payments?pageSize=100`).then((response) => response.json())
    const paymentToReverse = ledger.rows.find(
      (row: any) => row.kind === 'payment' && Number(row.amount_centavos) === 300,
    )
    expect(paymentToReverse).toBeTruthy()
    const reversal = await request.post(`/api/payments/${paymentToReverse.id}/reverse`, {
      data: { reason: 'Overview date filter verification', idempotencyKey: crypto.randomUUID() },
    })
    expect(reversal.ok()).toBeTruthy()

    const currentOverview = await overview(request)
    const selectedOverview = await overview(request, selectedDate)
    const futureOverview = await overview(request, futureDate)

    expect(currentOverview.reportingDate).toBe(today)
    expect(currentOverview.expectedOnDateCentavos).toBe(currentOverview.expectedTodayCentavos)
    expect(currentOverview.collectedOnDateCentavos).toBe(currentOverview.collectedTodayCentavos)
    expect(selectedOverview.reportingDate).toBe(selectedDate)
    expect(selectedOverview.expectedOnDateCentavos - baselineSelected.expectedOnDateCentavos).toBe(200)
    expect(selectedOverview.collectedOnDateCentavos - baselineSelected.collectedOnDateCentavos).toBe(120)
    expect(futureOverview.expectedOnDateCentavos - baselineFuture.expectedOnDateCentavos).toBe(200)
    expect(futureOverview.collectedOnDateCentavos).toBe(baselineFuture.collectedOnDateCentavos)
    for (const key of nonDailyKeys) expect(selectedOverview[key]).toEqual(currentOverview[key])

    await page.goto('/')
    const dateInput = page.getByLabel('Overview date')
    await expect(dateInput).toHaveValue(today)
    await expect(page.getByText('Expected today', { exact: true })).toBeVisible()
    await expect(page.getByText('Actual today', { exact: true })).toBeVisible()

    const summary = page.getByTestId('overview-summary')
    const dailyMetrics = page.getByTestId('overview-daily-metrics')
    const summaryBefore = await summary.locator('p').allTextContents()
    const activeBefore = await dailyMetrics.locator('a').nth(0).locator('p').allTextContents()
    const overdueBefore = await dailyMetrics.locator('a').nth(1).locator('p').allTextContents()

    let delayed = true
    await page.route('**/api/overview?date=*', async (route) => {
      const date = new URL(route.request().url()).searchParams.get('date')
      if (date === selectedDate && delayed) {
        delayed = false
        const response = await route.fetch()
        await new Promise((resolve) => setTimeout(resolve, 500))
        await route.fulfill({ response })
        return
      }
      await route.continue()
    })
    await dateInput.fill(selectedDate)
    await dateInput.fill(futureDate)
    await expect(dateInput).toHaveValue(futureDate)
    await expect(page.getByText('Expected on selected date', { exact: true }).locator('..').locator('p').nth(1))
      .toHaveText(formatCentavos(futureOverview.expectedOnDateCentavos))
    await page.waitForTimeout(650)
    await expect(dateInput).toHaveValue(futureDate)
    await expect(page.getByText('Actual on selected date', { exact: true }).locator('..').locator('p').nth(1))
      .toHaveText(formatCentavos(futureOverview.collectedOnDateCentavos))
    await page.unroute('**/api/overview?date=*')

    let allowRetrySuccess = false
    await page.route('**/api/overview**', async (route) => {
      if (!allowRetrySuccess) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'test failure' }) })
        return
      }
      await route.continue()
    })
    await dateInput.fill(errorDate)
    await expect(page.getByRole('alert')).toContainText('Something went wrong.')
    await expect(dateInput).toHaveValue(errorDate)
    allowRetrySuccess = true
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByText('Expected on selected date', { exact: true })).toBeVisible()
    await expect(dateInput).toHaveValue(errorDate)
    await page.unroute('**/api/overview**')

    await dateInput.fill(selectedDate)
    await expect(page.getByText('Expected on selected date', { exact: true }).locator('..').locator('p').nth(1))
      .toHaveText(formatCentavos(selectedOverview.expectedOnDateCentavos))
    await expect(page.getByText('Actual on selected date', { exact: true }).locator('..').locator('p').nth(1))
      .toHaveText(formatCentavos(selectedOverview.collectedOnDateCentavos))
    expect(await summary.locator('p').allTextContents()).toEqual(summaryBefore)
    expect(await dailyMetrics.locator('a').nth(0).locator('p').allTextContents()).toEqual(activeBefore)
    expect(await dailyMetrics.locator('a').nth(1).locator('p').allTextContents()).toEqual(overdueBefore)

    if (testInfo.project.name === 'desktop-chrome') {
      await page.screenshot({
        path: testInfo.outputPath('overview-after.png'),
        clip: { x: 0, y: 0, width: 1440, height: 620 },
      })
    } else {
      await page.screenshot({ path: testInfo.outputPath('overview-after-mobile.png'), fullPage: false })
    }
  } finally {
    const current = await request.get(`/api/loans/${loan.id}`).then((response) => response.json())
    if (!current.loan.archived_at) {
      await request.post(`/api/loans/${loan.id}/archive`, {
        data: { archived: true, version: current.loan.version },
      })
    }
  }
})

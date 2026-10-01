import { test, expect } from '@playwright/test'

const ownerId = '22222222-2222-4222-8222-222222222222'

function overview(outstandingTodayCentavos: number) {
  return {
    principalRecordedCentavos: 72_000_000,
    interestRecordedCentavos: 0,
    totalPayableCentavos: 72_000_000,
    collectedInPeriodCentavos: 0,
    outstandingTodayCentavos,
    outstandingExcludedCount: 0,
    activeCount: 3,
    overdueCount: 0,
    expectedTodayCentavos: 60_000,
    sixMonthChart: [
      { month: '2026-05', collectedCentavos: 0 },
      { month: '2026-06', collectedCentavos: 0 },
      { month: '2026-07', collectedCentavos: 0 },
      { month: '2026-08', collectedCentavos: 0 },
      { month: '2026-09', collectedCentavos: 0 },
      { month: '2026-10', collectedCentavos: 0 },
    ],
    recentActivity: [],
  }
}

test('renders a numeric outstanding total instead of concatenated bigint strings', async ({ page }, testInfo) => {
  let response = overview(Number('120002400003600000000000000000000000'))
  await page.route('**/api/auth/session', route => route.fulfill({ json: {
    user: { id: ownerId, email: 'fixture@arawan.test' }, native: true,
  } }))
  await page.route('**/api/overview', route => route.fulfill({ json: response }))

  await page.goto('/')
  const outstanding = page.getByText('Outstanding today').locator('..').locator('p').nth(1)
  await expect(outstanding).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('before-concatenated-outstanding.png'), fullPage: true })

  response = overview(72_000_000)
  await page.reload()
  await expect(outstanding).toHaveText('₱720,000.00')
  await page.screenshot({ path: testInfo.outputPath('after-numeric-outstanding.png'), fullPage: true })
})

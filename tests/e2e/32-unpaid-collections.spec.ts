import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import pg from 'pg'
import { hasSession } from './helpers'

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Tests run outside the Nuxt app, so this duplicates shared/utils/dates.ts's
// isoWeekday() rather than importing it (same reason 29/26 re-implement the
// PHP currency formatter locally).
function isoWeekdayOf(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  const day0 = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay() // 0=Sun..6=Sat
  return day0 === 0 ? 7 : day0
}

// --------------------------------------------------------------------------
// Group A -- real data. The dev seed leaves dozens of loans already unpaid
// (readiness='ready', zero payment_entries), so these assert the rule --
// does THIS borrower appear, with THIS bucket -- read off the wire response,
// rather than asserting rendering position or exact row counts.
// --------------------------------------------------------------------------
test.describe('unpaid collections -- real data', () => {
  test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

  let loanIds: string[] = []
  let borrowerIds: string[] = []

  test.afterEach(async () => {
    if (loanIds.length === 0 && borrowerIds.length === 0) return

    const databaseUrl = process.env.ARAWAN_DATABASE_URL
    if (!databaseUrl) throw new Error('ARAWAN_DATABASE_URL is required to clean up unpaid-collections test data')
    const hostname = new URL(databaseUrl).hostname
    if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
      throw new Error(`Refusing unpaid-collections test cleanup against non-loopback database host: ${hostname}`)
    }

    const client = new pg.Client({ connectionString: databaseUrl })
    await client.connect()
    try {
      await client.query('begin')
      await client.query('delete from public.audit_events where entity_type = $1 and entity_id = any($2::uuid[])', ['loan', loanIds])
      await client.query("delete from public.mutation_requests where response_json->>'id' = any($1::text[])", [loanIds])
      await client.query('delete from public.payment_entries where loan_id = any($1::uuid[])', [loanIds])
      await client.query('delete from public.opening_balances where loan_id = any($1::uuid[])', [loanIds])
      await client.query('delete from public.loan_renewals where old_loan_id = any($1::uuid[]) or new_loan_id = any($1::uuid[])', [loanIds])
      await client.query('delete from public.loans where id = any($1::uuid[])', [loanIds])
      await client.query('delete from public.borrowers where id = any($1::uuid[])', [borrowerIds])
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      await client.end()
      loanIds = []
      borrowerIds = []
    }
  })

  async function createLoan(request: APIRequestContext, opts: {
    name: string
    dailyDueCentavos?: number
    collectionWeekdays?: number[]
  }) {
    const response = await request.post('/api/loans', {
      data: {
        borrower: { newBorrower: { displayName: opts.name } },
        principalCentavos: 600_00,
        dailyDueCentavos: opts.dailyDueCentavos ?? 100_00,
        interestMode: 'none',
        interestCentavos: 0,
        borrowedOn: today,
        paymentStartOn: today,
        dueOn: addDays(today, 59),
        collectionWeekdays: opts.collectionWeekdays ?? [1, 2, 3, 4, 5, 6, 7],
      },
    })
    expect(response.ok()).toBeTruthy()
    const loan = await response.json()
    expect(loan.readiness).toBe('ready')
    loanIds.push(loan.id)
    borrowerIds.push(loan.borrower_id)
    return loan
  }

  async function unpaidRow(request: APIRequestContext, date: string, borrowerName: string) {
    const response = await request.get(`/api/overview?date=${date}`)
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    return body.unpaid.rows.find((r: { borrowerDisplayName: string }) => r.borrowerDisplayName === borrowerName) ?? null
  }

  test('a loan with no payment on D appears with bucket "none"', async ({ request }, testInfo) => {
    const name = `E2E-UNPAID-${testInfo.project.name}-${Date.now()}-none`
    await createLoan(request, { name })

    const row = await unpaidRow(request, today, name)
    expect(row).toBeTruthy()
    expect(row.bucket).toBe('none')
    expect(row.paidCentavos).toBe(0)
  })

  test('a loan paid in full on D does not appear', async ({ request }, testInfo) => {
    const name = `E2E-UNPAID-${testInfo.project.name}-${Date.now()}-paid`
    const loan = await createLoan(request, { name, dailyDueCentavos: 100_00 })
    const payment = await request.post(`/api/loans/${loan.id}/payments`, {
      data: { amountCentavos: 100_00, paidOn: today, idempotencyKey: crypto.randomUUID() },
    })
    expect(payment.ok()).toBeTruthy()

    expect(await unpaidRow(request, today, name)).toBeNull()
  })

  test('a partial payment on D appears with bucket "short"', async ({ request }, testInfo) => {
    const name = `E2E-UNPAID-${testInfo.project.name}-${Date.now()}-short`
    const loan = await createLoan(request, { name, dailyDueCentavos: 100_00 })
    const payment = await request.post(`/api/loans/${loan.id}/payments`, {
      data: { amountCentavos: 40_00, paidOn: today, idempotencyKey: crypto.randomUUID() },
    })
    expect(payment.ok()).toBeTruthy()

    const row = await unpaidRow(request, today, name)
    expect(row).toBeTruthy()
    expect(row.bucket).toBe('short')
    expect(row.paidCentavos).toBe(40_00)
    expect(row.dueCentavos).toBe(100_00)
  })

  test('a reversed payment puts the borrower back on the list', async ({ request }, testInfo) => {
    const name = `E2E-UNPAID-${testInfo.project.name}-${Date.now()}-reversed`
    const loan = await createLoan(request, { name, dailyDueCentavos: 100_00 })
    const payment = await request.post(`/api/loans/${loan.id}/payments`, {
      data: { amountCentavos: 100_00, paidOn: today, idempotencyKey: crypto.randomUUID() },
    })
    expect(payment.ok()).toBeTruthy()
    expect(await unpaidRow(request, today, name)).toBeNull()

    const ledger = await request.get(`/api/loans/${loan.id}/payments?pageSize=100`).then((r) => r.json())
    const paymentToReverse = ledger.rows.find((row: any) => row.kind === 'payment' && Number(row.amount_centavos) === 100_00)
    expect(paymentToReverse).toBeTruthy()
    const reversal = await request.post(`/api/payments/${paymentToReverse.id}/reverse`, {
      data: { reason: 'Unpaid collections verification', idempotencyKey: crypto.randomUUID() },
    })
    expect(reversal.ok()).toBeTruthy()

    const row = await unpaidRow(request, today, name)
    expect(row).toBeTruthy()
    expect(row.bucket).toBe('none')
  })

  test('a loan not scheduled to collect on D never appears', async ({ request }, testInfo) => {
    const name = `E2E-UNPAID-${testInfo.project.name}-${Date.now()}-offsched`
    const weekdaysExcludingToday = [1, 2, 3, 4, 5, 6, 7].filter((d) => d !== isoWeekdayOf(today))
    await createLoan(request, { name, collectionWeekdays: weekdaysExcludingToday })

    expect(await unpaidRow(request, today, name)).toBeNull()
  })

  test('the Overview page renders the section with a seeded borrower', async ({ page, request }, testInfo) => {
    const name = `E2E-UNPAID-${testInfo.project.name}-${Date.now()}-ui`
    await createLoan(request, { name })

    const response = await request.get(`/api/overview?date=${today}`)
    const { unpaid } = await response.json()

    await page.goto('/')
    const section = page.getByTestId('unpaid-collections')
    await expect(section).toBeVisible()
    await expect(section).toContainText(`${unpaid.noPaymentCount} borrower`)
    // The seed data already has dozens of unpaid loans ahead of this one
    // alphabetically, so only assert presence once Short/paging aren't at
    // play -- page through until found, bounded by the known total.
    await section.getByTestId('unpaid-short-toggle').check()
    let found = false
    const maxPages = Math.max(1, Math.ceil(unpaid.rows.length / 20))
    for (let i = 0; i < maxPages; i += 1) {
      if (await section.getByText(name, { exact: true }).isVisible()) { found = true; break }
      const next = section.getByTestId('unpaid-next')
      if (await next.isDisabled()) break
      await next.click()
    }
    expect(found).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('unpaid-collections-real-data.png'), fullPage: true })
  })
})

// --------------------------------------------------------------------------
// Group B -- UI state. Pagination, page-reset, the empty state, and the
// Short toggle are pure client logic once `overview.unpaid` is in hand, so
// stub /api/overview for deterministic rows with no DB and no teardown
// (precedent: tests/e2e/23-no-interest-date-range.spec.ts).
// --------------------------------------------------------------------------

type MockUnpaidRow = {
  loanId: string
  borrowerDisplayName: string
  dueCentavos: number
  paidCentavos: number
  remainingCentavos: number
  daysMissed: number
  bucket: 'none' | 'short'
  displayStatus: string
}

function makeRows(count: number, bucket: 'none' | 'short' = 'none', offset = 0): MockUnpaidRow[] {
  return Array.from({ length: count }, (_, i) => ({
    loanId: `00000000-0000-4000-8000-${String(offset + i).padStart(12, '0')}`,
    borrowerDisplayName: `Mock Borrower ${String(offset + i + 1).padStart(2, '0')}`,
    dueCentavos: 10_000,
    paidCentavos: bucket === 'short' ? 4_000 : 0,
    remainingCentavos: 500_000,
    daysMissed: offset + i + 1,
    bucket,
    displayStatus: 'active',
  }))
}

function overviewFixture(date: string, rows: MockUnpaidRow[]) {
  return {
    reportingDate: date,
    principalRecordedCentavos: 1_000_000,
    interestRecordedCentavos: 100_000,
    totalPayableCentavos: 1_100_000,
    collectedInPeriodCentavos: 0,
    collectedTodayCentavos: 0,
    outstandingTodayCentavos: 1_100_000,
    outstandingExcludedCount: 0,
    activeCount: rows.length,
    overdueCount: 0,
    expectedTodayCentavos: 10_000,
    collectedOnDateCentavos: 0,
    expectedOnDateCentavos: 10_000,
    sixMonthChart: Array.from({ length: 6 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}`, collectedCentavos: 0 })),
    recentActivity: [],
    unpaid: {
      rows,
      noPaymentCount: rows.filter((r) => r.bucket === 'none').length,
      shortCount: rows.filter((r) => r.bucket === 'short').length,
    },
  }
}

async function mockOverview(page: Page, getRows: (date: string) => MockUnpaidRow[]) {
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: {
    user: { id: '22222222-2222-4222-8222-222222222222', email: 'fixture@arawan.test' }, native: true,
  } }))
  await page.route('**/api/overview**', async (route) => {
    const date = new URL(route.request().url()).searchParams.get('date') ?? today
    await route.fulfill({ json: overviewFixture(date, getRows(date)) })
  })
}

test('pagination: 23 unpaid rows split 20/3 across two pages', async ({ page }) => {
  await mockOverview(page, () => makeRows(23))
  await page.goto('/')

  const section = page.getByTestId('unpaid-collections')
  await expect(section).toContainText('23 borrowers')
  await expect(section.locator('li')).toHaveCount(20)
  await expect(section.getByTestId('unpaid-prev')).toBeDisabled()
  await expect(section.getByTestId('unpaid-next')).toBeEnabled()
  const page1Names = await section.locator('li p.font-medium').allTextContents()

  await section.getByTestId('unpaid-next').click()
  await expect(section.getByTestId('unpaid-page-indicator')).toHaveText('Page 2 of 2')
  await expect(section.locator('li')).toHaveCount(3)
  await expect(section.getByTestId('unpaid-next')).toBeDisabled()
  const page2Names = await section.locator('li p.font-medium').allTextContents()

  expect(page1Names.filter((name) => page2Names.includes(name))).toHaveLength(0)
})

test('changing the Overview date resets pagination to page 1', async ({ page }) => {
  await mockOverview(page, () => makeRows(23))
  await page.goto('/')

  const section = page.getByTestId('unpaid-collections')
  await section.getByTestId('unpaid-next').click()
  await expect(section.getByTestId('unpaid-page-indicator')).toHaveText('Page 2 of 2')

  const dateInput = page.getByLabel('Overview date')
  const otherDate = addDays(today, -1)
  await dateInput.fill(otherDate)
  await expect(section.getByTestId('unpaid-page-indicator')).toHaveText('Page 1 of 2')
})

test('empty state renders when every eligible loan paid on D', async ({ page }, testInfo) => {
  await mockOverview(page, () => [])
  await page.goto('/')

  const section = page.getByTestId('unpaid-collections')
  await expect(section).toContainText(`Everyone paid on`)
  await page.screenshot({ path: testInfo.outputPath('unpaid-collections-empty.png'), fullPage: true })
})

test('the Short toggle shows and hides short-bucket rows', async ({ page }, testInfo) => {
  const rows = [...makeRows(2, 'none'), ...makeRows(1, 'short', 2)]
  await mockOverview(page, () => rows)
  await page.goto('/')

  const section = page.getByTestId('unpaid-collections')
  await expect(section.locator('li')).toHaveCount(2)
  await expect(section).not.toContainText('Mock Borrower 03')

  await section.getByTestId('unpaid-short-toggle').check()
  await expect(section.locator('li')).toHaveCount(3)
  await expect(section).toContainText('Mock Borrower 03')
  await page.screenshot({ path: testInfo.outputPath('unpaid-collections-short-toggle.png'), fullPage: true })
})

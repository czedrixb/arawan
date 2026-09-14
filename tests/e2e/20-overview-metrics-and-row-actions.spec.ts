import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

// Mirrors shared/utils/dates.ts's addDaysIso exactly (tests run outside the
// Nuxt app, so this can't import the real one -- see 19-add-loan-standard-terms.spec.ts).
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

// Mirrors shared/utils/money.ts's formatCentavos exactly (thousands
// separators mean a naive .toFixed(2) substring check doesn't match it).
const PHP_FORMATTER = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
function formatCentavos(centavos: number): string {
  return PHP_FORMATTER.format(centavos / 100)
}

// loans/borrowers have no delete grant at all (supabase/migrations/0007_rls_grants.sql:
// "full CRUD except delete" -- append-only, financial audit trail). Archiving is the
// closest thing to cleanup the app supports, so every loan created here gets archived
// once its test is done instead of left dangling as live "active" data.
async function archiveLoan(request: import('@playwright/test').APIRequestContext, loan: any) {
  await request.post(`/api/loans/${loan.id}/archive`, { data: { archived: true, version: loan.version } })
}

test('editing Amount recomputes Interest and Daily live, and Expected today reflects the change', async ({ page, request }, testInfo) => {
  const borrowerName = `Expected Today Test ${Date.now()}`
  const today = new Date().toISOString().slice(0, 10)

  // dailyDueCentavos is deliberately mismatched with the (principal+20%)/60
  // formula here -- standing in for a loan whose daily due went stale after
  // a prior principal edit, the bug this test guards against.
  const created = await request.post('/api/loans', {
    data: {
      borrower: { newBorrower: { displayName: borrowerName } },
      principalCentavos: 500000, // ₱5,000.00
      dailyDueCentavos: 100, // ₱1.00 -- stale/mismatched on purpose
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
    const before = await request.get('/api/overview').then((r) => r.json())

    await page.goto('/records')
    await page.getByPlaceholder('Search records').fill(borrowerName)
    await page.waitForTimeout(400) // debounce

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
    // Stored (stale) values load as-is -- no recompute on open.
    await expect(page.getByLabel('Amount (₱)')).toHaveValue('5000.00')
    await expect(page.getByLabel('Daily (₱)')).toHaveValue('1.00')

    // Editing Amount live-recomputes Interest (20%) and Daily ((principal+interest)/60).
    await page.getByLabel('Amount (₱)').fill('6000')
    await expect(page.getByLabel('Interest (₱)')).toHaveValue('1200.00')
    await expect(page.getByLabel('Daily (₱)')).toHaveValue('120.00')
    await page.screenshot({ path: testInfo.outputPath('edit-sheet-live-derivation.png'), fullPage: true })

    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Record updated')).toBeVisible()

    const after = await request.get('/api/overview').then((r) => r.json())
    // 12000 (new daily) - 100 (old daily) -- this loan is the only thing
    // that changed between the two overview snapshots.
    expect(after.expectedTodayCentavos - before.expectedTodayCentavos).toBe(11900)

    await page.goto('/')
    const expectedTodayValue = page.getByText('Expected today').locator('..').locator('p').nth(1)
    await expect(expectedTodayValue).toHaveText(formatCentavos(after.expectedTodayCentavos))
    await page.screenshot({ path: testInfo.outputPath('overview-expected-today-after.png'), fullPage: true })
  } finally {
    await archiveLoan(request, loan)
  }
})

test('a loan with a future payment start reads Active, and Upcoming is no longer a status', async ({ page, request }, testInfo) => {
  const borrowerName = `Future Start Test ${Date.now()}`
  const today = new Date().toISOString().slice(0, 10)
  const future = addDays(today, 10)

  const created = await request.post('/api/loans', {
    data: {
      borrower: { newBorrower: { displayName: borrowerName } },
      principalCentavos: 100000,
      dailyDueCentavos: 2000,
      interestMode: 'none',
      interestCentavos: 0,
      borrowedOn: today,
      paymentStartOn: future,
      dueOn: addDays(future, 59),
      collectionWeekdays: [1, 2, 3, 4, 5, 6, 7],
    },
  })
  expect(created.ok()).toBeTruthy()
  const loan = await created.json()

  try {
    expect(loan.display_status).toBe('active')

    await page.goto('/records')
    await page.getByPlaceholder('Search records').fill(borrowerName)
    await page.waitForTimeout(400)
    const row = page.locator('tr:visible, li:visible').filter({ hasText: borrowerName }).first()
    await expect(row).toBeVisible()
    await expect(row.getByText('Active', { exact: true })).toBeVisible()
    await expect(row.getByText('Upcoming', { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: /^Filter/ }).click()
    await expect(page.getByRole('button', { name: 'Upcoming', exact: true })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('filter-sheet-no-upcoming.png'), fullPage: true })
  } finally {
    await archiveLoan(request, loan)
  }
})

test('Records opens in stable record-number order by default', async ({ page }, testInfo) => {
  await page.goto('/records')
  // Wait for the async loan list to actually render before reading rows --
  // otherwise this can race the initial fetch and see an empty skeleton.
  await expect(page.locator('table tbody tr:visible, ul li:visible').first()).toBeVisible()

  let sequence: number[]
  if (testInfo.project.name === 'desktop-chrome') {
    const cells = await page.locator('table tbody tr td:first-child').allTextContents()
    sequence = cells.filter((c) => c !== '—').map(Number)
  } else {
    const texts = await page.locator('ul li:visible').allTextContents()
    sequence = texts
      .map((t) => t.match(/^(\d+)\./)?.[1])
      .filter((v): v is string => v !== undefined)
      .map(Number)
  }

  expect(sequence.length).toBeGreaterThan(1)
  for (let i = 1; i < sequence.length; i++) {
    expect(sequence[i]).toBeGreaterThan(sequence[i - 1])
  }
  await page.screenshot({ path: testInfo.outputPath('records-default-numbering.png'), fullPage: true })
})

test('desktop row actions expose a kebab menu with View details, instead of only the name link', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'desktop-only row actions')

  await page.goto('/records?q=JINKY%20C.%20JUAMAN')
  const row = page.locator('table tbody tr', { hasText: 'JINKY C. JUAMAN' }).first()
  await expect(row).toBeVisible()

  await row.getByRole('button', { name: 'Actions for JINKY C. JUAMAN' }).click()
  await expect(page.getByRole('menuitem', { name: 'View details' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Record payment' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('desktop-row-menu-open.png'), fullPage: true })

  await page.getByRole('menuitem', { name: 'View details' }).click()
  await page.waitForURL('**/records/*')
  await expect(page.getByRole('button', { name: 'More actions' })).toBeVisible()
})

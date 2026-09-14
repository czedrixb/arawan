import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

// Regression coverage for the Records "#" column: it used to render the
// permanent, per-owner loans.source_sequence verbatim (LoanTable.vue /
// LoanListItem.vue). That number survives archiving -- there is no loan
// DELETE grant at all (0007_rls_grants.sql) -- so any archived loan left a
// permanent hole in the visible list (e.g. ...42, 51...). The fix renders a
// positional row number instead: (page-1)*pageSize + index + 1, always
// contiguous regardless of what's hidden or how it's sorted.

// loans/borrowers have no delete grant (append-only, financial audit
// trail) -- mirrors the archiveLoan helper in
// 20-overview-metrics-and-row-actions.spec.ts.
async function archiveLoan(request: import('@playwright/test').APIRequestContext, loan: any) {
  await request.post(`/api/loans/${loan.id}/archive`, { data: { archived: true, version: loan.version } })
}

async function createLoan(request: import('@playwright/test').APIRequestContext, name: string) {
  const today = new Date().toISOString().slice(0, 10)
  const created = await request.post('/api/loans', {
    data: {
      borrower: { newBorrower: { displayName: name } },
      principalCentavos: 100000,
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
  return created.json()
}

async function readDesktopNumbers(page: import('@playwright/test').Page) {
  await expect(page.locator('table tbody tr:visible, ul li:visible').first()).toBeVisible()
  const cells = await page.locator('table tbody tr td:first-child').allTextContents()
  return cells.map(Number)
}

async function readMobileNumbers(page: import('@playwright/test').Page) {
  await expect(page.locator('table tbody tr:visible, ul li:visible').first()).toBeVisible()
  const texts = await page.locator('ul li:visible').allTextContents()
  return texts.map((t) => Number(t.match(/^(\d+)\./)?.[1])).filter((n) => !Number.isNaN(n))
}

function expectContiguousFrom(numbers: number[], start: number) {
  expect(numbers.length).toBeGreaterThan(0)
  numbers.forEach((n, i) => expect(n).toBe(start + i))
}

test('Records "#" column has no gaps on page 1', async ({ page }, testInfo) => {
  await page.goto('/records')
  const numbers = testInfo.project.name === 'desktop-chrome' ? await readDesktopNumbers(page) : await readMobileNumbers(page)
  expectContiguousFrom(numbers, 1)
})

test('archiving a row does not leave a gap in the visible numbering', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'single-page-size assertion, desktop-only to avoid double work')

  const borrowerName = `Gap Numbering Test ${Date.now()}`
  const loan = await createLoan(request, borrowerName)
  try {
    await page.goto('/records')
    const before = await readDesktopNumbers(page)
    expectContiguousFrom(before, 1)

    await archiveLoan(request, loan)
    await page.reload()
    const after = await readDesktopNumbers(page)
    // Same page, one fewer row hidden by the default archived='exclude'
    // filter -- still 1..n with no hole where the archived loan used to be.
    expectContiguousFrom(after, 1)
  } finally {
    // Loan is already archived (that's the scenario under test) -- nothing
    // further to clean up.
  }
})

test('page 2 continues the count from the end of page 1', async ({ page, request }) => {
  const totalBefore = await request.get('/api/loans?pageSize=25&page=1').then((r) => r.json()).then((d) => d.total)
  test.skip(totalBefore < 26, 'needs more than one page of records to exist')

  await page.goto('/records?page=2')
  const numbers = await readDesktopNumbers(page)
  expect(numbers[0]).toBe(26)
})

test('numbering stays positional under a non-default sort', async ({ page }) => {
  await page.goto('/records?sort=name_asc')
  const numbers = await readDesktopNumbers(page)
  expectContiguousFrom(numbers, 1)
})

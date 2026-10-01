import { test, expect, type Page } from '@playwright/test'

const loan = {
  id: '11111111-1111-4111-8111-111111111111',
  owner_id: '22222222-2222-4222-8222-222222222222',
  borrower_id: '33333333-3333-4333-8333-333333333333',
  borrower_display_name: 'No Interest Fixture',
  borrower_normalized_name: 'no interest fixture',
  borrower_archived_at: null,
  borrower_version: 1,
  source_sequence: 1,
  currency: 'PHP',
  principal_centavos: 9_120_000,
  daily_due_centavos: 182_400,
  interest_mode: 'added',
  interest_centavos: 1_824_000,
  total_payable_centavos: 10_944_000,
  borrowed_on: '2026-10-01',
  payment_start_on: '2026-10-02',
  due_on: '2027-01-28',
  legacy_completed_on: null,
  legacy_percent_value: null,
  collection_weekdays: [1, 2, 3, 4, 5, 6, 7],
  readiness: 'ready',
  archived_at: null,
  source_import_row_id: null,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
  version: 1,
  opening_collected_centavos: 0,
  net_payments_centavos: 0,
  recognized_collected_centavos: 0,
  remaining_centavos: 10_944_000,
  progress_pct: 0,
  completed_on: null,
  display_status: 'active',
  financial_terms_locked: false,
}

async function mockLoanList(page: Page, rows: typeof loan[] = []) {
  await page.route('**/api/auth/session', route => route.fulfill({ json: {
    user: { id: loan.owner_id, email: 'fixture@arawan.test' }, native: true,
  } }))
  await page.route('**/api/loans**', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({ json: { rows, total: rows.length, page: 1, pageSize: 25 } })
      return
    }
    await route.fallback()
  })
}

test('calculates an inclusive no-interest daily amount without saving test data', async ({ page }, testInfo) => {
  let submitted: any = null
  await mockLoanList(page)
  await page.route('**/api/loans', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    submitted = route.request().postDataJSON()
    await route.fulfill({ status: 201, json: loan })
  })

  await page.goto('/records')
  await page.getByRole('button', { name: '+ Add loan' }).or(page.getByRole('button', { name: '+ Add' })).first().click()
  await page.getByRole('button', { name: 'New borrower' }).click()
  await page.getByPlaceholder('Full name').fill('Ephemeral No Interest Borrower')
  await page.getByLabel('Principal (₱)').fill('91200')
  await page.getByLabel('Borrowed on').fill('2026-10-01')
  await page.screenshot({ path: testInfo.outputPath('before-standard-terms.png'), fullPage: true })
  await page.getByRole('button', { name: 'No interest' }).click()
  await page.getByLabel('Due date').fill('2027-01-28')

  await expect(page.getByLabel('Payment start')).toHaveValue('2026-10-01')
  await expect(page.getByLabel('Interest (₱)')).toHaveValue('0.00')
  await expect(page.getByLabel('Daily due (₱)')).toHaveValue('760.00')
  const preview = page.locator('section', { hasText: 'Preview' })
  await expect(preview.getByText('₱91,200.00')).toBeVisible()
  await expect(preview.getByText('120 collection days')).toBeVisible()
  await expect(preview.locator('dd', { hasText: /^120$/ })).toBeVisible()
  await expect(preview.getByText('Jan 28, 2027')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('after-no-interest.png'), fullPage: true })

  // Removing Sunday proves the calculation follows enabled collection days.
  await page.getByText('Collection days').locator('..').getByRole('button').nth(6).click()
  await expect(preview.getByText('103 collection days')).toBeVisible()
  await expect(page.getByLabel('Daily due (₱)')).toHaveValue('885.44')
  await expect(preview.getByText('₱885.12')).toBeVisible()

  await page.getByRole('button', { name: 'Save loan' }).click()
  await expect.poll(() => submitted).not.toBeNull()
  expect(submitted).toMatchObject({
    principalCentavos: 9_120_000,
    dailyDueCentavos: 88_544,
    interestMode: 'none',
    interestCentavos: 0,
    borrowedOn: '2026-10-01',
    paymentStartOn: '2026-10-01',
    dueOn: '2027-01-28',
    collectionWeekdays: [1, 2, 3, 4, 5, 6],
  })
})

test('switches an unlocked existing loan to date-based no-interest terms', async ({ page }, testInfo) => {
  let submitted: any = null
  await mockLoanList(page, [loan])
  await page.route(`**/api/borrowers/${loan.borrower_id}`, route => route.fulfill({ json: {
    id: loan.borrower_id,
    owner_id: loan.owner_id,
    display_name: loan.borrower_display_name,
    normalized_name: loan.borrower_normalized_name,
    phone: null,
    notes: null,
    archived_at: null,
    created_at: loan.created_at,
    updated_at: loan.updated_at,
    version: 1,
  } }))
  await page.route(`**/api/loans/${loan.id}/details`, async (route) => {
    submitted = route.request().postDataJSON()
    await route.fulfill({ json: { ...loan, ...{
      interest_mode: 'none', interest_centavos: 0, daily_due_centavos: 76_000,
      total_payable_centavos: 9_120_000, payment_start_on: '2026-10-01', version: 2,
    } } })
  })

  await page.goto('/records')
  if (testInfo.project.name === 'desktop-chrome') {
    await page.getByRole('button', { name: `Actions for ${loan.borrower_display_name}` }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
  } else {
    await page.getByRole('button', { name: `Show actions for ${loan.borrower_display_name}` }).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
  }

  await page.getByRole('button', { name: 'No interest' }).click()
  await expect(page.getByLabel('Payment Start')).toHaveValue('2026-10-01')
  await expect(page.getByLabel('Interest (₱)')).toHaveValue('0.00')
  await expect(page.getByLabel('Daily (₱)')).toHaveValue('760.00')
  await page.screenshot({ path: testInfo.outputPath('after-edit-no-interest.png'), fullPage: true })
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect.poll(() => submitted).not.toBeNull()
  expect(submitted).toMatchObject({
    principalCentavos: 9_120_000,
    dailyDueCentavos: 76_000,
    interestCentavos: 0,
    borrowedOn: '2026-10-01',
    paymentStartOn: '2026-10-01',
    dueOn: '2027-01-28',
  })
})

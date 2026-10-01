import { test, expect } from '@playwright/test'

test('an invalid local record date does not block Records or Add loan', async ({ page }, testInfo) => {
  const ownerId = '22222222-2222-4222-8222-222222222222'
  const loan = {
    id: '11111111-1111-4111-8111-111111111111',
    owner_id: ownerId,
    borrower_id: '33333333-3333-4333-8333-333333333333',
    borrower_display_name: 'Malformed Date Fixture',
    borrower_normalized_name: 'malformed date fixture',
    borrower_archived_at: null,
    borrower_version: 1,
    source_sequence: 1,
    currency: 'PHP',
    principal_centavos: 100_000,
    daily_due_centavos: 2_000,
    interest_mode: 'none',
    interest_centavos: 0,
    total_payable_centavos: 100_000,
    borrowed_on: 'not-a-date',
    payment_start_on: '2026-10-01T00:00:00.000Z',
    due_on: '2026-02-31',
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
    remaining_centavos: 100_000,
    progress_pct: 0,
    completed_on: null,
    display_status: 'active',
    financial_terms_locked: false,
  }

  await page.route('**/api/auth/session', route => route.fulfill({ json: {
    user: { id: ownerId, email: 'fixture@arawan.test' }, native: true,
  } }))
  await page.route('**/api/loans**', route => route.fulfill({ json: {
    rows: [loan], total: 1, page: 1, pageSize: 25,
  } }))

  await page.goto('/records')
  await expect(page.locator('a:visible:has-text("Malformed Date Fixture"), p:visible:has-text("Malformed Date Fixture")').first()).toBeVisible()
  await expect(page.locator(':visible:text-is("—")').first()).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('records-invalid-date-safe.png'), fullPage: true })

  await page.getByRole('button', { name: '+ Add loan' }).or(page.getByRole('button', { name: '+ Add' })).first().click()
  await expect(page.getByRole('heading', { name: 'Add loan' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('add-loan-opens-after-invalid-date.png'), fullPage: true })
})

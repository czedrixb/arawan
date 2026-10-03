import { test, expect } from '@playwright/test'
import pg from 'pg'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

let testLoanId: string | undefined
let testBorrowerId: string | undefined

test.afterEach(async () => {
  if (!testLoanId || !testBorrowerId) return

  const databaseUrl = process.env.ARAWAN_DATABASE_URL
  if (!databaseUrl) throw new Error('ARAWAN_DATABASE_URL is required to clean up ledger test data')
  const hostname = new URL(databaseUrl).hostname
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
    throw new Error(`Refusing ledger test cleanup against non-loopback database host: ${hostname}`)
  }

  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    await client.query('begin')
    await client.query('delete from public.audit_events where entity_type = $1 and entity_id = $2', ['loan', testLoanId])
    await client.query("delete from public.mutation_requests where response_json->>'id' = $1", [testLoanId])
    await client.query('delete from public.payment_entries where loan_id = $1', [testLoanId])
    await client.query('delete from public.opening_balances where loan_id = $1', [testLoanId])
    await client.query('delete from public.loan_renewals where old_loan_id = $1 or new_loan_id = $1', [testLoanId])
    await client.query('delete from public.loans where id = $1', [testLoanId])
    await client.query('delete from public.borrowers where id = $1', [testBorrowerId])
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    await client.end()
    testLoanId = undefined
    testBorrowerId = undefined
  }
})

test('partial payment, over-payment rejection, and reversal reopening', async ({ page, request }, testInfo) => {
  // Seed a small loan directly through the API so this test doesn't
  // depend on 03-loans having run first.
  const created = await request.post('/api/loans', {
    data: {
      borrower: { newBorrower: { displayName: `Ledger Test ${Date.now()}` } },
      principalCentavos: 20000,
      dailyDueCentavos: 5000,
      interestMode: 'none',
      interestCentavos: 0,
      borrowedOn: new Date().toISOString().slice(0, 10),
      paymentStartOn: new Date().toISOString().slice(0, 10),
      dueOn: new Date().toISOString().slice(0, 10),
      collectionWeekdays: [1, 2, 3, 4, 5, 6, 7],
    },
  })
  expect(created.ok()).toBeTruthy()
  const loan = await created.json()
  testLoanId = loan.id
  testBorrowerId = loan.borrower_id

  await page.goto(`/records/${loan.id}`)
  await page.getByTestId('loan-detail-record-payment').click()
  await page.getByLabel('Amount (₱)').fill('50.00')
  await page.screenshot({ path: testInfo.outputPath('before-save-payment.png'), fullPage: true })
  await page.getByRole('button', { name: 'Save payment' }).click()
  // ToastHost's "Payment saved" and the sheet's own inline "Payment
  // saved." status text both match a non-exact getByText -- pin to the
  // toast specifically.
  await expect(page.getByText('Payment saved', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('after-save-payment.png'), fullPage: true })

  // Over-payment beyond the remaining balance is rejected.
  await page.getByTestId('loan-detail-record-payment').click()
  await page.getByLabel('Amount (₱)').fill('999999')
  await page.getByRole('button', { name: 'Save payment' }).click()
  await expect(page.getByText(/exceeds/i)).toBeVisible()
  await page.keyboard.press('Escape')

  // Reversal reopens the loan for further payment.
  await page.getByRole('tab', { name: 'Payments' }).click()
  await page.getByRole('button', { name: 'Reverse' }).first().click()
  await page.getByPlaceholder('e.g. entered wrong amount').fill('test reversal')
  await page.getByRole('button', { name: 'Reverse payment' }).click()
  await expect(page.getByText('Payment reversed')).toBeVisible()
  await expect(page.getByText('(reversed)')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('payment-reversed.png'), fullPage: true })
})

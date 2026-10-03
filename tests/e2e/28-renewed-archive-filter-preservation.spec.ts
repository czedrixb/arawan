import { test, expect } from '@playwright/test'
import pg from 'pg'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured owner session')

let oldLoanId: string | undefined
let newLoanId: string | undefined
let borrowerId: string | undefined

test.afterEach(async () => {
  if (!oldLoanId || !newLoanId || !borrowerId) return

  const databaseUrl = process.env.ARAWAN_DATABASE_URL
  if (!databaseUrl) throw new Error('ARAWAN_DATABASE_URL is required to clean up renewed-loan test data')
  const hostname = new URL(databaseUrl).hostname
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
    throw new Error(`Refusing renewed-loan test cleanup against non-loopback database host: ${hostname}`)
  }

  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    await client.query('begin')
    await client.query('delete from public.audit_events where entity_type = $1 and entity_id = any($2::uuid[])', ['loan', [oldLoanId, newLoanId]])
    await client.query(`delete from public.mutation_requests
      where response_json->>'id' = any($1::text[])
         or response_json->'oldLoan'->>'id' = any($1::text[])
         or response_json->'newLoan'->>'id' = any($1::text[])`, [[oldLoanId, newLoanId]])
    await client.query('delete from public.payment_entries where loan_id = any($1::uuid[])', [[oldLoanId, newLoanId]])
    await client.query('delete from public.opening_balances where loan_id = any($1::uuid[])', [[oldLoanId, newLoanId]])
    await client.query('delete from public.loan_renewals where old_loan_id = $1 or new_loan_id = $2', [oldLoanId, newLoanId])
    await client.query('delete from public.loans where id = any($1::uuid[])', [[oldLoanId, newLoanId]])
    await client.query('delete from public.borrowers where id = $1', [borrowerId])
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    await client.end()
    oldLoanId = undefined
    newLoanId = undefined
    borrowerId = undefined
  }
})

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
}

test('archives a renewed loan and keeps record filters while details are open', async ({ page, request }, testInfo) => {
  const date = today()
  const name = `Renewed Archive ${Date.now()}`
  const createdResponse = await request.post('/api/loans', { data: {
    borrower: { newBorrower: { displayName: name } },
    principalCentavos: 100000,
    dailyDueCentavos: 2000,
    interestMode: 'added',
    interestCentavos: 20000,
    borrowedOn: date,
    paymentStartOn: date,
    dueOn: date,
    collectionWeekdays: [1, 2, 3, 4, 5],
  } })
  expect(createdResponse.ok()).toBeTruthy()
  const oldLoan = await createdResponse.json()
  oldLoanId = oldLoan.id
  borrowerId = oldLoan.borrower_id

  const renewedResponse = await request.post(`/api/loans/${oldLoan.id}/renew`, { data: {
    version: oldLoan.version,
    idempotencyKey: crypto.randomUUID(),
    effectiveOn: date,
    renewalPaymentCentavos: 0,
    waivedInterestCentavos: 0,
    additionalCashCentavos: 0,
    collectionWeekdays: [1, 2, 3, 4, 5],
    newTerm: 'standard',
  } })
  expect(renewedResponse.status()).toBe(201)
  const renewal = await renewedResponse.json()
  newLoanId = renewal.newLoan.id

  await page.goto(`/records?q=${encodeURIComponent(name)}&status=renewed&archived=include`)
  await expect(page.getByText('1 records')).toBeVisible()
  const renewedRecordLink = page.locator(`a[href^="/records/${oldLoan.id}"]`).filter({ hasText: name, visible: true })
  await expect(renewedRecordLink).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('filtered-list-before-details.png'), fullPage: true })

  await renewedRecordLink.click()
  await expect(page).toHaveURL(new RegExp(`/records/${oldLoan.id}.*q=Renewed.*status=renewed`))
  await expect(page.getByText('1 records')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('renewed-detail-before-archive.png'), fullPage: true })

  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByText('Archive', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Archive this loan?' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm' }).click()

  await page.getByRole('button', { name: 'More actions' }).click()
  await expect(page.getByText('Restore', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('renewed-detail-after-archive.png'), fullPage: true })

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page).toHaveURL(new RegExp(`/records\?.*q=Renewed.*status=renewed`))
  await expect(page.getByText('No records match these filters.')).toBeVisible()
})

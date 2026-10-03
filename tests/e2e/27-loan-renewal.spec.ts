import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured owner session')

function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()) }

test('renews from a principal, derives cash released, and makes the predecessor read-only', async ({ page, request }, testInfo) => {
  const name = `Renewal E2E ${Date.now()}`
  const date = today()
  const createdResponse = await request.post('/api/loans', { data: {
    borrower: { newBorrower: { displayName: name } }, principalCentavos: 1000000,
    dailyDueCentavos: 20000, interestMode: 'added', interestCentavos: 200000,
    borrowedOn: date, paymentStartOn: date, dueOn: date, collectionWeekdays: [1,3,5],
  } })
  expect(createdResponse.ok()).toBeTruthy()
  const oldLoan = await createdResponse.json()

  await page.goto(`/records/${oldLoan.id}`)
  await expect(page.getByText(name)).toBeVisible()
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByTestId('detail-renew-loan').click()

  const calculation = page.getByTestId('renewal-calculation')
  await expect(calculation).toContainText('Old outstanding balance')
  await expect(calculation).toContainText('₱12,000.00')
  await expect(calculation).toContainText('Cash released')
  await expect(calculation).toContainText('₱0.00')
  await expect(page.getByTestId('renew-adjustments')).toHaveCount(0)
  await calculation.screenshot({ path: testInfo.outputPath('renewal-before.png') })

  const renewalPrincipal = page.getByTestId('renew-principal')
  await expect(renewalPrincipal).toHaveValue('')
  await renewalPrincipal.pressSequentially('1000')
  await expect(renewalPrincipal).toHaveValue('1000')
  await renewalPrincipal.blur()
  await expect(renewalPrincipal).toHaveValue('1000.00')

  await renewalPrincipal.fill('11500')
  await expect(page.getByTestId('renew-principal-error')).toContainText('at least the adjusted outstanding balance')
  await expect(page.getByTestId('confirm-renewal')).toBeDisabled()

  await page.getByTestId('renew-adjust-toggle').click()
  await expect(page.getByTestId('renew-payment')).toHaveValue('')
  await expect(page.getByTestId('renew-waiver')).toHaveValue('')
  await expect(page.getByTestId('renew-standard-term')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('renew-weekday-1')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('renew-weekday-2')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('renew-weekday-3')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('renew-weekday-5')).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('renew-payment').fill('500')
  await page.getByTestId('renew-waiver').fill('250')
  await page.getByTestId('renew-waiver-note').fill('Owner-approved settlement waiver')
  await page.getByTestId('renew-principal').fill('12250')
  await expect(calculation).toContainText('₱11,250.00')
  await expect(calculation).toContainText('₱12,250.00')
  await expect(calculation).toContainText('₱1,000.00')

  await page.getByTestId('renew-no-interest-term').click()
  await expect(page.getByTestId('renew-due-on')).toBeVisible()
  await page.getByTestId('renew-standard-term').click()
  await expect(page.getByTestId('renew-due-on')).toHaveCount(0)
  await calculation.scrollIntoViewIfNeeded()
  await calculation.screenshot({ path: testInfo.outputPath('renewal-after.png') })

  await page.getByTestId('confirm-renewal').click()
  await expect(page.getByTestId('renewed-from-link')).toBeVisible()
  const newId = page.url().split('/').pop()!
  expect(newId).not.toBe(oldLoan.id)
  const newDetails = await request.get(`/api/loans/${newId}`).then(r => r.json())
  expect(newDetails.loan.principal_centavos).toBe(1225000)
  expect(newDetails.loan.interest_centavos).toBe(245000)
  expect(newDetails.loan.collection_weekdays).toEqual([1,3,5])

  await page.getByTestId('renewed-from-link').click()
  await expect(page.getByText('Renewed', { exact: true })).toBeVisible()
  await expect(page.getByTestId('renewed-to-link')).toBeVisible()
  await expect(page.getByTestId('renewal-settlement')).toContainText('₱250.00')
  await expect(page.getByTestId('renewal-settlement')).toContainText('₱1,000.00')
  await expect(page.getByTestId('loan-detail-record-payment')).toHaveCount(0)
  await page.getByRole('button', { name: 'More actions' }).click()
  await expect(page.getByText('Edit record', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Renew loan', { exact: true })).toHaveCount(0)

  const renewedList = await request.get('/api/loans?status=renewed&pageSize=100').then(r => r.json())
  expect(renewedList.rows.some((row:any) => row.id === oldLoan.id)).toBeTruthy()
  const activeList = await request.get('/api/loans?status=active&pageSize=100').then(r => r.json())
  expect(activeList.rows.some((row:any) => row.id === oldLoan.id)).toBeFalsy()
  const duplicate = await request.post(`/api/loans/${oldLoan.id}/renew`, { data: {
    version: oldLoan.version, idempotencyKey: crypto.randomUUID(), effectiveOn: date,
    renewalPaymentCentavos: 0, waivedInterestCentavos: 0, additionalCashCentavos: 0,
    collectionWeekdays: [1,3,5], newTerm: 'standard',
  } })
  expect(duplicate.status()).toBe(409)
  const invalidDate = await request.post(`/api/loans/${newId}/renew`, { data: {
    version: 1, idempotencyKey: crypto.randomUUID(), effectiveOn: '2000-01-01',
    renewalPaymentCentavos: 0, waivedInterestCentavos: 0, additionalCashCentavos: 0,
    collectionWeekdays: [1,3,5], newTerm: 'standard',
  } })
  expect(invalidDate.status()).toBe(422)
  await request.post(`/api/loans/${newId}/archive`, { data: { archived: true, version: newDetails.loan.version } })
})

test('renews no-interest debt into independent no-interest terms and replays the same key', async ({ request }) => {
  const date = today()
  const created = await request.post('/api/loans', { data: {
    borrower: { newBorrower: { displayName: `Renewal API ${Date.now()}` } }, principalCentavos: 500000,
    dailyDueCentavos: 500000, interestMode: 'none', interestCentavos: 0,
    borrowedOn: date, paymentStartOn: date, dueOn: date, collectionWeekdays: [1,2,3,4,5,6,7],
  } }).then(r => r.json())
  const key = crypto.randomUUID()
  const payload = { version: created.version, idempotencyKey: key, effectiveOn: date,
    renewalPaymentCentavos: 100000, waivedInterestCentavos: 0, additionalCashCentavos: 50000,
    collectionWeekdays: [1,2,3,4,5,6,7], newTerm: 'none', noInterestDueOn: date }
  const firstResponse = await request.post(`/api/loans/${created.id}/renew`, { data: payload })
  expect(firstResponse.status()).toBe(201)
  const first = await firstResponse.json()
  expect(first.renewal.carried_principal_centavos).toBe(400000)
  expect(first.renewal.additional_cash_centavos).toBe(50000)
  expect(first.newLoan.principal_centavos).toBe(450000)
  expect(first.newLoan.interest_centavos).toBe(0)
  const retryResponse = await request.post(`/api/loans/${created.id}/renew`, { data: payload })
  expect(retryResponse.status()).toBe(201)
  const retry = await retryResponse.json()
  expect(retry.newLoan.id).toBe(first.newLoan.id)
  await request.post(`/api/loans/${first.newLoan.id}/archive`, { data: { archived: true, version: first.newLoan.version } })
})

import { test, expect, type APIRequestContext } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())

async function createLoan(request: APIRequestContext, borrowerName: string) {
  const response = await request.post('/api/loans', {
    data: {
      borrower: { newBorrower: { displayName: borrowerName } },
      principalCentavos: 10000,
      dailyDueCentavos: 1000,
      interestMode: 'none',
      interestCentavos: 0,
      borrowedOn: today,
      paymentStartOn: today,
      dueOn: today,
      collectionWeekdays: [1, 2, 3, 4, 5, 6, 7],
    },
  })
  expect(response.ok()).toBeTruthy()
  return response.json()
}

test('the five most recently recorded payments refresh in Recent activity', async ({ page, request }, testInfo) => {
  const runId = Date.now()
  const loans: any[] = []

  try {
    // Seed five entries in creation order. Archive the oldest loan to prove
    // activity still resolves borrower names for archived records.
    for (let index = 0; index < 5; index += 1) {
      const loan = await createLoan(request, `Recent ${runId}-${index + 1}`)
      loans.push(loan)
      const payment = await request.post(`/api/loans/${loan.id}/payments`, {
        data: {
          amountCentavos: 100 + index,
          paidOn: today,
          idempotencyKey: crypto.randomUUID(),
        },
      })
      expect(payment.ok()).toBeTruthy()
    }

    const oldestCurrent = await request.get(`/api/loans/${loans[0].id}`).then((response) => response.json())
    const archived = await request.post(`/api/loans/${loans[0].id}/archive`, {
      data: { archived: true, version: oldestCurrent.loan.version },
    })
    expect(archived.ok()).toBeTruthy()

    await page.goto('/')
    await expect(page).toHaveTitle('Arawan')
    const activity = page.getByTestId('recent-activity')
    await expect(activity.locator('li')).toHaveCount(5)
    await expect(activity.getByText(`Recent ${runId}-1`, { exact: true })).toBeVisible()
    await activity.screenshot({ path: testInfo.outputPath('recent-activity-before.png') })

    const newestName = `Recent ${runId}-6`
    const newestLoan = await createLoan(request, newestName)
    loans.push(newestLoan)

    await page.goto(`/records/${newestLoan.id}`)
    await page.getByTestId('loan-detail-record-payment').click()
    await page.getByLabel(/Amount/).fill('19.87')
    await page.getByRole('button', { name: 'Save payment' }).click()
    await expect(page.getByText('Payment saved', { exact: true })).toBeVisible()

    // Overview was already cached before the mutation; revisiting it must
    // fetch the new activity rather than render the cached five rows.
    await page.goto('/')
    await expect(activity.locator('li')).toHaveCount(5)
    const newestRow = activity.locator('li').first()
    await expect(newestRow).toContainText(newestName)
    await expect(newestRow).toContainText('₱19.87')
    await expect(newestRow).toContainText(
      new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${today}T12:00:00`)),
    )
    await expect(activity.getByText(`Recent ${runId}-1`, { exact: true })).toHaveCount(0)
    await activity.screenshot({ path: testInfo.outputPath('recent-activity-after.png') })
  } finally {
    for (const loan of loans) {
      const current = await request.get(`/api/loans/${loan.id}`).then((response) => response.json())
      if (!current.loan.archived_at) {
        await request.post(`/api/loans/${loan.id}/archive`, {
          data: { archived: true, version: current.loan.version },
        })
      }
    }
  }
})

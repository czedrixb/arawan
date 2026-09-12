import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

test('shows workbook interest on Records and Overview', async ({ page, request }, testInfo) => {
  const today = new Date().toISOString().slice(0, 10)
  const borrowerName = `Interest Display ${Date.now()}`
  const created = await request.post('/api/loans', {
    data: {
      borrower: { newBorrower: { displayName: borrowerName } },
      principalCentavos: 1000000,
      dailyDueCentavos: 20000,
      interestMode: 'added',
      interestCentavos: 200000,
      borrowedOn: today,
      paymentStartOn: today,
      dueOn: '2099-12-31',
      collectionWeekdays: [1, 2, 3, 4, 5, 6, 7],
    },
  })
  expect(created.ok()).toBeTruthy()

  await page.goto(`/records?q=${encodeURIComponent(borrowerName)}`)
  await expect(page.locator(`:visible:has-text("${borrowerName}")`).first()).toBeVisible()
  if (testInfo.project.name === 'desktop-chrome') {
    await expect(page.locator('td').filter({ hasText: '20.0%' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Interest %' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Remaining' })).toHaveCount(0)
    for (const label of ['Name', 'Borrowed', 'Amount', 'Interest %', 'Daily', 'Status']) {
      await expect(page.getByRole('columnheader', { name: label }).getByRole('button')).toBeVisible()
    }
    const borrowed = page.getByRole('columnheader', { name: 'Borrowed' }).getByRole('button')
    await expect(borrowed).toHaveAttribute('aria-sort', 'ascending')
    await borrowed.click()
    await expect(page).toHaveURL(/sort=borrowed_desc/)
    await expect(borrowed).toHaveAttribute('aria-sort', 'descending')
  } else {
    await expect(page.locator('p').filter({ hasText: '20.0%' })).toBeVisible()
    await expect(page.locator('p').filter({ hasText: 'Interest %' })).toBeVisible()
    await expect(page.getByText('Remaining')).toHaveCount(0)
  }
  await page.screenshot({ path: testInfo.outputPath('interest-records.png'), fullPage: true })

  await page.goto('/')
  await expect(page.getByText('Principal recorded')).toBeVisible()
  await expect(page.getByText('Interest recorded')).toBeVisible()
  await expect(page.getByText('Average interest rate')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('interest-overview.png'), fullPage: true })
})

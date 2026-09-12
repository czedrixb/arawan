import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

test('matches workbook columns and displays interest as currency in Records and Overview', async ({ page }, testInfo) => {
  await page.goto(`/records?q=${encodeURIComponent('JINKY C. JUAMAN')}`)
  const record = page.locator('tr:visible, li:visible').filter({ hasText: 'JINKY C. JUAMAN' }).first()
  await expect(record).toBeVisible()

  if (testInfo.project.name === 'desktop-chrome') {
    const headers = await page.locator('table thead th button').allTextContents()
    expect(headers.map((value) => value.replace(/\s+/g, ' ').trim())).toEqual([
      '#', 'Name', 'Date Borrowed', 'Payment Start', 'Date Completed', 'Amount', 'Daily', 'Interest', 'Status',
    ])
    await expect(record.locator('td').nth(7)).toContainText('₱1,000.00')
    await expect(page.getByRole('button', { name: 'Edit JINKY C. JUAMAN' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('records-workbook-columns.png'), fullPage: true })
  } else {
    await expect(record).toContainText('Date Borrowed')
    await expect(record).toContainText('Payment Start')
    await expect(record).toContainText('Date Completed')
    await expect(record).toContainText('Amount')
    await expect(record).toContainText('Daily')
    await expect(record).toContainText('Interest')
    await expect(record).toContainText('₱1,000.00')
    await page.screenshot({ path: testInfo.outputPath('records-workbook-columns.png'), fullPage: true })
  }

  await page.locator(`a:visible:has-text("JINKY C. JUAMAN")`).first().click()
  await expect(page.getByText('Interest', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('₱1,000.00', { exact: true }).last()).toBeVisible()
  await expect(page.getByRole('button', { name: 'More actions' })).toBeVisible()
  await page.getByRole('button', { name: 'More actions' }).click()
  await expect(page.getByRole('button', { name: 'Edit record' })).toBeVisible()

  await page.goto('/')
  await expect(page.getByText('Principal recorded')).toBeVisible()
  await expect(page.getByText('Interest recorded')).toBeVisible()
  await expect(page.getByText('Total payable')).toBeVisible()
  await expect(page.getByText('₱59,300.00', { exact: true })).toBeVisible()
  await expect(page.getByText('₱380,800.00', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('overview-workbook-totals.png'), fullPage: true })
})

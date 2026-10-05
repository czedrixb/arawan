import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

test('clearing the Overview date restores today without an empty-date request', async ({ page, request }, testInfo) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
  const selectedDate = addDays(today, -7)
  const emptyDateRequests: string[] = []
  const validationFailures: string[] = []

  page.on('request', (outgoing) => {
    const url = new URL(outgoing.url())
    if (url.pathname === '/api/overview' && url.searchParams.has('date') && !url.searchParams.get('date')) {
      emptyDateRequests.push(url.href)
    }
  })
  page.on('response', (response) => {
    if (new URL(response.url()).pathname === '/api/overview' && response.status() === 422) {
      validationFailures.push(response.url())
    }
  })

  await page.goto('/')
  const dateInput = page.getByLabel('Overview date')
  await expect(dateInput).toHaveValue(today)
  const expectedToday = page.getByText('Expected today', { exact: true }).locator('..').locator('p').nth(1)
  const actualToday = page.getByText('Actual today', { exact: true }).locator('..').locator('p').nth(1)
  const expectedValue = await expectedToday.textContent()
  const actualValue = await actualToday.textContent()

  const selectedResponse = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.pathname === '/api/overview' && url.searchParams.get('date') === selectedDate && response.ok()
  })
  await dateInput.fill(selectedDate)
  await selectedResponse
  await expect(page.getByText('Expected on selected date', { exact: true })).toBeVisible()
  await expect(page.getByText('Actual on selected date', { exact: true })).toBeVisible()

  await dateInput.fill('')
  await expect(dateInput).toHaveValue(today)
  await expect(page.getByText('Expected today', { exact: true })).toBeVisible()
  await expect(page.getByText('Actual today', { exact: true })).toBeVisible()
  await expect(expectedToday).toHaveText(expectedValue ?? '')
  await expect(actualToday).toHaveText(actualValue ?? '')
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(emptyDateRequests).toEqual([])
  expect(validationFailures).toEqual([])

  const serviceWorker = await request.get('/sw.js')
  expect(serviceWorker.ok()).toBeTruthy()
  expect(await serviceWorker.text()).toContain('{url:"/",revision:null}')

  await page.screenshot(testInfo.project.name === 'desktop-chrome'
    ? {
        path: testInfo.outputPath('overview-date-clear-after.png'),
        clip: { x: 0, y: 0, width: 1440, height: 620 },
      }
    : { path: testInfo.outputPath('overview-date-clear-after-mobile.png'), fullPage: false })
})

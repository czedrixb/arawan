import { test, expect } from '@playwright/test'
import { hasSession } from './helpers'

test.skip(!hasSession(), 'requires a captured session from global-setup.ts')

test('uses vertical actions, aligned collection labels, and padded sheet footers on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'mobile-only UI verification')

  await page.goto('/records?q=JINKY%20C.%20JUAMAN')
  const row = page.locator('li:visible').filter({ hasText: 'JINKY C. JUAMAN' }).first()
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Show actions for JINKY C. JUAMAN' }).click()
  const actionNames = ['Record payment', 'Edit', 'More']
  const actionBoxes = await Promise.all(actionNames.map(async (name) => {
    const button = row.getByRole('button', { name, exact: true })
    await expect(button).toBeVisible()
    return button.boundingBox()
  }))
  expect(actionBoxes.every((box) => box !== null)).toBeTruthy()
  const boxes = actionBoxes as { x: number; y: number; width: number; height: number }[]
  expect(boxes[0].x).toBeCloseTo(boxes[1].x, 0)
  expect(boxes[1].x).toBeCloseTo(boxes[2].x, 0)
  expect(boxes[0].y).toBeLessThan(boxes[1].y)
  expect(boxes[1].y).toBeLessThan(boxes[2].y)
  await page.screenshot({ path: testInfo.outputPath('record-actions-after.png'), fullPage: true })

  await row.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Edit record' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Collections, last 6 months' })).toBeVisible()
  const chart = page.getByRole('img', { name: /Monthly collections chart/ })
  const bars = chart.locator('rect')
  const labels = chart.locator('xpath=following-sibling::div[1]/span')
  await expect(bars).toHaveCount(6)
  await expect(labels).toHaveCount(6)
  for (let i = 0; i < 6; i++) {
    const bar = await bars.nth(i).boundingBox()
    const label = await labels.nth(i).boundingBox()
    expect(bar).not.toBeNull()
    expect(label).not.toBeNull()
    expect((bar!.x + bar!.width / 2) - (label!.x + label!.width / 2)).toBeCloseTo(0, 0)
  }
  await page.screenshot({ path: testInfo.outputPath('collections-after.png'), fullPage: true })

  await page.getByRole('button', { name: '+ Add' }).click()
  await expect(page.getByRole('heading', { name: 'Add loan' })).toBeVisible()
  const footer = page.getByTestId('app-sheet-footer')
  const footerBox = await footer.boundingBox()
  const buttonBox = await footer.getByRole('button', { name: 'Save loan' }).boundingBox()
  expect(footerBox).not.toBeNull()
  expect(buttonBox).not.toBeNull()
  expect(footerBox!.y + footerBox!.height - (buttonBox!.y + buttonBox!.height)).toBeGreaterThanOrEqual(24)
  await page.screenshot({ path: testInfo.outputPath('modal-footer-after.png'), fullPage: true })
})

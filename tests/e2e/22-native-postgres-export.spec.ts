import { expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { hasSession } from './helpers'

test('exports every filtered record across pagination as a typed Excel workbook', async ({ page }, testInfo) => {
  test.skip(!hasSession(), 'Requires the seeded local owner session')

  await page.goto('/records?page=2&pageSize=25&sort=sequence_asc')
  await expect(page.getByText(/\d+ records/)).toBeVisible()
  const totalText = await page.getByText(/\d+ records/).textContent()
  const total = Number(totalText?.match(/\d+/)?.[0])
  expect(total).toBeGreaterThan(25)

  const exportButton = page.getByRole('button', { name: 'Export', exact: true })
  await expect(exportButton).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('export-before.png'), fullPage: true })

  const downloadPromise = page.waitForEvent('download')
  await exportButton.click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^ARAWAN-\d{4}-\d{2}-\d{2}-filtered\.xlsx$/)
  const file = await download.path()
  expect(file).toBeTruthy()

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(file!)
  const sheet = workbook.getWorksheet('Loans')
  expect(sheet).toBeTruthy()
  expect(sheet!.rowCount - 1).toBe(total)
  expect(sheet!.getCell('A2').value).toBe(1)
  expect(sheet!.getCell(`A${total + 1}`).value).toBe(total)
  expect(sheet!.getCell('B2').value).toMatch(/^[0-9a-f-]{36}$/)
  expect(sheet!.getCell('D2').value).toBeInstanceOf(Date)
  expect(typeof sheet!.getCell('H2').value).toBe('number')
  expect(sheet!.getCell('Q2').value).toBe('No')
  expect(sheet!.getColumn('H').numFmt).toContain('₱')

  await expect(page.getByText(`Exported ${total} records`)).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('export-after.png'), fullPage: true })
})

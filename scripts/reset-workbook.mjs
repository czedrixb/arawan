// Replaces the configured development owner's records with the workbook's
// validated rows in one database transaction. Never point this at production.
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

const [, , workbookPath, ...flags] = process.argv
const dryRun = flags.includes('--dry-run')
const ownerEmail = process.env.ARAWAN_OWNER_EMAIL
if (!workbookPath || !ownerEmail) {
  console.error('Usage: node --env-file=.env scripts/reset-workbook.mjs <workbook.xlsx> [--dry-run]')
  console.error('ARAWAN_OWNER_EMAIL must identify the development account to reset.')
  process.exit(1)
}

// This script only ever prints a path to run through psql -- it can't stop
// you from pointing psql at production. SUPABASE_DB_URL is the one signal
// available here, so flag it loudly (not fatally: SUPABASE_DB_URL is
// optional and the caller may pass a different connection string directly
// to psql) if it looks like anything other than the local stack.
if (process.env.SUPABASE_DB_URL && !/(127\.0\.0\.1|localhost)/.test(process.env.SUPABASE_DB_URL)) {
  console.error('WARNING: SUPABASE_DB_URL does not look like the local stack (127.0.0.1/localhost).')
  console.error('This script replaces ALL of the owner\'s records -- never run the generated SQL against production.')
}

function readWorkbookGrid(buffer) {
  let end = buffer.length - 22
  while (end > 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--
  if (end <= 0) throw new Error('Workbook is not a valid XLSX archive')
  const count = buffer.readUInt16LE(end + 10)
  let position = buffer.readUInt32LE(end + 16)
  const files = {}
  for (let i = 0; i < count; i++) {
    const nameLength = buffer.readUInt16LE(position + 28)
    const extraLength = buffer.readUInt16LE(position + 30)
    const commentLength = buffer.readUInt16LE(position + 32)
    const name = buffer.toString('utf8', position + 46, position + 46 + nameLength)
    const localOffset = buffer.readUInt32LE(position + 42)
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressedSize = buffer.readUInt32LE(position + 20)
    const method = buffer.readUInt16LE(position + 10)
    const raw = buffer.subarray(dataStart, dataStart + compressedSize)
    files[name] = method === 0 ? raw : zlib.inflateRawSync(raw)
    position += 46 + nameLength + extraLength + commentLength
  }

  const stringsXml = (files['xl/sharedStrings.xml'] ?? Buffer.from('')).toString('utf8')
  const sharedStrings = [...stringsXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((text) => decodeXml(text[1])).join(''),
  )
  const sheet = files['xl/worksheets/sheet1.xml']?.toString('utf8')
  if (!sheet) throw new Error('Workbook must contain Sheet1')
  const grid = {}
  for (const cell of sheet.matchAll(/<c\b([^>]*?)\br="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attributes = `${cell[1]} ${cell[3]}`
    const type = attributes.match(/\bt="([^"]+)"/)?.[1]
    const value = cell[4]?.match(/<v>([\s\S]*?)<\/v>/)?.[1]
    if (value === undefined) continue
    grid[cell[2]] = type === 's' ? sharedStrings[Number(value)] : decodeXml(value)
  }
  return grid
}

function decodeXml(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

function normalizeName(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function excelSerialToIso(value) {
  const date = new Date(Date.UTC(1899, 11, 30) + Number(value) * 86_400_000)
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid workbook date: ${value}`)
  return date.toISOString().slice(0, 10)
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

const grid = readWorkbookGrid(await readFile(workbookPath))
const expectedHeaders = { B3: 'NAME:', C3: 'DATE BORROWED', D3: 'PAYMENT START', E3: 'DATE COMPLETED', F3: 'AMOUNT', G3: 'DAILY', H3: '%' }
for (const [cell, expected] of Object.entries(expectedHeaders)) {
  if (grid[cell]?.trim() !== expected) throw new Error(`Unexpected workbook header at ${cell}: ${grid[cell] ?? '(blank)'}`)
}

const rows = []
for (let rowNumber = 4; rowNumber <= 45; rowNumber++) {
  const sequence = Number(grid[`A${rowNumber}`])
  const displayName = grid[`B${rowNumber}`]?.trim().replace(/\s+/g, ' ')
  if (!displayName || sequence !== rowNumber - 3) throw new Error(`Missing or invalid record at workbook row ${rowNumber}`)
  const principalPesos = Number(grid[`F${rowNumber}`])
  const dailyPesos = Number(grid[`G${rowNumber}`])
  const interestPesos = Number(grid[`H${rowNumber}`])
  if (![principalPesos, dailyPesos, interestPesos].every(Number.isFinite) || principalPesos <= 0 || dailyPesos <= 0 || interestPesos < 0) {
    throw new Error(`Invalid money value at workbook row ${rowNumber}`)
  }
  const borrowedOn = excelSerialToIso(grid[`C${rowNumber}`])
  const paymentStartOn = excelSerialToIso(grid[`D${rowNumber}`])
  const completedOn = excelSerialToIso(grid[`E${rowNumber}`])
  rows.push({
    source_sequence: sequence,
    display_name: displayName,
    normalized_name: normalizeName(displayName),
    borrowed_on: borrowedOn,
    payment_start_on: paymentStartOn,
    completed_on: completedOn,
    principal_centavos: Math.round(principalPesos * 100),
    daily_due_centavos: Math.round(dailyPesos * 100),
    interest_centavos: Math.round(interestPesos * 100),
    needs_review: paymentStartOn < borrowedOn || completedOn > '2030-01-01',
  })
}

const uniqueBorrowers = new Set(rows.map((row) => row.display_name))
const totals = rows.reduce((sum, row) => ({
  principal: sum.principal + row.principal_centavos,
  daily: sum.daily + row.daily_due_centavos,
  interest: sum.interest + row.interest_centavos,
}), { principal: 0, daily: 0, interest: 0 })
if (rows.length !== 42 || uniqueBorrowers.size !== 40 || totals.principal !== 32_150_000 || totals.daily !== 643_000 || totals.interest !== 5_930_000) {
  throw new Error(`Workbook reconciliation failed: ${JSON.stringify({ rows: rows.length, borrowers: uniqueBorrowers.size, totals })}`)
}

console.log(`Validated ${rows.length} rows / ${uniqueBorrowers.size} borrowers. Principal ₱${(totals.principal / 100).toLocaleString('en-PH')}, daily ₱${(totals.daily / 100).toLocaleString('en-PH')}, interest ₱${(totals.interest / 100).toLocaleString('en-PH')}.`)
console.log('Workbook rows with source-date anomalies will be preserved as Needs review.')
if (dryRun) process.exit(0)

const payload = JSON.stringify(rows)
let tag = 'workbook_reset'
while (payload.includes(`$${tag}$`)) tag += '_x'
const sql = `begin;\nselect public.reset_owner_from_workbook(${sqlString(ownerEmail)}, $${tag}$${payload}$${tag}$::jsonb);\ncommit;\n`
const tempDir = await mkdtemp(path.join(tmpdir(), 'arawan-workbook-reset-'))
const sqlPath = path.join(tempDir, 'reset.sql')
await writeFile(sqlPath, sql, 'utf8')
console.log(`Prepared one-transaction reset SQL at ${sqlPath}`)

// Dev-only loader: inserts the verified 42 workbook rows (see
// docs/workbook-analysis.md) as `needs_review` loans so Records/Overview
// have real data to render against in this pass, without building the
// phase-4 import wizard. NEVER run against production -- this bypasses
// RLS with the service role key and does not go through record_payment/
// commit_import at all.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ARAWAN_OWNER_ID=... \
//     node scripts/seed-workbook.mjs "d:\Downloads\ARAWAN copy.xlsx"
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import zlib from 'node:zlib'

const [, , xlsxPath] = process.argv
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ARAWAN_OWNER_ID } = process.env
if (!xlsxPath || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ARAWAN_OWNER_ID) {
  console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ARAWAN_OWNER_ID=... node scripts/seed-workbook.mjs <path-to-ARAWAN-copy.xlsx>')
  process.exit(1)
}

/** Minimal raw XLSX cell-grid reader -- no exceljs dependency this pass (that's phase 4). */
function readWorkbookGrid(path) {
  const buf = readFileSync(path)
  let end = buf.length - 22
  while (buf.readUInt32LE(end) !== 0x06054b50) end--
  const count = buf.readUInt16LE(end + 10)
  let pos = buf.readUInt32LE(end + 16)
  const files = {}
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(pos + 28)
    const extraLen = buf.readUInt16LE(pos + 30)
    const commentLen = buf.readUInt16LE(pos + 32)
    const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen)
    const localHeaderOffset = buf.readUInt32LE(pos + 42)
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26)
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen
    const compressedSize = buf.readUInt32LE(pos + 20)
    const method = buf.readUInt16LE(pos + 10)
    const raw = buf.subarray(dataStart, dataStart + compressedSize)
    files[name] = method === 0 ? raw : zlib.inflateRawSync(raw)
    pos += 46 + nameLen + extraLen + commentLen
  }

  const sharedStringsXml = (files['xl/sharedStrings.xml'] ?? Buffer.from('')).toString('utf8')
  const sharedStrings = [...sharedStringsXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''),
  )
  const sheetXml = files['xl/worksheets/sheet1.xml'].toString('utf8')
  const grid = {}
  for (const row of sheetXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    for (const cell of row[2].matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const type = (cell[3].match(/t="([^"]+)"/) ?? [])[1]
      let value = (cell[4] ?? '').match(/<v>([\s\S]*?)<\/v>/)
      value = value ? value[1] : undefined
      if (type === 's' && value !== undefined) value = sharedStrings[Number(value)]
      if (value !== undefined) grid[cell[1] + cell[2]] = value
    }
  }
  return grid
}

// Inlined rather than imported from shared/utils/normalize-name.ts --
// this is a plain Node script (no tsx/ts-node in its dependency chain),
// and the logic is a few lines. Keep both in sync if either changes.
function normalizeName(displayName) {
  return displayName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function excelSerialToIso(serial) {
  const ms = Date.UTC(1899, 11, 30) + Number(serial) * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

async function main() {
  const grid = readWorkbookGrid(xlsxPath)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  let inserted = 0
  for (let row = 4; row <= 45; row++) {
    const displayName = grid[`B${row}`]
    if (!displayName) continue

    const { data: existing } = await supabase
      .from('borrowers')
      .select('id')
      .eq('owner_id', ARAWAN_OWNER_ID)
      .eq('display_name', displayName)
      .maybeSingle()

    let borrowerId = existing?.id
    if (!borrowerId) {
      const { data: borrower, error } = await supabase
        .from('borrowers')
        .insert({ owner_id: ARAWAN_OWNER_ID, display_name: displayName, normalized_name: normalizeName(displayName) })
        .select('id')
        .single()
      if (error) throw error
      borrowerId = borrower.id
    }

    const { error: loanError } = await supabase.from('loans').insert({
      owner_id: ARAWAN_OWNER_ID,
      borrower_id: borrowerId,
      source_sequence: Number(grid[`A${row}`]),
      principal_centavos: Math.round(Number(grid[`F${row}`]) * 100),
      daily_due_centavos: Math.round(Number(grid[`G${row}`]) * 100),
      borrowed_on: excelSerialToIso(grid[`C${row}`]),
      payment_start_on: excelSerialToIso(grid[`D${row}`]),
      legacy_completed_on: excelSerialToIso(grid[`E${row}`]),
      legacy_percent_value: Math.round(Number(grid[`H${row}`]) * 100),
      readiness: 'needs_review', // meaning of "%" and DATE COMPLETED is deferred -- spec §2, docs/workbook-analysis.md
    })
    if (loanError) throw loanError
    inserted++
  }

  console.log(`Seeded ${inserted} needs_review loans from ${xlsxPath}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

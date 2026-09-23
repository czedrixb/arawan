import ExcelJS from 'exceljs'
import { loanFiltersSchema, type LoanFilters } from '#shared/schemas/loan'
import { listLoans } from '~~/server/services/loan-service'

export default defineEventHandler(async (event) => {
  const { user, client } = await requireOwner(event)
  const query = getQuery(event)
  const parsed = validateInput<LoanFilters>(event, loanFiltersSchema, {
    ...query,
    balanceMin: query.balanceMin ? Number(query.balanceMin) : undefined,
    balanceMax: query.balanceMax ? Number(query.balanceMax) : undefined,
    page: 1,
    pageSize: 100,
  })

  const rows: LoanSummary[] = []
  let page = 1
  let total = 0
  do {
    const result = await listLoans(client, user.id, { ...parsed, page, pageSize: 100 })
    rows.push(...result.rows)
    total = result.total
    page += 1
  } while (rows.length < total)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ARAWAN'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet('Loans', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: 'Record #', key: 'record', width: 12 },
    { header: 'Loan ID', key: 'id', width: 38 },
    { header: 'Borrower', key: 'borrower', width: 30 },
    { header: 'Borrowed On', key: 'borrowed', width: 15 },
    { header: 'Payment Start', key: 'paymentStart', width: 15 },
    { header: 'Due On', key: 'due', width: 15 },
    { header: 'Completed On', key: 'completed', width: 15 },
    { header: 'Principal', key: 'principal', width: 16 },
    { header: 'Interest Mode', key: 'interestMode', width: 16 },
    { header: 'Interest', key: 'interest', width: 16 },
    { header: 'Total Payable', key: 'totalPayable', width: 16 },
    { header: 'Daily Due', key: 'dailyDue', width: 14 },
    { header: 'Collected', key: 'collected', width: 16 },
    { header: 'Remaining', key: 'remaining', width: 16 },
    { header: 'Progress %', key: 'progress', width: 13 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Archived', key: 'archived', width: 12 },
    { header: 'Updated At', key: 'updated', width: 23 },
  ]
  const excelDate = (value: string | null) => value ? new Date(`${value}T00:00:00.000Z`) : null
  for (const [index, loan] of rows.entries()) {
    sheet.addRow({
      record: index + 1,
      id: loan.id,
      borrower: loan.borrower_display_name,
      borrowed: excelDate(loan.borrowed_on),
      paymentStart: excelDate(loan.payment_start_on),
      due: excelDate(loan.due_on),
      completed: excelDate(loan.completed_on),
      principal: loan.principal_centavos === null ? null : loan.principal_centavos / 100,
      interestMode: loan.interest_mode,
      interest: loan.interest_centavos === null ? null : loan.interest_centavos / 100,
      totalPayable: loan.total_payable_centavos === null ? null : loan.total_payable_centavos / 100,
      dailyDue: loan.daily_due_centavos === null ? null : loan.daily_due_centavos / 100,
      collected: loan.recognized_collected_centavos === null ? null : loan.recognized_collected_centavos / 100,
      remaining: loan.remaining_centavos === null ? null : loan.remaining_centavos / 100,
      progress: loan.progress_pct === null ? null : loan.progress_pct / 100,
      status: loan.display_status,
      archived: loan.archived_at ? 'Yes' : 'No',
      updated: new Date(loan.updated_at),
    })
  }
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF237A45' } }
  sheet.autoFilter = { from: 'A1', to: 'R1' }
  for (const key of ['borrowed', 'paymentStart', 'due', 'completed']) sheet.getColumn(key).numFmt = 'yyyy-mm-dd'
  for (const key of ['principal', 'interest', 'totalPayable', 'dailyDue', 'collected', 'remaining']) sheet.getColumn(key).numFmt = '₱#,##0.00'
  sheet.getColumn('progress').numFmt = '0.00%'
  sheet.getColumn('updated').numFmt = 'yyyy-mm-dd hh:mm'

  const buffer = await workbook.xlsx.writeBuffer()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  setResponseHeader(event, 'content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setResponseHeader(event, 'content-disposition', `attachment; filename="ARAWAN-${today}-filtered.xlsx"`)
  setResponseHeader(event, 'cache-control', 'no-store')
  return Buffer.from(buffer)
})

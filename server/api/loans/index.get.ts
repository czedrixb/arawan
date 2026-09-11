import { listLoans } from '~~/server/services/loan-service'
import { loanFiltersSchema, type LoanFilters } from '#shared/schemas/loan'

export default defineEventHandler(async (event) => {
  const { user, client } = await requireOwner(event)
  const query = getQuery(event)
  const filters = validateInput<LoanFilters>(event, loanFiltersSchema, {
    ...query,
    balanceMin: query.balanceMin ? Number(query.balanceMin) : undefined,
    balanceMax: query.balanceMax ? Number(query.balanceMax) : undefined,
    page: query.page ? Number(query.page) : undefined,
    pageSize: query.pageSize ? Number(query.pageSize) : undefined,
  })
  const { rows, total } = await listLoans(client, user.id, filters)
  return { rows, total, page: filters.page, pageSize: filters.pageSize }
})

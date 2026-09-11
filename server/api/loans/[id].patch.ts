import { hasLedgerEntries, patchLoan, touchesFinancialTerms } from '~~/server/services/loan-service'
import { loanPatchSchema } from '#shared/schemas/loan'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { user, client } = await requireOwner(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const patch = validateInput(event, loanPatchSchema, body)

  if (touchesFinancialTerms(patch) && (await hasLedgerEntries(client, user.id, id))) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Financial terms are locked once payments exist for this loan',
      data: { requestId: requestId(event) },
    })
  }

  const loan = await patchLoan(client, user.id, id, patch)
  if (!loan) staleVersion(event)
  return loan
})

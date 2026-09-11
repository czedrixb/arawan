import { createLoan } from '~~/server/services/loan-service'
import { loanInputSchema, type LoanInput } from '#shared/schemas/loan'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { user, client } = await requireOwner(event)
  const body = await readBody(event)
  const input = validateInput<LoanInput>(event, loanInputSchema, body)
  const loan = await createLoan(client, user.id, input)
  setResponseStatus(event, 201)
  return loan
})

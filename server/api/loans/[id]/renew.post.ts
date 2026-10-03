import { renewLoan } from '~~/server/services/loan-service'
import { renewLoanSchema } from '#shared/schemas/loan'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { client } = await requireOwner(event)
  const id = getRouterParam(event, 'id')!
  const input = validateInput(event, renewLoanSchema, await readBody(event))
  const result = await renewLoan(event, client, id, input)
  setResponseStatus(event, 201)
  return result
})

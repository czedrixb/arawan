import { recordPayment } from '~~/server/services/payment-service'
import { recordPaymentSchema } from '#shared/schemas/payment'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { user, client } = await requireOwner(event)
  const id = getRouterParam(event, 'id')!
  const input = validateInput(event, recordPaymentSchema, await readBody(event))
  const summary = await recordPayment(event, client, id, input)
  setResponseStatus(event, 201)
  return summary
})

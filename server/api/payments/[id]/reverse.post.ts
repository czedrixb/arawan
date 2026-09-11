import { reversePayment } from '~~/server/services/payment-service'
import { reversePaymentSchema } from '#shared/schemas/payment'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { user, client } = await requireOwner(event)
  const id = getRouterParam(event, 'id')!
  const input = validateInput(event, reversePaymentSchema, await readBody(event))
  return reversePayment(event, client, id, input)
})

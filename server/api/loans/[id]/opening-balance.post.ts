import { confirmOpeningBalance } from '~~/server/services/payment-service'
import { confirmOpeningBalanceSchema } from '#shared/schemas/payment'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { user, client } = await requireOwner(event)
  const id = getRouterParam(event, 'id')!
  const input = validateInput(event, confirmOpeningBalanceSchema, await readBody(event))
  return confirmOpeningBalance(event, client, id, input)
})

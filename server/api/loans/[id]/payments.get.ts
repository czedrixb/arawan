import { listPayments } from '~~/server/services/payment-service'
import { z } from 'zod'

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
})
type Query = z.infer<typeof querySchema>

export default defineEventHandler(async (event) => {
  const { user, client } = await requireOwner(event)
  const id = getRouterParam(event, 'id')!
  const { page, pageSize } = validateInput<Query>(event, querySchema, getQuery(event))
  const { rows, total } = await listPayments(client, user.id, id, page, pageSize)
  return { rows, total, page, pageSize }
})

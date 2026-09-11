import { setArchived } from '~~/server/services/loan-service'
import { z } from 'zod'

const bodySchema = z.object({ archived: z.boolean(), version: z.number().int().nonnegative() })

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { user, client } = await requireOwner(event)
  const id = getRouterParam(event, 'id')!
  const { archived, version } = validateInput(event, bodySchema, await readBody(event))

  const loan = await setArchived(client, user.id, id, archived, version)
  if (!loan) staleVersion(event)
  return loan
})

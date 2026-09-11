import { getOverview } from '~~/server/services/overview-service'

export default defineEventHandler(async (event) => {
  const { user, client } = await requireOwner(event)
  return getOverview(client, user.id)
})

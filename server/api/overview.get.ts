import { getOverview } from '~~/server/services/overview-service'
import { overviewQuerySchema, type OverviewQuery } from '#shared/schemas/overview'

export default defineEventHandler(async (event) => {
  const { user, client } = await requireOwner(event)
  const query = validateInput<OverviewQuery>(event, overviewQuerySchema, getQuery(event))
  return getOverview(client, user.id, query.date ?? todayIso())
})

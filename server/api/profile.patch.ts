import { z } from 'zod'

const schema = z.object({ defaultCollectionWeekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7) })

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { user, client } = await requireOwner(event)
  const input = validateInput(event, schema, await readBody(event))
  const { data, error } = await client.from('profiles')
    .update({ default_collection_weekdays: input.defaultCollectionWeekdays })
    .eq('id', user.id).select('*').single()
  if (error) throw error
  return data as Profile
})

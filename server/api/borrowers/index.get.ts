import { z } from 'zod'

const querySchema = z.object({ q: z.string().trim().max(200).optional() })

export default defineEventHandler(async (event) => {
  const { user, client } = await requireOwner(event)
  const { q } = validateInput(event, querySchema, getQuery(event))

  let query = client.from('borrowers').select('*').eq('owner_id', user.id).order('display_name', { ascending: true })
  if (q) query = query.ilike('normalized_name', `%${normalizeName(q)}%`)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Borrower[]
})

import { borrowerInputSchema } from '#shared/schemas/borrower'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { user, client } = await requireOwner(event)
  const input = validateInput(event, borrowerInputSchema, await readBody(event))

  const { data, error } = await client
    .from('borrowers')
    .insert({
      owner_id: user.id,
      display_name: input.displayName,
      normalized_name: normalizeName(input.displayName),
      phone: input.phone ?? null,
      notes: input.notes ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  setResponseStatus(event, 201)
  return data
})

import { borrowerPatchSchema } from '#shared/schemas/borrower'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { user, client } = await requireOwner(event)
  const id = getRouterParam(event, 'id')!
  const patch = validateInput(event, borrowerPatchSchema, await readBody(event))

  const update: Record<string, unknown> = {}
  if (patch.displayName !== undefined) {
    update.display_name = patch.displayName
    update.normalized_name = normalizeName(patch.displayName)
  }
  if (patch.phone !== undefined) update.phone = patch.phone
  if (patch.notes !== undefined) update.notes = patch.notes

  const { data, error } = await client
    .from('borrowers')
    .update(update)
    .eq('owner_id', user.id)
    .eq('id', id)
    .eq('version', patch.version)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) staleVersion(event)
  return data
})

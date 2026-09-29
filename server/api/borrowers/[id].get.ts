export default defineEventHandler(async (event) => {
  const { user, client } = await requireOwner(event)
  const id = getRouterParam(event, 'id')!

  const { data, error } = await client
    .from('borrowers')
    .select('*')
    .eq('owner_id', user.id)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) notFound(event, 'Borrower not found')
  return data as Borrower
})

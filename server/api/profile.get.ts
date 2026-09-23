export default defineEventHandler(async (event) => {
  const { user, client } = await requireOwner(event)
  const { data, error } = await client.from('profiles').select('*').eq('id', user.id).single()
  if (error) throw error
  return data as Profile
})

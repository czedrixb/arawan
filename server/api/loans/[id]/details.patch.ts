import { editLoanRecord } from '~~/server/services/loan-service'
import { loanRecordEditSchema } from '#shared/schemas/loan'

export default defineEventHandler(async (event) => {
  requireSameOrigin(event)
  const { client } = await requireOwner(event)
  const id = getRouterParam(event, 'id')!
  const input = validateInput(event, loanRecordEditSchema, await readBody(event))
  try {
    return await editLoanRecord(client, id, input)
  } catch (error: any) {
    mapPostgresError(event, error)
  }
})

import { getLoanById, listLoansByBorrower } from '~~/server/services/loan-service'

export default defineEventHandler(async (event) => {
  const { user, client } = await requireOwner(event)
  const id = getRouterParam(event, 'id')!
  const loan = await getLoanById(client, user.id, id)
  if (!loan) notFound(event, 'Loan not found')
  const otherLoans = (await listLoansByBorrower(client, user.id, loan.borrower_id)).filter((l) => l.id !== id)
  return { loan, otherLoans }
})

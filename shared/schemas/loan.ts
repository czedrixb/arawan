import { z } from 'zod'
import { MAX_CENTAVOS } from '../utils/money'
import { borrowerInputSchema } from './borrower'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const centavos = z.number().int().positive().max(MAX_CENTAVOS)
const weekdays = z.array(z.number().int().min(1).max(7)).min(1).max(7)

export const interestModeSchema = z.enum(['none', 'added', 'included'])

/** Either an existing borrower id, or details to create one inline (spec §6 add/edit loan). */
export const borrowerSelectionSchema = z.union([
  z.object({ borrowerId: z.string().uuid() }),
  z.object({ newBorrower: borrowerInputSchema }),
])

export const loanInputSchema = z
  .object({
    borrower: borrowerSelectionSchema,
    principalCentavos: centavos,
    dailyDueCentavos: centavos,
    interestMode: interestModeSchema,
    interestCentavos: z.number().int().nonnegative().max(MAX_CENTAVOS).default(0),
    borrowedOn: isoDate,
    paymentStartOn: isoDate,
    dueOn: isoDate,
    collectionWeekdays: weekdays.default([1, 2, 3, 4, 5, 6, 7]),
  })
  .refine((v) => v.paymentStartOn >= v.borrowedOn, {
    message: 'Payment start must be on or after the borrowed date',
    path: ['paymentStartOn'],
  })
  .refine((v) => v.dueOn >= v.paymentStartOn, {
    message: 'Due date must be on or after payment start',
    path: ['dueOn'],
  })
  .refine((v) => v.interestMode !== 'added' || v.interestCentavos > 0, {
    message: 'Enter a fixed interest amount, or choose a different interest treatment',
    path: ['interestCentavos'],
  })
export type LoanInput = z.infer<typeof loanInputSchema>

/** Allowed fields for PATCH -- financial terms are excluded once ledger entries exist (enforced server-side, spec §10). */
export const loanPatchSchema = z.object({
  version: z.number().int().nonnegative(),
  borrowedOn: isoDate.optional(),
  paymentStartOn: isoDate.optional(),
  dueOn: isoDate.optional(),
  principalCentavos: centavos.optional(),
  dailyDueCentavos: centavos.optional(),
  interestMode: interestModeSchema.optional(),
  interestCentavos: z.number().int().nonnegative().max(MAX_CENTAVOS).optional(),
})
export type LoanPatch = z.infer<typeof loanPatchSchema>

export const loanFiltersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['all', 'active', 'completed', 'upcoming', 'overdue', 'needs_review']).default('all'),
  archived: z.enum(['exclude', 'only', 'include']).default('exclude'),
  borrowedFrom: isoDate.optional(),
  borrowedTo: isoDate.optional(),
  balanceMin: z.number().int().nonnegative().optional(),
  balanceMax: z.number().int().nonnegative().optional(),
  sort: z.enum(['borrowed_desc', 'due_asc', 'name_asc', 'remaining_desc']).default('borrowed_desc'),
  page: z.number().int().positive().default(1),
  pageSize: z.union([z.literal(25), z.literal(50), z.literal(100)]).default(25),
})
export type LoanFilters = z.infer<typeof loanFiltersSchema>

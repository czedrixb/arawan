import { z } from 'zod'

export const borrowerInputSchema = z.object({
  displayName: z.string().trim().min(1, 'Name is required').max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})
export type BorrowerInput = z.infer<typeof borrowerInputSchema>

export const borrowerPatchSchema = borrowerInputSchema.partial().extend({
  version: z.number().int().nonnegative(),
})
export type BorrowerPatch = z.infer<typeof borrowerPatchSchema>

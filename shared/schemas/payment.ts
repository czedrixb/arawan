import { z } from 'zod'
import { MAX_CENTAVOS } from '../utils/money'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

export const recordPaymentSchema = z.object({
  amountCentavos: z.number().int().positive().max(MAX_CENTAVOS),
  paidOn: isoDate,
  method: z.string().trim().max(60).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  // Generated once per form-open (spec §6 record payment) so a network
  // timeout retry replays the same key instead of double-paying.
  idempotencyKey: z.string().uuid(),
})
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>

export const reversePaymentSchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required').max(500),
  idempotencyKey: z.string().uuid(),
})
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>

export const confirmOpeningBalanceSchema = z.object({
  collectedCentavos: z.number().int().nonnegative().max(MAX_CENTAVOS),
  asOf: isoDate,
  reason: z.string().trim().min(1, 'A reason is required').max(500),
})
export type ConfirmOpeningBalanceInput = z.infer<typeof confirmOpeningBalanceSchema>

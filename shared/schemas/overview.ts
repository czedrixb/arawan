import { z } from 'zod'

const isoCalendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number)
    const parsed = new Date(0)
    parsed.setUTCHours(0, 0, 0, 0)
    parsed.setUTCFullYear(year!, month! - 1, day!)
    return (
      year! >= 1 &&
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month! - 1 &&
      parsed.getUTCDate() === day
    )
  }, 'Expected a real calendar date')

export const overviewQuerySchema = z.object({
  date: isoCalendarDate.optional(),
})

export type OverviewQuery = z.infer<typeof overviewQuerySchema>

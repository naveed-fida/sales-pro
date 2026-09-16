import { z } from 'zod'

export const clockStatusSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    source: z.enum(['network', 'offline']),
    localMs: z.number().int(),
  }),
  z.object({
    ok: z.literal(false),
    reason: z.enum(['skew', 'rollback']),
    localMs: z.number().int(),
    trustedMs: z.number().int().optional(),
    watermarkMs: z.number().int().optional(),
  }),
])

export type ClockStatus = z.infer<typeof clockStatusSchema>

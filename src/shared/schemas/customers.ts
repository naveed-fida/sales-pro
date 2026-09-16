import { z } from 'zod'

export const searchCustomersSchema = z.object({
  query: z.string().trim().max(120, 'Search is too long'),
})

export const customerMatchSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  phone: z.string(),
})

export type SearchCustomersInput = z.input<typeof searchCustomersSchema>
export type CustomerMatch = z.infer<typeof customerMatchSchema>

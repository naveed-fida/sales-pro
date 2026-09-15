import { z } from 'zod'

export const supplierIdSchema = z.object({
  id: z.number().int().positive(),
})

export const saveSupplierSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  phone: z.string().trim().max(40, 'Phone is too long'),
  address: z.string().trim().max(200, 'Address is too long'),
  notes: z.string().trim().max(500, 'Notes are too long'),
})

export const supplierSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
})

export type SupplierId = z.infer<typeof supplierIdSchema>
export type SaveSupplierInput = z.input<typeof saveSupplierSchema>
export type SaveSupplier = z.infer<typeof saveSupplierSchema>
export type Supplier = z.infer<typeof supplierSchema>

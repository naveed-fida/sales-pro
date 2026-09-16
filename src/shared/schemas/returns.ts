import { z } from 'zod'
import { productUnits } from '@shared/quantity'
import { saleStatus } from '@shared/schemas/sales'

export const lookupReturnSchema = z.object({
  billNo: z.coerce.number().int().positive('Enter a bill number'),
})

export const returnBillItemSchema = z.object({
  saleItemId: z.number().int().positive(),
  variantId: z.number().int().positive(),
  productName: z.string(),
  barcode: z.string(),
  size: z.string().nullable(),
  colour: z.string().nullable(),
  unit: z.enum(productUnits),
  soldMilli: z.number().int().positive(),
  returnedMilli: z.number().int().nonnegative(),
  remainingMilli: z.number().int().nonnegative(),
  unitPriceRs: z.number().int(),
  lineTotalRs: z.number().int(),
  netRs: z.number().int(),
  refundedRs: z.number().int().nonnegative(),
  remainingRefundRs: z.number().int().nonnegative(),
})

export const returnBillSchema = z.object({
  saleId: z.number().int().positive(),
  billNo: z.number().int().positive(),
  phone: z.string().nullable(),
  status: z.enum(saleStatus),
  createdAt: z.coerce.date(),
  discountRs: z.number().int(),
  totalRs: z.number().int(),
  items: z.array(returnBillItemSchema).min(1),
})

export const completeReturnItemSchema = z.object({
  saleItemId: z.number().int().positive(),
  quantity: z.coerce
    .number()
    .positive('Quantity must be more than zero')
    .max(1_000_000, 'That quantity is too large'),
})

export const completeReturnSchema = z
  .object({
    saleId: z.number().int().positive(),
    items: z.array(completeReturnItemSchema).min(1, 'Return at least one item'),
  })
  .superRefine((value, context) => {
    const seen = new Set<number>()
    value.items.forEach((item, index) => {
      if (seen.has(item.saleItemId)) {
        context.addIssue({
          code: 'custom',
          message: 'Duplicate line',
          path: ['items', index, 'saleItemId'],
        })
      }
      seen.add(item.saleItemId)
    })
  })

export const completedReturnSchema = z.object({
  id: z.number().int().positive(),
  saleId: z.number().int().positive(),
  billNo: z.number().int().positive(),
  totalRs: z.number().int(),
  saleStatus: z.enum(saleStatus),
})

export type LookupReturnInput = z.infer<typeof lookupReturnSchema>
export type ReturnBillItem = z.infer<typeof returnBillItemSchema>
export type ReturnBill = z.infer<typeof returnBillSchema>
export type CompleteReturnInput = z.input<typeof completeReturnSchema>
export type CompleteReturn = z.infer<typeof completeReturnSchema>
export type CompletedReturn = z.infer<typeof completedReturnSchema>

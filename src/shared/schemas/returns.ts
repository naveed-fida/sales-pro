import { z } from 'zod'
import { lineTotalRs } from '@shared/cost'
import { productUnits, toMilli } from '@shared/quantity'
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

export const completeExchangeItemSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.coerce
    .number()
    .positive('Quantity must be more than zero')
    .max(1_000_000, 'That quantity is too large'),
  unitPriceRs: z.coerce
    .number()
    .int('Whole rupees only')
    .nonnegative('Cannot be negative')
    .max(10_000_000, 'That price is too large'),
  lineDiscountRs: z.coerce
    .number()
    .int('Whole rupees only')
    .nonnegative('Cannot be negative')
    .max(10_000_000, 'That discount is too large'),
})

export const completeReturnSchema = z
  .object({
    saleId: z.number().int().positive(),
    items: z.array(completeReturnItemSchema).min(1, 'Return at least one item'),
    exchangeItems: z.array(completeExchangeItemSchema).default([]),
    tenderedRs: z.coerce
      .number()
      .int('Whole rupees only')
      .nonnegative('Cannot be negative')
      .max(10_000_000, 'That amount is too large')
      .default(0),
  })
  .superRefine((value, context) => {
    const seenReturned = new Set<number>()
    value.items.forEach((item, index) => {
      if (seenReturned.has(item.saleItemId)) {
        context.addIssue({
          code: 'custom',
          message: 'Duplicate line',
          path: ['items', index, 'saleItemId'],
        })
      }
      seenReturned.add(item.saleItemId)
    })

    const seenTaken = new Set<number>()
    value.exchangeItems.forEach((item, index) => {
      if (seenTaken.has(item.variantId)) {
        context.addIssue({
          code: 'custom',
          message: 'Duplicate line',
          path: ['exchangeItems', index, 'variantId'],
        })
      }
      seenTaken.add(item.variantId)

      const gross = lineTotalRs(toMilli(item.quantity), item.unitPriceRs, 0)
      if (item.lineDiscountRs > gross) {
        context.addIssue({
          code: 'custom',
          message: 'Discount is larger than the line',
          path: ['exchangeItems', index, 'lineDiscountRs'],
        })
      }
    })
  })

export const completedReturnSchema = z.object({
  id: z.number().int().positive(),
  saleId: z.number().int().positive(),
  billNo: z.number().int().positive(),
  totalRs: z.number().int(),
  exchangeTotalRs: z.number().int(),
  tenderedRs: z.number().int(),
  changeRs: z.number().int(),
  saleStatus: z.enum(saleStatus),
})

export const returnIdSchema = z.object({
  id: z.number().int().positive(),
})

export const returnItemRecordSchema = z.object({
  id: z.number().int().positive(),
  variantId: z.number().int().positive(),
  productName: z.string(),
  barcode: z.string(),
  size: z.string().nullable(),
  colour: z.string().nullable(),
  unit: z.enum(productUnits),
  quantityMilli: z.number().int(),
  unitPriceRs: z.number().int(),
  lineTotalRs: z.number().int(),
})

export const returnListItemSchema = z.object({
  id: z.number().int().positive(),
  saleId: z.number().int().positive(),
  billNo: z.number().int().positive(),
  phone: z.string().nullable(),
  createdAt: z.coerce.date(),
  itemCount: z.number().int().nonnegative(),
  totalRs: z.number().int(),
  exchangeTotalRs: z.number().int(),
  tenderedRs: z.number().int(),
  changeRs: z.number().int(),
})

export const returnExchangeItemRecordSchema = z.object({
  id: z.number().int().positive(),
  variantId: z.number().int().positive(),
  productName: z.string(),
  barcode: z.string(),
  size: z.string().nullable(),
  colour: z.string().nullable(),
  unit: z.enum(productUnits),
  quantityMilli: z.number().int(),
  unitPriceRs: z.number().int(),
  lineDiscountRs: z.number().int(),
  lineTotalRs: z.number().int(),
})

export const returnRecordSchema = returnListItemSchema.extend({
  items: z.array(returnItemRecordSchema),
  exchangeItems: z.array(returnExchangeItemRecordSchema),
})

export type LookupReturnInput = z.infer<typeof lookupReturnSchema>
export type ReturnBillItem = z.infer<typeof returnBillItemSchema>
export type ReturnBill = z.infer<typeof returnBillSchema>
export type CompleteReturnInput = z.input<typeof completeReturnSchema>
export type CompleteReturn = z.infer<typeof completeReturnSchema>
export type CompletedReturn = z.infer<typeof completedReturnSchema>
export type ReturnListItem = z.infer<typeof returnListItemSchema>
export type ReturnRecord = z.infer<typeof returnRecordSchema>
export type ReturnExchangeItemRecord = z.infer<typeof returnExchangeItemRecordSchema>

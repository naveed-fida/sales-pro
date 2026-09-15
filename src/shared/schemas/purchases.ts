import { z } from 'zod'
import { lineTotalRs, quantityCostRs } from '@shared/cost'
import { productUnits, toMilli } from '@shared/quantity'

export const purchaseIdSchema = z.object({
  id: z.number().int().positive(),
})

export const purchaseCatalogVariantSchema = z.object({
  variantId: z.number().int().positive(),
  productId: z.number().int().positive(),
  productName: z.string(),
  barcode: z.string(),
  size: z.string().nullable(),
  colour: z.string().nullable(),
  unit: z.enum(productUnits),
  avgCostRs: z.number().int(),
  quantityMilli: z.number().int(),
})

export const receivePurchaseItemSchema = z.object({
  variantId: z.number().int().positive(),
  productName: z.string().min(1),
  barcode: z.string().min(1),
  size: z.string().nullable(),
  colour: z.string().nullable(),
  unit: z.enum(productUnits),
  quantity: z.coerce
    .number()
    .positive('Quantity must be more than zero')
    .max(1_000_000, 'That quantity is too large'),
  unitCostRs: z.coerce
    .number()
    .int('Whole rupees only')
    .nonnegative('Cannot be negative')
    .max(10_000_000, 'That cost is too large'),
  discountRs: z.coerce
    .number()
    .int('Whole rupees only')
    .nonnegative('Cannot be negative')
    .max(10_000_000, 'That discount is too large'),
})

export const receivePurchaseSchema = z
  .object({
    supplierId: z.coerce.number().int().positive('Pick a supplier'),
    purchasedAt: z.date(),
    discountRs: z.coerce
      .number()
      .int('Whole rupees only')
      .nonnegative('Cannot be negative')
      .max(10_000_000, 'That discount is too large'),
    note: z.string().trim().max(500, 'Note is too long'),
    items: z.array(receivePurchaseItemSchema).min(1, 'Add at least one item'),
  })
  .superRefine((value, context) => {
    value.items.forEach((item, index) => {
      if (item.unit === 'piece' && !Number.isInteger(item.quantity)) {
        context.addIssue({
          code: 'custom',
          message: 'Whole pieces only',
          path: ['items', index, 'quantity'],
        })
      }

      const gross = quantityCostRs(toMilli(item.quantity), item.unitCostRs)
      if (item.discountRs > gross) {
        context.addIssue({
          code: 'custom',
          message: 'Discount is larger than the line',
          path: ['items', index, 'discountRs'],
        })
      }
    })

    const subtotal = value.items.reduce(
      (sum, item) =>
        sum + lineTotalRs(toMilli(item.quantity), item.unitCostRs, item.discountRs),
      0,
    )
    if (value.discountRs > subtotal) {
      context.addIssue({
        code: 'custom',
        message: 'Discount is larger than the bill',
        path: ['discountRs'],
      })
    }
  })

export const purchaseItemRecordSchema = z.object({
  id: z.number().int().positive(),
  variantId: z.number().int().positive(),
  productName: z.string(),
  barcode: z.string(),
  size: z.string().nullable(),
  colour: z.string().nullable(),
  unit: z.enum(productUnits),
  quantityMilli: z.number().int(),
  unitCostRs: z.number().int(),
  discountRs: z.number().int(),
  lineTotalRs: z.number().int(),
})

export const purchaseListItemSchema = z.object({
  id: z.number().int().positive(),
  supplierId: z.number().int().positive(),
  supplierName: z.string(),
  purchasedAt: z.coerce.date(),
  itemCount: z.number().int().nonnegative(),
  discountRs: z.number().int(),
  totalRs: z.number().int(),
  note: z.string().nullable(),
})

export const purchaseRecordSchema = purchaseListItemSchema.extend({
  items: z.array(purchaseItemRecordSchema),
})

export type PurchaseId = z.infer<typeof purchaseIdSchema>
export type PurchaseCatalogVariant = z.infer<typeof purchaseCatalogVariantSchema>
export type ReceivePurchaseItemInput = z.input<typeof receivePurchaseItemSchema>
export type ReceivePurchaseItem = z.infer<typeof receivePurchaseItemSchema>
export type ReceivePurchaseInput = z.input<typeof receivePurchaseSchema>
export type ReceivePurchase = z.infer<typeof receivePurchaseSchema>
export type PurchaseItemRecord = z.infer<typeof purchaseItemRecordSchema>
export type PurchaseListItem = z.infer<typeof purchaseListItemSchema>
export type PurchaseRecord = z.infer<typeof purchaseRecordSchema>

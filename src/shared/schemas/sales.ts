import { z } from 'zod'
import { lineTotalRs } from '@shared/cost'
import { productUnits, toMilli } from '@shared/quantity'

export const posCatalogVariantSchema = z.object({
  variantId: z.number().int().positive(),
  productId: z.number().int().positive(),
  productName: z.string(),
  barcode: z.string(),
  size: z.string().nullable(),
  colour: z.string().nullable(),
  unit: z.enum(productUnits),
  salePriceRs: z.number().int(),
  quantityMilli: z.number().int(),
})

export const cartItemSchema = z.object({
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

function refineCart(
  value: {
    discountRs: number
    items: Array<{
      unit: (typeof productUnits)[number]
      quantity: number
      unitPriceRs: number
      lineDiscountRs: number
    }>
  },
  context: z.RefinementCtx,
  tenderedRs?: number,
): void {
  value.items.forEach((item, index) => {
    if (item.unit === 'piece' && !Number.isInteger(item.quantity)) {
      context.addIssue({
        code: 'custom',
        message: 'Whole pieces only',
        path: ['items', index, 'quantity'],
      })
    }

    const gross = lineTotalRs(toMilli(item.quantity), item.unitPriceRs, 0)
    if (item.lineDiscountRs > gross) {
      context.addIssue({
        code: 'custom',
        message: 'Discount is larger than the line',
        path: ['items', index, 'lineDiscountRs'],
      })
    }
  })

  const subtotal = value.items.reduce(
    (sum, item) =>
      sum + lineTotalRs(toMilli(item.quantity), item.unitPriceRs, item.lineDiscountRs),
    0,
  )
  if (value.discountRs > subtotal) {
    context.addIssue({
      code: 'custom',
      message: 'Discount is larger than the bill',
      path: ['discountRs'],
    })
  }

  if (tenderedRs !== undefined && tenderedRs < subtotal - value.discountRs) {
    context.addIssue({
      code: 'custom',
      message: 'Tendered is less than the total',
      path: ['tenderedRs'],
    })
  }
}

export const completeSaleSchema = z
  .object({
    phone: z.string().trim().max(20, 'Phone is too long'),
    discountRs: z.coerce
      .number()
      .int('Whole rupees only')
      .nonnegative('Cannot be negative')
      .max(10_000_000, 'That discount is too large'),
    tenderedRs: z.coerce
      .number()
      .int('Whole rupees only')
      .nonnegative('Cannot be negative')
      .max(10_000_000, 'That amount is too large'),
    items: z.array(cartItemSchema).min(1, 'Add at least one item'),
  })
  .superRefine((value, context) => refineCart(value, context, value.tenderedRs))

export const saveHoldSchema = z
  .object({
    phone: z.string().trim().max(20, 'Phone is too long'),
    note: z.string().trim().max(500, 'Note is too long'),
    discountRs: z.coerce
      .number()
      .int('Whole rupees only')
      .nonnegative('Cannot be negative')
      .max(10_000_000, 'That discount is too large'),
    items: z.array(cartItemSchema).min(1, 'Add at least one item'),
  })
  .superRefine((value, context) => refineCart(value, context))

export const holdIdSchema = z.object({
  id: z.number().int().positive(),
})

export const heldSaleItemSchema = z.object({
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

export const heldSaleSchema = z.object({
  id: z.number().int().positive(),
  phone: z.string().nullable(),
  note: z.string().nullable(),
  discountRs: z.number().int(),
  createdAt: z.coerce.date(),
  itemCount: z.number().int().nonnegative(),
  totalRs: z.number().int(),
  items: z.array(heldSaleItemSchema),
})

export const completedSaleSchema = z.object({
  id: z.number().int().positive(),
  billNo: z.number().int().positive(),
  totalRs: z.number().int(),
  tenderedRs: z.number().int(),
  changeRs: z.number().int(),
})

export type PosCatalogVariant = z.infer<typeof posCatalogVariantSchema>
export type CartItemInput = z.input<typeof cartItemSchema>
export type CartItem = z.infer<typeof cartItemSchema>
export type CompleteSaleInput = z.input<typeof completeSaleSchema>
export type CompleteSale = z.infer<typeof completeSaleSchema>
export type SaveHoldInput = z.input<typeof saveHoldSchema>
export type SaveHold = z.infer<typeof saveHoldSchema>
export type HoldId = z.infer<typeof holdIdSchema>
export type HeldSaleItem = z.infer<typeof heldSaleItemSchema>
export type HeldSale = z.infer<typeof heldSaleSchema>
export type CompletedSale = z.infer<typeof completedSaleSchema>

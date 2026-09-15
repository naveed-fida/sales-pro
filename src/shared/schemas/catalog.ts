import { z } from 'zod'
import { PRODUCT_IMAGE_MAX_BYTES } from '@shared/product-image'
import { productUnits } from '@shared/quantity'

export const categorySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
})

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long'),
})

export const productIdSchema = z.object({
  id: z.number().int().positive(),
})

export const saveProductImageSchema = z.object({
  id: z.number().int().positive(),
  bytes: z
    .instanceof(Uint8Array)
    .refine((bytes) => bytes.byteLength > 0, 'Photo is empty')
    .refine((bytes) => bytes.byteLength <= PRODUCT_IMAGE_MAX_BYTES, 'Photo is too large'),
})

export const variantInputSchema = z.object({
  id: z.number().int().positive().optional(),
  barcode: z.string().trim().max(64, 'Barcode is too long'),
  size: z.string().trim().max(40, 'Size is too long'),
  colour: z.string().trim().max(40, 'Colour is too long'),
  salePriceRs: z.coerce
    .number()
    .int('Whole rupees only')
    .nonnegative('Cannot be negative')
    .max(10_000_000, 'That price is too large'),
  reorderLevel: z.coerce
    .number()
    .nonnegative('Cannot be negative')
    .max(1_000_000, 'That number is too large'),
  isActive: z.boolean(),
})

export const saveProductSchema = z
  .object({
    id: z.number().int().positive().optional(),
    name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
    categoryId: z.coerce.number().int().positive('Pick a category'),
    unit: z.enum(productUnits),
    description: z.string().trim().max(500, 'Description is too long'),
    isActive: z.boolean(),
    variants: z.array(variantInputSchema).min(1, 'Add at least one variant'),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>()

    value.variants.forEach((variant, index) => {
      if (value.unit === 'piece' && !Number.isInteger(variant.reorderLevel)) {
        context.addIssue({
          code: 'custom',
          message: 'Whole pieces only',
          path: ['variants', index, 'reorderLevel'],
        })
      }

      if (!variant.barcode) return

      if (seen.has(variant.barcode)) {
        context.addIssue({
          code: 'custom',
          message: 'Duplicate barcode on this product',
          path: ['variants', index, 'barcode'],
        })
      }

      seen.add(variant.barcode)
    })
  })

export const variantRecordSchema = z.object({
  id: z.number().int().positive(),
  barcode: z.string(),
  size: z.string().nullable(),
  colour: z.string().nullable(),
  salePriceRs: z.number().int(),
  avgCostRs: z.number().int(),
  quantityMilli: z.number().int(),
  reorderLevelMilli: z.number().int(),
  isActive: z.boolean(),
})

export const productRecordSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  categoryId: z.number().int().positive(),
  unit: z.enum(productUnits),
  description: z.string().nullable(),
  imagePath: z.string().nullable(),
  isActive: z.boolean(),
  variants: z.array(variantRecordSchema),
})

export const productListItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  categoryId: z.number().int().positive(),
  categoryName: z.string(),
  unit: z.enum(productUnits),
  isActive: z.boolean(),
  variantCount: z.number().int().nonnegative(),
  quantityMilli: z.number().int(),
  minSalePriceRs: z.number().int(),
  maxSalePriceRs: z.number().int(),
  barcodes: z.string(),
  imagePath: z.string().nullable(),
})

export type Category = z.infer<typeof categorySchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type SaveProductImageInput = z.infer<typeof saveProductImageSchema>
export type SaveProductInput = z.input<typeof saveProductSchema>
export type SaveProduct = z.infer<typeof saveProductSchema>
export type ProductRecord = z.infer<typeof productRecordSchema>
export type ProductListItem = z.infer<typeof productListItemSchema>
export type VariantRecord = z.infer<typeof variantRecordSchema>

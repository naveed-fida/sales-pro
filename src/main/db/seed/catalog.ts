import { and, eq } from 'drizzle-orm'
import { toMilli, type ProductUnit } from '../../../shared/quantity.ts'
import { categories, products, productVariants } from '../schema.ts'
import type { AppDatabase } from '../sqlite.ts'

type SeedVariant = {
  size?: string
  colour?: string
  salePriceRs: number
  reorderLevel: number
}

type SeedProduct = {
  name: string
  category: string
  unit: ProductUnit
  description?: string
  variants: SeedVariant[]
}

const CATEGORIES = [
  "Men's Wear",
  "Women's Wear",
  'Kids',
  'Unstitched',
  'Accessories',
] as const

const PRODUCTS: SeedProduct[] = [
  {
    name: "Men's Cotton Kurta",
    category: "Men's Wear",
    unit: 'piece',
    description: 'Everyday cotton kurta, collared.',
    variants: [
      { size: 'S', colour: 'White', salePriceRs: 2200, reorderLevel: 4 },
      { size: 'M', colour: 'White', salePriceRs: 2200, reorderLevel: 6 },
      { size: 'L', colour: 'White', salePriceRs: 2400, reorderLevel: 6 },
      { size: 'XL', colour: 'White', salePriceRs: 2400, reorderLevel: 4 },
      { size: 'M', colour: 'Navy', salePriceRs: 2300, reorderLevel: 5 },
      { size: 'L', colour: 'Navy', salePriceRs: 2500, reorderLevel: 5 },
    ],
  },
  {
    name: "Men's Shalwar Kameez",
    category: "Men's Wear",
    unit: 'piece',
    variants: [
      { size: 'M', colour: 'Cream', salePriceRs: 3200, reorderLevel: 4 },
      { size: 'L', colour: 'Cream', salePriceRs: 3400, reorderLevel: 4 },
      { size: 'L', colour: 'Grey', salePriceRs: 3400, reorderLevel: 3 },
    ],
  },
  {
    name: "Men's Waistcoat",
    category: "Men's Wear",
    unit: 'piece',
    variants: [
      { size: 'M', colour: 'Black', salePriceRs: 2800, reorderLevel: 2 },
      { size: 'L', colour: 'Black', salePriceRs: 2800, reorderLevel: 2 },
    ],
  },
  {
    name: 'Ladies Lawn Suit 3pc',
    category: "Women's Wear",
    unit: 'piece',
    description: 'Printed lawn shirt, trouser and dupatta.',
    variants: [
      { colour: 'Mint', salePriceRs: 4500, reorderLevel: 4 },
      { colour: 'Rose', salePriceRs: 4500, reorderLevel: 4 },
      { colour: 'Sky', salePriceRs: 4700, reorderLevel: 3 },
    ],
  },
  {
    name: 'Ladies Pret Kurti',
    category: "Women's Wear",
    unit: 'piece',
    variants: [
      { size: 'S', colour: 'Black', salePriceRs: 1800, reorderLevel: 3 },
      { size: 'M', colour: 'Black', salePriceRs: 1800, reorderLevel: 4 },
      { size: 'L', colour: 'Black', salePriceRs: 1900, reorderLevel: 3 },
      { size: 'M', colour: 'Maroon', salePriceRs: 1900, reorderLevel: 3 },
    ],
  },
  {
    name: 'Chiffon Dupatta',
    category: "Women's Wear",
    unit: 'piece',
    variants: [
      { colour: 'White', salePriceRs: 650, reorderLevel: 8 },
      { colour: 'Gold', salePriceRs: 750, reorderLevel: 6 },
      { colour: 'Black', salePriceRs: 650, reorderLevel: 6 },
    ],
  },
  {
    name: 'Boys Kurta',
    category: 'Kids',
    unit: 'piece',
    variants: [
      { size: '3-4Y', colour: 'White', salePriceRs: 1400, reorderLevel: 3 },
      { size: '5-6Y', colour: 'White', salePriceRs: 1500, reorderLevel: 3 },
      { size: '7-8Y', colour: 'Navy', salePriceRs: 1600, reorderLevel: 2 },
    ],
  },
  {
    name: 'Girls Frock',
    category: 'Kids',
    unit: 'piece',
    variants: [
      { size: '3-4Y', colour: 'Pink', salePriceRs: 1700, reorderLevel: 2 },
      { size: '5-6Y', colour: 'Pink', salePriceRs: 1800, reorderLevel: 2 },
      { size: '5-6Y', colour: 'Yellow', salePriceRs: 1800, reorderLevel: 2 },
    ],
  },
  {
    name: 'Cotton Lawn',
    category: 'Unstitched',
    unit: 'meter',
    description: 'Sold by the metre from the roll.',
    variants: [
      { colour: 'White', salePriceRs: 480, reorderLevel: 20 },
      { colour: 'Ivory', salePriceRs: 520, reorderLevel: 15 },
      { colour: 'Printed Blue', salePriceRs: 680, reorderLevel: 12 },
    ],
  },
  {
    name: 'Wash & Wear',
    category: 'Unstitched',
    unit: 'meter',
    variants: [
      { colour: 'White', salePriceRs: 420, reorderLevel: 15 },
      { colour: 'Sky', salePriceRs: 450, reorderLevel: 10 },
    ],
  },
  {
    name: 'Linen',
    category: 'Unstitched',
    unit: 'yard',
    variants: [
      { colour: 'Beige', salePriceRs: 890, reorderLevel: 8 },
      { colour: 'Olive', salePriceRs: 920, reorderLevel: 6 },
    ],
  },
  {
    name: 'Plastic Buttons (pack)',
    category: 'Accessories',
    unit: 'piece',
    variants: [
      { colour: 'White', salePriceRs: 80, reorderLevel: 12 },
      { colour: 'Black', salePriceRs: 80, reorderLevel: 12 },
      { colour: 'Brown', salePriceRs: 80, reorderLevel: 8 },
    ],
  },
  {
    name: 'Matching Thread',
    category: 'Accessories',
    unit: 'piece',
    variants: [
      { colour: 'White', salePriceRs: 40, reorderLevel: 20 },
      { colour: 'Black', salePriceRs: 40, reorderLevel: 20 },
      { colour: 'Navy', salePriceRs: 40, reorderLevel: 10 },
    ],
  },
  {
    name: 'Elastic Tape',
    category: 'Accessories',
    unit: 'meter',
    variants: [{ colour: 'White', salePriceRs: 25, reorderLevel: 30 }],
  },
]

export type CatalogSeedSummary = {
  categoriesCreated: number
  productsCreated: number
  productsSkipped: number
}

function nextNumericBarcode(barcodes: string[]): number {
  const numeric = barcodes
    .filter((code) => /^\d+$/.test(code))
    .map((code) => Number.parseInt(code, 10))
  const highest = numeric.length > 0 ? Math.max(...numeric) : undefined
  if (highest === undefined || highest < 1_000_000) return 1_000_001
  return highest + 1
}

/** Inserts sample categories and products. Existing names are left untouched. */
export function seedCatalog(db: AppDatabase): CatalogSeedSummary {
  const categoryIds = new Map<string, number>()
  let categoriesCreated = 0
  let productsCreated = 0
  let productsSkipped = 0

  for (const name of CATEGORIES) {
    const existing = db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.name, name))
      .get()

    if (existing) {
      categoryIds.set(name, existing.id)
      continue
    }

    const row = db
      .insert(categories)
      .values({ name })
      .returning({ id: categories.id })
      .get()
    categoryIds.set(name, row.id)
    categoriesCreated += 1
  }

  const existingBarcodes = db
    .select({ barcode: productVariants.barcode })
    .from(productVariants)
    .all()
    .map((row) => row.barcode)
  const used = new Set(existingBarcodes)
  let next = nextNumericBarcode(existingBarcodes)

  for (const product of PRODUCTS) {
    const categoryId = categoryIds.get(product.category)
    if (categoryId === undefined) {
      throw new Error(`Seed category missing: ${product.category}`)
    }

    const existing = db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.name, product.name), eq(products.categoryId, categoryId)))
      .get()

    if (existing) {
      productsSkipped += 1
      continue
    }

    db.transaction((tx) => {
      const inserted = tx
        .insert(products)
        .values({
          name: product.name,
          categoryId,
          unit: product.unit,
          description: product.description ?? null,
        })
        .returning({ id: products.id })
        .get()

      for (const variant of product.variants) {
        while (used.has(String(next))) next += 1
        const barcode = String(next)
        next += 1
        used.add(barcode)

        tx.insert(productVariants)
          .values({
            productId: inserted.id,
            barcode,
            size: variant.size ?? null,
            colour: variant.colour ?? null,
            salePriceRs: variant.salePriceRs,
            reorderLevelMilli: toMilli(variant.reorderLevel),
          })
          .run()
      }
    })

    productsCreated += 1
  }

  return { categoriesCreated, productsCreated, productsSkipped }
}

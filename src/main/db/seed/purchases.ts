import { eq } from 'drizzle-orm'
import { roundRs } from '../../../shared/money.ts'
import { toMilli } from '../../../shared/quantity.ts'
import {
  productVariants,
  purchaseItems,
  purchases,
  stockMovements,
  suppliers,
} from '../schema.ts'
import type { AppDatabase } from '../sqlite.ts'
import { SEED_PRODUCTS } from './catalog.ts'
import { quantityCostRs, weightedAverageCostRs } from './cost.ts'
import { shopTimeDaysAgo } from './dates.ts'
import { findVariant, type SeedVariantRef } from './find-variant.ts'

type SeedSupplier = {
  name: string
  phone: string
  address: string
}

type SeedLine = SeedVariantRef & {
  quantity: number
  unitCostRs: number
}

const SUPPLIERS: SeedSupplier[] = [
  {
    name: 'Al-Noor Textiles',
    phone: '0300 555 0101',
    address: 'Shah Alam Market, Lahore',
  },
  {
    name: 'City Wholesale',
    phone: '0321 555 0202',
    address: 'Bolton Market, Karachi',
  },
]

const AL_NOOR_CATEGORIES = new Set(["Men's Wear", 'Kids', 'Unstitched'])

function openingLinesFor(categories: Set<string>): SeedLine[] {
  return SEED_PRODUCTS.filter((product) => categories.has(product.category)).flatMap(
    (product) =>
      product.variants.map((variant) => ({
        productName: product.name,
        size: variant.size,
        colour: variant.colour,
        quantity: product.unit === 'piece' ? 36 : 50,
        unitCostRs: roundRs(variant.salePriceRs * 0.6),
      })),
  )
}

export type PurchasesSeedSummary = {
  suppliersCreated: number
  purchasesCreated: number
}

function receivePurchase(
  db: AppDatabase,
  input: {
    supplierId: number
    purchasedAt: Date
    note: string
    lines: SeedLine[]
  },
): void {
  const lines = input.lines.map((line) => {
    const variant = findVariant(db, line)
    if (!variant) {
      throw new Error(`Seed variant missing: ${line.productName}`)
    }
    const quantityMilli = toMilli(line.quantity)
    return {
      variant,
      quantityMilli,
      unitCostRs: line.unitCostRs,
      lineTotal: quantityCostRs(quantityMilli, line.unitCostRs),
    }
  })

  db.transaction((tx) => {
    const inserted = tx
      .insert(purchases)
      .values({
        supplierId: input.supplierId,
        purchasedAt: input.purchasedAt,
        discountRs: 0,
        totalRs: lines.reduce((sum, line) => sum + line.lineTotal, 0),
        note: input.note,
      })
      .returning({ id: purchases.id })
      .get()

    for (const line of lines) {
      tx.insert(purchaseItems)
        .values({
          purchaseId: inserted.id,
          variantId: line.variant.id,
          quantityMilli: line.quantityMilli,
          unitCostRs: line.unitCostRs,
          discountRs: 0,
          lineTotalRs: line.lineTotal,
        })
        .run()

      const variant = tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, line.variant.id))
        .get()
      if (!variant) {
        throw new Error('Seed variant disappeared during purchase.')
      }

      tx.update(productVariants)
        .set({
          quantityMilli: variant.quantityMilli + line.quantityMilli,
          avgCostRs: weightedAverageCostRs(
            variant.quantityMilli,
            variant.avgCostRs,
            line.quantityMilli,
            line.unitCostRs,
          ),
          updatedAt: input.purchasedAt,
        })
        .where(eq(productVariants.id, line.variant.id))
        .run()

      tx.insert(stockMovements)
        .values({
          variantId: line.variant.id,
          quantityMilli: line.quantityMilli,
          reason: 'purchase',
          sourceTable: 'purchases',
          sourceId: inserted.id,
          createdAt: input.purchasedAt,
        })
        .run()
    }
  })
}

function supplierId(db: AppDatabase, name: string): number {
  const row = db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.name, name))
    .get()
  if (!row) throw new Error(`Seed supplier missing: ${name}`)
  return row.id
}

/** Inserts suppliers and two opening purchases covering the whole catalog. */
export function seedPurchases(db: AppDatabase): PurchasesSeedSummary {
  for (const supplier of SUPPLIERS) {
    db.insert(suppliers).values(supplier).run()
  }

  receivePurchase(db, {
    supplierId: supplierId(db, 'Al-Noor Textiles'),
    purchasedAt: shopTimeDaysAgo(18, 10, 30),
    note: "Opening stock — men's, kids, cloth",
    lines: openingLinesFor(AL_NOOR_CATEGORIES),
  })

  receivePurchase(db, {
    supplierId: supplierId(db, 'City Wholesale'),
    purchasedAt: shopTimeDaysAgo(10, 15, 0),
    note: 'Opening stock — ladies and accessories',
    lines: openingLinesFor(
      new Set(
        SEED_PRODUCTS.map((product) => product.category).filter(
          (name) => !AL_NOOR_CATEGORIES.has(name),
        ),
      ),
    ),
  })

  return { suppliersCreated: SUPPLIERS.length, purchasesCreated: 2 }
}

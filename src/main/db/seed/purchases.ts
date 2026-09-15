import { eq } from 'drizzle-orm'
import { roundRs } from '../../../shared/money.ts'
import { QUANTITY_SCALE, toMilli } from '../../../shared/quantity.ts'
import {
  productVariants,
  products,
  purchaseItems,
  purchases,
  stockMovements,
  suppliers,
} from '../schema.ts'
import type { AppDatabase } from '../sqlite.ts'

function quantityCostRs(quantityMilli: number, unitCostRs: number): number {
  return roundRs((quantityMilli * unitCostRs) / QUANTITY_SCALE)
}

function weightedAverageCostRs(
  existingQtyMilli: number,
  existingAvgCostRs: number,
  incomingQtyMilli: number,
  incomingUnitCostRs: number,
): number {
  if (incomingQtyMilli <= 0) return existingAvgCostRs
  if (existingQtyMilli <= 0) return incomingUnitCostRs
  const totalMilli = existingQtyMilli + incomingQtyMilli
  return roundRs(
    (existingQtyMilli * existingAvgCostRs + incomingQtyMilli * incomingUnitCostRs) /
      totalMilli,
  )
}

type SeedSupplier = {
  name: string
  phone: string
  address: string
}

type SeedLine = {
  productName: string
  size?: string
  colour?: string
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

const OPENING_LINES: SeedLine[] = [
  {
    productName: "Men's Cotton Kurta",
    size: 'M',
    colour: 'White',
    quantity: 12,
    unitCostRs: 1400,
  },
  {
    productName: "Men's Cotton Kurta",
    size: 'L',
    colour: 'Navy',
    quantity: 8,
    unitCostRs: 1500,
  },
  {
    productName: 'Ladies Lawn Suit 3pc',
    colour: 'Mint',
    quantity: 6,
    unitCostRs: 2800,
  },
  {
    productName: 'Cotton Lawn',
    colour: 'White',
    quantity: 25,
    unitCostRs: 280,
  },
  {
    productName: 'Linen',
    colour: 'Beige',
    quantity: 10,
    unitCostRs: 520,
  },
]

export type PurchasesSeedSummary = {
  suppliersCreated: number
  purchasesCreated: number
}

function findVariant(
  db: AppDatabase,
  line: SeedLine,
): { id: number; quantityMilli: number; avgCostRs: number } | undefined {
  const product = db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.name, line.productName))
    .get()
  if (!product) return undefined

  const rows = db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .all()

  return rows.find((variant) => {
    const sizeOk = line.size ? variant.size === line.size : true
    const colourOk = line.colour ? variant.colour === line.colour : true
    return sizeOk && colourOk
  })
}

/** Inserts sample suppliers and one opening purchase. Existing rows are left alone. */
export function seedPurchases(db: AppDatabase): PurchasesSeedSummary {
  let suppliersCreated = 0

  for (const supplier of SUPPLIERS) {
    const existing = db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.name, supplier.name))
      .get()
    if (existing) continue

    db.insert(suppliers).values(supplier).run()
    suppliersCreated += 1
  }

  const alreadyPurchased = db.select({ id: purchases.id }).from(purchases).limit(1).get()
  if (alreadyPurchased) {
    return { suppliersCreated, purchasesCreated: 0 }
  }

  const supplier = db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.name, 'Al-Noor Textiles'))
    .get()
  if (!supplier) {
    return { suppliersCreated, purchasesCreated: 0 }
  }

  const lines = OPENING_LINES.map((line) => {
    const variant = findVariant(db, line)
    if (!variant) return null
    const quantityMilli = toMilli(line.quantity)
    const lineTotal = quantityCostRs(quantityMilli, line.unitCostRs)
    return { variant, quantityMilli, unitCostRs: line.unitCostRs, lineTotal }
  }).filter((line) => line !== null)

  if (lines.length === 0) {
    return { suppliersCreated, purchasesCreated: 0 }
  }

  db.transaction((tx) => {
    const inserted = tx
      .insert(purchases)
      .values({
        supplierId: supplier.id,
        purchasedAt: new Date(),
        discountRs: 0,
        totalRs: lines.reduce((sum, line) => sum + line.lineTotal, 0),
        note: 'Opening stock',
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
      if (!variant) continue

      tx.update(productVariants)
        .set({
          quantityMilli: variant.quantityMilli + line.quantityMilli,
          avgCostRs: weightedAverageCostRs(
            variant.quantityMilli,
            variant.avgCostRs,
            line.quantityMilli,
            line.unitCostRs,
          ),
          updatedAt: new Date(),
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
        })
        .run()
    }
  })

  return { suppliersCreated, purchasesCreated: 1 }
}

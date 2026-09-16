import { eq } from 'drizzle-orm'
import { toMilli } from '../../../shared/quantity.ts'
import {
  heldSaleItems,
  heldSales,
  productVariants,
  saleItems,
  sales,
  stockMovements,
} from '../schema.ts'
import type { AppDatabase } from '../sqlite.ts'
import { SEED_PRODUCTS } from './catalog.ts'
import { lineTotalRs } from './cost.ts'
import { shopTimeDaysAgo } from './dates.ts'
import { findVariant, type SeedVariantRef } from './find-variant.ts'

type SeedSaleLine = SeedVariantRef & {
  quantity: number
  lineDiscountRs?: number
}

type SeedSale = {
  daysAgo: number
  hour: number
  minute: number
  phone?: string
  discountRs?: number
  items: SeedSaleLine[]
}

const PHONES = ['0300 111 2233', '0321 444 5566', '0333 777 8899', '0345 121 3434'] as const

const NAMED_SALES: SeedSale[] = [
  {
    daysAgo: 17,
    hour: 11,
    minute: 20,
    items: [
      { productName: "Men's Cotton Kurta", size: 'M', colour: 'White', quantity: 2 },
      { productName: "Men's Cotton Kurta", size: 'L', colour: 'Navy', quantity: 1 },
    ],
  },
  {
    daysAgo: 16,
    hour: 16,
    minute: 5,
    phone: PHONES[0],
    items: [
      { productName: 'Ladies Lawn Suit 3pc', colour: 'Mint', quantity: 1 },
      { productName: 'Chiffon Dupatta', colour: 'White', quantity: 1 },
    ],
  },
  {
    daysAgo: 15,
    hour: 12,
    minute: 40,
    items: [{ productName: 'Cotton Lawn', colour: 'White', quantity: 3 }],
  },
  {
    daysAgo: 14,
    hour: 18,
    minute: 10,
    phone: PHONES[1],
    items: [
      { productName: 'Girls Frock', size: '5-6Y', colour: 'Pink', quantity: 1 },
      { productName: 'Boys Kurta', size: '5-6Y', colour: 'White', quantity: 1 },
    ],
  },
  {
    daysAgo: 12,
    hour: 13,
    minute: 0,
    phone: PHONES[2],
    discountRs: 200,
    items: [{ productName: "Men's Shalwar Kameez", size: 'L', colour: 'Cream', quantity: 1 }],
  },
  {
    daysAgo: 11,
    hour: 10,
    minute: 45,
    items: [
      { productName: 'Plastic Buttons (pack)', colour: 'White', quantity: 3 },
      { productName: 'Matching Thread', colour: 'White', quantity: 4 },
    ],
  },
  {
    daysAgo: 8,
    hour: 17,
    minute: 25,
    phone: PHONES[3],
    items: [{ productName: 'Ladies Pret Kurti', size: 'M', colour: 'Black', quantity: 2 }],
  },
  {
    daysAgo: 5,
    hour: 11,
    minute: 50,
    items: [
      { productName: "Men's Waistcoat", size: 'M', colour: 'Black', quantity: 1 },
      { productName: "Men's Cotton Kurta", size: 'M', colour: 'Navy', quantity: 1 },
    ],
  },
  {
    daysAgo: 3,
    hour: 14,
    minute: 15,
    phone: PHONES[0],
    items: [{ productName: 'Linen', colour: 'Beige', quantity: 2 }],
  },
  {
    daysAgo: 1,
    hour: 19,
    minute: 5,
    items: [
      { productName: 'Ladies Lawn Suit 3pc', colour: 'Sky', quantity: 1 },
      { productName: 'Elastic Tape', colour: 'White', quantity: 2 },
    ],
  },
]

const HOLDS: Array<{
  phone?: string
  note: string
  items: SeedSaleLine[]
}> = [
  {
    phone: PHONES[1],
    note: 'Waiting for matching dupatta',
    items: [{ productName: 'Ladies Lawn Suit 3pc', colour: 'Rose', quantity: 1 }],
  },
  {
    note: 'Call back after Jumma',
    items: [
      { productName: "Men's Cotton Kurta", size: 'XL', colour: 'White', quantity: 1 },
      { productName: "Men's Cotton Kurta", size: 'L', colour: 'White', quantity: 1 },
    ],
  },
]

export type SalesSeedSummary = {
  salesCreated: number
  holdsCreated: number
}

function cashTendered(totalRs: number): number {
  if (totalRs <= 0) return 0
  if (totalRs <= 500) return Math.ceil(totalRs / 50) * 50
  return Math.ceil(totalRs / 100) * 100
}

function catalogCycle(): Array<SeedVariantRef & { quantity: number }> {
  return SEED_PRODUCTS.flatMap((product) =>
    product.variants.map((variant) => ({
      productName: product.name,
      size: variant.size,
      colour: variant.colour,
      quantity: product.unit === 'piece' ? 1 : 1.5,
    })),
  )
}

function generatedSales(): SeedSale[] {
  const cycle = catalogCycle()
  const extra = 55
  const bills: SeedSale[] = []

  for (let i = 0; i < extra; i += 1) {
    const item = cycle[i % cycle.length]
    const daysAgo = 20 - Math.floor((i * 20) / extra)
    bills.push({
      daysAgo,
      hour: 10 + (i % 9),
      minute: (i * 7) % 60,
      phone: i % 3 === 0 ? PHONES[i % PHONES.length] : undefined,
      items: [
        {
          productName: item.productName,
          size: item.size,
          colour: item.colour,
          quantity: item.quantity,
        },
      ],
    })
  }

  return bills
}

function completeSeedSale(
  db: AppDatabase,
  billNo: number,
  sale: SeedSale,
): void {
  const createdAt = shopTimeDaysAgo(sale.daysAgo, sale.hour, sale.minute)
  const discountRs = sale.discountRs ?? 0

  db.transaction((tx) => {
    const prepared: Array<{
      variantId: number
      quantityMilli: number
      unitPriceRs: number
      lineDiscountRs: number
      lineTotalRs: number
      unitCostRs: number
    }> = []

    for (const item of sale.items) {
      const variant = findVariant(db, item)
      if (!variant) {
        throw new Error(`Seed variant missing: ${item.productName}`)
      }
      const live = tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, variant.id))
        .get()
      if (!live) {
        throw new Error(`Seed variant missing: ${item.productName}`)
      }

      const quantityMilli = toMilli(item.quantity)
      if (live.quantityMilli < quantityMilli) {
        throw new Error(`Seed sale oversold ${item.productName}`)
      }

      const lineDiscountRs = item.lineDiscountRs ?? 0
      prepared.push({
        variantId: live.id,
        quantityMilli,
        unitPriceRs: live.salePriceRs,
        lineDiscountRs,
        lineTotalRs: lineTotalRs(quantityMilli, live.salePriceRs, lineDiscountRs),
        unitCostRs: live.avgCostRs,
      })
    }

    const subtotal = prepared.reduce((sum, line) => sum + line.lineTotalRs, 0)
    const totalRs = subtotal - discountRs
    const tenderedRs = cashTendered(totalRs)

    const inserted = tx
      .insert(sales)
      .values({
        billNo,
        phone: sale.phone ?? null,
        discountRs,
        totalRs,
        tenderedRs,
        changeRs: tenderedRs - totalRs,
        createdAt,
      })
      .returning({ id: sales.id })
      .get()

    for (const line of prepared) {
      tx.insert(saleItems)
        .values({
          saleId: inserted.id,
          variantId: line.variantId,
          quantityMilli: line.quantityMilli,
          unitPriceRs: line.unitPriceRs,
          lineDiscountRs: line.lineDiscountRs,
          lineTotalRs: line.lineTotalRs,
          unitCostRs: line.unitCostRs,
        })
        .run()

      const live = tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, line.variantId))
        .get()
      if (!live) {
        throw new Error('Seed variant disappeared during sale.')
      }

      tx.update(productVariants)
        .set({
          quantityMilli: live.quantityMilli - line.quantityMilli,
          updatedAt: createdAt,
        })
        .where(eq(productVariants.id, line.variantId))
        .run()

      tx.insert(stockMovements)
        .values({
          variantId: line.variantId,
          quantityMilli: -line.quantityMilli,
          reason: 'sale',
          sourceTable: 'sales',
          sourceId: inserted.id,
          createdAt,
        })
        .run()
    }
  })
}

function seedHolds(db: AppDatabase): number {
  for (const hold of HOLDS) {
    db.transaction((tx) => {
      const inserted = tx
        .insert(heldSales)
        .values({
          phone: hold.phone ?? null,
          note: hold.note,
          discountRs: 0,
        })
        .returning({ id: heldSales.id })
        .get()

      for (const item of hold.items) {
        const variant = findVariant(db, item)
        if (!variant) {
          throw new Error(`Seed hold variant missing: ${item.productName}`)
        }
        tx.insert(heldSaleItems)
          .values({
            heldSaleId: inserted.id,
            variantId: variant.id,
            quantityMilli: toMilli(item.quantity),
            unitPriceRs: variant.salePriceRs,
            lineDiscountRs: item.lineDiscountRs ?? 0,
          })
          .run()
      }
    })
  }

  return HOLDS.length
}

/** Inserts completed bills and a couple of held carts. Call after seedPurchases. */
export function seedSales(db: AppDatabase): SalesSeedSummary {
  const bills = [...NAMED_SALES, ...generatedSales()]
  bills.forEach((sale, index) => {
    completeSeedSale(db, index + 1, sale)
  })

  return {
    salesCreated: bills.length,
    holdsCreated: seedHolds(db),
  }
}

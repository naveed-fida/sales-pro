import { asc, desc, eq } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { groupBy } from 'lodash-es'
import { quantityCostRs, weightedAverageCostRs } from '@shared/cost'
import { IPC } from '@shared/ipc'
import { ipcFail, ipcOk, type IpcResult } from '@shared/ipc-result'
import { toMilli } from '@shared/quantity'
import {
  purchaseIdSchema,
  receivePurchaseSchema,
  type PurchaseCatalogVariant,
  type PurchaseListItem,
  type PurchaseRecord,
  type ReceivePurchase,
} from '@shared/schemas/purchases'
import { getDb } from '../db/client'
import {
  productVariants,
  products,
  purchaseItems,
  purchases,
  stockMovements,
  suppliers,
} from '../db/schema'

class PurchasesError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'PurchasesError'
  }
}

function listCatalogVariants(): PurchaseCatalogVariant[] {
  const db = getDb()
  const productRows = db.select().from(products).orderBy(asc(products.name)).all()
  const variantRows = db
    .select()
    .from(productVariants)
    .orderBy(asc(productVariants.id))
    .all()
  const variantsByProduct = groupBy(variantRows, (row) => String(row.productId))
  const rows: PurchaseCatalogVariant[] = []

  for (const product of productRows) {
    if (!product.isActive) continue
    for (const variant of variantsByProduct[String(product.id)] ?? []) {
      if (!variant.isActive) continue
      rows.push({
        variantId: variant.id,
        productId: product.id,
        productName: product.name,
        barcode: variant.barcode,
        size: variant.size,
        colour: variant.colour,
        unit: product.unit,
        avgCostRs: variant.avgCostRs,
        quantityMilli: variant.quantityMilli,
      })
    }
  }

  return rows
}

function listPurchases(): PurchaseListItem[] {
  const db = getDb()
  const purchaseRows = db
    .select({
      id: purchases.id,
      supplierId: purchases.supplierId,
      purchasedAt: purchases.purchasedAt,
      discountRs: purchases.discountRs,
      totalRs: purchases.totalRs,
      note: purchases.note,
      supplierName: suppliers.name,
    })
    .from(purchases)
    .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
    .orderBy(desc(purchases.purchasedAt), desc(purchases.id))
    .all()
  const itemRows = db.select().from(purchaseItems).all()
  const itemsByPurchase = groupBy(itemRows, (row) => String(row.purchaseId))

  return purchaseRows.map((row) => ({
    id: row.id,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    purchasedAt: row.purchasedAt,
    itemCount: (itemsByPurchase[String(row.id)] ?? []).length,
    discountRs: row.discountRs,
    totalRs: row.totalRs,
    note: row.note,
  }))
}

function loadPurchase(id: number): PurchaseRecord | undefined {
  const db = getDb()
  const row = db
    .select({
      id: purchases.id,
      supplierId: purchases.supplierId,
      purchasedAt: purchases.purchasedAt,
      discountRs: purchases.discountRs,
      totalRs: purchases.totalRs,
      note: purchases.note,
      supplierName: suppliers.name,
    })
    .from(purchases)
    .innerJoin(suppliers, eq(purchases.supplierId, suppliers.id))
    .where(eq(purchases.id, id))
    .get()

  if (!row) return undefined

  const items = db
    .select({
      id: purchaseItems.id,
      variantId: purchaseItems.variantId,
      quantityMilli: purchaseItems.quantityMilli,
      unitCostRs: purchaseItems.unitCostRs,
      discountRs: purchaseItems.discountRs,
      lineTotalRs: purchaseItems.lineTotalRs,
      barcode: productVariants.barcode,
      size: productVariants.size,
      colour: productVariants.colour,
      productName: products.name,
      unit: products.unit,
    })
    .from(purchaseItems)
    .innerJoin(productVariants, eq(purchaseItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(purchaseItems.purchaseId, id))
    .orderBy(asc(purchaseItems.id))
    .all()

  return {
    id: row.id,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    purchasedAt: row.purchasedAt,
    itemCount: items.length,
    discountRs: row.discountRs,
    totalRs: row.totalRs,
    note: row.note,
    items,
  }
}

function receivePurchase(input: ReceivePurchase): PurchaseRecord {
  const db = getDb()
  const purchaseId = db.transaction((tx) => {
    const supplier = tx
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.id, input.supplierId))
      .get()
    if (!supplier) throw new PurchasesError('Supplier not found.', 'supplierId')

    const prepared: Array<{
      variantId: number
      quantityMilli: number
      unitCostRs: number
      discountRs: number
      lineTotal: number
    }> = []

    for (const [index, item] of input.items.entries()) {
      const variant = tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, item.variantId))
        .get()
      if (!variant) {
        throw new PurchasesError('Variant not found.', `items.${index}.variantId`)
      }

      const product = tx
        .select()
        .from(products)
        .where(eq(products.id, variant.productId))
        .get()
      if (!product) {
        throw new PurchasesError('Product not found.', `items.${index}.variantId`)
      }

      if (product.unit === 'piece' && !Number.isInteger(item.quantity)) {
        throw new PurchasesError('Whole pieces only', `items.${index}.quantity`)
      }

      const quantityMilli = toMilli(item.quantity)
      if (quantityMilli <= 0) {
        throw new PurchasesError(
          'Quantity must be more than zero',
          `items.${index}.quantity`,
        )
      }

      const gross = quantityCostRs(quantityMilli, item.unitCostRs)
      if (item.discountRs > gross) {
        throw new PurchasesError(
          'Discount is larger than the line',
          `items.${index}.discountRs`,
        )
      }

      prepared.push({
        variantId: variant.id,
        quantityMilli,
        unitCostRs: item.unitCostRs,
        discountRs: item.discountRs,
        lineTotal: gross - item.discountRs,
      })
    }

    const subtotal = prepared.reduce((sum, line) => sum + line.lineTotal, 0)
    if (input.discountRs > subtotal) {
      throw new PurchasesError('Discount is larger than the bill', 'discountRs')
    }

    const inserted = tx
      .insert(purchases)
      .values({
        supplierId: input.supplierId,
        purchasedAt: input.purchasedAt,
        discountRs: input.discountRs,
        totalRs: subtotal - input.discountRs,
        note: input.note || null,
      })
      .returning({ id: purchases.id })
      .get()

    for (const [index, line] of prepared.entries()) {
      tx.insert(purchaseItems)
        .values({
          purchaseId: inserted.id,
          variantId: line.variantId,
          quantityMilli: line.quantityMilli,
          unitCostRs: line.unitCostRs,
          discountRs: line.discountRs,
          lineTotalRs: line.lineTotal,
        })
        .run()

      const variant = tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, line.variantId))
        .get()
      if (!variant) {
        throw new PurchasesError('Variant not found.', `items.${index}.variantId`)
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
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, line.variantId))
        .run()

      tx.insert(stockMovements)
        .values({
          variantId: line.variantId,
          quantityMilli: line.quantityMilli,
          reason: 'purchase',
          sourceTable: 'purchases',
          sourceId: inserted.id,
        })
        .run()
    }

    return inserted.id
  })

  const saved = loadPurchase(purchaseId)
  if (!saved) throw new PurchasesError('Purchase not found.')
  return saved
}

export function registerPurchasesHandlers(): void {
  ipcMain.handle(IPC.purchases.list, (): IpcResult<PurchaseListItem[]> => {
    try {
      return ipcOk(listPurchases())
    } catch (error) {
      console.error('purchases:list failed', error)
      return ipcFail('Could not load purchases.')
    }
  })

  ipcMain.handle(IPC.purchases.catalog, (): IpcResult<PurchaseCatalogVariant[]> => {
    try {
      return ipcOk(listCatalogVariants())
    } catch (error) {
      console.error('purchases:catalog failed', error)
      return ipcFail('Could not load variants.')
    }
  })

  ipcMain.handle(
    IPC.purchases.get,
    (_event, payload: unknown): IpcResult<PurchaseRecord> => {
      const parsed = purchaseIdSchema.safeParse(payload)
      if (!parsed.success) return ipcFail('Invalid purchase.')

      try {
        const purchase = loadPurchase(parsed.data.id)
        if (!purchase) return ipcFail('Purchase not found.')
        return ipcOk(purchase)
      } catch (error) {
        console.error('purchases:get failed', error)
        return ipcFail('Could not load the purchase.')
      }
    },
  )

  ipcMain.handle(
    IPC.purchases.receive,
    (_event, payload: unknown): IpcResult<PurchaseRecord> => {
      const parsed = receivePurchaseSchema.safeParse(payload)
      if (!parsed.success) {
        const [issue] = parsed.error.issues
        return ipcFail(
          issue?.message ?? 'Invalid purchase.',
          issue?.path.map(String).join('.'),
        )
      }

      try {
        return ipcOk(receivePurchase(parsed.data))
      } catch (error) {
        if (error instanceof PurchasesError) {
          return ipcFail(error.message, error.field)
        }
        console.error('purchases:receive failed', error)
        return ipcFail('Could not receive the purchase.')
      }
    },
  )
}

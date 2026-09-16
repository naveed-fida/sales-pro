import { asc, eq } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { allocateByWeights, refundPortionRs } from '@shared/cost'
import { IPC } from '@shared/ipc'
import { ipcFail, ipcOk, type IpcResult } from '@shared/ipc-result'
import { fromMilli, toMilli } from '@shared/quantity'
import {
  completeReturnSchema,
  lookupReturnSchema,
  type CompletedReturn,
  type CompleteReturn,
  type ReturnBill,
  type ReturnBillItem,
} from '@shared/schemas/returns'
import { getDb } from '../db/client'
import {
  productVariants,
  products,
  returnItems,
  saleItems,
  sales,
  salesReturns,
  stockMovements,
} from '../db/schema'
import type { AppDatabase } from '../db/sqlite'

type QueryDb = Pick<AppDatabase, 'select'>

class ReturnsError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'ReturnsError'
  }
}

type SaleLine = {
  id: number
  variantId: number
  quantityMilli: number
  unitPriceRs: number
  lineTotalRs: number
  barcode: string
  size: string | null
  colour: string | null
  productName: string
  unit: ReturnBillItem['unit']
}

function loadSaleLines(db: QueryDb, saleId: number): SaleLine[] {
  return db
    .select({
      id: saleItems.id,
      variantId: saleItems.variantId,
      quantityMilli: saleItems.quantityMilli,
      unitPriceRs: saleItems.unitPriceRs,
      lineTotalRs: saleItems.lineTotalRs,
      barcode: productVariants.barcode,
      size: productVariants.size,
      colour: productVariants.colour,
      productName: products.name,
      unit: products.unit,
    })
    .from(saleItems)
    .innerJoin(productVariants, eq(saleItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(saleItems.saleId, saleId))
    .orderBy(asc(saleItems.id))
    .all()
}

function priorReturns(
  db: QueryDb,
  saleId: number,
): Map<number, { milli: number; refundedRs: number }> {
  const rows = db
    .select({
      saleItemId: returnItems.saleItemId,
      quantityMilli: returnItems.quantityMilli,
      lineTotalRs: returnItems.lineTotalRs,
    })
    .from(returnItems)
    .innerJoin(salesReturns, eq(returnItems.returnId, salesReturns.id))
    .where(eq(salesReturns.saleId, saleId))
    .all()

  const totals = new Map<number, { milli: number; refundedRs: number }>()
  for (const row of rows) {
    const current = totals.get(row.saleItemId) ?? { milli: 0, refundedRs: 0 }
    totals.set(row.saleItemId, {
      milli: current.milli + row.quantityMilli,
      refundedRs: current.refundedRs + row.lineTotalRs,
    })
  }
  return totals
}

function toBillItems(
  saleTotalRs: number,
  lines: SaleLine[],
  returned: Map<number, { milli: number; refundedRs: number }>,
): ReturnBillItem[] {
  const nets = allocateByWeights(
    saleTotalRs,
    lines.map((line) => line.lineTotalRs),
  )

  return lines.map((line, index) => {
    const prior = returned.get(line.id) ?? { milli: 0, refundedRs: 0 }
    const remainingMilli = Math.max(0, line.quantityMilli - prior.milli)
    const netRs = nets[index] ?? 0
    const remainingRefundRs =
      remainingMilli <= 0 ? 0 : Math.max(0, netRs - prior.refundedRs)
    return {
      saleItemId: line.id,
      variantId: line.variantId,
      productName: line.productName,
      barcode: line.barcode,
      size: line.size,
      colour: line.colour,
      unit: line.unit,
      soldMilli: line.quantityMilli,
      returnedMilli: prior.milli,
      remainingMilli,
      unitPriceRs: line.unitPriceRs,
      lineTotalRs: line.lineTotalRs,
      netRs,
      refundedRs: prior.refundedRs,
      remainingRefundRs,
    }
  })
}

function lookupBill(billNo: number): ReturnBill {
  const db = getDb()
  const row = db.select().from(sales).where(eq(sales.billNo, billNo)).get()
  if (!row) throw new ReturnsError('Bill not found.')

  const lines = loadSaleLines(db, row.id)
  if (lines.length === 0) throw new ReturnsError('That bill has no items.')

  return {
    saleId: row.id,
    billNo: row.billNo,
    phone: row.phone,
    status: row.status,
    createdAt: row.createdAt,
    discountRs: row.discountRs,
    totalRs: row.totalRs,
    items: toBillItems(row.totalRs, lines, priorReturns(db, row.id)),
  }
}

function completeReturn(input: CompleteReturn): CompletedReturn {
  return getDb().transaction((tx) => {
    const sale = tx.select().from(sales).where(eq(sales.id, input.saleId)).get()
    if (!sale) throw new ReturnsError('Sale not found.')
    if (sale.status === 'returned') {
      throw new ReturnsError('This bill is already returned.')
    }

    const lines = loadSaleLines(tx, sale.id)
    const items = toBillItems(sale.totalRs, lines, priorReturns(tx, sale.id))
    const itemById = new Map(items.map((item) => [item.saleItemId, item]))

    const prepared: Array<{
      saleItemId: number
      variantId: number
      quantityMilli: number
      unitPriceRs: number
      lineTotalRs: number
    }> = []

    for (const [index, item] of input.items.entries()) {
      const billItem = itemById.get(item.saleItemId)
      if (!billItem) {
        throw new ReturnsError('Item is not on this bill.', `items.${index}.saleItemId`)
      }
      if (billItem.unit === 'piece' && !Number.isInteger(item.quantity)) {
        throw new ReturnsError('Whole pieces only', `items.${index}.quantity`)
      }
      const quantityMilli = toMilli(item.quantity)
      if (quantityMilli > billItem.remainingMilli) {
        throw new ReturnsError(
          `Only ${fromMilli(billItem.remainingMilli)} left to return.`,
          `items.${index}.quantity`,
        )
      }
      prepared.push({
        saleItemId: billItem.saleItemId,
        variantId: billItem.variantId,
        quantityMilli,
        unitPriceRs: billItem.unitPriceRs,
        lineTotalRs: refundPortionRs(
          billItem.netRs,
          billItem.soldMilli,
          quantityMilli,
          billItem.remainingMilli,
          billItem.remainingRefundRs,
        ),
      })
    }

    const totalRs = prepared.reduce((sum, line) => sum + line.lineTotalRs, 0)
    const inserted = tx
      .insert(salesReturns)
      .values({
        saleId: sale.id,
        totalRs,
      })
      .returning({ id: salesReturns.id })
      .get()

    for (const line of prepared) {
      tx.insert(returnItems)
        .values({
          returnId: inserted.id,
          saleItemId: line.saleItemId,
          variantId: line.variantId,
          quantityMilli: line.quantityMilli,
          unitPriceRs: line.unitPriceRs,
          lineTotalRs: line.lineTotalRs,
        })
        .run()

      const variant = tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, line.variantId))
        .get()
      if (!variant) throw new ReturnsError('Item is no longer in the catalog.')

      tx.update(productVariants)
        .set({
          quantityMilli: variant.quantityMilli + line.quantityMilli,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, line.variantId))
        .run()

      tx.insert(stockMovements)
        .values({
          variantId: line.variantId,
          quantityMilli: line.quantityMilli,
          reason: 'return',
          sourceTable: 'sales_returns',
          sourceId: inserted.id,
        })
        .run()
    }

    const remainingAfter = new Map(
      items.map((item) => [item.saleItemId, item.remainingMilli]),
    )
    for (const line of prepared) {
      remainingAfter.set(
        line.saleItemId,
        (remainingAfter.get(line.saleItemId) ?? 0) - line.quantityMilli,
      )
    }
    const anyRemaining = [...remainingAfter.values()].some((milli) => milli > 0)
    const saleStatus = anyRemaining ? 'partially_returned' : 'returned'

    tx.update(sales).set({ status: saleStatus }).where(eq(sales.id, sale.id)).run()

    return {
      id: inserted.id,
      saleId: sale.id,
      billNo: sale.billNo,
      totalRs,
      saleStatus,
    }
  })
}

export function registerReturnsHandlers(): void {
  ipcMain.handle(
    IPC.returns.lookup,
    (_event, payload: unknown): IpcResult<ReturnBill> => {
      const parsed = lookupReturnSchema.safeParse(payload)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        return ipcFail(
          issue?.message ?? 'Invalid bill number.',
          issue?.path.map(String).join('.'),
        )
      }

      try {
        return ipcOk(lookupBill(parsed.data.billNo))
      } catch (error) {
        if (error instanceof ReturnsError) return ipcFail(error.message, error.field)
        console.error('returns:lookup failed', error)
        return ipcFail('Could not load the bill.')
      }
    },
  )

  ipcMain.handle(
    IPC.returns.complete,
    (_event, payload: unknown): IpcResult<CompletedReturn> => {
      const parsed = completeReturnSchema.safeParse(payload)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        return ipcFail(
          issue?.message ?? 'Invalid return.',
          issue?.path.map(String).join('.'),
        )
      }

      try {
        return ipcOk(completeReturn(parsed.data))
      } catch (error) {
        if (error instanceof ReturnsError) return ipcFail(error.message, error.field)
        console.error('returns:complete failed', error)
        return ipcFail('Could not complete the return.')
      }
    },
  )
}

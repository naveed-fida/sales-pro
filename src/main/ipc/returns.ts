import { asc, desc, eq, inArray } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { groupBy } from 'lodash-es'
import { allocateByWeights, lineTotalRs, refundPortionRs } from '@shared/cost'
import { IPC } from '@shared/ipc'
import { ipcFail, ipcOk, type IpcResult } from '@shared/ipc-result'
import { fromMilli, toMilli } from '@shared/quantity'
import {
  completeReturnSchema,
  lookupReturnSchema,
  returnIdSchema,
  type CompletedReturn,
  type CompleteReturn,
  type ReturnBill,
  type ReturnBillItem,
  type ReturnListItem,
  type ReturnRecord,
} from '@shared/schemas/returns'
import { getDb } from '../db/client'
import {
  productVariants,
  products,
  returnExchangeItems,
  returnItems,
  saleItems,
  sales,
  salesReturns,
  stockMovements,
} from '../db/schema'
import type { AppDatabase } from '../db/sqlite'
import { printReceipt } from '../receipt'
import { loadSettings } from './settings'

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

    const exchangePrepared: Array<{
      variantId: number
      quantityMilli: number
      unitPriceRs: number
      lineDiscountRs: number
      lineTotalRs: number
      unitCostRs: number
    }> = []
    const reservedMilli = new Map<number, number>()
    for (const line of prepared) {
      reservedMilli.set(
        line.variantId,
        (reservedMilli.get(line.variantId) ?? 0) - line.quantityMilli,
      )
    }

    for (const [index, item] of input.exchangeItems.entries()) {
      const quantityMilli = toMilli(item.quantity)
      const variant = tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, item.variantId))
        .get()
      if (!variant || !variant.isActive) {
        throw new ReturnsError(
          'Item is no longer for sale.',
          `exchangeItems.${index}.variantId`,
        )
      }
      const product = tx
        .select()
        .from(products)
        .where(eq(products.id, variant.productId))
        .get()
      if (!product) {
        throw new ReturnsError(
          'Item is no longer for sale.',
          `exchangeItems.${index}.variantId`,
        )
      }
      if (product.unit === 'piece' && !Number.isInteger(item.quantity)) {
        throw new ReturnsError('Whole pieces only', `exchangeItems.${index}.quantity`)
      }
      const already = reservedMilli.get(variant.id) ?? 0
      const remaining = variant.quantityMilli - already
      if (remaining < quantityMilli) {
        throw new ReturnsError(
          `Only ${fromMilli(Math.max(0, remaining))} in stock.`,
          `exchangeItems.${index}.quantity`,
        )
      }
      reservedMilli.set(variant.id, already + quantityMilli)
      exchangePrepared.push({
        variantId: variant.id,
        quantityMilli,
        unitPriceRs: item.unitPriceRs,
        lineDiscountRs: item.lineDiscountRs,
        lineTotalRs: lineTotalRs(quantityMilli, item.unitPriceRs, item.lineDiscountRs),
        unitCostRs: variant.avgCostRs,
      })
    }

    const exchangeTotalRs = exchangePrepared.reduce(
      (sum, line) => sum + line.lineTotalRs,
      0,
    )
    const dueRs = Math.max(0, exchangeTotalRs - totalRs)
    if (dueRs > 0 && input.tenderedRs < dueRs) {
      throw new ReturnsError('Tendered is less than the due amount.', 'tenderedRs')
    }
    const tenderedRs = dueRs > 0 ? input.tenderedRs : 0
    const changeRs = dueRs > 0 ? tenderedRs - dueRs : 0

    const inserted = tx
      .insert(salesReturns)
      .values({
        saleId: sale.id,
        totalRs,
        exchangeTotalRs,
        tenderedRs,
        changeRs,
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

    for (const line of exchangePrepared) {
      tx.insert(returnExchangeItems)
        .values({
          returnId: inserted.id,
          variantId: line.variantId,
          quantityMilli: line.quantityMilli,
          unitPriceRs: line.unitPriceRs,
          lineDiscountRs: line.lineDiscountRs,
          lineTotalRs: line.lineTotalRs,
          unitCostRs: line.unitCostRs,
        })
        .run()

      const variant = tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, line.variantId))
        .get()
      if (!variant) throw new ReturnsError('Item is no longer for sale.')

      tx.update(productVariants)
        .set({
          quantityMilli: variant.quantityMilli - line.quantityMilli,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, line.variantId))
        .run()

      tx.insert(stockMovements)
        .values({
          variantId: line.variantId,
          quantityMilli: -line.quantityMilli,
          reason: 'exchange',
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
      exchangeTotalRs,
      tenderedRs,
      changeRs,
      saleStatus,
    }
  })
}

function listReturns(): ReturnListItem[] {
  const db = getDb()
  const rows = db
    .select({
      id: salesReturns.id,
      saleId: salesReturns.saleId,
      totalRs: salesReturns.totalRs,
      exchangeTotalRs: salesReturns.exchangeTotalRs,
      tenderedRs: salesReturns.tenderedRs,
      changeRs: salesReturns.changeRs,
      createdAt: salesReturns.createdAt,
      billNo: sales.billNo,
      phone: sales.phone,
    })
    .from(salesReturns)
    .innerJoin(sales, eq(salesReturns.saleId, sales.id))
    .orderBy(desc(salesReturns.createdAt), desc(salesReturns.id))
    .all()

  const ids = rows.map((row) => row.id)
  const itemRows =
    ids.length === 0
      ? []
      : db
          .select({ id: returnItems.id, returnId: returnItems.returnId })
          .from(returnItems)
          .where(inArray(returnItems.returnId, ids))
          .all()
  const exchangeRows =
    ids.length === 0
      ? []
      : db
          .select({ id: returnExchangeItems.id, returnId: returnExchangeItems.returnId })
          .from(returnExchangeItems)
          .where(inArray(returnExchangeItems.returnId, ids))
          .all()
  const itemsByReturn = groupBy(itemRows, (row) => String(row.returnId))
  const exchangeByReturn = groupBy(exchangeRows, (row) => String(row.returnId))

  return rows.map((row) => ({
    id: row.id,
    saleId: row.saleId,
    billNo: row.billNo,
    phone: row.phone,
    createdAt: row.createdAt,
    itemCount:
      (itemsByReturn[String(row.id)] ?? []).length +
      (exchangeByReturn[String(row.id)] ?? []).length,
    totalRs: row.totalRs,
    exchangeTotalRs: row.exchangeTotalRs,
    tenderedRs: row.tenderedRs,
    changeRs: row.changeRs,
  }))
}

function loadReturn(id: number): ReturnRecord | undefined {
  const db = getDb()
  const row = db
    .select({
      id: salesReturns.id,
      saleId: salesReturns.saleId,
      totalRs: salesReturns.totalRs,
      exchangeTotalRs: salesReturns.exchangeTotalRs,
      tenderedRs: salesReturns.tenderedRs,
      changeRs: salesReturns.changeRs,
      createdAt: salesReturns.createdAt,
      billNo: sales.billNo,
      phone: sales.phone,
    })
    .from(salesReturns)
    .innerJoin(sales, eq(salesReturns.saleId, sales.id))
    .where(eq(salesReturns.id, id))
    .get()
  if (!row) return undefined

  const items = db
    .select({
      id: returnItems.id,
      variantId: returnItems.variantId,
      quantityMilli: returnItems.quantityMilli,
      unitPriceRs: returnItems.unitPriceRs,
      lineTotalRs: returnItems.lineTotalRs,
      barcode: productVariants.barcode,
      size: productVariants.size,
      colour: productVariants.colour,
      productName: products.name,
      unit: products.unit,
    })
    .from(returnItems)
    .innerJoin(productVariants, eq(returnItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(returnItems.returnId, id))
    .orderBy(asc(returnItems.id))
    .all()

  const exchangeItems = db
    .select({
      id: returnExchangeItems.id,
      variantId: returnExchangeItems.variantId,
      quantityMilli: returnExchangeItems.quantityMilli,
      unitPriceRs: returnExchangeItems.unitPriceRs,
      lineDiscountRs: returnExchangeItems.lineDiscountRs,
      lineTotalRs: returnExchangeItems.lineTotalRs,
      barcode: productVariants.barcode,
      size: productVariants.size,
      colour: productVariants.colour,
      productName: products.name,
      unit: products.unit,
    })
    .from(returnExchangeItems)
    .innerJoin(productVariants, eq(returnExchangeItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(returnExchangeItems.returnId, id))
    .orderBy(asc(returnExchangeItems.id))
    .all()

  return {
    ...row,
    itemCount: items.length + exchangeItems.length,
    items,
    exchangeItems,
  }
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

  ipcMain.handle(IPC.returns.list, (): IpcResult<ReturnListItem[]> => {
    try {
      return ipcOk(listReturns())
    } catch (error) {
      console.error('returns:list failed', error)
      return ipcFail('Could not load returns.')
    }
  })

  ipcMain.handle(IPC.returns.get, (_event, payload: unknown): IpcResult<ReturnRecord> => {
    const parsed = returnIdSchema.safeParse(payload)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return ipcFail(
        issue?.message ?? 'Invalid return.',
        issue?.path.map(String).join('.'),
      )
    }

    try {
      const record = loadReturn(parsed.data.id)
      if (!record) return ipcFail('Return not found.')
      return ipcOk(record)
    } catch (error) {
      console.error('returns:get failed', error)
      return ipcFail('Could not load the return.')
    }
  })

  ipcMain.handle(
    IPC.returns.print,
    async (_event, payload: unknown): Promise<IpcResult<null>> => {
      const parsed = returnIdSchema.safeParse(payload)
      if (!parsed.success) return ipcFail('Invalid return.')

      try {
        const record = loadReturn(parsed.data.id)
        if (!record) return ipcFail('Return not found.')
        await printReceipt({ returnId: record.id }, loadSettings().printerName)
        return ipcOk(null)
      } catch (error) {
        console.error('returns:print failed', error)
        return ipcFail(
          error instanceof Error ? error.message : 'Could not print the receipt.',
        )
      }
    },
  )
}

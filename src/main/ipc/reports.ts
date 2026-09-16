import { eachDayOfInterval, format } from 'date-fns'
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { quantityCostRs } from '@shared/cost'
import { IPC } from '@shared/ipc'
import { ipcFail, ipcOk, type IpcResult } from '@shared/ipc-result'
import {
  reportRangeSchema,
  type ReportDay,
  type ReportLowStock,
  type ReportSummary,
  type ReportTopProduct,
} from '@shared/schemas/reports'
import { getDb } from '../db/client'
import {
  expenses,
  productVariants,
  products,
  purchases,
  returnExchangeItems,
  returnItems,
  saleItems,
  sales,
  salesReturns,
} from '../db/schema'

const TOP_PRODUCTS = 10

function dayStart(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

function dayEnd(iso: string): Date {
  return new Date(`${iso}T23:59:59.999`)
}

function dayKey(at: Date): string {
  return format(at, 'yyyy-MM-dd')
}

function loadReport(from: string, to: string): ReportSummary {
  const startIso = from <= to ? from : to
  const endIso = from <= to ? to : from
  const start = dayStart(startIso)
  const end = dayEnd(endIso)
  const db = getDb()
  const inRange = and(gte(sales.createdAt, start), lte(sales.createdAt, end))

  const saleRows = db
    .select()
    .from(sales)
    .where(inRange)
    .orderBy(desc(sales.createdAt), desc(sales.id))
    .all()

  const saleIds = saleRows.map((row) => row.id)
  const itemRows =
    saleIds.length === 0
      ? []
      : db
          .select({
            saleId: saleItems.saleId,
            variantId: saleItems.variantId,
            quantityMilli: saleItems.quantityMilli,
            unitPriceRs: saleItems.unitPriceRs,
            lineDiscountRs: saleItems.lineDiscountRs,
            lineTotalRs: saleItems.lineTotalRs,
            unitCostRs: saleItems.unitCostRs,
            barcode: productVariants.barcode,
            size: productVariants.size,
            colour: productVariants.colour,
            productName: products.name,
            unit: products.unit,
          })
          .from(saleItems)
          .innerJoin(productVariants, eq(saleItems.variantId, productVariants.id))
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(inArray(saleItems.saleId, saleIds))
          .all()

  const returnRows = db
    .select()
    .from(salesReturns)
    .where(and(gte(salesReturns.createdAt, start), lte(salesReturns.createdAt, end)))
    .all()
  const returnIds = returnRows.map((row) => row.id)
  const returnedLines =
    returnIds.length === 0
      ? []
      : db
          .select({
            returnId: returnItems.returnId,
            quantityMilli: returnItems.quantityMilli,
            unitCostRs: saleItems.unitCostRs,
          })
          .from(returnItems)
          .innerJoin(saleItems, eq(returnItems.saleItemId, saleItems.id))
          .where(inArray(returnItems.returnId, returnIds))
          .all()

  const exchangedLines =
    returnIds.length === 0
      ? []
      : db
          .select({
            returnId: returnExchangeItems.returnId,
            variantId: returnExchangeItems.variantId,
            quantityMilli: returnExchangeItems.quantityMilli,
            unitPriceRs: returnExchangeItems.unitPriceRs,
            lineDiscountRs: returnExchangeItems.lineDiscountRs,
            lineTotalRs: returnExchangeItems.lineTotalRs,
            unitCostRs: returnExchangeItems.unitCostRs,
            barcode: productVariants.barcode,
            size: productVariants.size,
            colour: productVariants.colour,
            productName: products.name,
            unit: products.unit,
          })
          .from(returnExchangeItems)
          .innerJoin(
            productVariants,
            eq(returnExchangeItems.variantId, productVariants.id),
          )
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(inArray(returnExchangeItems.returnId, returnIds))
          .all()

  const purchaseRows = db
    .select({
      id: purchases.id,
      totalRs: purchases.totalRs,
    })
    .from(purchases)
    .where(and(gte(purchases.purchasedAt, start), lte(purchases.purchasedAt, end)))
    .all()

  const expenseRows = db
    .select()
    .from(expenses)
    .where(and(gte(expenses.incurredAt, start), lte(expenses.incurredAt, end)))
    .all()

  const itemsBySale = new Map<number, typeof itemRows>()
  for (const item of itemRows) {
    const list = itemsBySale.get(item.saleId) ?? []
    list.push(item)
    itemsBySale.set(item.saleId, list)
  }

  const returnedCostByReturn = new Map<number, number>()
  for (const line of returnedLines) {
    returnedCostByReturn.set(
      line.returnId,
      (returnedCostByReturn.get(line.returnId) ?? 0) +
        quantityCostRs(line.quantityMilli, line.unitCostRs),
    )
  }

  const exchangedCostByReturn = new Map<number, number>()
  for (const line of exchangedLines) {
    exchangedCostByReturn.set(
      line.returnId,
      (exchangedCostByReturn.get(line.returnId) ?? 0) +
        quantityCostRs(line.quantityMilli, line.unitCostRs),
    )
  }

  const days = new Map<string, { netRs: number; costRs: number; expenseRs: number }>()
  for (const day of eachDayOfInterval({ start, end: dayStart(endIso) })) {
    days.set(dayKey(day), { netRs: 0, costRs: 0, expenseRs: 0 })
  }

  let grossRs = 0
  let discountRs = 0
  let salesNetRs = 0
  let salesCostRs = 0

  for (const sale of saleRows) {
    const lines = itemsBySale.get(sale.id) ?? []
    let lineGross = 0
    let lineDiscount = 0
    let cost = 0
    for (const line of lines) {
      lineGross += quantityCostRs(line.quantityMilli, line.unitPriceRs)
      lineDiscount += line.lineDiscountRs
      cost += quantityCostRs(line.quantityMilli, line.unitCostRs)
    }
    grossRs += lineGross
    discountRs += lineDiscount + sale.discountRs
    salesNetRs += sale.totalRs
    salesCostRs += cost
    const bucket = days.get(dayKey(sale.createdAt))
    if (bucket) {
      bucket.netRs += sale.totalRs
      bucket.costRs += cost
    }
  }

  for (const line of exchangedLines) {
    grossRs += quantityCostRs(line.quantityMilli, line.unitPriceRs)
    discountRs += line.lineDiscountRs
  }

  let returnRs = 0
  let returnCostRs = 0
  let exchangeRs = 0
  let exchangeCostRs = 0
  for (const row of returnRows) {
    const cost = returnedCostByReturn.get(row.id) ?? 0
    const takenCost = exchangedCostByReturn.get(row.id) ?? 0
    returnRs += row.totalRs
    returnCostRs += cost
    exchangeRs += row.exchangeTotalRs
    exchangeCostRs += takenCost
    const bucket = days.get(dayKey(row.createdAt))
    if (bucket) {
      bucket.netRs -= row.totalRs
      bucket.netRs += row.exchangeTotalRs
      bucket.costRs -= cost
      bucket.costRs += takenCost
    }
  }

  let expenseRs = 0
  for (const row of expenseRows) {
    expenseRs += row.amountRs
    const bucket = days.get(dayKey(row.incurredAt))
    if (bucket) bucket.expenseRs += row.amountRs
  }

  const netRs = salesNetRs - returnRs + exchangeRs
  const costRs = salesCostRs - returnCostRs + exchangeCostRs
  const grossProfitRs = netRs - costRs
  const purchaseRs = purchaseRows.reduce((sum, row) => sum + row.totalRs, 0)
  const netProfitRs = grossProfitRs - expenseRs

  const daily: ReportDay[] = [...days.entries()].map(([date, bucket]) => ({
    date,
    netRs: bucket.netRs,
    expenseRs: bucket.expenseRs,
    profitRs: bucket.netRs - bucket.costRs - bucket.expenseRs,
  }))

  const topByVariant = new Map<
    number,
    Omit<ReportTopProduct, 'variantId'> & { variantId: number }
  >()
  for (const line of [...itemRows, ...exchangedLines]) {
    const current = topByVariant.get(line.variantId)
    if (current) {
      current.quantityMilli += line.quantityMilli
      current.netRs += line.lineTotalRs
      continue
    }
    topByVariant.set(line.variantId, {
      variantId: line.variantId,
      productName: line.productName,
      barcode: line.barcode,
      size: line.size,
      colour: line.colour,
      unit: line.unit,
      quantityMilli: line.quantityMilli,
      netRs: line.lineTotalRs,
    })
  }
  const topProducts = [...topByVariant.values()]
    .sort((a, b) => b.netRs - a.netRs || b.quantityMilli - a.quantityMilli)
    .slice(0, TOP_PRODUCTS)

  const lowStock: ReportLowStock[] = db
    .select({
      variantId: productVariants.id,
      productName: products.name,
      barcode: productVariants.barcode,
      size: productVariants.size,
      colour: productVariants.colour,
      unit: products.unit,
      quantityMilli: productVariants.quantityMilli,
      reorderLevelMilli: productVariants.reorderLevelMilli,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      and(
        eq(productVariants.isActive, true),
        eq(products.isActive, true),
        lte(productVariants.quantityMilli, productVariants.reorderLevelMilli),
      ),
    )
    .orderBy(asc(productVariants.quantityMilli), asc(products.name))
    .all()

  return {
    from: startIso,
    to: endIso,
    billCount: saleRows.length,
    grossRs,
    discountRs,
    returnRs,
    netRs,
    costRs,
    grossProfitRs,
    purchaseCount: purchaseRows.length,
    purchaseRs,
    expenseRs,
    netProfitRs,
    daily,
    topProducts,
    bills: saleRows.map((row) => ({
      id: row.id,
      billNo: row.billNo,
      createdAt: row.createdAt,
      totalRs: row.totalRs,
      status: row.status,
    })),
    lowStock,
  }
}

export function registerReportsHandlers(): void {
  ipcMain.handle(
    IPC.reports.summary,
    (_event, payload: unknown): IpcResult<ReportSummary> => {
      const parsed = reportRangeSchema.safeParse(payload)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        return ipcFail(issue?.message ?? 'Invalid date range.')
      }

      try {
        return ipcOk(loadReport(parsed.data.from, parsed.data.to))
      } catch (error) {
        console.error('reports:summary failed', error)
        return ipcFail('Could not load the report.')
      }
    },
  )
}

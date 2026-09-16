import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { ipcMain } from 'electron'
import { groupBy } from 'lodash-es'
import { lineTotalRs } from '@shared/cost'
import { IPC } from '@shared/ipc'
import { ipcFail, ipcOk, type IpcResult } from '@shared/ipc-result'
import { fromMilli, toMilli } from '@shared/quantity'
import {
  completeSaleSchema,
  holdIdSchema,
  listSalesSchema,
  SALES_PAGE_SIZE,
  saleIdSchema,
  saveHoldSchema,
  type CompletedSale,
  type HeldSale,
  type HeldSaleItem,
  type ListSalesInput,
  type PosCatalogVariant,
  type SaleListPage,
  type SaleRecord,
} from '@shared/schemas/sales'
import { printReceipt } from '../receipt'
import { getDb } from '../db/client'
import { loadSettings } from './settings'
import {
  heldSaleItems,
  heldSales,
  productVariants,
  products,
  saleItems,
  sales,
  stockMovements,
} from '../db/schema'

class SalesError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'SalesError'
  }
}

function listCatalogVariants(): PosCatalogVariant[] {
  const db = getDb()
  const productRows = db.select().from(products).orderBy(asc(products.name)).all()
  const variantRows = db
    .select()
    .from(productVariants)
    .orderBy(asc(productVariants.id))
    .all()
  const variantsByProduct = groupBy(variantRows, (row) => String(row.productId))
  const rows: PosCatalogVariant[] = []

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
        salePriceRs: variant.salePriceRs,
        quantityMilli: variant.quantityMilli,
      })
    }
  }

  return rows
}

function loadHoldItems(holdId: number): HeldSaleItem[] {
  const rows = getDb()
    .select({
      variantId: heldSaleItems.variantId,
      quantityMilli: heldSaleItems.quantityMilli,
      unitPriceRs: heldSaleItems.unitPriceRs,
      lineDiscountRs: heldSaleItems.lineDiscountRs,
      productName: products.name,
      barcode: productVariants.barcode,
      size: productVariants.size,
      colour: productVariants.colour,
      unit: products.unit,
    })
    .from(heldSaleItems)
    .innerJoin(productVariants, eq(heldSaleItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(heldSaleItems.heldSaleId, holdId))
    .orderBy(asc(heldSaleItems.id))
    .all()

  return rows.map((row) => ({
    ...row,
    lineTotalRs: lineTotalRs(row.quantityMilli, row.unitPriceRs, row.lineDiscountRs),
  }))
}

function listHolds(): HeldSale[] {
  const holdRows = getDb()
    .select()
    .from(heldSales)
    .orderBy(desc(heldSales.createdAt), desc(heldSales.id))
    .all()

  return holdRows.map((row) => {
    const items = loadHoldItems(row.id)
    const subtotal = items.reduce((sum, item) => sum + item.lineTotalRs, 0)
    return {
      id: row.id,
      phone: row.phone,
      note: row.note,
      discountRs: row.discountRs,
      createdAt: row.createdAt,
      itemCount: items.length,
      totalRs: subtotal - row.discountRs,
      items,
    }
  })
}

function saveHold(input: {
  phone: string
  note: string
  discountRs: number
  items: Array<{
    variantId: number
    quantity: number
    unitPriceRs: number
    lineDiscountRs: number
  }>
}): HeldSale {
  const holdId = getDb().transaction((tx) => {
    const inserted = tx
      .insert(heldSales)
      .values({
        phone: input.phone || null,
        note: input.note || null,
        discountRs: input.discountRs,
      })
      .returning({ id: heldSales.id })
      .get()

    for (const item of input.items) {
      tx.insert(heldSaleItems)
        .values({
          heldSaleId: inserted.id,
          variantId: item.variantId,
          quantityMilli: toMilli(item.quantity),
          unitPriceRs: item.unitPriceRs,
          lineDiscountRs: item.lineDiscountRs,
        })
        .run()
    }

    return inserted.id
  })

  const saved = listHolds().find((hold) => hold.id === holdId)
  if (!saved) throw new SalesError('Could not hold the sale.')
  return saved
}

function deleteHold(id: number): void {
  const deleted = getDb().delete(heldSales).where(eq(heldSales.id, id)).returning().get()
  if (!deleted) throw new SalesError('Held sale not found.')
}

function completeSale(input: {
  phone: string
  discountRs: number
  tenderedRs: number
  items: Array<{
    variantId: number
    quantity: number
    unit: 'piece' | 'meter' | 'yard'
    unitPriceRs: number
    lineDiscountRs: number
  }>
}): CompletedSale {
  const completed = getDb().transaction((tx) => {
    const last = tx
      .select({ billNo: sales.billNo })
      .from(sales)
      .orderBy(desc(sales.billNo))
      .limit(1)
      .get()
    const billNo = (last?.billNo ?? 0) + 1
    const prepared: Array<{
      variantId: number
      quantityMilli: number
      unitPriceRs: number
      lineDiscountRs: number
      lineTotalRs: number
      unitCostRs: number
    }> = []
    const reservedMilli = new Map<number, number>()

    for (const [index, item] of input.items.entries()) {
      const quantityMilli = toMilli(item.quantity)
      const variant = tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, item.variantId))
        .get()
      if (!variant || !variant.isActive) {
        throw new SalesError('Item is no longer for sale.', `items.${index}.variantId`)
      }
      const already = reservedMilli.get(variant.id) ?? 0
      const remaining = variant.quantityMilli - already
      if (remaining < quantityMilli) {
        throw new SalesError(
          `Only ${fromMilli(variant.quantityMilli)} in stock.`,
          `items.${index}.quantity`,
        )
      }
      reservedMilli.set(variant.id, already + quantityMilli)

      const lineTotal = lineTotalRs(quantityMilli, item.unitPriceRs, item.lineDiscountRs)
      prepared.push({
        variantId: variant.id,
        quantityMilli,
        unitPriceRs: item.unitPriceRs,
        lineDiscountRs: item.lineDiscountRs,
        lineTotalRs: lineTotal,
        unitCostRs: variant.avgCostRs,
      })
    }

    const subtotal = prepared.reduce((sum, line) => sum + line.lineTotalRs, 0)
    const totalRs = subtotal - input.discountRs
    const changeRs = input.tenderedRs - totalRs

    const inserted = tx
      .insert(sales)
      .values({
        billNo,
        phone: input.phone || null,
        discountRs: input.discountRs,
        totalRs,
        tenderedRs: input.tenderedRs,
        changeRs,
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

      const variant = tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, line.variantId))
        .get()
      if (!variant) {
        throw new SalesError('Item is no longer for sale.')
      }

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
          reason: 'sale',
          sourceTable: 'sales',
          sourceId: inserted.id,
        })
        .run()
    }

    return {
      id: inserted.id,
      billNo,
      totalRs,
      tenderedRs: input.tenderedRs,
      changeRs,
    }
  })

  return completed
}

function likePattern(search: string): string {
  return `%${search.replaceAll('%', '').replaceAll('_', '')}%`
}

function dayStart(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

function dayEnd(iso: string): Date {
  return new Date(`${iso}T23:59:59.999`)
}

function listSales(input: ListSalesInput): SaleListPage {
  const db = getDb()
  const conditions: SQL[] = []
  const pattern = input.search ? likePattern(input.search) : null
  if (pattern) {
    const searchFilter = or(
      sql`cast(${sales.billNo} as text) like ${pattern}`,
      like(sales.phone, pattern),
    )
    if (searchFilter) conditions.push(searchFilter)
  }
  if (input.from) conditions.push(gte(sales.createdAt, dayStart(input.from)))
  if (input.to) conditions.push(lte(sales.createdAt, dayEnd(input.to)))
  if (input.status !== 'all') conditions.push(eq(sales.status, input.status))
  const filter = conditions.length > 0 ? and(...conditions) : undefined

  const total = db.select({ total: count() }).from(sales).where(filter).get()?.total ?? 0
  const saleRows = db
    .select()
    .from(sales)
    .where(filter)
    .orderBy(desc(sales.createdAt), desc(sales.id))
    .limit(SALES_PAGE_SIZE)
    .offset((input.page - 1) * SALES_PAGE_SIZE)
    .all()

  const ids = saleRows.map((row) => row.id)
  const itemRows =
    ids.length === 0
      ? []
      : db
          .select({ id: saleItems.id, saleId: saleItems.saleId })
          .from(saleItems)
          .where(inArray(saleItems.saleId, ids))
          .all()
  const itemsBySale = groupBy(itemRows, (row) => String(row.saleId))

  return {
    items: saleRows.map((row) => ({
      id: row.id,
      billNo: row.billNo,
      phone: row.phone,
      status: row.status,
      createdAt: row.createdAt,
      itemCount: (itemsBySale[String(row.id)] ?? []).length,
      discountRs: row.discountRs,
      totalRs: row.totalRs,
      tenderedRs: row.tenderedRs,
      changeRs: row.changeRs,
    })),
    total,
    page: input.page,
    pageSize: SALES_PAGE_SIZE,
  }
}

function loadSale(id: number): SaleRecord | undefined {
  const db = getDb()
  const row = db.select().from(sales).where(eq(sales.id, id)).get()
  if (!row) return undefined

  const items = db
    .select({
      id: saleItems.id,
      variantId: saleItems.variantId,
      quantityMilli: saleItems.quantityMilli,
      unitPriceRs: saleItems.unitPriceRs,
      lineDiscountRs: saleItems.lineDiscountRs,
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
    .where(eq(saleItems.saleId, id))
    .orderBy(asc(saleItems.id))
    .all()

  return {
    id: row.id,
    billNo: row.billNo,
    phone: row.phone,
    status: row.status,
    createdAt: row.createdAt,
    itemCount: items.length,
    discountRs: row.discountRs,
    totalRs: row.totalRs,
    tenderedRs: row.tenderedRs,
    changeRs: row.changeRs,
    items,
  }
}

export function registerSalesHandlers(): void {
  ipcMain.handle(IPC.sales.catalog, (): IpcResult<PosCatalogVariant[]> => {
    try {
      return ipcOk(listCatalogVariants())
    } catch (error) {
      console.error('sales:catalog failed', error)
      return ipcFail('Could not load items.')
    }
  })

  ipcMain.handle(IPC.sales.listHolds, (): IpcResult<HeldSale[]> => {
    try {
      return ipcOk(listHolds())
    } catch (error) {
      console.error('sales:holds:list failed', error)
      return ipcFail('Could not load held sales.')
    }
  })

  ipcMain.handle(IPC.sales.saveHold, (_event, payload: unknown): IpcResult<HeldSale> => {
    const parsed = saveHoldSchema.safeParse(payload)
    if (!parsed.success) {
      const [issue] = parsed.error.issues
      return ipcFail(issue?.message ?? 'Invalid sale.', issue?.path.map(String).join('.'))
    }

    try {
      return ipcOk(saveHold(parsed.data))
    } catch (error) {
      if (error instanceof SalesError) return ipcFail(error.message, error.field)
      console.error('sales:holds:save failed', error)
      return ipcFail('Could not hold the sale.')
    }
  })

  ipcMain.handle(IPC.sales.deleteHold, (_event, payload: unknown): IpcResult<null> => {
    const parsed = holdIdSchema.safeParse(payload)
    if (!parsed.success) return ipcFail('Invalid held sale.')

    try {
      deleteHold(parsed.data.id)
      return ipcOk(null)
    } catch (error) {
      if (error instanceof SalesError) return ipcFail(error.message, error.field)
      console.error('sales:holds:delete failed', error)
      return ipcFail('Could not discard the held sale.')
    }
  })

  ipcMain.handle(
    IPC.sales.complete,
    (_event, payload: unknown): IpcResult<CompletedSale> => {
      const parsed = completeSaleSchema.safeParse(payload)
      if (!parsed.success) {
        const [issue] = parsed.error.issues
        return ipcFail(
          issue?.message ?? 'Invalid sale.',
          issue?.path.map(String).join('.'),
        )
      }

      try {
        return ipcOk(completeSale(parsed.data))
      } catch (error) {
        if (error instanceof SalesError) return ipcFail(error.message, error.field)
        console.error('sales:complete failed', error)
        return ipcFail('Could not complete the sale.')
      }
    },
  )

  ipcMain.handle(IPC.sales.list, (_event, payload: unknown): IpcResult<SaleListPage> => {
    const parsed = listSalesSchema.safeParse(payload)
    if (!parsed.success) return ipcFail('Invalid sales list.')

    try {
      return ipcOk(listSales(parsed.data))
    } catch (error) {
      console.error('sales:list failed', error)
      return ipcFail('Could not load sales.')
    }
  })

  ipcMain.handle(IPC.sales.get, (_event, payload: unknown): IpcResult<SaleRecord> => {
    const parsed = saleIdSchema.safeParse(payload)
    if (!parsed.success) return ipcFail('Invalid sale.')

    try {
      const sale = loadSale(parsed.data.id)
      if (!sale) return ipcFail('Sale not found.')
      return ipcOk(sale)
    } catch (error) {
      console.error('sales:get failed', error)
      return ipcFail('Could not load the sale.')
    }
  })

  ipcMain.handle(
    IPC.sales.print,
    async (_event, payload: unknown): Promise<IpcResult<null>> => {
      const parsed = saleIdSchema.safeParse(payload)
      if (!parsed.success) return ipcFail('Invalid sale.')

      try {
        const sale = loadSale(parsed.data.id)
        if (!sale) return ipcFail('Sale not found.')
        await printReceipt(sale.id, loadSettings().printerName)
        return ipcOk(null)
      } catch (error) {
        console.error('sales:print failed', error)
        return ipcFail(
          error instanceof Error ? error.message : 'Could not print the receipt.',
        )
      }
    },
  )
}

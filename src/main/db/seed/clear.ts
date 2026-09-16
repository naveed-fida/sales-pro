import {
  categories,
  expenses,
  heldSaleItems,
  heldSales,
  productVariants,
  products,
  purchaseItems,
  purchases,
  returnExchangeItems,
  returnItems,
  saleItems,
  sales,
  salesReturns,
  stockMovements,
  suppliers,
} from '../schema.ts'
import type { AppDatabase, SqliteConnection } from '../sqlite.ts'

/**
 * Drops catalog, stock, purchases, sales and expenses so a seed run starts
 * from a blank shop. Shop settings and the clock watermark stay put.
 */
export function clearBusinessData(db: AppDatabase, sqlite: SqliteConnection): void {
  db.transaction((tx) => {
    tx.delete(returnItems).run()
    tx.delete(returnExchangeItems).run()
    tx.delete(salesReturns).run()
    tx.delete(saleItems).run()
    tx.delete(sales).run()
    tx.delete(heldSaleItems).run()
    tx.delete(heldSales).run()
    tx.delete(purchaseItems).run()
    tx.delete(purchases).run()
    tx.delete(stockMovements).run()
    tx.delete(expenses).run()
    tx.delete(productVariants).run()
    tx.delete(products).run()
    tx.delete(suppliers).run()
    tx.delete(categories).run()
  })

  try {
    sqlite.exec('DELETE FROM sqlite_sequence')
  } catch {
    // sqlite_sequence appears after the first autoincrement insert.
  }
}

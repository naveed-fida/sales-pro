import { existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { devDatabasePath, envDatabasePath, loadEnvFile } from '../src/main/db/paths.ts'
import { categories } from '../src/main/db/schema.ts'
import { seedCatalog } from '../src/main/db/seed/catalog.ts'
import { clearBusinessData } from '../src/main/db/seed/clear.ts'
import { seedExpenses } from '../src/main/db/seed/expenses.ts'
import { seedPurchases } from '../src/main/db/seed/purchases.ts'
import { seedSales } from '../src/main/db/seed/sales.ts'
import { openDatabase } from '../src/main/db/sqlite.ts'

/**
 * Wipes shop data (not settings) and inserts the full demo set. Migrations are
 * applied by the app, not here, so start the app once if the file is empty.
 */
function main(): void {
  const root = process.cwd()
  loadEnvFile(root)
  const databasePath = envDatabasePath(root) ?? devDatabasePath(root)

  if (!existsSync(databasePath)) {
    throw new Error(
      `No database at ${databasePath}. Run "npm run dev" once so migrations create it, then seed.`,
    )
  }

  const { sqlite, db } = openDatabase(databasePath)

  try {
    db.select({ id: categories.id }).from(categories).limit(1).all()
  } catch {
    sqlite.close()
    throw new Error(
      `Database at ${databasePath} has no catalog tables. Run "npm run dev" once so migrations apply, then seed.`,
    )
  }

  clearBusinessData(db, sqlite)
  rmSync(join(dirname(databasePath), 'product-images'), { recursive: true, force: true })

  const catalog = seedCatalog(db)
  const purchases = seedPurchases(db)
  const sales = seedSales(db)
  const shopExpenses = seedExpenses(db)
  sqlite.close()

  console.log(`Seeded ${databasePath}`)
  console.log(
    `categories ${catalog.categoriesCreated}, products ${catalog.productsCreated}`,
  )
  console.log(
    `suppliers ${purchases.suppliersCreated}, purchases ${purchases.purchasesCreated}`,
  )
  console.log(`sales ${sales.salesCreated}, holds ${sales.holdsCreated}`)
  console.log(`expenses ${shopExpenses.expensesCreated}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

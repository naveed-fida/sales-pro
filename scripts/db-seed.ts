import { existsSync } from 'node:fs'
import { devDatabasePath, envDatabasePath, loadEnvFile } from '../src/main/db/paths.ts'
import { categories } from '../src/main/db/schema.ts'
import { seedCatalog } from '../src/main/db/seed/catalog.ts'
import { seedPurchases } from '../src/main/db/seed/purchases.ts'
import { openDatabase } from '../src/main/db/sqlite.ts'

/**
 * Seeds the same SQLite file drizzle-kit and `npm run dev` use. Migrations are
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

  const catalog = seedCatalog(db)
  const purchases = seedPurchases(db)
  sqlite.close()

  console.log(`Seeded ${databasePath}`)
  console.log(
    `categories +${catalog.categoriesCreated}, products +${catalog.productsCreated}, skipped ${catalog.productsSkipped}`,
  )
  console.log(
    `suppliers +${purchases.suppliersCreated}, purchases +${purchases.purchasesCreated}`,
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

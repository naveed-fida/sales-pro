import { eq } from 'drizzle-orm'
import { productVariants, products } from '../schema.ts'
import type { AppDatabase } from '../sqlite.ts'

export type SeedVariantRef = {
  productName: string
  size?: string
  colour?: string
}

export function findVariant(
  db: AppDatabase,
  line: SeedVariantRef,
):
  | {
      id: number
      quantityMilli: number
      avgCostRs: number
      salePriceRs: number
    }
  | undefined {
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

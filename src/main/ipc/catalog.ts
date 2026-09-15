import { asc, eq } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { groupBy, max } from 'lodash-es'
import { IPC } from '@shared/ipc'
import { ipcFail, ipcOk, type IpcResult } from '@shared/ipc-result'
import { toMilli } from '@shared/quantity'
import {
  createCategorySchema,
  productIdSchema,
  saveProductImageSchema,
  saveProductSchema,
  type Category,
  type ProductListItem,
  type ProductRecord,
  type SaveProduct,
} from '@shared/schemas/catalog'
import { getDb } from '../db/client'
import { categories, products, productVariants } from '../db/schema'
import {
  unlinkProductImageIfOrphaned,
  writeProductImageFile,
} from '../files/product-images'

class CatalogError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'CatalogError'
  }
}

function isUniqueConstraint(error: unknown, column: string): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  if ((error as { code: unknown }).code !== 'SQLITE_CONSTRAINT_UNIQUE') return false
  return error instanceof Error && error.message.includes(column)
}

function isForeignKeyConstraint(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  return (error as { code: unknown }).code === 'SQLITE_CONSTRAINT_FOREIGNKEY'
}

function nextNumericBarcode(barcodes: string[]): number {
  const numeric = barcodes
    .filter((code) => /^\d+$/.test(code))
    .map((code) => Number.parseInt(code, 10))
  const highest = max(numeric)
  if (highest === undefined || highest < 1_000_000) return 1_000_001
  return highest + 1
}

function listCategories(): Category[] {
  return getDb()
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .orderBy(asc(categories.name))
    .all()
}

function listProducts(): ProductListItem[] {
  const db = getDb()
  const productRows = db.select().from(products).orderBy(asc(products.name)).all()
  const categoryRows = db.select().from(categories).all()
  const variantRows = db.select().from(productVariants).all()
  const categoryNameById = new Map(categoryRows.map((row) => [row.id, row.name]))
  const variantsByProduct = groupBy(variantRows, (row) => String(row.productId))

  return productRows.map((product) => {
    const variants = variantsByProduct[String(product.id)] ?? []
    const prices = variants.map((variant) => variant.salePriceRs)

    return {
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      categoryName: categoryNameById.get(product.categoryId) ?? 'Unknown',
      unit: product.unit,
      isActive: product.isActive,
      variantCount: variants.length,
      quantityMilli: variants.reduce((sum, variant) => sum + variant.quantityMilli, 0),
      minSalePriceRs: prices.length > 0 ? Math.min(...prices) : 0,
      maxSalePriceRs: prices.length > 0 ? Math.max(...prices) : 0,
      barcodes: variants.map((variant) => variant.barcode).join(' '),
      imagePath: product.imagePath,
    }
  })
}

function loadProduct(productId: number): ProductRecord | undefined {
  const db = getDb()
  const product = db.select().from(products).where(eq(products.id, productId)).get()
  if (!product) return undefined

  const variants = db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.id))
    .all()

  return {
    id: product.id,
    name: product.name,
    categoryId: product.categoryId,
    unit: product.unit,
    description: product.description,
    imagePath: product.imagePath,
    isActive: product.isActive,
    variants: variants.map((variant) => ({
      id: variant.id,
      barcode: variant.barcode,
      size: variant.size,
      colour: variant.colour,
      salePriceRs: variant.salePriceRs,
      avgCostRs: variant.avgCostRs,
      quantityMilli: variant.quantityMilli,
      reorderLevelMilli: variant.reorderLevelMilli,
      isActive: variant.isActive,
    })),
  }
}

function persistProduct(values: SaveProduct): ProductRecord {
  return getDb().transaction((tx) => {
    const now = new Date()
    const category = tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, values.categoryId))
      .get()

    if (!category) throw new CatalogError('Pick a category.', 'categoryId')

    let productId = values.id

    if (productId) {
      const existing = tx.select().from(products).where(eq(products.id, productId)).get()
      if (!existing) throw new CatalogError('Product not found.')

      tx.update(products)
        .set({
          name: values.name,
          categoryId: values.categoryId,
          description: values.description || null,
          isActive: values.isActive,
          updatedAt: now,
        })
        .where(eq(products.id, productId))
        .run()
    } else {
      const inserted = tx
        .insert(products)
        .values({
          name: values.name,
          categoryId: values.categoryId,
          unit: values.unit,
          description: values.description || null,
          isActive: values.isActive,
        })
        .returning({ id: products.id })
        .get()

      productId = inserted.id
    }

    const existingVariants = tx
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId))
      .all()
    const allBarcodes = tx
      .select({ id: productVariants.id, barcode: productVariants.barcode })
      .from(productVariants)
      .all()

    const ownedIds = new Set(existingVariants.map((variant) => variant.id))
    const used = new Set(
      allBarcodes.filter((row) => !ownedIds.has(row.id)).map((row) => row.barcode),
    )
    let next = nextNumericBarcode(allBarcodes.map((row) => row.barcode))
    const incomingIds = new Set<number>()

    for (const [index, variant] of values.variants.entries()) {
      if (variant.id && !ownedIds.has(variant.id)) {
        throw new CatalogError('Variant does not belong to this product.')
      }

      let barcode = variant.barcode
      if (!barcode) {
        while (used.has(String(next))) next += 1
        barcode = String(next)
        next += 1
      }

      if (used.has(barcode)) {
        throw new CatalogError(
          'That barcode is already in use.',
          `variants.${index}.barcode`,
        )
      }

      used.add(barcode)
      const reorderLevelMilli = toMilli(variant.reorderLevel)

      if (variant.id) {
        incomingIds.add(variant.id)
        tx.update(productVariants)
          .set({
            barcode,
            size: variant.size || null,
            colour: variant.colour || null,
            salePriceRs: variant.salePriceRs,
            reorderLevelMilli,
            isActive: variant.isActive,
            updatedAt: now,
          })
          .where(eq(productVariants.id, variant.id))
          .run()
      } else {
        tx.insert(productVariants)
          .values({
            productId,
            barcode,
            size: variant.size || null,
            colour: variant.colour || null,
            salePriceRs: variant.salePriceRs,
            reorderLevelMilli,
            isActive: variant.isActive,
          })
          .run()
      }
    }

    for (const existing of existingVariants) {
      if (!incomingIds.has(existing.id)) {
        tx.update(productVariants)
          .set({ isActive: false, updatedAt: now })
          .where(eq(productVariants.id, existing.id))
          .run()
      }
    }

    const saved = loadProduct(productId)
    if (!saved) throw new CatalogError('Product not found.')
    return saved
  })
}

function deleteProduct(productId: number): void {
  const imagePath = getDb().transaction((tx) => {
    const product = tx.select().from(products).where(eq(products.id, productId)).get()
    if (!product) throw new CatalogError('Product not found.')
    if (product.isActive) {
      throw new CatalogError('Turn Active off to archive the product before deleting it.')
    }

    tx.delete(productVariants).where(eq(productVariants.productId, productId)).run()
    tx.delete(products).where(eq(products.id, productId)).run()
    return product.imagePath
  })

  if (imagePath) unlinkProductImageIfOrphaned(imagePath)
}

function saveProductImage(productId: number, bytes: Uint8Array): ProductRecord {
  let fileName: string
  try {
    fileName = writeProductImageFile(bytes)
  } catch (error) {
    throw new CatalogError(
      error instanceof Error ? error.message : 'Could not save the photo.',
    )
  }
  const previous = getDb().transaction((tx) => {
    const product = tx.select().from(products).where(eq(products.id, productId)).get()
    if (!product) throw new CatalogError('Product not found.')
    const previousPath = product.imagePath
    tx.update(products)
      .set({ imagePath: fileName, updatedAt: new Date() })
      .where(eq(products.id, productId))
      .run()
    return previousPath
  })

  if (previous && previous !== fileName) {
    unlinkProductImageIfOrphaned(previous, productId)
  }

  const saved = loadProduct(productId)
  if (!saved) throw new CatalogError('Product not found.')
  return saved
}

function clearProductImage(productId: number): ProductRecord {
  const previous = getDb().transaction((tx) => {
    const product = tx.select().from(products).where(eq(products.id, productId)).get()
    if (!product) throw new CatalogError('Product not found.')
    tx.update(products)
      .set({ imagePath: null, updatedAt: new Date() })
      .where(eq(products.id, productId))
      .run()
    return product.imagePath
  })

  if (previous) unlinkProductImageIfOrphaned(previous)

  const saved = loadProduct(productId)
  if (!saved) throw new CatalogError('Product not found.')
  return saved
}

export function registerCatalogHandlers(): void {
  ipcMain.handle(IPC.categories.list, (): IpcResult<Category[]> => {
    try {
      return ipcOk(listCategories())
    } catch (error) {
      console.error('categories:list failed', error)
      return ipcFail('Could not load categories.')
    }
  })

  ipcMain.handle(
    IPC.categories.create,
    (_event, payload: unknown): IpcResult<Category> => {
      const parsed = createCategorySchema.safeParse(payload)
      if (!parsed.success) {
        const [issue] = parsed.error.issues
        return ipcFail(issue?.message ?? 'Invalid category.', issue?.path[0]?.toString())
      }

      try {
        const row = getDb()
          .insert(categories)
          .values({ name: parsed.data.name })
          .returning({ id: categories.id, name: categories.name })
          .get()
        return ipcOk(row)
      } catch (error) {
        if (isUniqueConstraint(error, 'categories.name')) {
          return ipcFail('A category with that name already exists.', 'name')
        }
        console.error('categories:create failed', error)
        return ipcFail('Could not create the category.')
      }
    },
  )

  ipcMain.handle(IPC.products.list, (): IpcResult<ProductListItem[]> => {
    try {
      return ipcOk(listProducts())
    } catch (error) {
      console.error('products:list failed', error)
      return ipcFail('Could not load products.')
    }
  })

  ipcMain.handle(
    IPC.products.get,
    (_event, payload: unknown): IpcResult<ProductRecord> => {
      const parsed = productIdSchema.safeParse(payload)
      if (!parsed.success) return ipcFail('Product not found.')

      try {
        const product = loadProduct(parsed.data.id)
        if (!product) return ipcFail('Product not found.')
        return ipcOk(product)
      } catch (error) {
        console.error('products:get failed', error)
        return ipcFail('Could not load the product.')
      }
    },
  )

  ipcMain.handle(
    IPC.products.save,
    (_event, payload: unknown): IpcResult<ProductRecord> => {
      const parsed = saveProductSchema.safeParse(payload)
      if (!parsed.success) {
        const [issue] = parsed.error.issues
        return ipcFail(
          issue?.message ?? 'Invalid product.',
          issue?.path.map(String).join('.'),
        )
      }

      try {
        return ipcOk(persistProduct(parsed.data))
      } catch (error) {
        if (error instanceof CatalogError) {
          return ipcFail(error.message, error.field)
        }
        if (isUniqueConstraint(error, 'product_variants.barcode')) {
          return ipcFail('That barcode is already in use.', 'barcode')
        }
        console.error('products:save failed', error)
        return ipcFail('Could not save the product.')
      }
    },
  )

  ipcMain.handle(IPC.products.delete, (_event, payload: unknown): IpcResult<null> => {
    const parsed = productIdSchema.safeParse(payload)
    if (!parsed.success) return ipcFail('Product not found.')

    try {
      deleteProduct(parsed.data.id)
      return ipcOk(null)
    } catch (error) {
      if (error instanceof CatalogError) return ipcFail(error.message)
      if (isForeignKeyConstraint(error)) {
        return ipcFail(
          'This product has sales or purchases, so it cannot be deleted. Leave it archived.',
        )
      }
      console.error('products:delete failed', error)
      return ipcFail('Could not delete the product.')
    }
  })

  ipcMain.handle(
    IPC.products.saveImage,
    (_event, payload: unknown): IpcResult<ProductRecord> => {
      const parsed = saveProductImageSchema.safeParse(payload)
      if (!parsed.success) {
        const [issue] = parsed.error.issues
        return ipcFail(issue?.message ?? 'Invalid photo.', issue?.path[0]?.toString())
      }

      try {
        return ipcOk(saveProductImage(parsed.data.id, parsed.data.bytes))
      } catch (error) {
        if (error instanceof CatalogError) return ipcFail(error.message)
        console.error('products:saveImage failed', error)
        return ipcFail('Could not save the photo.')
      }
    },
  )

  ipcMain.handle(
    IPC.products.clearImage,
    (_event, payload: unknown): IpcResult<ProductRecord> => {
      const parsed = productIdSchema.safeParse(payload)
      if (!parsed.success) return ipcFail('Product not found.')

      try {
        return ipcOk(clearProductImage(parsed.data.id))
      } catch (error) {
        if (error instanceof CatalogError) return ipcFail(error.message)
        console.error('products:clearImage failed', error)
        return ipcFail('Could not remove the photo.')
      }
    },
  )
}

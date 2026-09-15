import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { isProductImageFileName } from '@shared/product-image'

const PRODUCT_IMAGES_DIR = 'product-images'

/**
 * Photos sit next to the SQLite file so a copied database keeps its images,
 * and so SALES_PRO_DB_PATH cannot point the app at one tree and the photos at
 * another. Never join a product-image filename at a call site; use
 * productImageFilePath().
 */
export function productImagesDir(databasePath: string): string {
  return join(dirname(databasePath), PRODUCT_IMAGES_DIR)
}

export function productImageFilePath(databasePath: string, fileName: string): string {
  if (!isProductImageFileName(fileName)) {
    throw new Error('Invalid product image name.')
  }
  return join(productImagesDir(databasePath), fileName)
}

export function ensureProductImagesDir(databasePath: string): void {
  mkdirSync(productImagesDir(databasePath), { recursive: true })
}

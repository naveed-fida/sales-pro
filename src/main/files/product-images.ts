import { createHash } from 'node:crypto'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { and, eq, ne } from 'drizzle-orm'
import {
  isWebpBytes,
  PRODUCT_IMAGE_EXT,
  PRODUCT_IMAGE_MAX_BYTES,
} from '@shared/product-image'
import { SETTING_KEYS } from '@shared/schemas/settings'
import { getDatabasePath, getDb } from '../db/client'
import { appSettings, products } from '../db/schema'
import { ensureProductImagesDir, productImageFilePath } from './paths'

export function hashedWebpFileName(bytes: Uint8Array): string {
  return `${createHash('sha256').update(bytes).digest('hex')}${PRODUCT_IMAGE_EXT}`
}

export function writeProductImageFile(bytes: Uint8Array): string {
  if (bytes.byteLength === 0 || bytes.byteLength > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error('Photo is too large.')
  }
  if (!isWebpBytes(bytes)) {
    throw new Error('Photo must be a WebP image.')
  }

  const fileName = hashedWebpFileName(bytes)
  const databasePath = getDatabasePath()
  ensureProductImagesDir(databasePath)
  const filePath = productImageFilePath(databasePath, fileName)

  if (!existsSync(filePath)) {
    writeFileSync(filePath, bytes)
  }

  return fileName
}

export function unlinkProductImageIfOrphaned(
  fileName: string,
  exceptProductId?: number,
): void {
  const db = getDb()
  const stillUsed = exceptProductId
    ? db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.imagePath, fileName), ne(products.id, exceptProductId)))
        .get()
    : db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.imagePath, fileName))
        .get()

  if (stillUsed) return

  const usedAsShopLogo = db
    .select({ key: appSettings.key })
    .from(appSettings)
    .where(
      and(eq(appSettings.key, SETTING_KEYS.shopLogo), eq(appSettings.value, fileName)),
    )
    .get()

  if (usedAsShopLogo) return

  try {
    const filePath = productImageFilePath(getDatabasePath(), fileName)
    if (existsSync(filePath)) unlinkSync(filePath)
  } catch (error) {
    console.error('Could not remove unused product image', error)
  }
}

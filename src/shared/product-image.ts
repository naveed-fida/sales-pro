/**
 * Product photos live on disk, not in SQLite. The renderer never sees a
 * filesystem path: it sends WebP bytes over IPC and loads them back through
 * this custom protocol, which main maps onto the images directory next to
 * the database file.
 */
export const PRODUCT_IMAGE_SCHEME = 'product-image'
export const PRODUCT_IMAGE_HOST = 'product'
export const PRODUCT_IMAGE_EXT = '.webp'

/** SHA-256 hex plus the WebP suffix, e.g. `ab…cd.webp`. */
export const PRODUCT_IMAGE_FILE_PATTERN = /^[a-f0-9]{64}\.webp$/

/** Longest edge after the renderer downscales on a canvas. */
export const PRODUCT_IMAGE_MAX_EDGE = 800

/** Reject a source file before we even decode it. */
export const PRODUCT_IMAGE_SOURCE_MAX_BYTES = 20 * 1024 * 1024

/** Cap on the WebP bytes that may cross IPC. */
export const PRODUCT_IMAGE_MAX_BYTES = 512 * 1024

export function isProductImageFileName(value: string): boolean {
  return PRODUCT_IMAGE_FILE_PATTERN.test(value)
}

export function productImageSrc(fileName: string): string {
  return `${PRODUCT_IMAGE_SCHEME}://${PRODUCT_IMAGE_HOST}/${fileName}`
}

/** Pulls the hashed filename out of a `product-image://` request, or null. */
export function parseProductImageFileName(requestUrl: string): string | null {
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== `${PRODUCT_IMAGE_SCHEME}:`) return null
    if (url.hostname !== PRODUCT_IMAGE_HOST) return null
    const fileName = decodeURIComponent(url.pathname.replace(/^\//, ''))
    return isProductImageFileName(fileName) ? fileName : null
  } catch {
    return null
  }
}

export function isWebpBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false
  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
}

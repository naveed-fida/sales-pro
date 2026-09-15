import {
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_EDGE,
  PRODUCT_IMAGE_SOURCE_MAX_BYTES,
} from '@shared/product-image'

const QUALITIES = [0.82, 0.64, 0.48]

function compact(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes)
}

async function canvasToWebp(
  canvas: OffscreenCanvas,
  quality: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality })
  return compact(new Uint8Array(await blob.arrayBuffer()))
}

function drawScaled(bitmap: ImageBitmap, edge: number): OffscreenCanvas {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not read that image.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  return canvas
}

/**
 * Decode a user-picked photo, fit it to PRODUCT_IMAGE_MAX_EDGE, and encode
 * WebP so main never has to touch a native image library.
 */
export async function downscaleProductImage(
  file: File,
): Promise<Uint8Array<ArrayBuffer>> {
  if (file.size > PRODUCT_IMAGE_SOURCE_MAX_BYTES) {
    throw new Error('That photo is too large.')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('That file is not a photo we can use.')
  }

  try {
    let edge = PRODUCT_IMAGE_MAX_EDGE
    for (let pass = 0; pass < 3; pass += 1) {
      const canvas = drawScaled(bitmap, edge)
      for (const quality of QUALITIES) {
        const bytes = await canvasToWebp(canvas, quality)
        if (bytes.byteLength <= PRODUCT_IMAGE_MAX_BYTES) return bytes
      }
      edge = Math.max(320, Math.round(edge * 0.7))
    }
  } finally {
    bitmap.close()
  }

  throw new Error('Could not shrink that photo enough to save.')
}

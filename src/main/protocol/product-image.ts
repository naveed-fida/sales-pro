import { readFileSync } from 'node:fs'
import { protocol } from 'electron'
import { parseProductImageFileName, PRODUCT_IMAGE_SCHEME } from '@shared/product-image'
import { getDatabasePath } from '../db/client'
import { productImageFilePath } from '../files/paths'

/**
 * Must run before app ready. Privileged schemes cannot be registered later,
 * and without this the renderer CSP would block `<img src="product-image://…">`.
 */
export function registerProductImageScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PRODUCT_IMAGE_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

export function handleProductImageProtocol(): void {
  protocol.handle(PRODUCT_IMAGE_SCHEME, (request) => {
    const fileName = parseProductImageFileName(request.url)
    if (!fileName) {
      return new Response(null, { status: 404 })
    }

    try {
      const filePath = productImageFilePath(getDatabasePath(), fileName)
      const body = readFileSync(filePath)
      return new Response(body, {
        headers: { 'content-type': 'image/webp' },
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })
}

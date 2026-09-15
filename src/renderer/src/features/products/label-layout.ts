import type { LabelVariant } from '@shared/schemas/catalog'

export const LABEL_COLUMNS = 3
export const LABEL_ROWS = 8
export const LABELS_PER_PAGE = LABEL_COLUMNS * LABEL_ROWS

export function variantOptionLabel(variant: LabelVariant): string {
  const detail = [variant.size, variant.colour].filter(Boolean).join(' · ')
  return detail ? `${variant.productName} (${detail})` : variant.productName
}

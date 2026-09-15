export function variantOptionLabel(variant: {
  productName: string
  size: string | null
  colour: string | null
}): string {
  const detail = [variant.size, variant.colour].filter(Boolean).join(' · ')
  return detail ? `${variant.productName} (${detail})` : variant.productName
}

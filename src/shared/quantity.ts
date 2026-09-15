/**
 * Quantities are integer thousandths so 2.5 metres does not pick up float
 * drift. Piece items are still stored on this scale (1 piece = 1000).
 */

export const QUANTITY_SCALE = 1000

export const productUnits = ['piece', 'meter', 'yard'] as const

export type ProductUnit = (typeof productUnits)[number]

export function toMilli(display: number): number {
  return Math.round(display * QUANTITY_SCALE)
}

export function fromMilli(milli: number): number {
  return milli / QUANTITY_SCALE
}

export function formatQuantity(milli: number, unit: ProductUnit): string {
  if (unit === 'piece') {
    return String(Math.round(fromMilli(milli)))
  }

  return fromMilli(milli)
    .toFixed(3)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
}

export function parseQuantity(input: string, unit: ProductUnit): number | null {
  const normalised = input.trim().replaceAll(',', '')

  if (normalised === '') return null

  if (unit === 'piece') {
    if (!/^\d+$/.test(normalised)) return null
    return toMilli(Number.parseInt(normalised, 10))
  }

  if (!/^\d+(\.\d{1,3})?$/.test(normalised)) return null

  return toMilli(Number.parseFloat(normalised))
}

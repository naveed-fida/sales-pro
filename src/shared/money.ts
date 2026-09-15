/**
 * Money is whole rupees. Pakistani retail does not price in paisa, so storing
 * a minor unit of 1/100 would only multiply every total by 100. Arithmetic
 * stays in integers; percentage discounts round to the nearest rupee.
 */

export function roundRs(value: number): number {
  return Math.round(value)
}

export function percentOffRs(amountRs: number, percent: number): number {
  return roundRs((amountRs * percent) / 100)
}

export function formatRs(amountRs: number): string {
  return `Rs ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(amountRs)}`
}

export function parseRs(input: string): number | null {
  const normalised = input
    .trim()
    .replaceAll(',', '')
    .replace(/^rs\.?\s*/i, '')

  if (!/^-?\d+$/.test(normalised)) return null

  return Number.parseInt(normalised, 10)
}

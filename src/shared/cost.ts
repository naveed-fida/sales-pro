import { roundRs } from './money'
import { QUANTITY_SCALE } from './quantity'

export function quantityCostRs(quantityMilli: number, unitCostRs: number): number {
  return roundRs((quantityMilli * unitCostRs) / QUANTITY_SCALE)
}

export function lineTotalRs(
  quantityMilli: number,
  unitCostRs: number,
  discountRs: number,
): number {
  return quantityCostRs(quantityMilli, unitCostRs) - discountRs
}

export function weightedAverageCostRs(
  existingQtyMilli: number,
  existingAvgCostRs: number,
  incomingQtyMilli: number,
  incomingUnitCostRs: number,
): number {
  if (incomingQtyMilli <= 0) return existingAvgCostRs
  if (existingQtyMilli <= 0) return incomingUnitCostRs

  const totalMilli = existingQtyMilli + incomingQtyMilli
  return roundRs(
    (existingQtyMilli * existingAvgCostRs + incomingQtyMilli * incomingUnitCostRs) /
      totalMilli,
  )
}

export function allocateByWeights(totalRs: number, weights: number[]): number[] {
  if (weights.length === 0) return []
  const whole = weights.reduce((sum, weight) => sum + weight, 0)
  if (whole <= 0) return weights.map(() => 0)

  const shares = weights.map((weight) => roundRs((totalRs * weight) / whole))
  const drift = totalRs - shares.reduce((sum, share) => sum + share, 0)
  if (drift !== 0) {
    const index = shares.findIndex((_, i) => weights[i] > 0)
    if (index >= 0) shares[index] += drift
  }
  return shares
}

export function refundPortionRs(
  netRs: number,
  soldMilli: number,
  returnMilli: number,
  remainingMilli: number,
  remainingRs: number,
): number {
  if (returnMilli <= 0 || remainingMilli <= 0) return 0
  if (returnMilli >= remainingMilli) return remainingRs
  return roundRs((netRs * returnMilli) / soldMilli)
}

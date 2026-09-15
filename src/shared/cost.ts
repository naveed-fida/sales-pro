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

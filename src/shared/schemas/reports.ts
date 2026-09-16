import { z } from 'zod'
import { productUnits } from '@shared/quantity'
import { saleStatus } from '@shared/schemas/sales'

const dayStamp = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')

export const reportRangeSchema = z.object({
  from: dayStamp,
  to: dayStamp,
})

export const reportDaySchema = z.object({
  date: z.string(),
  netRs: z.number().int(),
  expenseRs: z.number().int(),
  profitRs: z.number().int(),
})

export const reportTopProductSchema = z.object({
  variantId: z.number().int().positive(),
  productName: z.string(),
  barcode: z.string(),
  size: z.string().nullable(),
  colour: z.string().nullable(),
  unit: z.enum(productUnits),
  quantityMilli: z.number().int(),
  netRs: z.number().int(),
})

export const reportBillSchema = z.object({
  id: z.number().int().positive(),
  billNo: z.number().int().positive(),
  createdAt: z.coerce.date(),
  totalRs: z.number().int(),
  status: z.enum(saleStatus),
})

export const reportLowStockSchema = z.object({
  variantId: z.number().int().positive(),
  productName: z.string(),
  barcode: z.string(),
  size: z.string().nullable(),
  colour: z.string().nullable(),
  unit: z.enum(productUnits),
  quantityMilli: z.number().int(),
  reorderLevelMilli: z.number().int(),
})

export const reportSummarySchema = z.object({
  from: dayStamp,
  to: dayStamp,
  billCount: z.number().int().nonnegative(),
  grossRs: z.number().int(),
  discountRs: z.number().int(),
  returnRs: z.number().int(),
  netRs: z.number().int(),
  costRs: z.number().int(),
  grossProfitRs: z.number().int(),
  purchaseCount: z.number().int().nonnegative(),
  purchaseRs: z.number().int(),
  expenseRs: z.number().int(),
  netProfitRs: z.number().int(),
  daily: z.array(reportDaySchema),
  topProducts: z.array(reportTopProductSchema),
  bills: z.array(reportBillSchema),
  lowStock: z.array(reportLowStockSchema),
})

export type ReportRangeInput = z.infer<typeof reportRangeSchema>
export type ReportDay = z.infer<typeof reportDaySchema>
export type ReportTopProduct = z.infer<typeof reportTopProductSchema>
export type ReportBill = z.infer<typeof reportBillSchema>
export type ReportLowStock = z.infer<typeof reportLowStockSchema>
export type ReportSummary = z.infer<typeof reportSummarySchema>

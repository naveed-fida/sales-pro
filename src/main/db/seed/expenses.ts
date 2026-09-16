import { shopTimeDaysAgo } from './dates.ts'
import { expenses } from '../schema.ts'
import type { AppDatabase } from '../sqlite.ts'

const ROWS: Array<{
  category: string
  amountRs: number
  daysAgo: number
  note: string
}> = [
  { category: 'Rent', amountRs: 45_000, daysAgo: 72, note: 'Shop rent' },
  { category: 'Electricity', amountRs: 7_400, daysAgo: 68, note: '' },
  { category: 'Salary', amountRs: 25_000, daysAgo: 60, note: 'Tailor' },
  { category: 'Rent', amountRs: 45_000, daysAgo: 42, note: 'Shop rent' },
  { category: 'Electricity', amountRs: 8_100, daysAgo: 38, note: '' },
  { category: 'Transport', amountRs: 1_800, daysAgo: 21, note: 'Lahore trip' },
  { category: 'Packaging', amountRs: 950, daysAgo: 14, note: '' },
  { category: 'Rent', amountRs: 45_000, daysAgo: 12, note: 'Shop rent' },
  { category: 'Salary', amountRs: 25_000, daysAgo: 8, note: 'Tailor' },
  { category: 'Electricity', amountRs: 8_200, daysAgo: 5, note: '' },
  { category: 'Maintenance', amountRs: 3_500, daysAgo: 3, note: 'AC service' },
  { category: 'Misc', amountRs: 600, daysAgo: 1, note: 'Tea and supplies' },
]

export type ExpensesSeedSummary = {
  expensesCreated: number
}

export function seedExpenses(db: AppDatabase): ExpensesSeedSummary {
  for (const row of ROWS) {
    db.insert(expenses)
      .values({
        category: row.category,
        amountRs: row.amountRs,
        incurredAt: shopTimeDaysAgo(row.daysAgo, 10),
        note: row.note || null,
      })
      .run()
  }

  return { expensesCreated: ROWS.length }
}

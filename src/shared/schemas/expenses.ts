import { z } from 'zod'

export const EXPENSE_CATEGORY_SUGGESTIONS = [
  'Rent',
  'Electricity',
  'Salary',
  'Transport',
  'Packaging',
  'Maintenance',
  'Misc',
] as const

export const expenseIdSchema = z.object({
  id: z.number().int().positive(),
})

export const saveExpenseSchema = z.object({
  id: z.number().int().positive().optional(),
  category: z
    .string()
    .trim()
    .min(1, 'Category is required')
    .max(80, 'Category is too long'),
  amountRs: z.coerce
    .number()
    .int('Whole rupees only')
    .positive('Amount must be more than zero')
    .max(10_000_000, 'That amount is too large'),
  incurredAt: z.coerce.date(),
  note: z.string().trim().max(500, 'Note is too long'),
})

export const expenseSchema = z.object({
  id: z.number().int().positive(),
  category: z.string(),
  amountRs: z.number().int(),
  incurredAt: z.coerce.date(),
  note: z.string().nullable(),
})

export type ExpenseId = z.infer<typeof expenseIdSchema>
export type SaveExpenseInput = z.input<typeof saveExpenseSchema>
export type SaveExpense = z.infer<typeof saveExpenseSchema>
export type Expense = z.infer<typeof expenseSchema>

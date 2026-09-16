import { useQuery } from '@tanstack/react-query'
import type { Expense } from '@shared/schemas/expenses'

export const expensesQueryKey = ['expenses'] as const

export function useExpensesQuery(): ReturnType<typeof useQuery<Expense[]>> {
  return useQuery({
    queryKey: expensesQueryKey,
    queryFn: async (): Promise<Expense[]> => {
      const result = await window.api.expenses.list()
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ListSalesInput, SaleListPage, SaleRecord } from '@shared/schemas/sales'

export const salesQueryKey = ['sales'] as const

export function salesListQueryKey(
  input: ListSalesInput,
): readonly ['sales', 'list', string, number, string, string, ListSalesInput['status']] {
  return ['sales', 'list', input.search, input.page, input.from, input.to, input.status]
}

export function saleQueryKey(id: number): readonly ['sales', number] {
  return ['sales', id] as const
}

export function useSalesQuery(
  input: ListSalesInput,
): ReturnType<typeof useQuery<SaleListPage>> {
  return useQuery({
    queryKey: salesListQueryKey(input),
    queryFn: async (): Promise<SaleListPage> => {
      const result = await window.api.sales.list(input)
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    placeholderData: keepPreviousData,
  })
}

export function useSaleQuery(id: number | null): ReturnType<typeof useQuery<SaleRecord>> {
  return useQuery({
    queryKey: id === null ? ['sales', 'none'] : saleQueryKey(id),
    enabled: id !== null,
    queryFn: async (): Promise<SaleRecord> => {
      if (id === null) throw new Error('Sale not found.')
      const result = await window.api.sales.get(id)
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

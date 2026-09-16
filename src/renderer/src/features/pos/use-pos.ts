import { useQuery } from '@tanstack/react-query'
import type { CustomerMatch } from '@shared/schemas/customers'
import type { HeldSale, PosCatalogVariant } from '@shared/schemas/sales'

export const posCatalogQueryKey = ['sales', 'catalog'] as const
export const holdsQueryKey = ['sales', 'holds'] as const
export const customerSearchQueryKey = ['customers', 'search'] as const

export function usePosCatalogQuery(): ReturnType<typeof useQuery<PosCatalogVariant[]>> {
  return useQuery({
    queryKey: posCatalogQueryKey,
    queryFn: async (): Promise<PosCatalogVariant[]> => {
      const result = await window.api.sales.catalog()
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

export function useHoldsQuery(): ReturnType<typeof useQuery<HeldSale[]>> {
  return useQuery({
    queryKey: holdsQueryKey,
    queryFn: async (): Promise<HeldSale[]> => {
      const result = await window.api.sales.listHolds()
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

export function useCustomerSearchQuery(
  query: string,
  enabled: boolean,
): ReturnType<typeof useQuery<CustomerMatch[]>> {
  return useQuery({
    queryKey: [...customerSearchQueryKey, query],
    enabled: enabled && query.trim().length > 0,
    staleTime: 0,
    queryFn: async (): Promise<CustomerMatch[]> => {
      const result = await window.api.customers.search({ query })
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

import { useQuery } from '@tanstack/react-query'
import type { HeldSale, PosCatalogVariant } from '@shared/schemas/sales'

export const posCatalogQueryKey = ['sales', 'catalog'] as const
export const holdsQueryKey = ['sales', 'holds'] as const

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

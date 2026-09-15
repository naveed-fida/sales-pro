import { useQuery } from '@tanstack/react-query'
import type {
  PurchaseCatalogVariant,
  PurchaseListItem,
  PurchaseRecord,
} from '@shared/schemas/purchases'

export const purchasesQueryKey = ['purchases'] as const
export const purchaseCatalogQueryKey = ['purchases', 'catalog'] as const

export function purchaseQueryKey(id: number): readonly ['purchases', number] {
  return ['purchases', id] as const
}

export function usePurchasesQuery(): ReturnType<typeof useQuery<PurchaseListItem[]>> {
  return useQuery({
    queryKey: purchasesQueryKey,
    queryFn: async (): Promise<PurchaseListItem[]> => {
      const result = await window.api.purchases.list()
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

export function usePurchaseQuery(
  id: number | null,
): ReturnType<typeof useQuery<PurchaseRecord>> {
  return useQuery({
    queryKey: id === null ? ['purchases', 'none'] : purchaseQueryKey(id),
    enabled: id !== null,
    queryFn: async (): Promise<PurchaseRecord> => {
      if (id === null) throw new Error('Purchase not found.')
      const result = await window.api.purchases.get(id)
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

export function usePurchaseCatalogQuery(
  enabled = true,
): ReturnType<typeof useQuery<PurchaseCatalogVariant[]>> {
  return useQuery({
    queryKey: purchaseCatalogQueryKey,
    enabled,
    queryFn: async (): Promise<PurchaseCatalogVariant[]> => {
      const result = await window.api.purchases.catalog()
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

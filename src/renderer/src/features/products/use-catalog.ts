import { useQuery, type QueryClient } from '@tanstack/react-query'
import type {
  Category,
  LabelVariant,
  ProductListItem,
  ProductRecord,
} from '@shared/schemas/catalog'
import { posCatalogQueryKey } from '@/features/pos/use-pos'
import { purchaseCatalogQueryKey } from '@/features/purchases/use-purchases'
import { reportsQueryKey } from '@/features/reports/use-reports'

export const categoriesQueryKey = ['categories'] as const
export const productsQueryKey = ['products'] as const
export const labelVariantsQueryKey = ['products', 'variants'] as const

export function productQueryKey(id: number): readonly ['products', number] {
  return ['products', id] as const
}

export async function invalidateAfterProductWrite(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: productsQueryKey }),
    queryClient.invalidateQueries({ queryKey: posCatalogQueryKey }),
    queryClient.invalidateQueries({ queryKey: purchaseCatalogQueryKey }),
    queryClient.invalidateQueries({ queryKey: reportsQueryKey }),
  ])
}

export function useCategoriesQuery(): ReturnType<typeof useQuery<Category[]>> {
  return useQuery({
    queryKey: categoriesQueryKey,
    queryFn: async (): Promise<Category[]> => {
      const result = await window.api.categories.list()
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

export function useProductsQuery(): ReturnType<typeof useQuery<ProductListItem[]>> {
  return useQuery({
    queryKey: productsQueryKey,
    queryFn: async (): Promise<ProductListItem[]> => {
      const result = await window.api.products.list()
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

export function useLabelVariantsQuery(
  enabled = true,
): ReturnType<typeof useQuery<LabelVariant[]>> {
  return useQuery({
    queryKey: labelVariantsQueryKey,
    enabled,
    queryFn: async (): Promise<LabelVariant[]> => {
      const result = await window.api.products.listVariants()
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

export function useProductQuery(
  id: number | null,
): ReturnType<typeof useQuery<ProductRecord>> {
  return useQuery({
    queryKey: id === null ? ['products', 'none'] : productQueryKey(id),
    enabled: id !== null,
    queryFn: async (): Promise<ProductRecord> => {
      if (id === null) throw new Error('Product not found.')
      const result = await window.api.products.get(id)
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

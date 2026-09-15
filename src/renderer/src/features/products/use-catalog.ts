import { useQuery } from '@tanstack/react-query'
import type { Category, ProductListItem, ProductRecord } from '@shared/schemas/catalog'

export const categoriesQueryKey = ['categories'] as const
export const productsQueryKey = ['products'] as const

export function productQueryKey(id: number): readonly ['products', number] {
  return ['products', id] as const
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

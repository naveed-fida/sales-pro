import { useQuery } from '@tanstack/react-query'
import type { Supplier } from '@shared/schemas/suppliers'

export const suppliersQueryKey = ['suppliers'] as const

export function supplierQueryKey(id: number): readonly ['suppliers', number] {
  return ['suppliers', id] as const
}

export function useSuppliersQuery(): ReturnType<typeof useQuery<Supplier[]>> {
  return useQuery({
    queryKey: suppliersQueryKey,
    queryFn: async (): Promise<Supplier[]> => {
      const result = await window.api.suppliers.list()
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

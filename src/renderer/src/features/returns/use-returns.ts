import { useQuery } from '@tanstack/react-query'
import type { ReturnListItem, ReturnRecord } from '@shared/schemas/returns'

export const returnsQueryKey = ['returns'] as const

export function returnQueryKey(id: number): readonly ['returns', number] {
  return ['returns', id] as const
}

export function useReturnsQuery(): ReturnType<typeof useQuery<ReturnListItem[]>> {
  return useQuery({
    queryKey: returnsQueryKey,
    queryFn: async (): Promise<ReturnListItem[]> => {
      const result = await window.api.returns.list()
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

export function useReturnQuery(
  id: number | null,
): ReturnType<typeof useQuery<ReturnRecord>> {
  return useQuery({
    queryKey: id === null ? ['returns', 'none'] : returnQueryKey(id),
    enabled: id !== null,
    queryFn: async (): Promise<ReturnRecord> => {
      if (id === null) throw new Error('Return not found.')
      const result = await window.api.returns.get(id)
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

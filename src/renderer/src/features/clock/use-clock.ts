import { useQuery } from '@tanstack/react-query'
import type { ClockStatus } from '@shared/schemas/clock'

export const clockQueryKey = ['clock'] as const

export function useClockQuery(): ReturnType<typeof useQuery<ClockStatus>> {
  return useQuery({
    queryKey: clockQueryKey,
    queryFn: async (): Promise<ClockStatus> => {
      const result = await window.api.clock.get()
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    retry: false,
  })
}

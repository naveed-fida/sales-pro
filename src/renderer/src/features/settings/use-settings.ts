import { useQuery } from '@tanstack/react-query'
import type { AppSettings, Printer } from '@shared/schemas/settings'

export const settingsQueryKey = ['settings'] as const
export const printersQueryKey = ['settings', 'printers'] as const

export function useSettingsQuery(): ReturnType<typeof useQuery<AppSettings>> {
  return useQuery({
    queryKey: settingsQueryKey,
    queryFn: async (): Promise<AppSettings> => {
      const result = await window.api.settings.get()
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

export function usePrintersQuery(): ReturnType<typeof useQuery<Printer[]>> {
  return useQuery({
    queryKey: printersQueryKey,
    queryFn: async (): Promise<Printer[]> => {
      const result = await window.api.settings.listPrinters()
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
  })
}

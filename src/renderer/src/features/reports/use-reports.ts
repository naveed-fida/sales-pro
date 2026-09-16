import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  reportRangeSchema,
  type ReportRangeInput,
  type ReportSummary,
} from '@shared/schemas/reports'

export const reportsQueryKey = ['reports'] as const

export function reportSummaryQueryKey(
  range: ReportRangeInput,
): readonly ['reports', 'summary', string, string] {
  return ['reports', 'summary', range.from, range.to]
}

export function useReportSummaryQuery(
  range: ReportRangeInput,
): ReturnType<typeof useQuery<ReportSummary>> {
  const parsed = reportRangeSchema.safeParse(range)
  return useQuery({
    queryKey: reportSummaryQueryKey(range),
    enabled: parsed.success,
    queryFn: async (): Promise<ReportSummary> => {
      const result = await window.api.reports.summary(range)
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    placeholderData: keepPreviousData,
  })
}

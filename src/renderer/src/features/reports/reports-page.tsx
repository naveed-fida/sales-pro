import { useMemo, useState } from 'react'
import { format, parseISO, startOfMonth, startOfWeek, subDays } from 'date-fns'
import { Bar, CartesianGrid, ComposedChart, Line, XAxis } from 'recharts'
import { cn } from 'cn'
import { formatRs } from '@shared/money'
import { formatQuantity } from '@shared/quantity'
import type { ReportRangeInput } from '@shared/schemas/reports'
import { variantOptionLabel } from '@shared/variant-label'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UNIT_LABELS } from '@/features/products/unit-labels'
import { SaleDetailDialog } from '@/features/sales/sale-detail-dialog'
import { SALE_STATUS_LABELS } from '@/features/sales/status-labels'
import { useReportSummaryQuery } from './use-reports'

type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

const PRESETS: Array<{ id: Exclude<Preset, 'custom'>; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
]

const chartConfig = {
  netRs: { label: 'Sales', color: 'var(--chart-1)' },
  expenseRs: { label: 'Expenses', color: 'var(--chart-2)' },
  profitRs: { label: 'Profit', color: 'var(--chart-3)' },
} satisfies ChartConfig

function isoDay(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function rangeFor(preset: Exclude<Preset, 'custom'>): ReportRangeInput {
  const today = new Date()
  const todayIso = isoDay(today)
  if (preset === 'today') return { from: todayIso, to: todayIso }
  if (preset === 'yesterday') {
    const day = isoDay(subDays(today, 1))
    return { from: day, to: day }
  }
  if (preset === 'week') {
    return {
      from: isoDay(startOfWeek(today, { weekStartsOn: 1 })),
      to: todayIso,
    }
  }
  return { from: isoDay(startOfMonth(today)), to: todayIso }
}

function ReportTableCard({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Card className="h-80 overflow-hidden py-0">
      <CardContent className="h-full overflow-auto px-0">{children}</CardContent>
    </Card>
  )
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}): React.JSX.Element {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-xl">{value}</CardTitle>
        {hint ? <CardDescription>{hint}</CardDescription> : null}
      </CardHeader>
    </Card>
  )
}

export function ReportsPage(): React.JSX.Element {
  const [preset, setPreset] = useState<Preset>('month')
  const initial = rangeFor('month')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [openId, setOpenId] = useState<number | null>(null)
  const range = useMemo(() => ({ from, to }), [from, to])
  const reportQuery = useReportSummaryQuery(range)
  const report = reportQuery.data

  function applyPreset(next: Exclude<Preset, 'custom'>): void {
    const selected = rangeFor(next)
    setPreset(next)
    setFrom(selected.from)
    setTo(selected.to)
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Sales, cost, expenses and profit for a period. Low stock is current, not
            dated.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={preset === item.id ? 'default' : 'outline'}
              onClick={() => applyPreset(item.id)}
            >
              {item.label}
            </Button>
          ))}
          <Input
            className="w-40"
            type="date"
            value={from}
            onChange={(event) => {
              setPreset('custom')
              setFrom(event.target.value)
            }}
            aria-label="From date"
          />
          <Input
            className="w-40"
            type="date"
            value={to}
            onChange={(event) => {
              setPreset('custom')
              setTo(event.target.value)
            }}
            aria-label="To date"
          />
        </div>

        {reportQuery.isPending && !report ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : reportQuery.isError ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-destructive">
              {reportQuery.error instanceof Error
                ? reportQuery.error.message
                : 'Could not load the report.'}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void reportQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : report ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label="Bills" value={String(report.billCount)} />
              <Kpi label="Gross" value={formatRs(report.grossRs)} />
              <Kpi label="Discounts" value={formatRs(report.discountRs)} />
              <Kpi label="Returns" value={formatRs(report.returnRs)} />
              <Kpi label="Net sales" value={formatRs(report.netRs)} />
              <Kpi label="Cost of goods" value={formatRs(report.costRs)} />
              <Kpi label="Gross profit" value={formatRs(report.grossProfitRs)} />
              <Kpi
                label="Purchases"
                value={formatRs(report.purchaseRs)}
                hint={`${report.purchaseCount} bills`}
              />
              <Kpi label="Expenses" value={formatRs(report.expenseRs)} />
              <Kpi label="Net profit" value={formatRs(report.netProfitRs)} />
            </div>

            <Card className="shrink-0">
              <CardHeader>
                <CardTitle>Daily</CardTitle>
                <CardDescription>
                  Net sales after returns, expenses, and profit for each day.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={chartConfig}
                  className="aspect-auto h-72 w-full"
                  initialDimension={{ width: 640, height: 288 }}
                >
                  <ComposedChart data={report.daily}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value: string) => format(parseISO(value), 'd MMM')}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) =>
                            format(parseISO(String(value)), 'd MMM yyyy')
                          }
                          formatter={(value, name) => {
                            const series =
                              name in chartConfig
                                ? chartConfig[name as keyof typeof chartConfig].label
                                : String(name)
                            return (
                              <div className="flex flex-1 justify-between gap-8">
                                <span className="text-muted-foreground">{series}</span>
                                <span className="font-mono tabular-nums">
                                  {formatRs(Number(value))}
                                </span>
                              </div>
                            )
                          }}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      dataKey="netRs"
                      fill="var(--color-netRs)"
                      radius={4}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="expenseRs"
                      fill="var(--color-expenseRs)"
                      radius={4}
                      maxBarSize={28}
                    />
                    <Line
                      dataKey="profitRs"
                      type="monotone"
                      stroke="var(--color-profitRs)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: 'var(--color-profitRs)', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Tabs defaultValue="bills" className="shrink-0">
              <TabsList>
                <TabsTrigger value="bills">Bills</TabsTrigger>
                <TabsTrigger value="products">Top products</TabsTrigger>
                <TabsTrigger value="stock">Low stock</TabsTrigger>
              </TabsList>
              <TabsContent value="bills">
                <ReportTableCard>
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="sticky top-0 z-10 bg-card">Bill</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">Date</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">
                          Status
                        </TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card text-right">
                          Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.bills.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center">
                            No bills in this period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.bills.map((bill) => (
                          <TableRow
                            key={bill.id}
                            className="cursor-pointer"
                            onClick={() => setOpenId(bill.id)}
                          >
                            <TableCell>{bill.billNo}</TableCell>
                            <TableCell>
                              {format(new Date(bill.createdAt), 'd MMM yyyy, h:mm a')}
                            </TableCell>
                            <TableCell>{SALE_STATUS_LABELS[bill.status]}</TableCell>
                            <TableCell className="text-right">
                              {formatRs(bill.totalRs)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </table>
                </ReportTableCard>
              </TabsContent>
              <TabsContent value="products">
                <ReportTableCard>
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="sticky top-0 z-10 bg-card">Item</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">Qty</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card text-right">
                          Net
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.topProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="h-24 text-center">
                            No sales in this period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.topProducts.map((item) => (
                          <TableRow key={item.variantId} className="hover:bg-transparent">
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{variantOptionLabel(item)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {item.barcode}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {formatQuantity(item.quantityMilli, item.unit)}{' '}
                              {UNIT_LABELS[item.unit]}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatRs(item.netRs)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </table>
                </ReportTableCard>
              </TabsContent>
              <TabsContent value="stock">
                <ReportTableCard>
                  <table className="w-full caption-bottom text-sm">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="sticky top-0 z-10 bg-card">Item</TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">
                          On hand
                        </TableHead>
                        <TableHead className="sticky top-0 z-10 bg-card">
                          Reorder at
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.lowStock.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="h-24 text-center">
                            All stock is above reorder level.
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.lowStock.map((item) => (
                          <TableRow key={item.variantId} className="hover:bg-transparent">
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{variantOptionLabel(item)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {item.barcode}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell
                              className={cn(
                                item.quantityMilli <= 0 && 'text-destructive',
                              )}
                            >
                              {formatQuantity(item.quantityMilli, item.unit)}{' '}
                              {UNIT_LABELS[item.unit]}
                            </TableCell>
                            <TableCell>
                              {formatQuantity(item.reorderLevelMilli, item.unit)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </table>
                </ReportTableCard>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>

      <SaleDetailDialog
        saleId={openId}
        onOpenChange={(open) => {
          if (!open) setOpenId(null)
        }}
      />
    </div>
  )
}

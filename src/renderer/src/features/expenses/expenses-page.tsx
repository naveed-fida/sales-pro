import { useCallback, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { uniq } from 'lodash-es'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { EXPENSE_CATEGORY_SUGGESTIONS, type Expense } from '@shared/schemas/expenses'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRs } from '@shared/money'
import { reportsQueryKey } from '@/features/reports/use-reports'
import { ExpenseForm } from './expense-form'
import { ExpensesTable } from './expenses-table'
import { expensesQueryKey, useExpensesQuery } from './use-expenses'

const ALL = 'all'
const EMPTY_EXPENSES: Expense[] = []

export function ExpensesPage(): React.JSX.Element {
  const queryClient = useQueryClient()
  const expensesQuery = useExpensesQuery()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | 'all'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [editor, setEditor] = useState<Expense | 'new' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState(false)
  const expenses = expensesQuery.data ?? EMPTY_EXPENSES
  const categories = useMemo(
    () => uniq(expenses.map((row) => row.category)).sort((a, b) => a.localeCompare(b)),
    [expenses],
  )
  const formCategories = useMemo(
    () =>
      uniq([...EXPENSE_CATEGORY_SUGGESTIONS, ...categories]).sort((a, b) =>
        a.localeCompare(b),
      ),
    [categories],
  )
  const onOpen = useCallback(
    (id: number) => {
      const row = expenses.find((expense) => expense.id === id)
      if (row) setEditor(row)
    },
    [expenses],
  )
  const emptyShop = expenses.length === 0 && !expensesQuery.isPending
  const editing = editor === null || editor === 'new' ? null : editor

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) return
    setDeleting(true)
    const result = await window.api.expenses.delete(pendingDelete.id)
    setDeleting(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    await queryClient.invalidateQueries({ queryKey: expensesQueryKey })
    await queryClient.invalidateQueries({ queryKey: reportsQueryKey })
    setPendingDelete(null)
    setEditor(null)
    toast.success('Expense deleted')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Rent, wages and other shop costs. These come off profit in reports.
          </p>
        </div>
        <Button type="button" onClick={() => setEditor('new')}>
          <Plus />
          New expense
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search category or note"
        />
        <Select
          value={category === 'all' ? ALL : category}
          onValueChange={(value) => setCategory(value === ALL ? 'all' : value)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-40"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          aria-label="From date"
        />
        <Input
          className="w-40"
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          aria-label="To date"
        />
      </div>

      {expensesQuery.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : expensesQuery.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-destructive">
            {expensesQuery.error instanceof Error
              ? expensesQuery.error.message
              : 'Could not load expenses.'}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void expensesQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : emptyShop ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <p className="text-sm text-muted-foreground">
              No expenses yet. Add rent, electricity or wages so profit is not overstated.
            </p>
            <Button type="button" onClick={() => setEditor('new')}>
              <Plus />
              New expense
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
          <CardContent className="min-h-0 flex-1 overflow-auto px-0">
            <ExpensesTable
              data={expenses}
              search={search}
              category={category}
              from={from}
              to={to}
              onOpen={onOpen}
            />
          </CardContent>
        </Card>
      )}

      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit expense' : 'New expense'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `${editing.category} · ${formatRs(editing.amountRs)}`
                : 'Whole rupees. Pick a date the cost was incurred.'}
            </DialogDescription>
          </DialogHeader>
          <ExpenseForm
            expense={editing}
            categories={formCategories}
            onClose={() => setEditor(null)}
          />
          {editing ? (
            <Button
              type="button"
              variant="outline"
              className="text-destructive"
              onClick={() => setPendingDelete(editing)}
            >
              Delete
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `${pendingDelete.category} · ${formatRs(pendingDelete.amountRs)} will be removed.`
                : 'This expense will be removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

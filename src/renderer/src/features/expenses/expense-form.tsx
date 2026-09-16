import { useEffect } from 'react'
import { Controller, useForm, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  saveExpenseSchema,
  type Expense,
  type SaveExpense,
  type SaveExpenseInput,
} from '@shared/schemas/expenses'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { expensesQueryKey } from './use-expenses'

function emptyExpense(): SaveExpenseInput {
  return {
    category: '',
    amountRs: '',
    incurredAt: new Date(),
    note: '',
  }
}

function valuesFrom(expense: Expense | null): SaveExpenseInput {
  if (!expense) return emptyExpense()
  return {
    id: expense.id,
    category: expense.category,
    amountRs: expense.amountRs,
    incurredAt: new Date(expense.incurredAt),
    note: expense.note ?? '',
  }
}

export function ExpenseForm({
  expense,
  categories,
  onClose,
}: {
  expense: Expense | null
  categories: string[]
  onClose: () => void
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const form = useForm<SaveExpenseInput, unknown, SaveExpense>({
    resolver: zodResolver(saveExpenseSchema),
    defaultValues: valuesFrom(expense),
  })

  const {
    control,
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = form

  useEffect(() => {
    reset(valuesFrom(expense))
  }, [expense, reset])

  async function onSubmit(values: SaveExpense): Promise<void> {
    const result = await window.api.expenses.save(values)
    if (!result.ok) {
      if (result.error.field) {
        setError(result.error.field as FieldPath<SaveExpense>, {
          type: 'server',
          message: result.error.message,
        })
        return
      }
      toast.error(result.error.message)
      return
    }

    await queryClient.invalidateQueries({ queryKey: expensesQueryKey })
    toast.success(expense ? 'Expense saved' : 'Expense added')
    onClose()
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.stopPropagation()
        void handleSubmit(onSubmit)(event)
      }}
    >
      <FieldGroup>
        <Field data-invalid={!!errors.category}>
          <FieldLabel htmlFor="expense-category">Category</FieldLabel>
          <Input
            id="expense-category"
            list="expense-category-options"
            autoFocus
            aria-invalid={!!errors.category}
            {...register('category')}
          />
          <datalist id="expense-category-options">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <FieldError errors={[errors.category]} />
        </Field>
        <Field data-invalid={!!errors.incurredAt}>
          <FieldLabel htmlFor="expense-date">Date</FieldLabel>
          <Controller
            name="incurredAt"
            control={control}
            render={({ field }) => (
              <Input
                id="expense-date"
                type="date"
                value={
                  field.value instanceof Date ? format(field.value, 'yyyy-MM-dd') : ''
                }
                onChange={(event) => {
                  const next = event.target.value
                  if (!next) return
                  field.onChange(new Date(`${next}T12:00:00`))
                }}
                aria-invalid={!!errors.incurredAt}
              />
            )}
          />
          <FieldError errors={[errors.incurredAt]} />
        </Field>
        <Field data-invalid={!!errors.amountRs}>
          <FieldLabel htmlFor="expense-amount">Amount (Rs)</FieldLabel>
          <Input
            id="expense-amount"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            aria-invalid={!!errors.amountRs}
            {...register('amountRs')}
          />
          <FieldError errors={[errors.amountRs]} />
        </Field>
        <Field data-invalid={!!errors.note}>
          <FieldLabel htmlFor="expense-note">Note</FieldLabel>
          <Textarea
            id="expense-note"
            rows={3}
            aria-invalid={!!errors.note}
            {...register('note')}
          />
          <FieldError errors={[errors.note]} />
        </Field>
      </FieldGroup>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}

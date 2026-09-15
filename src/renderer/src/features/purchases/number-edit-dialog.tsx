import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const quantitySchema = z.object({
  value: z.coerce
    .number()
    .positive('Must be more than zero')
    .max(1_000_000, 'That number is too large'),
})

const pieceQuantitySchema = z.object({
  value: z.coerce
    .number()
    .int('Whole pieces only')
    .positive('Must be more than zero')
    .max(1_000_000, 'That number is too large'),
})

const moneySchema = z.object({
  value: z.coerce
    .number()
    .int('Whole rupees only')
    .nonnegative('Cannot be negative')
    .max(10_000_000, 'That number is too large'),
})

type NumberFormInput = { value: unknown }
type NumberForm = { value: number }

export function NumberEditDialog({
  open,
  title,
  description,
  label,
  value,
  kind,
  integer,
  onOpenChange,
  onSave,
}: {
  open: boolean
  title: string
  description: string
  label: string
  value: number
  kind: 'quantity' | 'money'
  integer: boolean
  onOpenChange: (open: boolean) => void
  onSave: (value: number) => void
}): React.JSX.Element {
  const schema =
    kind === 'money' ? moneySchema : integer ? pieceQuantitySchema : quantitySchema
  const min = kind === 'money' ? 0 : integer ? 1 : 0.001
  const step = integer ? 1 : 0.001
  const form = useForm<NumberFormInput, unknown, NumberForm>({
    resolver: zodResolver(schema),
    defaultValues: { value },
  })

  useEffect(() => {
    if (open) form.reset({ value })
  }, [form, open, value])

  function onSubmit(values: NumberForm): void {
    onSave(values.value)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" showCloseButton>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.stopPropagation()
            void form.handleSubmit(onSubmit)(event)
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!form.formState.errors.value}>
            <FieldLabel htmlFor="number-edit-value">{label}</FieldLabel>
            <Input
              id="number-edit-value"
              type="number"
              min={min}
              step={step}
              inputMode={integer ? 'numeric' : 'decimal'}
              autoFocus
              aria-invalid={!!form.formState.errors.value}
              {...form.register('value')}
            />
            <FieldError errors={[form.formState.errors.value]} />
          </Field>
          <DialogFooter>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

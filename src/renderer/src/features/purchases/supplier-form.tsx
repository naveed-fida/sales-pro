import { useEffect } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  saveSupplierSchema,
  type SaveSupplier,
  type SaveSupplierInput,
  type Supplier,
} from '@shared/schemas/suppliers'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { purchasesQueryKey } from './use-purchases'
import { supplierQueryKey, suppliersQueryKey } from './use-suppliers'

export function SupplierForm({
  supplier,
  onClose,
  onSaved,
}: {
  supplier: Supplier | null
  onClose: () => void
  onSaved?: (saved: Supplier) => void
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const form = useForm<SaveSupplierInput, unknown, SaveSupplier>({
    resolver: zodResolver(saveSupplierSchema),
    defaultValues: supplier
      ? {
          id: supplier.id,
          name: supplier.name,
          phone: supplier.phone ?? '',
          address: supplier.address ?? '',
          notes: supplier.notes ?? '',
        }
      : { name: '', phone: '', address: '', notes: '' },
  })

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = form

  useEffect(() => {
    reset(
      supplier
        ? {
            id: supplier.id,
            name: supplier.name,
            phone: supplier.phone ?? '',
            address: supplier.address ?? '',
            notes: supplier.notes ?? '',
          }
        : { name: '', phone: '', address: '', notes: '' },
    )
  }, [reset, supplier])

  async function onSubmit(values: SaveSupplier): Promise<void> {
    const result = await window.api.suppliers.save(values)
    if (!result.ok) {
      if (result.error.field) {
        setError(result.error.field as FieldPath<SaveSupplier>, {
          type: 'server',
          message: result.error.message,
        })
        return
      }
      toast.error(result.error.message)
      return
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: suppliersQueryKey }),
      queryClient.invalidateQueries({ queryKey: purchasesQueryKey }),
    ])
    if (result.data.id) {
      queryClient.setQueryData(supplierQueryKey(result.data.id), result.data)
    }
    toast.success(supplier ? 'Supplier saved' : 'Supplier added')
    onSaved?.(result.data)
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
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="supplier-name">Name</FieldLabel>
          <Input
            id="supplier-name"
            autoFocus
            aria-invalid={!!errors.name}
            {...register('name')}
          />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="supplier-phone">Phone</FieldLabel>
          <Input
            id="supplier-phone"
            aria-invalid={!!errors.phone}
            {...register('phone')}
          />
          <FieldError errors={[errors.phone]} />
        </Field>
        <Field data-invalid={!!errors.address}>
          <FieldLabel htmlFor="supplier-address">Address</FieldLabel>
          <Input
            id="supplier-address"
            aria-invalid={!!errors.address}
            {...register('address')}
          />
          <FieldError errors={[errors.address]} />
        </Field>
        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="supplier-notes">Notes</FieldLabel>
          <Textarea
            id="supplier-notes"
            rows={3}
            aria-invalid={!!errors.notes}
            {...register('notes')}
          />
          <FieldError errors={[errors.notes]} />
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

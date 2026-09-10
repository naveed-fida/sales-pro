import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, UserPlus } from 'lucide-react'
import {
  createCustomerSchema,
  type CreateCustomerInput,
  type Customer,
} from '@shared/ipc-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type CustomerFormProps = {
  onCreated: (customer: Customer) => void
}

export function CustomerForm({ onCreated }: CustomerFormProps): React.JSX.Element {
  const form = useForm<CreateCustomerInput>({
    // The same schema the main process validates with, so the client-side
    // messages and the server-side ones cannot disagree.
    resolver: zodResolver(createCustomerSchema),
    defaultValues: { name: '', email: '' },
  })

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = form

  const onSubmit = handleSubmit(async (values) => {
    const result = await window.api.customers.create(values)

    if (result.ok) {
      onCreated(result.data)
      reset()
      return
    }

    // The envelope's optional field name is what lets a uniqueness failure
    // land under the offending input instead of in a detached banner.
    const { field, message } = result.error

    if (field === 'name' || field === 'email') {
      setError(field, { message })
    } else {
      setError('root', { message })
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="customer-name">Name</FieldLabel>
          <Input
            id="customer-name"
            placeholder="Ada Lovelace"
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="customer-email">Email</FieldLabel>
          <Input
            id="customer-email"
            type="email"
            placeholder="ada@example.com"
            autoComplete="off"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : <UserPlus />}
            Add customer
          </Button>
          <FieldError errors={[errors.root]} />
        </Field>
      </FieldGroup>
    </form>
  )
}

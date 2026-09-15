import { useState } from 'react'
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldPath,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatRs } from '@shared/money'
import { formatQuantity, fromMilli, productUnits } from '@shared/quantity'
import {
  saveProductSchema,
  type Category,
  type ProductRecord,
  type SaveProduct,
  type SaveProductInput,
} from '@shared/schemas/catalog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { categoriesQueryKey, productsQueryKey, productQueryKey } from './use-catalog'
import { UNIT_LABELS } from './unit-labels'

function emptyVariant(reorderLevel: number): SaveProduct['variants'][number] {
  return {
    barcode: '',
    size: '',
    colour: '',
    salePriceRs: 0,
    reorderLevel,
    isActive: true,
  }
}

function toFormValues(product: ProductRecord): SaveProduct {
  return {
    id: product.id,
    name: product.name,
    categoryId: product.categoryId,
    unit: product.unit,
    description: product.description ?? '',
    isActive: product.isActive,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      barcode: variant.barcode,
      size: variant.size ?? '',
      colour: variant.colour ?? '',
      salePriceRs: variant.salePriceRs,
      reorderLevel:
        product.unit === 'piece'
          ? Math.round(fromMilli(variant.reorderLevelMilli))
          : fromMilli(variant.reorderLevelMilli),
      isActive: variant.isActive,
    })),
  }
}

export function ProductForm({
  product,
  categories,
  defaultReorderPieces,
  onClose,
}: {
  product: ProductRecord | null
  categories: Category[]
  defaultReorderPieces: number
  onClose: () => void
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const isNew = product === null
  const defaultReorder = product ? 0 : defaultReorderPieces

  const form = useForm<SaveProductInput, unknown, SaveProduct>({
    resolver: zodResolver(saveProductSchema),
    defaultValues: product
      ? toFormValues(product)
      : {
          name: '',
          categoryId: categories[0]?.id,
          unit: 'piece',
          description: '',
          isActive: true,
          variants: [emptyVariant(defaultReorder)],
        },
  })

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = form

  const variants = useFieldArray({ control, name: 'variants', keyName: 'fieldId' })
  const unit = useWatch({ control, name: 'unit' })
  const reorderStep = unit === 'piece' ? 1 : 0.001
  const reorderSuffix =
    unit === 'piece' ? 'pieces' : unit === 'meter' ? 'metres' : 'yards'
  const [categoryName, setCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [categoryPending, setCategoryPending] = useState(false)

  async function onSubmit(values: SaveProduct): Promise<void> {
    const result = await window.api.products.save(values)

    if (!result.ok) {
      if (result.error.field) {
        setError(result.error.field as FieldPath<SaveProduct>, {
          type: 'server',
          message: result.error.message,
        })
        return
      }

      toast.error(result.error.message)
      return
    }

    await queryClient.invalidateQueries({ queryKey: productsQueryKey })
    queryClient.setQueryData(productQueryKey(result.data.id), result.data)
    toast.success(isNew ? 'Product created' : 'Product saved')
    onClose()
  }

  async function addCategory(): Promise<void> {
    const name = categoryName.trim()
    if (!name) return

    setCategoryPending(true)
    const result = await window.api.categories.create({ name })
    setCategoryPending(false)

    if (!result.ok) {
      toast.error(result.error.message)
      return
    }

    await queryClient.invalidateQueries({ queryKey: categoriesQueryKey })
    setValue('categoryId', result.data.id, { shouldValidate: true })
    setCategoryName('')
    setAddingCategory(false)
    toast.success('Category added')
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="product-name">Name</FieldLabel>
              <Input
                id="product-name"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.categoryId}>
              <FieldLabel htmlFor="product-category">Category</FieldLabel>
              {addingCategory ? (
                <div className="flex gap-2">
                  <Input
                    id="product-category"
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void addCategory()
                      }
                      if (event.key === 'Escape') setAddingCategory(false)
                    }}
                    placeholder="e.g. Kurtas"
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={() => void addCategory()}
                    disabled={categoryPending || categoryName.trim() === ''}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddingCategory(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Controller
                    name="categoryId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : undefined}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        <SelectTrigger
                          id="product-category"
                          className="w-full"
                          aria-invalid={!!errors.categoryId}
                        >
                          <SelectValue placeholder="Pick a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={String(category.id)}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddingCategory(true)}
                  >
                    New
                  </Button>
                </div>
              )}
              <FieldError errors={[errors.categoryId]} />
            </Field>
            <Field data-invalid={!!errors.unit}>
              <FieldLabel htmlFor="product-unit">Unit</FieldLabel>
              <Controller
                name="unit"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!isNew}
                  >
                    <SelectTrigger id="product-unit" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {productUnits.map((item) => (
                        <SelectItem key={item} value={item}>
                          {UNIT_LABELS[item]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {!isNew ? (
                <FieldDescription>
                  Unit is fixed after the product is created.
                </FieldDescription>
              ) : null}
              <FieldError errors={[errors.unit]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="product-active" className="flex items-center gap-2">
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="product-active"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  )}
                />
                Active in POS
              </FieldLabel>
            </Field>
          </div>
          <Field data-invalid={!!errors.description}>
            <FieldLabel htmlFor="product-description">Description</FieldLabel>
            <Textarea id="product-description" rows={2} {...register('description')} />
            <FieldError errors={[errors.description]} />
          </Field>
        </FieldGroup>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Variants</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                variants.append(emptyVariant(unit === 'piece' ? defaultReorderPieces : 0))
              }
            >
              <Plus />
              Add variant
            </Button>
          </div>
          {errors.variants?.root ? (
            <FieldError errors={[errors.variants.root]} />
          ) : errors.variants?.message ? (
            <FieldError errors={[errors.variants]} />
          ) : null}

          <div className="space-y-3">
            {variants.fields.map((field, index) => {
              const variantErrors = errors.variants?.[index]
              const record =
                typeof field.id === 'number'
                  ? product?.variants.find((item) => item.id === field.id)
                  : undefined

              return (
                <div
                  key={field.fieldId}
                  className="grid gap-3 rounded-xl ring-1 ring-foreground/10 p-3 sm:grid-cols-6"
                >
                  <Field
                    className="sm:col-span-2"
                    data-invalid={!!variantErrors?.barcode}
                  >
                    <FieldLabel htmlFor={`variant-barcode-${index}`}>Barcode</FieldLabel>
                    <Input
                      id={`variant-barcode-${index}`}
                      placeholder="Auto"
                      aria-invalid={!!variantErrors?.barcode}
                      {...register(`variants.${index}.barcode`)}
                    />
                    <FieldError errors={[variantErrors?.barcode]} />
                  </Field>
                  <Field data-invalid={!!variantErrors?.size}>
                    <FieldLabel htmlFor={`variant-size-${index}`}>Size</FieldLabel>
                    <Input
                      id={`variant-size-${index}`}
                      {...register(`variants.${index}.size`)}
                    />
                    <FieldError errors={[variantErrors?.size]} />
                  </Field>
                  <Field data-invalid={!!variantErrors?.colour}>
                    <FieldLabel htmlFor={`variant-colour-${index}`}>Colour</FieldLabel>
                    <Input
                      id={`variant-colour-${index}`}
                      {...register(`variants.${index}.colour`)}
                    />
                    <FieldError errors={[variantErrors?.colour]} />
                  </Field>
                  <Field data-invalid={!!variantErrors?.salePriceRs}>
                    <FieldLabel htmlFor={`variant-price-${index}`}>Sale price</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>
                        <InputGroupText>Rs</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        id={`variant-price-${index}`}
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        aria-invalid={!!variantErrors?.salePriceRs}
                        {...register(`variants.${index}.salePriceRs`)}
                      />
                    </InputGroup>
                    <FieldError errors={[variantErrors?.salePriceRs]} />
                  </Field>
                  <Field data-invalid={!!variantErrors?.reorderLevel}>
                    <FieldLabel htmlFor={`variant-reorder-${index}`}>
                      Reorder at
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id={`variant-reorder-${index}`}
                        type="number"
                        min={0}
                        step={reorderStep}
                        aria-invalid={!!variantErrors?.reorderLevel}
                        {...register(`variants.${index}.reorderLevel`)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>{reorderSuffix}</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldError errors={[variantErrors?.reorderLevel]} />
                  </Field>
                  {record ? (
                    <p className="text-muted-foreground sm:col-span-4 text-xs">
                      Stock {formatQuantity(record.quantityMilli, unit)} · Cost{' '}
                      {formatRs(record.avgCostRs)}
                    </p>
                  ) : (
                    <p className="text-muted-foreground sm:col-span-4 text-xs">
                      Stock starts at zero until a purchase is received.
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 sm:col-span-2">
                    <FieldLabel
                      htmlFor={`variant-active-${index}`}
                      className="flex items-center gap-2"
                    >
                      <Controller
                        name={`variants.${index}.isActive`}
                        control={control}
                        render={({ field: activeField }) => (
                          <Checkbox
                            id={`variant-active-${index}`}
                            checked={activeField.value}
                            onCheckedChange={(checked) =>
                              activeField.onChange(checked === true)
                            }
                          />
                        )}
                      />
                      Active
                    </FieldLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={variants.fields.length === 1}
                      onClick={() => variants.remove(index)}
                      aria-label="Remove variant"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save product'}
        </Button>
      </div>
    </form>
  )
}

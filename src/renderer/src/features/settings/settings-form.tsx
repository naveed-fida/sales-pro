import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import {
  saveSettingsSchema,
  type AppSettings,
  type Printer,
  type SaveSettingsInput,
} from '@shared/schemas/settings'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { downscaleProductImage } from '@/features/products/downscale-image'
import { ProductImage } from '@/features/products/product-image'
import { settingsQueryKey } from './use-settings'

/** Radix Select forbids an empty item value, so "system default" needs a sentinel. */
const SYSTEM_PRINTER = '__system_default__'

type SettingsFormValues = Omit<AppSettings, 'shopLogo'>

function printerOptions(printers: Printer[], savedName: string): Printer[] {
  if (!savedName || printers.some((printer) => printer.name === savedName)) {
    return printers
  }

  return [
    ...printers,
    {
      name: savedName,
      displayName: `${savedName} (unavailable)`,
    },
  ]
}

export function SettingsForm({
  settings,
  printers,
  printersError,
  printersPending,
}: {
  settings: AppSettings
  printers: Printer[]
  printersError: boolean
  printersPending: boolean
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const options = printerOptions(printers, settings.printerName)

  const form = useForm<SaveSettingsInput, unknown, SettingsFormValues>({
    resolver: zodResolver(saveSettingsSchema),
    defaultValues: settings,
  })

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form

  const [pendingBytes, setPendingBytes] = useState<Uint8Array<ArrayBuffer> | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [removeSaved, setRemoveSaved] = useState(false)
  const [readingLogo, setReadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    }
  }, [pendingPreview])

  function discardPendingPreview(): void {
    setPendingBytes(null)
    setPendingPreview((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    setRemoveSaved(false)
  }

  async function onSubmit(values: SettingsFormValues): Promise<void> {
    const result = await window.api.settings.save(values)

    if (!result.ok) {
      if (result.error.field && result.error.field in values) {
        setError(result.error.field as keyof SettingsFormValues, {
          type: 'server',
          message: result.error.message,
        })
        return
      }

      toast.error(result.error.message)
      return
    }

    let saved = result.data

    if (pendingBytes) {
      const logoResult = await window.api.settings.saveLogo({ bytes: pendingBytes })
      if (!logoResult.ok) {
        queryClient.setQueryData(settingsQueryKey, saved)
        toast.success('Settings saved')
        toast.error(logoResult.error.message)
        return
      }
      saved = logoResult.data
    } else if (removeSaved && settings.shopLogo) {
      const cleared = await window.api.settings.clearLogo()
      if (!cleared.ok) {
        queryClient.setQueryData(settingsQueryKey, saved)
        toast.success('Settings saved')
        toast.error(cleared.error.message)
        return
      }
      saved = cleared.data
    }

    discardPendingPreview()
    queryClient.setQueryData(settingsQueryKey, saved)
    toast.success('Settings saved')
  }

  async function onLogoChosen(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setReadingLogo(true)
    try {
      const bytes = await downscaleProductImage(file)
      setPendingBytes(bytes)
      setPendingPreview((current) => {
        if (current) URL.revokeObjectURL(current)
        return URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }))
      })
      setRemoveSaved(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read that image.')
    } finally {
      setReadingLogo(false)
    }
  }

  function clearLogo(): void {
    setPendingBytes(null)
    setPendingPreview((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    setRemoveSaved(true)
  }

  return (
    <form
      className="flex max-w-xl flex-col gap-6"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <Card>
        <CardHeader>
          <CardTitle>Shop</CardTitle>
          <CardDescription>
            Logo in the app header. Name, address, and phone print at the top of receipts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="flex items-start gap-4">
              <ProductImage
                fileName={removeSaved ? null : settings.shopLogo || null}
                previewUrl={pendingPreview}
                alt={settings.shopName || 'Shop logo'}
                fit="contain"
                className="size-24 shrink-0 rounded-xl bg-background ring-1 ring-foreground/10"
              />
              <Field>
                <FieldLabel>Logo</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={readingLogo}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus />
                    {readingLogo
                      ? 'Reading…'
                      : pendingPreview || (settings.shopLogo && !removeSaved)
                        ? 'Change'
                        : 'Add logo'}
                  </Button>
                  {pendingPreview || (settings.shopLogo && !removeSaved) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={readingLogo}
                      onClick={clearLogo}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <FieldDescription>
                  JPEG, PNG or WebP. Shown in the header. Shrunk on this computer before
                  saving.
                </FieldDescription>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => void onLogoChosen(event)}
                />
              </Field>
            </div>
            <Field data-invalid={!!errors.shopName}>
              <FieldLabel htmlFor="shopName">Shop name</FieldLabel>
              <Input
                id="shopName"
                autoComplete="organization"
                aria-invalid={!!errors.shopName}
                {...register('shopName')}
              />
              <FieldError errors={[errors.shopName]} />
            </Field>
            <Field data-invalid={!!errors.shopAddress}>
              <FieldLabel htmlFor="shopAddress">Address</FieldLabel>
              <Textarea
                id="shopAddress"
                rows={3}
                aria-invalid={!!errors.shopAddress}
                {...register('shopAddress')}
              />
              <FieldError errors={[errors.shopAddress]} />
            </Field>
            <Field data-invalid={!!errors.shopPhone}>
              <FieldLabel htmlFor="shopPhone">Phone</FieldLabel>
              <Input
                id="shopPhone"
                type="tel"
                autoComplete="tel"
                aria-invalid={!!errors.shopPhone}
                {...register('shopPhone')}
              />
              <FieldError errors={[errors.shopPhone]} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receipts</CardTitle>
          <CardDescription>
            Footer text and the 80mm thermal printer used when a sale or return completes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={!!errors.receiptFooter}>
              <FieldLabel htmlFor="receiptFooter">Footer</FieldLabel>
              <Textarea
                id="receiptFooter"
                rows={3}
                aria-invalid={!!errors.receiptFooter}
                {...register('receiptFooter')}
              />
              <FieldError errors={[errors.receiptFooter]} />
            </Field>
            <Field data-invalid={!!errors.printerName}>
              <FieldLabel htmlFor="printerName">Printer</FieldLabel>
              <Controller
                name="printerName"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value === '' ? SYSTEM_PRINTER : field.value}
                    onValueChange={(value) =>
                      field.onChange(value === SYSTEM_PRINTER ? '' : value)
                    }
                    disabled={printersPending}
                  >
                    <SelectTrigger
                      id="printerName"
                      className="w-full"
                      aria-invalid={!!errors.printerName}
                    >
                      <SelectValue
                        placeholder={
                          printersPending ? 'Loading printers…' : 'System default'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SYSTEM_PRINTER}>System default</SelectItem>
                      {options.map((printer) => (
                        <SelectItem key={printer.name} value={printer.name}>
                          {printer.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {printersError ? (
                <FieldDescription>
                  Could not list printers. Shop details can still be saved; receipts will
                  use the system default until a printer is chosen.
                </FieldDescription>
              ) : printersPending ? (
                <FieldDescription>Looking up printers on this computer…</FieldDescription>
              ) : options.length === 0 ? (
                <FieldDescription>
                  No printers found. Receipts will use the system default.
                </FieldDescription>
              ) : (
                <FieldDescription>
                  Leave as system default if this computer has only one printer.
                </FieldDescription>
              )}
              <FieldError errors={[errors.printerName]} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock</CardTitle>
          <CardDescription>
            Default low-stock level for new piece items. Variants can override this later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field data-invalid={!!errors.defaultReorderPieces}>
            <FieldLabel htmlFor="defaultReorderPieces">Reorder at</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="defaultReorderPieces"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                aria-invalid={!!errors.defaultReorderPieces}
                {...register('defaultReorderPieces')}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>pieces</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>
              New products start at this quantity. Cloth items set their own length when
              they are created.
            </FieldDescription>
            <FieldError errors={[errors.defaultReorderPieces]} />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={isSubmitting || readingLogo}>
            {isSubmitting ? 'Saving…' : 'Save settings'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

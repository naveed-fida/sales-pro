import { z } from 'zod'

export const SETTING_KEYS = {
  shopName: 'shopName',
  shopAddress: 'shopAddress',
  shopPhone: 'shopPhone',
  receiptFooter: 'receiptFooter',
  printerName: 'printerName',
  defaultReorderLevelMilli: 'defaultReorderLevelMilli',
} as const

export const appSettingsSchema = z.object({
  shopName: z.string(),
  shopAddress: z.string(),
  shopPhone: z.string(),
  receiptFooter: z.string(),
  printerName: z.string(),
  defaultReorderPieces: z.number().int().nonnegative(),
})

export const saveSettingsSchema = z.object({
  shopName: z
    .string()
    .trim()
    .min(1, 'Shop name is required')
    .max(120, 'Name is too long'),
  shopAddress: z.string().trim().max(500, 'Address is too long'),
  shopPhone: z.string().trim().max(40, 'Phone is too long'),
  receiptFooter: z.string().trim().max(500, 'Footer is too long'),
  printerName: z.string(),
  defaultReorderPieces: z.coerce
    .number()
    .int('Whole pieces only')
    .nonnegative('Cannot be negative')
    .max(1_000_000, 'That number is too large'),
})

export const printerSchema = z.object({
  name: z.string(),
  displayName: z.string(),
})

export const DEFAULT_SETTINGS: AppSettings = {
  shopName: '',
  shopAddress: '',
  shopPhone: '',
  receiptFooter: 'Thank you',
  printerName: '',
  defaultReorderPieces: 5,
}

export type AppSettings = z.infer<typeof appSettingsSchema>
export type SaveSettingsInput = z.input<typeof saveSettingsSchema>
export type Printer = z.infer<typeof printerSchema>

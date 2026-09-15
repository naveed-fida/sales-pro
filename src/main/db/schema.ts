import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const createdAtDefault = sql`(unixepoch())`

export const categories = sqliteTable(
  'categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(createdAtDefault),
  },
  (table) => [index('categories_name_idx').on(table.name)],
)

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id),
    name: text('name').notNull(),
    unit: text('unit', { enum: ['piece', 'meter', 'yard'] }).notNull(),
    description: text('description'),
    imagePath: text('image_path'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(createdAtDefault),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(createdAtDefault),
  },
  (table) => [
    index('products_name_idx').on(table.name),
    index('products_category_id_idx').on(table.categoryId),
  ],
)

export const productVariants = sqliteTable(
  'product_variants',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    barcode: text('barcode').notNull().unique(),
    size: text('size'),
    colour: text('colour'),
    salePriceRs: integer('sale_price_rs').notNull().default(0),
    avgCostRs: integer('avg_cost_rs').notNull().default(0),
    quantityMilli: integer('quantity_milli').notNull().default(0),
    reorderLevelMilli: integer('reorder_level_milli').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(createdAtDefault),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(createdAtDefault),
  },
  (table) => [
    index('product_variants_product_id_idx').on(table.productId),
    index('product_variants_barcode_idx').on(table.barcode),
  ],
)

export const suppliers = sqliteTable(
  'suppliers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    phone: text('phone'),
    address: text('address'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(createdAtDefault),
  },
  (table) => [index('suppliers_name_idx').on(table.name)],
)

export const purchases = sqliteTable(
  'purchases',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    supplierId: integer('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    purchasedAt: integer('purchased_at', { mode: 'timestamp' }).notNull(),
    discountRs: integer('discount_rs').notNull().default(0),
    totalRs: integer('total_rs').notNull(),
    note: text('note'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(createdAtDefault),
  },
  (table) => [
    index('purchases_supplier_id_idx').on(table.supplierId),
    index('purchases_purchased_at_idx').on(table.purchasedAt),
  ],
)

export const purchaseItems = sqliteTable(
  'purchase_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    purchaseId: integer('purchase_id')
      .notNull()
      .references(() => purchases.id, { onDelete: 'cascade' }),
    variantId: integer('variant_id')
      .notNull()
      .references(() => productVariants.id),
    quantityMilli: integer('quantity_milli').notNull(),
    unitCostRs: integer('unit_cost_rs').notNull(),
    discountRs: integer('discount_rs').notNull().default(0),
    lineTotalRs: integer('line_total_rs').notNull(),
  },
  (table) => [
    index('purchase_items_purchase_id_idx').on(table.purchaseId),
    index('purchase_items_variant_id_idx').on(table.variantId),
  ],
)

export const sales = sqliteTable(
  'sales',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    billNo: integer('bill_no').notNull().unique(),
    phone: text('phone'),
    status: text('status', {
      enum: ['completed', 'partially_returned', 'returned'],
    })
      .notNull()
      .default('completed'),
    discountRs: integer('discount_rs').notNull().default(0),
    totalRs: integer('total_rs').notNull(),
    tenderedRs: integer('tendered_rs').notNull(),
    changeRs: integer('change_rs').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(createdAtDefault),
  },
  (table) => [
    index('sales_bill_no_idx').on(table.billNo),
    index('sales_created_at_idx').on(table.createdAt),
    index('sales_phone_idx').on(table.phone),
  ],
)

export const saleItems = sqliteTable(
  'sale_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    saleId: integer('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    variantId: integer('variant_id')
      .notNull()
      .references(() => productVariants.id),
    quantityMilli: integer('quantity_milli').notNull(),
    unitPriceRs: integer('unit_price_rs').notNull(),
    lineDiscountRs: integer('line_discount_rs').notNull().default(0),
    lineTotalRs: integer('line_total_rs').notNull(),
    unitCostRs: integer('unit_cost_rs').notNull(),
  },
  (table) => [
    index('sale_items_sale_id_idx').on(table.saleId),
    index('sale_items_variant_id_idx').on(table.variantId),
  ],
)

export const heldSales = sqliteTable(
  'held_sales',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    phone: text('phone'),
    note: text('note'),
    discountRs: integer('discount_rs').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(createdAtDefault),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(createdAtDefault),
  },
  (table) => [index('held_sales_created_at_idx').on(table.createdAt)],
)

export const heldSaleItems = sqliteTable(
  'held_sale_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    heldSaleId: integer('held_sale_id')
      .notNull()
      .references(() => heldSales.id, { onDelete: 'cascade' }),
    variantId: integer('variant_id')
      .notNull()
      .references(() => productVariants.id),
    quantityMilli: integer('quantity_milli').notNull(),
    unitPriceRs: integer('unit_price_rs').notNull(),
    lineDiscountRs: integer('line_discount_rs').notNull().default(0),
  },
  (table) => [
    index('held_sale_items_held_sale_id_idx').on(table.heldSaleId),
    index('held_sale_items_variant_id_idx').on(table.variantId),
  ],
)

export const salesReturns = sqliteTable(
  'sales_returns',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    saleId: integer('sale_id')
      .notNull()
      .references(() => sales.id),
    totalRs: integer('total_rs').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(createdAtDefault),
  },
  (table) => [index('sales_returns_sale_id_idx').on(table.saleId)],
)

export const returnItems = sqliteTable(
  'return_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    returnId: integer('return_id')
      .notNull()
      .references(() => salesReturns.id, { onDelete: 'cascade' }),
    saleItemId: integer('sale_item_id')
      .notNull()
      .references(() => saleItems.id),
    variantId: integer('variant_id')
      .notNull()
      .references(() => productVariants.id),
    quantityMilli: integer('quantity_milli').notNull(),
    unitPriceRs: integer('unit_price_rs').notNull(),
    lineTotalRs: integer('line_total_rs').notNull(),
  },
  (table) => [
    index('return_items_return_id_idx').on(table.returnId),
    index('return_items_sale_item_id_idx').on(table.saleItemId),
  ],
)

export const stockMovements = sqliteTable(
  'stock_movements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    variantId: integer('variant_id')
      .notNull()
      .references(() => productVariants.id),
    quantityMilli: integer('quantity_milli').notNull(),
    reason: text('reason', {
      enum: ['opening', 'purchase', 'sale', 'return', 'adjustment'],
    }).notNull(),
    sourceTable: text('source_table'),
    sourceId: integer('source_id'),
    note: text('note'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(createdAtDefault),
  },
  (table) => [
    index('stock_movements_variant_id_idx').on(table.variantId),
    index('stock_movements_created_at_idx').on(table.createdAt),
  ],
)

export const expenses = sqliteTable(
  'expenses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    category: text('category').notNull(),
    amountRs: integer('amount_rs').notNull(),
    incurredAt: integer('incurred_at', { mode: 'timestamp' }).notNull(),
    note: text('note'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(createdAtDefault),
  },
  (table) => [
    index('expenses_incurred_at_idx').on(table.incurredAt),
    index('expenses_category_idx').on(table.category),
  ],
)

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

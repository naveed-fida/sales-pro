CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE INDEX `categories_name_idx` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`amount_rs` integer NOT NULL,
	`incurred_at` integer NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expenses_incurred_at_idx` ON `expenses` (`incurred_at`);--> statement-breakpoint
CREATE INDEX `expenses_category_idx` ON `expenses` (`category`);--> statement-breakpoint
CREATE TABLE `held_sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`held_sale_id` integer NOT NULL,
	`variant_id` integer NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_price_rs` integer NOT NULL,
	`line_discount_rs` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`held_sale_id`) REFERENCES `held_sales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `held_sale_items_held_sale_id_idx` ON `held_sale_items` (`held_sale_id`);--> statement-breakpoint
CREATE INDEX `held_sale_items_variant_id_idx` ON `held_sale_items` (`variant_id`);--> statement-breakpoint
CREATE TABLE `held_sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone` text,
	`note` text,
	`discount_rs` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `held_sales_created_at_idx` ON `held_sales` (`created_at`);--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`barcode` text NOT NULL,
	`size` text,
	`colour` text,
	`sale_price_rs` integer DEFAULT 0 NOT NULL,
	`avg_cost_rs` integer DEFAULT 0 NOT NULL,
	`quantity_milli` integer DEFAULT 0 NOT NULL,
	`reorder_level_milli` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_barcode_unique` ON `product_variants` (`barcode`);--> statement-breakpoint
CREATE INDEX `product_variants_product_id_idx` ON `product_variants` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_variants_barcode_idx` ON `product_variants` (`barcode`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`description` text,
	`image_path` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `products_name_idx` ON `products` (`name`);--> statement-breakpoint
CREATE INDEX `products_category_id_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE TABLE `purchase_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_id` integer NOT NULL,
	`variant_id` integer NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_cost_rs` integer NOT NULL,
	`discount_rs` integer DEFAULT 0 NOT NULL,
	`line_total_rs` integer NOT NULL,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `purchase_items_purchase_id_idx` ON `purchase_items` (`purchase_id`);--> statement-breakpoint
CREATE INDEX `purchase_items_variant_id_idx` ON `purchase_items` (`variant_id`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer NOT NULL,
	`purchased_at` integer NOT NULL,
	`discount_rs` integer DEFAULT 0 NOT NULL,
	`total_rs` integer NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `purchases_supplier_id_idx` ON `purchases` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `purchases_purchased_at_idx` ON `purchases` (`purchased_at`);--> statement-breakpoint
CREATE TABLE `return_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`return_id` integer NOT NULL,
	`sale_item_id` integer NOT NULL,
	`variant_id` integer NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_price_rs` integer NOT NULL,
	`line_total_rs` integer NOT NULL,
	FOREIGN KEY (`return_id`) REFERENCES `sales_returns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `return_items_return_id_idx` ON `return_items` (`return_id`);--> statement-breakpoint
CREATE INDEX `return_items_sale_item_id_idx` ON `return_items` (`sale_item_id`);--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`variant_id` integer NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_price_rs` integer NOT NULL,
	`line_discount_rs` integer DEFAULT 0 NOT NULL,
	`line_total_rs` integer NOT NULL,
	`unit_cost_rs` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sale_items_sale_id_idx` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_items_variant_id_idx` ON `sale_items` (`variant_id`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bill_no` integer NOT NULL,
	`phone` text,
	`status` text DEFAULT 'completed' NOT NULL,
	`discount_rs` integer DEFAULT 0 NOT NULL,
	`total_rs` integer NOT NULL,
	`tendered_rs` integer NOT NULL,
	`change_rs` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_bill_no_unique` ON `sales` (`bill_no`);--> statement-breakpoint
CREATE INDEX `sales_bill_no_idx` ON `sales` (`bill_no`);--> statement-breakpoint
CREATE INDEX `sales_created_at_idx` ON `sales` (`created_at`);--> statement-breakpoint
CREATE INDEX `sales_phone_idx` ON `sales` (`phone`);--> statement-breakpoint
CREATE TABLE `sales_returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`total_rs` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sales_returns_sale_id_idx` ON `sales_returns` (`sale_id`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`variant_id` integer NOT NULL,
	`quantity_milli` integer NOT NULL,
	`reason` text NOT NULL,
	`source_table` text,
	`source_id` integer,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `stock_movements_variant_id_idx` ON `stock_movements` (`variant_id`);--> statement-breakpoint
CREATE INDEX `stock_movements_created_at_idx` ON `stock_movements` (`created_at`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`address` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `suppliers_name_idx` ON `suppliers` (`name`);
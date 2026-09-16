CREATE TABLE `return_exchange_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`return_id` integer NOT NULL,
	`variant_id` integer NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_price_rs` integer NOT NULL,
	`line_discount_rs` integer DEFAULT 0 NOT NULL,
	`line_total_rs` integer NOT NULL,
	`unit_cost_rs` integer NOT NULL,
	FOREIGN KEY (`return_id`) REFERENCES `sales_returns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `return_exchange_items_return_id_idx` ON `return_exchange_items` (`return_id`);--> statement-breakpoint
CREATE INDEX `return_exchange_items_variant_id_idx` ON `return_exchange_items` (`variant_id`);--> statement-breakpoint
ALTER TABLE `sales_returns` ADD `exchange_total_rs` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_returns` ADD `tendered_rs` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_returns` ADD `change_rs` integer DEFAULT 0 NOT NULL;
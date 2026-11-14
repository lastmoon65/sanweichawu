-- CreateTable
CREATE TABLE `stores` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    `business_day_cutoff_minute` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `openid` VARCHAR(128) NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_openid_key`(`openid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `store_id` BIGINT NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `role` ENUM('OWNER', 'MANAGER', 'STAFF') NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `store_id` BIGINT NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_store_id_name_key`(`store_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `store_id` BIGINT NOT NULL,
    `category_id` BIGINT NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `image_url` VARCHAR(512) NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `products_category_id_status_sort_order_idx`(`category_id`, `status`, `sort_order`),
    UNIQUE INDEX `products_store_id_name_key`(`store_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_variants` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `price_fen` BIGINT NOT NULL,
    `inventory_mode` ENUM('MANAGED', 'UNMANAGED') NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `product_variants_product_id_status_sort_order_idx`(`product_id`, `status`, `sort_order`),
    UNIQUE INDEX `product_variants_product_id_name_key`(`product_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `variant_option_groups` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `variant_id` BIGINT NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `selection_type` ENUM('SINGLE', 'MULTI') NOT NULL,
    `required` BOOLEAN NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL,

    UNIQUE INDEX `variant_option_groups_variant_id_name_key`(`variant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `variant_option_values` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `option_group_id` BIGINT NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `price_delta_fen` BIGINT NOT NULL DEFAULT 0,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL,

    UNIQUE INDEX `variant_option_values_option_group_id_name_key`(`option_group_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `variant_recipes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `variant_id` BIGINT NOT NULL,
    `material_id` BIGINT NOT NULL,
    `role` ENUM('BASE', 'TAKEAWAY_EXTRA') NOT NULL,
    `quantity` DECIMAL(18, 3) NOT NULL,

    UNIQUE INDEX `variant_recipes_variant_id_material_id_role_key`(`variant_id`, `material_id`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recipe_modifiers` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `variant_id` BIGINT NOT NULL,
    `option_value_id` BIGINT NOT NULL,
    `material_id` BIGINT NOT NULL,
    `target_role` ENUM('BASE', 'TAKEAWAY_EXTRA') NOT NULL,
    `quantity_delta` DECIMAL(18, 3) NOT NULL,

    INDEX `recipe_modifiers_option_value_id_idx`(`option_value_id`),
    UNIQUE INDEX `recipe_modifiers_variant_id_option_value_id_material_id_targ_key`(`variant_id`, `option_value_id`, `material_id`, `target_role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `materials` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `store_id` BIGINT NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `unit` VARCHAR(20) NOT NULL,
    `on_hand` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `reserved` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `average_cost_per_unit` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `materials_store_id_status_idx`(`store_id`, `status`),
    UNIQUE INDEX `materials_store_id_name_key`(`store_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `dedupe_key` VARCHAR(160) NOT NULL,
    `store_id` BIGINT NOT NULL,
    `material_id` BIGINT NOT NULL,
    `movement_type` ENUM('OPENING_BALANCE', 'STOCK_IN', 'RESERVE', 'RELEASE', 'CONSUME', 'ADJUST') NOT NULL,
    `quantity_delta` DECIMAL(18, 3) NOT NULL,
    `reserved_delta` DECIMAL(18, 3) NOT NULL,
    `on_hand_after` DECIMAL(18, 3) NOT NULL,
    `reserved_after` DECIMAL(18, 3) NOT NULL,
    `unit_cost_snapshot` DECIMAL(18, 6) NULL,
    `total_cost_snapshot` DECIMAL(18, 6) NULL,
    `order_id` BIGINT NULL,
    `order_item_id` BIGINT NULL,
    `operator_staff_id` BIGINT NULL,
    `reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stock_movements_dedupe_key_key`(`dedupe_key`),
    INDEX `stock_movements_material_id_created_at_idx`(`material_id`, `created_at`),
    INDEX `stock_movements_order_id_movement_type_idx`(`order_id`, `movement_type`),
    INDEX `stock_movements_store_id_movement_type_created_at_idx`(`store_id`, `movement_type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loss_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `dedupe_key` VARCHAR(160) NOT NULL,
    `store_id` BIGINT NOT NULL,
    `material_id` BIGINT NOT NULL,
    `order_id` BIGINT NULL,
    `order_item_id` BIGINT NULL,
    `stock_movement_id` BIGINT NULL,
    `quantity` DECIMAL(18, 3) NOT NULL,
    `unit_cost_snapshot` DECIMAL(18, 6) NOT NULL,
    `loss_cost_snapshot` DECIMAL(18, 6) NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `operator_staff_id` BIGINT NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `loss_records_dedupe_key_key`(`dedupe_key`),
    UNIQUE INDEX `loss_records_stock_movement_id_key`(`stock_movement_id`),
    INDEX `loss_records_material_id_occurred_at_idx`(`material_id`, `occurred_at`),
    INDEX `loss_records_store_id_occurred_at_idx`(`store_id`, `occurred_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dining_tables` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `store_id` BIGINT NOT NULL,
    `name` VARCHAR(40) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dining_tables_store_id_code_key`(`store_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dining_sessions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `store_id` BIGINT NOT NULL,
    `table_id` BIGINT NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `opened_at` DATETIME(3) NOT NULL,
    `closed_at` DATETIME(3) NULL,
    `closed_by_staff_id` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dining_sessions_table_id_status_idx`(`table_id`, `status`),
    INDEX `dining_sessions_store_id_status_opened_at_idx`(`store_id`, `status`, `opened_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `store_id` BIGINT NOT NULL,
    `customer_user_id` BIGINT NOT NULL,
    `order_no` VARCHAR(40) NOT NULL,
    `idempotency_key` VARCHAR(160) NOT NULL,
    `channel` ENUM('DINE', 'TAKEAWAY') NOT NULL,
    `session_id` BIGINT NULL,
    `status` ENUM('PENDING_ACCEPTANCE', 'ACCEPTED', 'PREPARING', 'COMPLETED', 'CANCELLED') NOT NULL,
    `subtotal_fen` BIGINT NOT NULL,
    `total_amount_fen` BIGINT NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `accepted_at` DATETIME(3) NULL,
    `preparing_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancel_reason` VARCHAR(500) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_order_no_key`(`order_no`),
    UNIQUE INDEX `orders_idempotency_key_key`(`idempotency_key`),
    INDEX `orders_store_id_status_created_at_idx`(`store_id`, `status`, `created_at`),
    INDEX `orders_session_id_status_idx`(`session_id`, `status`),
    INDEX `orders_customer_user_id_created_at_idx`(`customer_user_id`, `created_at`),
    INDEX `orders_completed_at_idx`(`completed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT NOT NULL,
    `product_id` BIGINT NOT NULL,
    `variant_id` BIGINT NOT NULL,
    `product_name_snapshot` VARCHAR(120) NOT NULL,
    `variant_name_snapshot` VARCHAR(80) NOT NULL,
    `unit_price_fen` BIGINT NOT NULL,
    `quantity` INTEGER NOT NULL,
    `line_subtotal_fen` BIGINT NOT NULL,
    `remark` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_items_order_id_idx`(`order_id`),
    INDEX `order_items_product_id_created_at_idx`(`product_id`, `created_at`),
    INDEX `order_items_variant_id_created_at_idx`(`variant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item_options` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_item_id` BIGINT NOT NULL,
    `option_value_id` BIGINT NOT NULL,
    `group_name_snapshot` VARCHAR(80) NOT NULL,
    `value_name_snapshot` VARCHAR(80) NOT NULL,
    `price_delta_fen_snapshot` BIGINT NOT NULL,

    INDEX `order_item_options_option_value_id_idx`(`option_value_id`),
    UNIQUE INDEX `order_item_options_order_item_id_option_value_id_key`(`order_item_id`, `option_value_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item_materials` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_item_id` BIGINT NOT NULL,
    `material_id` BIGINT NOT NULL,
    `material_name_snapshot` VARCHAR(120) NOT NULL,
    `unit_snapshot` VARCHAR(20) NOT NULL,
    `quantity_per_item` DECIMAL(18, 3) NOT NULL,
    `total_quantity` DECIMAL(18, 3) NOT NULL,
    `actual_unit_cost_snapshot` DECIMAL(18, 6) NULL,
    `actual_total_cost_snapshot` DECIMAL(18, 6) NULL,
    `source` ENUM('BASE', 'TAKEAWAY_EXTRA', 'MODIFIER') NOT NULL,

    INDEX `order_item_materials_material_id_idx`(`material_id`),
    UNIQUE INDEX `order_item_materials_order_item_id_material_id_source_key`(`order_item_id`, `material_id`, `source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `payment_no` VARCHAR(64) NOT NULL,
    `idempotency_key` VARCHAR(160) NOT NULL,
    `store_id` BIGINT NOT NULL,
    `session_id` BIGINT NULL,
    `order_id` BIGINT NULL,
    `payment_method` ENUM('CASH', 'WECHAT', 'ALIPAY', 'POS', 'OTHER') NOT NULL,
    `amount_fen` BIGINT NOT NULL,
    `received_at` DATETIME(3) NOT NULL,
    `operator_staff_id` BIGINT NULL,
    `status` ENUM('ACTIVE', 'VOIDED') NOT NULL,
    `remark` VARCHAR(500) NULL,
    `voided_at` DATETIME(3) NULL,
    `voided_by_staff_id` BIGINT NULL,
    `void_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_records_payment_no_key`(`payment_no`),
    UNIQUE INDEX `payment_records_idempotency_key_key`(`idempotency_key`),
    INDEX `payment_records_store_id_status_received_at_idx`(`store_id`, `status`, `received_at`),
    INDEX `payment_records_session_id_status_idx`(`session_id`, `status`),
    INDEX `payment_records_order_id_status_idx`(`order_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refund_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `refund_no` VARCHAR(64) NOT NULL,
    `idempotency_key` VARCHAR(160) NOT NULL,
    `payment_record_id` BIGINT NOT NULL,
    `amount_fen` BIGINT NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `status` ENUM('ACTIVE', 'VOIDED') NOT NULL,
    `refunded_at` DATETIME(3) NOT NULL,
    `operator_staff_id` BIGINT NULL,
    `voided_at` DATETIME(3) NULL,
    `voided_by_staff_id` BIGINT NULL,
    `void_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `refund_records_refund_no_key`(`refund_no`),
    UNIQUE INDEX `refund_records_idempotency_key_key`(`idempotency_key`),
    INDEX `refund_records_payment_record_id_status_refunded_at_idx`(`payment_record_id`, `status`, `refunded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `staff` ADD CONSTRAINT `staff_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variant_option_groups` ADD CONSTRAINT `variant_option_groups_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variant_option_values` ADD CONSTRAINT `variant_option_values_option_group_id_fkey` FOREIGN KEY (`option_group_id`) REFERENCES `variant_option_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variant_recipes` ADD CONSTRAINT `variant_recipes_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variant_recipes` ADD CONSTRAINT `variant_recipes_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recipe_modifiers` ADD CONSTRAINT `recipe_modifiers_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recipe_modifiers` ADD CONSTRAINT `recipe_modifiers_option_value_id_fkey` FOREIGN KEY (`option_value_id`) REFERENCES `variant_option_values`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recipe_modifiers` ADD CONSTRAINT `recipe_modifiers_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materials` ADD CONSTRAINT `materials_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_operator_staff_id_fkey` FOREIGN KEY (`operator_staff_id`) REFERENCES `staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loss_records` ADD CONSTRAINT `loss_records_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loss_records` ADD CONSTRAINT `loss_records_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loss_records` ADD CONSTRAINT `loss_records_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loss_records` ADD CONSTRAINT `loss_records_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loss_records` ADD CONSTRAINT `loss_records_stock_movement_id_fkey` FOREIGN KEY (`stock_movement_id`) REFERENCES `stock_movements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loss_records` ADD CONSTRAINT `loss_records_operator_staff_id_fkey` FOREIGN KEY (`operator_staff_id`) REFERENCES `staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dining_tables` ADD CONSTRAINT `dining_tables_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dining_sessions` ADD CONSTRAINT `dining_sessions_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dining_sessions` ADD CONSTRAINT `dining_sessions_table_id_fkey` FOREIGN KEY (`table_id`) REFERENCES `dining_tables`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dining_sessions` ADD CONSTRAINT `dining_sessions_closed_by_staff_id_fkey` FOREIGN KEY (`closed_by_staff_id`) REFERENCES `staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_user_id_fkey` FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `dining_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_options` ADD CONSTRAINT `order_item_options_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_options` ADD CONSTRAINT `order_item_options_option_value_id_fkey` FOREIGN KEY (`option_value_id`) REFERENCES `variant_option_values`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_materials` ADD CONSTRAINT `order_item_materials_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_item_materials` ADD CONSTRAINT `order_item_materials_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_records` ADD CONSTRAINT `payment_records_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_records` ADD CONSTRAINT `payment_records_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `dining_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_records` ADD CONSTRAINT `payment_records_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_records` ADD CONSTRAINT `payment_records_operator_staff_id_fkey` FOREIGN KEY (`operator_staff_id`) REFERENCES `staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_records` ADD CONSTRAINT `payment_records_voided_by_staff_id_fkey` FOREIGN KEY (`voided_by_staff_id`) REFERENCES `staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refund_records` ADD CONSTRAINT `refund_records_payment_record_id_fkey` FOREIGN KEY (`payment_record_id`) REFERENCES `payment_records`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refund_records` ADD CONSTRAINT `refund_records_operator_staff_id_fkey` FOREIGN KEY (`operator_staff_id`) REFERENCES `staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refund_records` ADD CONSTRAINT `refund_records_voided_by_staff_id_fkey` FOREIGN KEY (`voided_by_staff_id`) REFERENCES `staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

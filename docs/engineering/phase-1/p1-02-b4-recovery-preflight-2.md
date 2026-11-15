# P1-02-B4 第二次失败后的恢复只读预检

检查时间：2026-11-15 18:13:13 +08:00（Asia/Shanghai）

当前 Git 基线：`a5641f29e8338a8b339f450ea3e195836c5c1cf9`

状态：只读检查完成。本批未执行 DDL、DML、`migrate resolve` 或 `migrate deploy`。

## 1. 当前数据库

| 项目 | 实际值 |
| --- | --- |
| database | `sanweichawu_b4_main_20261114t152855z` |
| version | `8.4.13` |
| versionComment | `MySQL Community Server - GPL` |
| charset | `utf8mb4` |
| collation | `utf8mb4_unicode_ci` |
| timezone | `UTC` |
| sqlMode | `ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION` |

业务表：**21**；物理字段：**202**；外键：**46**；CHECK：**0**。

## 2. 21 张业务表

| 表 | Engine | Collation |
| --- | --- | --- |
| `categories` | `InnoDB` | `utf8mb4_unicode_ci` |
| `dining_sessions` | `InnoDB` | `utf8mb4_unicode_ci` |
| `dining_tables` | `InnoDB` | `utf8mb4_unicode_ci` |
| `loss_records` | `InnoDB` | `utf8mb4_unicode_ci` |
| `materials` | `InnoDB` | `utf8mb4_unicode_ci` |
| `order_item_materials` | `InnoDB` | `utf8mb4_unicode_ci` |
| `order_item_options` | `InnoDB` | `utf8mb4_unicode_ci` |
| `order_items` | `InnoDB` | `utf8mb4_unicode_ci` |
| `orders` | `InnoDB` | `utf8mb4_unicode_ci` |
| `payment_records` | `InnoDB` | `utf8mb4_unicode_ci` |
| `product_variants` | `InnoDB` | `utf8mb4_unicode_ci` |
| `products` | `InnoDB` | `utf8mb4_unicode_ci` |
| `recipe_modifiers` | `InnoDB` | `utf8mb4_unicode_ci` |
| `refund_records` | `InnoDB` | `utf8mb4_unicode_ci` |
| `staff` | `InnoDB` | `utf8mb4_unicode_ci` |
| `stock_movements` | `InnoDB` | `utf8mb4_unicode_ci` |
| `stores` | `InnoDB` | `utf8mb4_unicode_ci` |
| `users` | `InnoDB` | `utf8mb4_unicode_ci` |
| `variant_option_groups` | `InnoDB` | `utf8mb4_unicode_ci` |
| `variant_option_values` | `InnoDB` | `utf8mb4_unicode_ci` |
| `variant_recipes` | `InnoDB` | `utf8mb4_unicode_ci` |

## 3. 202 个物理字段

| 表 | 序号 | 字段 | MySQL 类型 | 可空 | 默认值 |
| --- | ---: | --- | --- | --- | --- |
| `categories` | 6 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `categories` | 1 | `id` | `bigint` | NO |  |
| `categories` | 3 | `name` | `varchar(80)` | NO |  |
| `categories` | 4 | `sort_order` | `int` | NO | 0 |
| `categories` | 5 | `status` | `enum('ACTIVE','DISABLED')` | NO |  |
| `categories` | 2 | `store_id` | `bigint` | NO |  |
| `categories` | 7 | `updated_at` | `datetime(3)` | NO |  |
| `dining_sessions` | 7 | `closed_at` | `datetime(3)` | YES |  |
| `dining_sessions` | 8 | `closed_by_staff_id` | `bigint` | YES |  |
| `dining_sessions` | 9 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `dining_sessions` | 1 | `id` | `bigint` | NO |  |
| `dining_sessions` | 6 | `opened_at` | `datetime(3)` | NO |  |
| `dining_sessions` | 4 | `status` | `enum('OPEN','CLOSED')` | NO |  |
| `dining_sessions` | 2 | `store_id` | `bigint` | NO |  |
| `dining_sessions` | 3 | `table_id` | `bigint` | NO |  |
| `dining_sessions` | 10 | `updated_at` | `datetime(3)` | NO |  |
| `dining_sessions` | 5 | `version` | `int` | NO | 1 |
| `dining_tables` | 4 | `code` | `varchar(40)` | NO |  |
| `dining_tables` | 5 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `dining_tables` | 1 | `id` | `bigint` | NO |  |
| `dining_tables` | 3 | `name` | `varchar(40)` | NO |  |
| `dining_tables` | 2 | `store_id` | `bigint` | NO |  |
| `dining_tables` | 6 | `updated_at` | `datetime(3)` | NO |  |
| `loss_records` | 14 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `loss_records` | 2 | `dedupe_key` | `varchar(160)` | NO |  |
| `loss_records` | 1 | `id` | `bigint` | NO |  |
| `loss_records` | 10 | `loss_cost_snapshot` | `decimal(18,6)` | NO |  |
| `loss_records` | 4 | `material_id` | `bigint` | NO |  |
| `loss_records` | 13 | `occurred_at` | `datetime(3)` | NO |  |
| `loss_records` | 12 | `operator_staff_id` | `bigint` | YES |  |
| `loss_records` | 5 | `order_id` | `bigint` | YES |  |
| `loss_records` | 6 | `order_item_id` | `bigint` | YES |  |
| `loss_records` | 8 | `quantity` | `decimal(18,3)` | NO |  |
| `loss_records` | 11 | `reason` | `varchar(500)` | NO |  |
| `loss_records` | 7 | `stock_movement_id` | `bigint` | YES |  |
| `loss_records` | 3 | `store_id` | `bigint` | NO |  |
| `loss_records` | 9 | `unit_cost_snapshot` | `decimal(18,6)` | NO |  |
| `materials` | 7 | `average_cost_per_unit` | `decimal(18,6)` | NO | 0.000000 |
| `materials` | 10 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `materials` | 1 | `id` | `bigint` | NO |  |
| `materials` | 3 | `name` | `varchar(120)` | NO |  |
| `materials` | 5 | `on_hand` | `decimal(18,3)` | NO | 0.000 |
| `materials` | 6 | `reserved` | `decimal(18,3)` | NO | 0.000 |
| `materials` | 8 | `status` | `enum('ACTIVE','DISABLED')` | NO |  |
| `materials` | 2 | `store_id` | `bigint` | NO |  |
| `materials` | 4 | `unit` | `varchar(20)` | NO |  |
| `materials` | 11 | `updated_at` | `datetime(3)` | NO |  |
| `materials` | 9 | `version` | `int` | NO | 1 |
| `order_item_materials` | 9 | `actual_total_cost_snapshot` | `decimal(18,6)` | YES |  |
| `order_item_materials` | 8 | `actual_unit_cost_snapshot` | `decimal(18,6)` | YES |  |
| `order_item_materials` | 1 | `id` | `bigint` | NO |  |
| `order_item_materials` | 3 | `material_id` | `bigint` | NO |  |
| `order_item_materials` | 4 | `material_name_snapshot` | `varchar(120)` | NO |  |
| `order_item_materials` | 2 | `order_item_id` | `bigint` | NO |  |
| `order_item_materials` | 6 | `quantity_per_item` | `decimal(18,3)` | NO |  |
| `order_item_materials` | 10 | `source` | `enum('BASE','TAKEAWAY_EXTRA','MODIFIER')` | NO |  |
| `order_item_materials` | 7 | `total_quantity` | `decimal(18,3)` | NO |  |
| `order_item_materials` | 5 | `unit_snapshot` | `varchar(20)` | NO |  |
| `order_item_options` | 4 | `group_name_snapshot` | `varchar(80)` | NO |  |
| `order_item_options` | 1 | `id` | `bigint` | NO |  |
| `order_item_options` | 3 | `option_value_id` | `bigint` | NO |  |
| `order_item_options` | 2 | `order_item_id` | `bigint` | NO |  |
| `order_item_options` | 6 | `price_delta_fen_snapshot` | `bigint` | NO |  |
| `order_item_options` | 5 | `value_name_snapshot` | `varchar(80)` | NO |  |
| `order_items` | 11 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `order_items` | 1 | `id` | `bigint` | NO |  |
| `order_items` | 9 | `line_subtotal_fen` | `bigint` | NO |  |
| `order_items` | 2 | `order_id` | `bigint` | NO |  |
| `order_items` | 3 | `product_id` | `bigint` | NO |  |
| `order_items` | 5 | `product_name_snapshot` | `varchar(120)` | NO |  |
| `order_items` | 8 | `quantity` | `int` | NO |  |
| `order_items` | 10 | `remark` | `varchar(500)` | YES |  |
| `order_items` | 7 | `unit_price_fen` | `bigint` | NO |  |
| `order_items` | 4 | `variant_id` | `bigint` | NO |  |
| `order_items` | 6 | `variant_name_snapshot` | `varchar(80)` | NO |  |
| `orders` | 13 | `accepted_at` | `datetime(3)` | YES |  |
| `orders` | 17 | `cancel_reason` | `varchar(500)` | YES |  |
| `orders` | 16 | `cancelled_at` | `datetime(3)` | YES |  |
| `orders` | 6 | `channel` | `enum('DINE','TAKEAWAY')` | NO |  |
| `orders` | 15 | `completed_at` | `datetime(3)` | YES |  |
| `orders` | 12 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `orders` | 3 | `customer_user_id` | `bigint` | NO |  |
| `orders` | 1 | `id` | `bigint` | NO |  |
| `orders` | 5 | `idempotency_key` | `varchar(160)` | NO |  |
| `orders` | 4 | `order_no` | `varchar(40)` | NO |  |
| `orders` | 14 | `preparing_at` | `datetime(3)` | YES |  |
| `orders` | 7 | `session_id` | `bigint` | YES |  |
| `orders` | 8 | `status` | `enum('PENDING_ACCEPTANCE','ACCEPTED','PREPARING','COMPLETED','CANCELLED')` | NO |  |
| `orders` | 2 | `store_id` | `bigint` | NO |  |
| `orders` | 9 | `subtotal_fen` | `bigint` | NO |  |
| `orders` | 10 | `total_amount_fen` | `bigint` | NO |  |
| `orders` | 18 | `updated_at` | `datetime(3)` | NO |  |
| `orders` | 11 | `version` | `int` | NO | 1 |
| `payment_records` | 8 | `amount_fen` | `bigint` | NO |  |
| `payment_records` | 16 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `payment_records` | 1 | `id` | `bigint` | NO |  |
| `payment_records` | 3 | `idempotency_key` | `varchar(160)` | NO |  |
| `payment_records` | 10 | `operator_staff_id` | `bigint` | YES |  |
| `payment_records` | 6 | `order_id` | `bigint` | YES |  |
| `payment_records` | 7 | `payment_method` | `enum('CASH','WECHAT','ALIPAY','POS','OTHER')` | NO |  |
| `payment_records` | 2 | `payment_no` | `varchar(64)` | NO |  |
| `payment_records` | 9 | `received_at` | `datetime(3)` | NO |  |
| `payment_records` | 12 | `remark` | `varchar(500)` | YES |  |
| `payment_records` | 5 | `session_id` | `bigint` | YES |  |
| `payment_records` | 11 | `status` | `enum('ACTIVE','VOIDED')` | NO |  |
| `payment_records` | 4 | `store_id` | `bigint` | NO |  |
| `payment_records` | 17 | `updated_at` | `datetime(3)` | NO |  |
| `payment_records` | 15 | `void_reason` | `varchar(500)` | YES |  |
| `payment_records` | 13 | `voided_at` | `datetime(3)` | YES |  |
| `payment_records` | 14 | `voided_by_staff_id` | `bigint` | YES |  |
| `product_variants` | 8 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `product_variants` | 1 | `id` | `bigint` | NO |  |
| `product_variants` | 5 | `inventory_mode` | `enum('MANAGED','UNMANAGED')` | NO |  |
| `product_variants` | 3 | `name` | `varchar(80)` | NO |  |
| `product_variants` | 4 | `price_fen` | `bigint` | NO |  |
| `product_variants` | 2 | `product_id` | `bigint` | NO |  |
| `product_variants` | 7 | `sort_order` | `int` | NO | 0 |
| `product_variants` | 6 | `status` | `enum('ACTIVE','DISABLED')` | NO |  |
| `product_variants` | 9 | `updated_at` | `datetime(3)` | NO |  |
| `products` | 3 | `category_id` | `bigint` | NO |  |
| `products` | 9 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `products` | 5 | `description` | `text` | YES |  |
| `products` | 1 | `id` | `bigint` | NO |  |
| `products` | 6 | `image_url` | `varchar(512)` | YES |  |
| `products` | 4 | `name` | `varchar(120)` | NO |  |
| `products` | 8 | `sort_order` | `int` | NO | 0 |
| `products` | 7 | `status` | `enum('ACTIVE','DISABLED')` | NO |  |
| `products` | 2 | `store_id` | `bigint` | NO |  |
| `products` | 10 | `updated_at` | `datetime(3)` | NO |  |
| `recipe_modifiers` | 1 | `id` | `bigint` | NO |  |
| `recipe_modifiers` | 4 | `material_id` | `bigint` | NO |  |
| `recipe_modifiers` | 3 | `option_value_id` | `bigint` | NO |  |
| `recipe_modifiers` | 6 | `quantity_delta` | `decimal(18,3)` | NO |  |
| `recipe_modifiers` | 5 | `target_role` | `enum('BASE','TAKEAWAY_EXTRA')` | NO |  |
| `recipe_modifiers` | 2 | `variant_id` | `bigint` | NO |  |
| `refund_records` | 5 | `amount_fen` | `bigint` | NO |  |
| `refund_records` | 13 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `refund_records` | 1 | `id` | `bigint` | NO |  |
| `refund_records` | 3 | `idempotency_key` | `varchar(160)` | NO |  |
| `refund_records` | 9 | `operator_staff_id` | `bigint` | YES |  |
| `refund_records` | 4 | `payment_record_id` | `bigint` | NO |  |
| `refund_records` | 6 | `reason` | `varchar(500)` | NO |  |
| `refund_records` | 2 | `refund_no` | `varchar(64)` | NO |  |
| `refund_records` | 8 | `refunded_at` | `datetime(3)` | NO |  |
| `refund_records` | 7 | `status` | `enum('ACTIVE','VOIDED')` | NO |  |
| `refund_records` | 14 | `updated_at` | `datetime(3)` | NO |  |
| `refund_records` | 12 | `void_reason` | `varchar(500)` | YES |  |
| `refund_records` | 10 | `voided_at` | `datetime(3)` | YES |  |
| `refund_records` | 11 | `voided_by_staff_id` | `bigint` | YES |  |
| `staff` | 6 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `staff` | 1 | `id` | `bigint` | NO |  |
| `staff` | 3 | `name` | `varchar(80)` | NO |  |
| `staff` | 4 | `role` | `enum('OWNER','MANAGER','STAFF')` | NO |  |
| `staff` | 5 | `status` | `enum('ACTIVE','DISABLED')` | NO |  |
| `staff` | 2 | `store_id` | `bigint` | NO |  |
| `staff` | 7 | `updated_at` | `datetime(3)` | NO |  |
| `stock_movements` | 16 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `stock_movements` | 2 | `dedupe_key` | `varchar(160)` | NO |  |
| `stock_movements` | 1 | `id` | `bigint` | NO |  |
| `stock_movements` | 4 | `material_id` | `bigint` | NO |  |
| `stock_movements` | 5 | `movement_type` | `enum('OPENING_BALANCE','STOCK_IN','RESERVE','RELEASE','CONSUME','ADJUST')` | NO |  |
| `stock_movements` | 8 | `on_hand_after` | `decimal(18,3)` | NO |  |
| `stock_movements` | 14 | `operator_staff_id` | `bigint` | YES |  |
| `stock_movements` | 12 | `order_id` | `bigint` | YES |  |
| `stock_movements` | 13 | `order_item_id` | `bigint` | YES |  |
| `stock_movements` | 6 | `quantity_delta` | `decimal(18,3)` | NO |  |
| `stock_movements` | 15 | `reason` | `varchar(500)` | YES |  |
| `stock_movements` | 9 | `reserved_after` | `decimal(18,3)` | NO |  |
| `stock_movements` | 7 | `reserved_delta` | `decimal(18,3)` | NO |  |
| `stock_movements` | 3 | `store_id` | `bigint` | NO |  |
| `stock_movements` | 11 | `total_cost_snapshot` | `decimal(18,6)` | YES |  |
| `stock_movements` | 10 | `unit_cost_snapshot` | `decimal(18,6)` | YES |  |
| `stores` | 5 | `business_day_cutoff_minute` | `int` | NO | 0 |
| `stores` | 6 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `stores` | 1 | `id` | `bigint` | NO |  |
| `stores` | 2 | `name` | `varchar(120)` | NO |  |
| `stores` | 3 | `status` | `enum('ACTIVE','SUSPENDED')` | NO |  |
| `stores` | 4 | `timezone` | `varchar(64)` | NO | Asia/Shanghai |
| `stores` | 7 | `updated_at` | `datetime(3)` | NO |  |
| `users` | 4 | `created_at` | `datetime(3)` | NO | CURRENT_TIMESTAMP(3) |
| `users` | 1 | `id` | `bigint` | NO |  |
| `users` | 2 | `openid` | `varchar(128)` | NO |  |
| `users` | 3 | `status` | `enum('ACTIVE','DISABLED')` | NO |  |
| `users` | 5 | `updated_at` | `datetime(3)` | NO |  |
| `variant_option_groups` | 1 | `id` | `bigint` | NO |  |
| `variant_option_groups` | 3 | `name` | `varchar(80)` | NO |  |
| `variant_option_groups` | 5 | `required` | `tinyint(1)` | NO |  |
| `variant_option_groups` | 4 | `selection_type` | `enum('SINGLE','MULTI')` | NO |  |
| `variant_option_groups` | 6 | `sort_order` | `int` | NO | 0 |
| `variant_option_groups` | 7 | `status` | `enum('ACTIVE','DISABLED')` | NO |  |
| `variant_option_groups` | 2 | `variant_id` | `bigint` | NO |  |
| `variant_option_values` | 1 | `id` | `bigint` | NO |  |
| `variant_option_values` | 3 | `name` | `varchar(80)` | NO |  |
| `variant_option_values` | 2 | `option_group_id` | `bigint` | NO |  |
| `variant_option_values` | 4 | `price_delta_fen` | `bigint` | NO | 0 |
| `variant_option_values` | 5 | `sort_order` | `int` | NO | 0 |
| `variant_option_values` | 6 | `status` | `enum('ACTIVE','DISABLED')` | NO |  |
| `variant_recipes` | 1 | `id` | `bigint` | NO |  |
| `variant_recipes` | 3 | `material_id` | `bigint` | NO |  |
| `variant_recipes` | 5 | `quantity` | `decimal(18,3)` | NO |  |
| `variant_recipes` | 4 | `role` | `enum('BASE','TAKEAWAY_EXTRA')` | NO |  |
| `variant_recipes` | 2 | `variant_id` | `bigint` | NO |  |

## 4. 46 个外键

| 外键名称 | 表 | 字段 | 引用表 | 引用字段 | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- | --- | --- |
| `categories_store_id_fkey` | `categories` | `store_id` | `stores` | `id` | RESTRICT | CASCADE |
| `dining_sessions_closed_by_staff_id_fkey` | `dining_sessions` | `closed_by_staff_id` | `staff` | `id` | RESTRICT | CASCADE |
| `dining_sessions_store_id_fkey` | `dining_sessions` | `store_id` | `stores` | `id` | RESTRICT | CASCADE |
| `dining_sessions_table_id_fkey` | `dining_sessions` | `table_id` | `dining_tables` | `id` | RESTRICT | CASCADE |
| `dining_tables_store_id_fkey` | `dining_tables` | `store_id` | `stores` | `id` | RESTRICT | CASCADE |
| `loss_records_material_id_fkey` | `loss_records` | `material_id` | `materials` | `id` | RESTRICT | CASCADE |
| `loss_records_operator_staff_id_fkey` | `loss_records` | `operator_staff_id` | `staff` | `id` | RESTRICT | CASCADE |
| `loss_records_order_id_fkey` | `loss_records` | `order_id` | `orders` | `id` | RESTRICT | CASCADE |
| `loss_records_order_item_id_fkey` | `loss_records` | `order_item_id` | `order_items` | `id` | RESTRICT | CASCADE |
| `loss_records_stock_movement_id_fkey` | `loss_records` | `stock_movement_id` | `stock_movements` | `id` | RESTRICT | CASCADE |
| `loss_records_store_id_fkey` | `loss_records` | `store_id` | `stores` | `id` | RESTRICT | CASCADE |
| `materials_store_id_fkey` | `materials` | `store_id` | `stores` | `id` | RESTRICT | CASCADE |
| `orders_customer_user_id_fkey` | `orders` | `customer_user_id` | `users` | `id` | RESTRICT | CASCADE |
| `orders_session_id_fkey` | `orders` | `session_id` | `dining_sessions` | `id` | RESTRICT | CASCADE |
| `orders_store_id_fkey` | `orders` | `store_id` | `stores` | `id` | RESTRICT | CASCADE |
| `order_items_order_id_fkey` | `order_items` | `order_id` | `orders` | `id` | RESTRICT | CASCADE |
| `order_items_product_id_fkey` | `order_items` | `product_id` | `products` | `id` | RESTRICT | CASCADE |
| `order_items_variant_id_fkey` | `order_items` | `variant_id` | `product_variants` | `id` | RESTRICT | CASCADE |
| `order_item_materials_material_id_fkey` | `order_item_materials` | `material_id` | `materials` | `id` | RESTRICT | CASCADE |
| `order_item_materials_order_item_id_fkey` | `order_item_materials` | `order_item_id` | `order_items` | `id` | RESTRICT | CASCADE |
| `order_item_options_option_value_id_fkey` | `order_item_options` | `option_value_id` | `variant_option_values` | `id` | RESTRICT | CASCADE |
| `order_item_options_order_item_id_fkey` | `order_item_options` | `order_item_id` | `order_items` | `id` | RESTRICT | CASCADE |
| `payment_records_operator_staff_id_fkey` | `payment_records` | `operator_staff_id` | `staff` | `id` | RESTRICT | CASCADE |
| `payment_records_order_id_fkey` | `payment_records` | `order_id` | `orders` | `id` | RESTRICT | CASCADE |
| `payment_records_session_id_fkey` | `payment_records` | `session_id` | `dining_sessions` | `id` | RESTRICT | CASCADE |
| `payment_records_store_id_fkey` | `payment_records` | `store_id` | `stores` | `id` | RESTRICT | CASCADE |
| `payment_records_voided_by_staff_id_fkey` | `payment_records` | `voided_by_staff_id` | `staff` | `id` | RESTRICT | CASCADE |
| `products_category_id_fkey` | `products` | `category_id` | `categories` | `id` | RESTRICT | CASCADE |
| `products_store_id_fkey` | `products` | `store_id` | `stores` | `id` | RESTRICT | CASCADE |
| `product_variants_product_id_fkey` | `product_variants` | `product_id` | `products` | `id` | RESTRICT | CASCADE |
| `recipe_modifiers_material_id_fkey` | `recipe_modifiers` | `material_id` | `materials` | `id` | RESTRICT | CASCADE |
| `recipe_modifiers_option_value_id_fkey` | `recipe_modifiers` | `option_value_id` | `variant_option_values` | `id` | RESTRICT | CASCADE |
| `recipe_modifiers_variant_id_fkey` | `recipe_modifiers` | `variant_id` | `product_variants` | `id` | RESTRICT | CASCADE |
| `refund_records_operator_staff_id_fkey` | `refund_records` | `operator_staff_id` | `staff` | `id` | RESTRICT | CASCADE |
| `refund_records_payment_record_id_fkey` | `refund_records` | `payment_record_id` | `payment_records` | `id` | RESTRICT | CASCADE |
| `refund_records_voided_by_staff_id_fkey` | `refund_records` | `voided_by_staff_id` | `staff` | `id` | RESTRICT | CASCADE |
| `staff_store_id_fkey` | `staff` | `store_id` | `stores` | `id` | RESTRICT | CASCADE |
| `stock_movements_material_id_fkey` | `stock_movements` | `material_id` | `materials` | `id` | RESTRICT | CASCADE |
| `stock_movements_operator_staff_id_fkey` | `stock_movements` | `operator_staff_id` | `staff` | `id` | RESTRICT | CASCADE |
| `stock_movements_order_id_fkey` | `stock_movements` | `order_id` | `orders` | `id` | RESTRICT | CASCADE |
| `stock_movements_order_item_id_fkey` | `stock_movements` | `order_item_id` | `order_items` | `id` | RESTRICT | CASCADE |
| `stock_movements_store_id_fkey` | `stock_movements` | `store_id` | `stores` | `id` | RESTRICT | CASCADE |
| `variant_option_groups_variant_id_fkey` | `variant_option_groups` | `variant_id` | `product_variants` | `id` | RESTRICT | CASCADE |
| `variant_option_values_option_group_id_fkey` | `variant_option_values` | `option_group_id` | `variant_option_groups` | `id` | RESTRICT | CASCADE |
| `variant_recipes_material_id_fkey` | `variant_recipes` | `material_id` | `materials` | `id` | RESTRICT | CASCADE |
| `variant_recipes_variant_id_fkey` | `variant_recipes` | `variant_id` | `product_variants` | `id` | RESTRICT | CASCADE |

## 5. 当前 CHECK

当前 CHECK 数量：**0**。

数据库中当前没有 CHECK。

## 6. 六个目标外键

| 外键 | 表 | 字段 | 引用目标 | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- | --- |
| `dining_sessions_closed_by_staff_id_fkey` | `dining_sessions` | `closed_by_staff_id` | `staff.id` | RESTRICT | CASCADE |
| `orders_session_id_fkey` | `orders` | `session_id` | `dining_sessions.id` | RESTRICT | CASCADE |
| `payment_records_session_id_fkey` | `payment_records` | `session_id` | `dining_sessions.id` | RESTRICT | CASCADE |
| `payment_records_order_id_fkey` | `payment_records` | `order_id` | `orders.id` | RESTRICT | CASCADE |
| `payment_records_voided_by_staff_id_fkey` | `payment_records` | `voided_by_staff_id` | `staff.id` | RESTRICT | CASCADE |
| `refund_records_voided_by_staff_id_fkey` | `refund_records` | `voided_by_staff_id` | `staff.id` | RESTRICT | CASCADE |

目标外键存在数量：**6/6**。全部仍为 ON UPDATE CASCADE：**True**。

## 7. Migration 历史

总记录：**3**；其他名称记录：**0**；initial 记录：**1**；domain 记录：**2**；domain 已回滚：**1**；domain 当前失败：**1**。

| migration_name | started_at | finished_at | rolled_back_at | applied_steps_count | checksum | logs |
| --- | --- | --- | --- | --- | --- | --- |
| `20261114120000_initial_schema` | 2026-11-14 15:29:03.748000 | 2026-11-14 15:29:12.212000 |  | 1 | `ad2274e7a964ea753661b8c037c486f4b4a1855c0dfe74ecb9613cf0190ce19b` |  |
| `20261114120100_domain_constraints` | 2026-11-14 15:29:12.221000 |  | 2026-11-15 04:19:44.734000 | 0 | `8c07acfd2f657d5cf1e58a1250aa315416a6d73d97cf1bc9b2729092332c4333` | A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20261114120100_domain_constraints\n\nDatabase error code: 3823\n\nDatabase error:\nColumn &#39;closed_by_staff_id&#39; cannot be used in a check constraint &#39;chk_dining_sessions_closed_fields&#39;: needed in a foreign key constraint &#39;dining_sessions_closed_by_staff_id_fkey&#39; referential action.\n\nPlease check the query number 11 from the migration file.\n\n |
| `20261114120100_domain_constraints` | 2026-11-15 04:20:51.050000 |  |  | 0 | `c0e4aa640f4853e7cd7ea702562d151d515e3b64f826ebab2baa6361e461498a` | A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20261114120100_domain_constraints\n\nDatabase error code: 1826\n\nDatabase error:\nDuplicate foreign key constraint name &#39;dining_sessions_closed_by_staff_id_fkey&#39;\n\nPlease check the query number 1 from the migration file.\n\n |

## 8. Prisma migrate status

退出码：`1`

```text
Prisma schema loaded from backend\prisma\schema.prisma
Datasource "db": MySQL database "sanweichawu_b4_main_20261114t152855z" at "127.0.0.1:33316"

2 migrations found in prisma/migrations
Following migration have failed:
20261114120100_domain_constraints

During development if the failed migration(s) have not been deployed to a production database you can then fix the migration(s) and run prisma migrate dev.

The failed migration(s) can be marked as rolled back or applied:
      
- If you rolled back the migration(s) manually:
prisma migrate resolve --rolled-back "20261114120100_domain_constraints"

- If you fixed the database manually (hotfix):
prisma migrate resolve --applied "20261114120100_domain_constraints"

Read more about how to resolve migration issues in a production database:
https://pris.ly/d/migrate-resolve
```

## 9. 当前 Migration 文件

initial_schema SHA-256：`AD2274E7A964EA753661B8C037C486F4B4A1855C0DFE74ECB9613CF0190CE19B`

domain_constraints SHA-256：`A8E247D1F2555AC2A1FD505369BEC1532EDEA6CA44847E446AF3D4BF426F4949`

domain_constraints 中：6 个 DROP、6 个 ADD、22 个 CHECK、6 个 ON UPDATE RESTRICT。

六组兼容性 SQL：

```sql
-- MySQL 8.4 compatibility: columns used by CHECK constraints cannot participate
-- in a foreign-key ON UPDATE CASCADE referential action.
-- DROP and ADD must be separate statements because reusing the same constraint
-- name in one ALTER TABLE fails with MySQL error 1826.
ALTER TABLE `dining_sessions`
  DROP FOREIGN KEY `dining_sessions_closed_by_staff_id_fkey`;

ALTER TABLE `dining_sessions`
  ADD CONSTRAINT `dining_sessions_closed_by_staff_id_fkey`
    FOREIGN KEY (`closed_by_staff_id`) REFERENCES `staff`(`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `orders`
  DROP FOREIGN KEY `orders_session_id_fkey`;

ALTER TABLE `orders`
  ADD CONSTRAINT `orders_session_id_fkey`
    FOREIGN KEY (`session_id`) REFERENCES `dining_sessions`(`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `payment_records`
  DROP FOREIGN KEY `payment_records_session_id_fkey`;

ALTER TABLE `payment_records`
  ADD CONSTRAINT `payment_records_session_id_fkey`
    FOREIGN KEY (`session_id`) REFERENCES `dining_sessions`(`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `payment_records`
  DROP FOREIGN KEY `payment_records_order_id_fkey`;

ALTER TABLE `payment_records`
  ADD CONSTRAINT `payment_records_order_id_fkey`
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `payment_records`
  DROP FOREIGN KEY `payment_records_voided_by_staff_id_fkey`;

ALTER TABLE `payment_records`
  ADD CONSTRAINT `payment_records_voided_by_staff_id_fkey`
    FOREIGN KEY (`voided_by_staff_id`) REFERENCES `staff`(`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `refund_records`
  DROP FOREIGN KEY `refund_records_voided_by_staff_id_fkey`;

ALTER TABLE `refund_records`
  ADD CONSTRAINT `refund_records_voided_by_staff_id_fkey`
    FOREIGN KEY (`voided_by_staff_id`) REFERENCES `staff`(`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;
```

22 个 CHECK 名称：

- `chk_stores_business_day_cutoff_minute`
- `chk_product_variants_price_fen_nonnegative`
- `chk_variant_recipes_quantity_positive`
- `chk_materials_nonnegative_balances`
- `chk_materials_version_positive`
- `chk_stock_movements_balance`
- `chk_stock_movements_direction`
- `chk_stock_movements_cost_nonnegative`
- `chk_loss_records_values_nonnegative`
- `chk_dining_sessions_version_positive`
- `chk_dining_sessions_closed_fields`
- `chk_orders_version_positive`
- `chk_orders_amounts`
- `chk_orders_channel_session`
- `chk_order_items_values`
- `chk_order_item_materials_quantities`
- `chk_order_item_materials_cost_pair`
- `chk_payment_records_target_xor`
- `chk_payment_records_amount_positive`
- `chk_payment_records_void_audit`
- `chk_refund_records_amount_positive`
- `chk_refund_records_void_audit`

## 10. Prisma 多次失败记录的恢复行为

Prisma CLI 6.19.0 使用 schema-engine 6.19.0。对应 commit 为 `2ba551f319ab1df4bc874a89965d8b3641056773`。

### 10.1 再次执行 resolve --rolled-back

引擎源码 `mark_migration_rolled_back.rs` 的行为：

1. 读取所有 Migration 记录。
2. 筛选 migration_name 相同的全部记录。
3. 若同名记录全部 finished，拒绝回滚。
4. 仅选择 `finished_at IS NULL AND rolled_back_at IS NULL` 的记录。
5. 调用 `mark_migration_rolled_back_by_id` 更新这些记录。

当前实际数据：
- 第一次 domain 失败记录已有 `rolled_back_at`：不会被再次修改。
- 第二次 domain 失败记录 `finished_at=NULL`、`rolled_back_at=NULL`：会被标记为 rolled back。
- resolve 命令本身不会创建新记录。
- 如果存在多个同名且同时未完成、未回滚的失败记录，引擎会更新所有这些记录。

### 10.2 后续 deploy

引擎源码 `apply_migrations.rs` 在检测失败记录后，以数据库中 `rolled_back_at IS NULL` 的同名记录判断 Migration 是否已经应用。

因此：

- 当三条 domain 记录都已有 rolled back 或成功状态后，当前文件系统 Migration 会被视为尚未应用。
- deploy 会调用 `record_migration_started` 创建一条新的 Migration 执行记录。
- 然后执行当前 Migration SQL；成功时写入 successful step 和 finished_at。
- 多个旧失败记录不会阻止 deploy，前提是所有旧失败记录都已被标记 rolled back。
- 当前仍有一条 failed 记录，所以现在直接 deploy 会被拒绝。

结论：再次 resolve 是必要步骤，不是删除历史；它只会把当前第二条失败记录补充为已回滚。

## 11. 重新部署风险

当前 6 个目标外键全部存在，字段、引用目标和策略均为初始状态，没有缺失：

- 6 / 6 存在。
- 6 / 6 `ON DELETE RESTRICT`。
- 6 / 6 `ON UPDATE CASCADE`。
- 当前没有 CHECK，因此不会发生 CHECK 重复创建。

拆分后的 Migration 风险：

- 每条 DROP 成功后、对应 ADD 成功前，外键处于缺失状态。
- 如果 ADD 失败，表会保留，但该外键缺失；不得盲目再次执行完整 Migration。
- 下一轮执行时必须逐条观察结果；如果失败，停止并先核对六个外键是否存在。
- 当前没有外键缺失，具备执行前提。

## 12. 推荐恢复步骤

1. 再次执行 `prisma migrate resolve --rolled-back "20261114120100_domain_constraints"`。影响对象：当前第二条失败记录的 `rolled_back_at`。第一次已回滚记录和初始成功记录不变。
2. resolve 后只读核对：三条 domain 记录中两条已回滚、没有新的成功记录、仍无 active failed 记录。
3. 执行 `prisma migrate deploy`。影响对象：新建一条 domain Migration 执行记录，执行 6 组 DROP/ADD 和 22 个 CHECK。
4. 如果 deploy 失败，立即停止，不再次 resolve/deploy，检查六个外键是否全部存在。
5. 成功后按完整清单验收 21 表、202 列、46 外键、22 CHECK、6 Restrict/40 Cascade。

## 13. 不能自动恢复的风险

- 当前仍有一条 active failed 记录；未 resolve 前不能 deploy。
- 拆分 DROP/ADD 不是整体原子操作；中途失败可能留下一个或多个外键缺失。
- 若未来发现外键缺失，必须先人工核对并恢复，不能盲目重跑 Migration。
- 旧失败记录会保留，这是审计所需，不是异常。
- 本批没有执行任何恢复动作；下一轮仍需明确授权。

## 14. 证据来源

- 本报告数据库查询：通过 Docker 内 MySQL 8.4.13 的只读 SELECT。
- Prisma resolve 源码：https://github.com/prisma/prisma-engines/blob/2ba551f319ab1df4bc874a89965d8b3641056773/schema-engine/commands/src/commands/mark_migration_rolled_back.rs
- Prisma deploy 源码：https://github.com/prisma/prisma-engines/blob/2ba551f319ab1df4bc874a89965d8b3641056773/schema-engine/commands/src/commands/apply_migrations.rs
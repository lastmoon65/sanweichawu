# P1-02-B4 失败库恢复只读预检

检查时间：2026-11-14 23:53:21 +08:00（Asia/Shanghai）

检查时间 UTC：`2026-11-14T15:53:21.5914207Z`

状态：只读预检完成。本批未执行 DDL、DML、`migrate resolve` 或 `migrate deploy`。

## 1. 数据库范围

当前 MySQL 中匹配 `sanweichawu_b4%` 的数据库：

- `sanweichawu_b4`
- `sanweichawu_b4_compat_20261114t152855z`
- `sanweichawu_b4_failure_20261114t152855z`
- `sanweichawu_b4_main_20261114t152855z`
- `sanweichawu_b4_recovery_20261114t152855z`
- `sanweichawu_b4_scratch_20261114t152855z`

本次检查目标：`sanweichawu_b4_main_20261114t152855z`。

## 2. 数据库与版本

| 项目 | 实际值 |
| --- | --- |
| 当前数据库 | `sanweichawu_b4_main_20261114t152855z` |
| MySQL 版本 | `8.4.13` |
| Version comment | `MySQL Community Server - GPL` |
| 字符集 | `utf8mb4` |
| 排序规则 | `utf8mb4_unicode_ci` |
| 时区 | `UTC` |
| SQL mode | `ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION` |

## 3. 业务表

- 业务表数量：**21**
- 总表数量（含 `_prisma_migrations`）：**22**
- 缺失业务表：
- 非预期业务表：

| 表 | Engine | Collation |
| --- | --- | --- |
| `_prisma_migrations` | `InnoDB` | `utf8mb4_unicode_ci` |
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

## 4. 外键实际定义

- 外键数量：**46**
- 与初始 Migration 定义差异：**0**

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

## 5. CHECK 实际状态

- 当前 CHECK 数量：**10**
- 迁移文件定义 CHECK 数量：**22**
- 尚未创建 CHECK 数量：**12**
- 非预期 CHECK 数量：**0**

| CHECK 名称 | 所属表 | 实际表达式 |
| --- | --- | --- |
| `chk_stores_business_day_cutoff_minute` | `stores` | `(`business_day_cutoff_minute` between 0 and 1439)` |
| `chk_product_variants_price_fen_nonnegative` | `product_variants` | `(`price_fen` >= 0)` |
| `chk_variant_recipes_quantity_positive` | `variant_recipes` | `(`quantity` > 0)` |
| `chk_materials_nonnegative_balances` | `materials` | `((`on_hand` >= 0) and (`reserved` >= 0) and (`average_cost_per_unit` >= 0) and (`reserved` <= `on_hand`))` |
| `chk_materials_version_positive` | `materials` | `(`version` > 0)` |
| `chk_stock_movements_balance` | `stock_movements` | `((`on_hand_after` >= 0) and (`reserved_after` >= 0) and (`reserved_after` <= `on_hand_after`))` |
| `chk_stock_movements_direction` | `stock_movements` | `(((`movement_type` = _utf8mb4\\'OPENING_BALANCE\\') and (`quantity_delta` >= 0) and (`reserved_delta` = 0)) or ((`movement_type` = _utf8mb4\\'STOCK_IN\\') and (`quantity_delta` > 0) and (`reserved_delta` = 0)) or ((`movement_type` = _utf8mb4\\'RESERVE\\') and (`quantity_delta` = 0) and (`reserved_delta` > 0)) or ((`movement_type` = _utf8mb4\\'RELEASE\\') and (`quantity_delta` = 0) and (`reserved_delta` < 0)) or ((`movement_type` = _utf8mb4\\'CONSUME\\') and (`quantity_delta` < 0) and (`reserved_delta` < 0) and (`quantity_delta` = `reserved_delta`)) or ((`movement_type` = _utf8mb4\\'ADJUST\\') and (`quantity_delta` <> 0) and (`reserved_delta` = 0)))` |
| `chk_stock_movements_cost_nonnegative` | `stock_movements` | `(((`unit_cost_snapshot` is null) or (`unit_cost_snapshot` >= 0)) and ((`total_cost_snapshot` is null) or (`total_cost_snapshot` >= 0)))` |
| `chk_loss_records_values_nonnegative` | `loss_records` | `((`quantity` > 0) and (`unit_cost_snapshot` >= 0) and (`loss_cost_snapshot` >= 0))` |
| `chk_dining_sessions_version_positive` | `dining_sessions` | `(`version` > 0)` |

尚未创建的 CHECK：
- `chk_dining_sessions_closed_fields`
- `chk_order_item_materials_cost_pair`
- `chk_order_item_materials_quantities`
- `chk_order_items_values`
- `chk_orders_amounts`
- `chk_orders_channel_session`
- `chk_orders_version_positive`
- `chk_payment_records_amount_positive`
- `chk_payment_records_target_xor`
- `chk_payment_records_void_audit`
- `chk_refund_records_amount_positive`
- `chk_refund_records_void_audit`

## 6. Prisma Migration Status

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

## 7. `_prisma_migrations` 记录

- Migration 记录数量：**2**
- 其他 Migration 记录数量：**0**

| migration_name | started_at | finished_at | rolled_back_at | applied_steps_count | checksum | logs |
| --- | --- | --- | --- | --- | --- | --- |
| `20261114120000_initial_schema` | 2026-11-14 15:29:03.748000 | 2026-11-14 15:29:12.212000 |  | 1 | `ad2274e7a964ea753661b8c037c486f4b4a1855c0dfe74ecb9613cf0190ce19b` |  |
| `20261114120100_domain_constraints` | 2026-11-14 15:29:12.221000 |  |  | 0 | `8c07acfd2f657d5cf1e58a1250aa315416a6d73d97cf1bc9b2729092332c4333` | A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20261114120100_domain_constraints\n\nDatabase error code: 3823\n\nDatabase error:\nColumn 'closed_by_staff_id' cannot be used in a check constraint 'chk_dining_sessions_closed_fields': needed in a foreign key constraint 'dining_sessions_closed_by_staff_id_fkey' referential action.\n\nPlease check the query number 11 from the migration file.\n\n |

初始 Migration 文件 SHA-256：

`AD2274E7A964EA753661B8C037C486F4B4A1855C0DFE74ECB9613CF0190CE19B`

与数据库 checksum 一致：**True**

## 8. 六个目标外键状态

| 外键名称 | 表 | 字段 | 目标 | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- | --- |
| `dining_sessions_closed_by_staff_id_fkey` | `dining_sessions` | `closed_by_staff_id` | `staff.id` | RESTRICT | CASCADE |
| `orders_session_id_fkey` | `orders` | `session_id` | `dining_sessions.id` | RESTRICT | CASCADE |
| `payment_records_session_id_fkey` | `payment_records` | `session_id` | `dining_sessions.id` | RESTRICT | CASCADE |
| `payment_records_order_id_fkey` | `payment_records` | `order_id` | `orders.id` | RESTRICT | CASCADE |
| `payment_records_voided_by_staff_id_fkey` | `payment_records` | `voided_by_staff_id` | `staff.id` | RESTRICT | CASCADE |
| `refund_records_voided_by_staff_id_fkey` | `refund_records` | `voided_by_staff_id` | `staff.id` | RESTRICT | CASCADE |

- 已为 Restrict：**0**
- 仍为 Cascade：**6**
- 是否部分调整：**False**

## 9. 与预期状态的差异

| 检查项 | 结果 |
| --- | --- |
| 21 张业务表完整 | True |
| 46 个外键及初始定义一致 | True |
| CHECK 恰好为失败时前 10 个 | True |
| 仅有两条预期 Migration 记录 | True |
| 六个目标外键仍全部 Cascade | True |

是否存在不符合预期的状态：**False**

## 10. 推荐恢复步骤

本报告只提出步骤，本批未执行。

1. 保存本预检报告和失败现场。影响对象：无，只读。
2. 清理当前实际存在的 10 个 CHECK。影响对象：仅下列 CHECK；表、外键、数据和 Migration 记录不变。
   - `stores.chk_stores_business_day_cutoff_minute`
   - `product_variants.chk_product_variants_price_fen_nonnegative`
   - `variant_recipes.chk_variant_recipes_quantity_positive`
   - `materials.chk_materials_nonnegative_balances`
   - `materials.chk_materials_version_positive`
   - `stock_movements.chk_stock_movements_balance`
   - `stock_movements.chk_stock_movements_direction`
   - `stock_movements.chk_stock_movements_cost_nonnegative`
   - `loss_records.chk_loss_records_values_nonnegative`
   - `dining_sessions.chk_dining_sessions_version_positive`
3. 清理后验证 `checks=0`、`business_tables=21`、`foreign_keys=46`。影响对象：无，只读验证。
4. 检查六个目标外键名称、字段、目标和策略；当前均为 Cascade 时不需要人工调整。影响对象：无，只读验证。
5. 执行 `prisma migrate resolve --rolled-back "20261114120100_domain_constraints"`。影响对象：仅失败 Migration 记录的 `rolled_back_at`，不删除历史、不标记为成功。
6. 使用已通过静态检查的新领域约束 Migration 重新执行 `prisma migrate deploy`。影响对象：6 个外键由 Cascade 重建为 Restrict；创建 22 个 CHECK；新增一条领域的成功 Migration 记录。
7. 验证 21 张表、202 列、46 个外键、22 个 CHECK、6 个 Restrict / 40 个 Cascade，以及初始 Migration 记录和 checksum 未变化。

### 防止重复 DROP/ADD

- 新 Migration 的每个外键语句都是同一条 `ALTER TABLE` 内先 DROP 指定名称、再 ADD 同名外键。
- 重试前必须确认六个外键均存在；若某个外键缺失，停止自动恢复并保留现场。
- 不单独手工 ADD 后再执行 Migration，避免人工状态与 Migration 重放叠加。
- 若未来出现部分 Restrict，不需要先把它们改回 Cascade；Migration 会按名称 DROP 后重建。

## 11. 安全判断

实际状态与首次失败后的预期完全一致：可以使用上述受控步骤恢复；当前没有无法安全自动恢复的情况。

即使状态一致，本批也不执行清理、resolve 或 deploy，等待下一轮明确授权。

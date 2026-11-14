# P1-02-A 完整字段契约

编制日期：2026-11-14（Asia/Shanghai）

决策基线：`docs/engineering/phase-1/p1-02-a-business-decisions.md`

Schema 快照：提交 `17b30ea`；SHA-256 `d38dae5442f64f49c1f4faaf869a85908e8ef2e4e008eb91b87e5ff4caafc44b`

契约版本：**v1.3（候选属性收口）**

契约状态：**待最终验收**。本文件依据 A1-A9、T1-T11、R1-R5 及本轮候选属性收口结果编制，不修改当前 Schema。

## 1. 契约范围与状态标记

- 当前 Schema：21 个模型、224 个物理字段、92 个 Prisma 关系字段、46 个带 `fields:` 的外键关系。
- 目标：保留 202 个物理字段，删除 22 个物理字段。
- “已冻结”表示由 A/T 决策直接确定。
- 本版已完成字符串长度、默认值、业务事件时间、普通索引、枚举和可空性收口，不再保留未决候选属性。
- 删除字段的目标 Prisma 类型、MySQL 类型和列名均记为 `—`，不得进入目标 Schema。
- Prisma 虚拟关系不计入物理字段覆盖统计。

### 独立审查修订索引

| 修订 | 内容 | 对应契约位置 |
| --- | --- | --- |
| R1 | `User.openid` 改为非空唯一，确保下单顾客具有真实微信身份 | User 字段表、ACC-USER-ID |
| R2 | 明确 DINE / TAKEAWAY 与 `sessionId` 的组合完整性 | Order 字段表、第 7.2 节、ACC-ORDER-TARGET |
| R3 | 补齐六类库存流水的 `quantityDelta` / `reservedDelta` 方向及余额约束 | StockMovement 字段表、第 7.3 节、ACC-LEDGER-SIGN |
| R4 | 补齐独立损耗与关联库存流水的门店、原料、数量、单位成本和总成本一致性 | LossRecord 字段表、第 7.5 节、ACC-LOSS-MATCH |
| R5 | 明确 Decimal 运算、ROUND_HALF_UP 落库点和复算边界 | 成本字段表、第 7.8 节、ACC-ROUND |

## 2. 全局规范

### T1 主键与 API

所有 21 个模型使用 `BigInt @id @default(autoincrement())`。API 中所有 BigInt 标识使用十进制字符串，禁止转为 JS Number；业务服务内部使用 BigInt。

### T2 时间

数据库使用 `DATETIME(3)` 并保存 UTC；API 返回带 `Z` 的 ISO 8601；前端按 `Store.timezone` 展示。`createdAt` 使用 `@default(now())`，`updatedAt` 使用 `@updatedAt`。其他业务时间不使用数据库默认值，必须由业务事务在真实事件发生时显式填写。

### T3 字段语义

字符串长度采用字段表最终值；只有字段表标记为可空且附有业务原因的关系或属性才允许 NULL；禁止用空字符串代替 NULL；枚举采用下文最终取值；业务状态、角色、类型、布尔选择、订单状态和账本变动量不得依赖默认值，必须由业务事务显式写入。

### T4 乐观锁

仅保留 `Material.version`、`DiningSession.version`、`Order.version`，默认 1。更新必须校验原版本、成功递增、冲突拒绝，不替代事务和库存行锁。

### T5-T7 软删除、唯一性和选项快照

- 五类主数据不使用 `deletedAt`。
- 停用记录仍占用名称或桌号。
- 历史引用使用 `Restrict` 和快照保留。
- 8 组唯一约束见第 5 节。
- `OrderItemOption.groupCodeSnapshot`、`valueCodeSnapshot` 删除。

### T8 外键

外键必须指向真实记录；必填关系不得随意可空；被引用数据统一 `onDelete: Restrict`；不使用 Cascade。LossRecord 的三个关联按业务允许为空；PaymentRecord 的两个资金归属允许物理为空，但业务必须 XOR 明确归属。

### T9 索引、唯一和 CHECK

唯一约束、普通索引和 CHECK 必须在契约中明确。普通索引只服务实际查询；CHECK 只限制明显非法数值；状态机、资金和复杂业务规则由事务与服务层保证；不增加触发器。

### T10 命名

Prisma 模型 PascalCase、字段 camelCase；MySQL 表名和列名 snake_case；所有字段使用显式 `@map`，所有表使用 `@@map`。映射不改变类型、可空性和业务关系。

### 枚举契约

| 枚举 | MySQL 取值 | 状态 | 依据 |
| --- | --- | --- | --- |
| StoreStatus | ACTIVE, SUSPENDED | 已冻结 | A2 |
| UserStatus | ACTIVE, DISABLED | 已冻结 | A4 + T3，最终取值 |
| StaffRole | OWNER, MANAGER, STAFF | 已冻结 | 既有批准设计 |
| StaffStatus | ACTIVE, DISABLED | 已冻结 | T3，最终取值 |
| CommonStatus | ACTIVE, DISABLED | 已冻结 | A5 |
| InventoryMode | MANAGED, UNMANAGED | 已冻结 | 既有批准设计 |
| RecipeMaterialRole | BASE, TAKEAWAY_EXTRA | 已冻结 | 既有批准设计 |
| RecipeModifierTarget | BASE, TAKEAWAY_EXTRA | 已冻结 | T3，最终取值 |
| OptionSelectionType | SINGLE, MULTI | 已冻结 | T3，最终取值 |
| StockMovementType | OPENING_BALANCE, STOCK_IN, RESERVE, RELEASE, CONSUME, ADJUST | 已冻结 | 既有批准设计 |
| OrderItemMaterialSource | BASE, TAKEAWAY_EXTRA, MODIFIER | 已冻结 | T3，最终取值 |
| OrderChannel | DINE, TAKEAWAY | 已冻结 | 既有批准设计 |
| OrderStatus | PENDING_ACCEPTANCE, ACCEPTED, PREPARING, COMPLETED, CANCELLED | 已冻结 | 既有批准设计 |
| DiningSessionStatus | OPEN, CLOSED | 已冻结 | 既有批准设计 |
| PaymentMethod | CASH, WECHAT, ALIPAY, POS, OTHER | 已冻结 | T3，最终取值 |
| PaymentStatus | ACTIVE, VOIDED | 已冻结 | 既有批准设计 |
| RefundStatus | ACTIVE, VOIDED | 已冻结 | 既有批准设计 |

## 3. 模型与数据库表映射

| 模型 | MySQL 表名 | 物理字段数 | 关系字段数 |
| --- | --- | ---: | ---: |
| `Store` | `stores` | 11 | 10 |
| `User` | `users` | 8 | 1 |
| `Staff` | `staff` | 7 | 8 |
| `Category` | `categories` | 8 | 2 |
| `Product` | `products` | 11 | 4 |
| `ProductVariant` | `product_variants` | 10 | 5 |
| `VariantOptionGroup` | `variant_option_groups` | 8 | 2 |
| `VariantOptionValue` | `variant_option_values` | 7 | 3 |
| `VariantRecipe` | `variant_recipes` | 5 | 2 |
| `RecipeModifier` | `recipe_modifiers` | 6 | 3 |
| `Material` | `materials` | 13 | 6 |
| `StockMovement` | `stock_movements` | 17 | 6 |
| `LossRecord` | `loss_records` | 15 | 6 |
| `DiningTable` | `dining_tables` | 8 | 2 |
| `DiningSession` | `dining_sessions` | 11 | 5 |
| `Order` | `orders` | 19 | 7 |
| `OrderItem` | `order_items` | 11 | 7 |
| `OrderItemOption` | `order_item_options` | 8 | 2 |
| `OrderItemMaterial` | `order_item_materials` | 10 | 2 |
| `PaymentRecord` | `payment_records` | 17 | 6 |
| `RefundRecord` | `refund_records` | 14 | 3 |

## 4. 逐模型字段契约

### Store

数据库表名：`stores`。物理字段 11 个，Prisma 关系字段 10 个。

目标唯一约束：无额外复合唯一约束。

目标普通索引：无。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `name` | **保留** | `String` | VARCHAR(120) | NO | —（显式填写） | `name` | — | — | T3 + T10 | 门店名称；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `status` | **保留** | `StoreStatus` | ENUM('ACTIVE', 'SUSPENDED') | NO | —（显式填写） | `status` | — | — | T3 + A1-A9 + T10 | 门店启停状态；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `timezone` | **保留** | `String` | VARCHAR(64) | NO | "Asia/Shanghai"（最终） | `timezone` | — | — | T3 + T10 | 店铺展示时区；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `businessDayCutoffMinute` | **保留** | `Int` | INT | NO | 0（最终） | `business_day_cutoff_minute` | — | — | T3 + T10 | 营业日切点分钟；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `pendingReminderMinutes` | **删除** | `—` | — | — | — | `—` | — | — | A1-A9 | pending reminder minutes；ACC-ABS |
| `maxPendingOrdersPerCustomer` | **删除** | `—` | — | — | — | `—` | — | — | A1-A9 | max pending orders per customer；ACC-ABS |
| `maxPendingOrdersPerSession` | **删除** | `—` | — | — | — | `—` | — | — | A1-A9 | max pending orders per session；ACC-ABS |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | — | — | T3 + T2 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `updatedAt` | **保留** | `DateTime` | DATETIME(3) | NO | 无数据库默认；Prisma Client 维护（T2） | `updated_at` | — | — | T3 + T2 + T10 | 更新时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `deletedAt` | **删除** | `—` | — | — | — | `—` | 删除旧 IDX1 | — | A1-A9 | deleted at；ACC-ABS |

### User

数据库表名：`users`。物理字段 8 个，Prisma 关系字段 1 个。

目标唯一约束：无额外复合唯一约束。

目标普通索引：无。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `openid` | **保留** | `String` | VARCHAR(128) | NO | —（显式填写） | `openid` | UQ(openid) | — | A4 + T3 + T9 + T10 + R1 | 微信顾客唯一身份标识；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-USER-ID |
| `unionid` | **删除** | `—` | — | — | — | `—` | — | — | A1-A9 | unionid；ACC-ABS |
| `nickname` | **删除** | `—` | — | — | — | `—` | — | — | A1-A9 | nickname；ACC-ABS |
| `avatarUrl` | **删除** | `—` | — | — | — | `—` | — | — | A1-A9 | avatar url；ACC-ABS |
| `status` | **保留** | `UserStatus` | ENUM('ACTIVE', 'DISABLED') | NO | —（显式填写） | `status` | — | — | T3 + A1-A9 + T9 + T10 | 顾客账号启停状态；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | — | — | T3 + T2 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `updatedAt` | **保留** | `DateTime` | DATETIME(3) | NO | 无数据库默认；Prisma Client 维护（T2） | `updated_at` | — | — | T3 + T2 + T10 | 更新时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |

身份约束：只有具备非空、唯一 `openid` 的登录顾客才能创建订单；`Order.customerUserId` 必须来自服务端登录态，不接受前端自行提供用户 ID。`openid` 最终使用 `VARCHAR(128)` 非空唯一。

### Staff

数据库表名：`staff`。物理字段 7 个，Prisma 关系字段 8 个。

目标唯一约束：无额外复合唯一约束。

目标普通索引：无。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `storeId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `store_id` | — | -> stores.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 员工所属门店；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `name` | **保留** | `String` | VARCHAR(80) | NO | —（显式填写） | `name` | — | — | T3 + T10 | 员工姓名；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `role` | **保留** | `StaffRole` | ENUM('OWNER', 'MANAGER', 'STAFF') | NO | —（显式填写） | `role` | — | — | T3 + T9 + T10 | 员工角色；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `status` | **保留** | `StaffStatus` | ENUM('ACTIVE', 'DISABLED') | NO | —（显式填写） | `status` | — | — | T3 + T9 + T10 | 员工状态；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | — | — | T3 + T2 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `updatedAt` | **保留** | `DateTime` | DATETIME(3) | NO | 无数据库默认；Prisma Client 维护（T2） | `updated_at` | — | — | T3 + T2 + T10 | 更新时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |

### Category

数据库表名：`categories`。物理字段 8 个，Prisma 关系字段 2 个。

目标唯一约束：`storeId + name（T5-UQ）`。

目标普通索引：无。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `storeId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `store_id` | UQ(storeId, name; T5-UQ) | -> stores.id; N:1; onDelete Restrict | T3 + T8 + T5 + T9 + T10 | 所属门店；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `name` | **保留** | `String` | VARCHAR(80) | NO | —（显式填写） | `name` | UQ(storeId, name; T5-UQ) | — | T3 + T5 + T9 + T10 | 菜单分类名称；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `sortOrder` | **保留** | `Int` | INT | NO | 0（最终） | `sort_order` | — | — | T3 + T9 + T10 | 分类展示顺序；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `status` | **保留** | `CommonStatus` | ENUM('ACTIVE', 'DISABLED') | NO | —（显式填写） | `status` | — | — | T3 + A1-A9 + T9 + T10 | 生命周期状态；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | — | — | T3 + T2 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `updatedAt` | **保留** | `DateTime` | DATETIME(3) | NO | 无数据库默认；Prisma Client 维护（T2） | `updated_at` | — | — | T3 + T2 + T10 | 更新时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `deletedAt` | **删除** | `—` | — | — | — | `—` | — | — | T5 | deleted at；ACC-ABS |

### Product

数据库表名：`products`。物理字段 11 个，Prisma 关系字段 4 个。

目标唯一约束：`storeId + name（T5-UQ）`。

目标普通索引：`IDX1(categoryId, status, sortOrder)`。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `storeId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `store_id` | UQ(storeId, name; T5-UQ) | -> stores.id; N:1; onDelete Restrict | T3 + T8 + T5 + T9 + T10 | 所属门店；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `categoryId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `category_id` | IDX1(categoryId, status, sortOrder) | -> categories.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 关联标识；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `name` | **保留** | `String` | VARCHAR(120) | NO | —（显式填写） | `name` | UQ(storeId, name; T5-UQ) | — | T3 + T5 + T9 + T10 | 商品名称；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `description` | **保留** | `String?` | TEXT | YES（商品可无说明） | —（可空） | `description` | — | — | T3 + A1-A9 + T10 | 商品说明；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `imageUrl` | **保留** | `String?` | VARCHAR(512) | YES（商品可无图片） | —（可空） | `image_url` | — | — | T3 + T10 | 商品图片；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `status` | **保留** | `CommonStatus` | ENUM('ACTIVE', 'DISABLED') | NO | —（显式填写） | `status` | IDX1(categoryId, status, sortOrder) | — | T3 + T9 + T10 | 商品上下架状态；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `sortOrder` | **保留** | `Int` | INT | NO | 0（最终） | `sort_order` | IDX1(categoryId, status, sortOrder) | — | T3 + T9 + T10 | 展示排序；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | — | — | T3 + T2 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `updatedAt` | **保留** | `DateTime` | DATETIME(3) | NO | 无数据库默认；Prisma Client 维护（T2） | `updated_at` | — | — | T3 + T2 + T10 | 更新时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `deletedAt` | **删除** | `—` | — | — | — | `—` | — | — | T5 | deleted at；ACC-ABS |

### ProductVariant

数据库表名：`product_variants`。物理字段 10 个，Prisma 关系字段 5 个。

目标唯一约束：`productId + name（T5-UQ）`。

目标普通索引：`IDX1(productId, status, sortOrder)`。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `productId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `product_id` | UQ(productId, name; T5-UQ); IDX1(productId, status, sortOrder) | -> products.id; N:1; onDelete Restrict | T3 + T8 + T5 + T9 + T10 | 关联标识；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `name` | **保留** | `String` | VARCHAR(80) | NO | —（显式填写） | `name` | UQ(productId, name; T5-UQ) | — | T3 + T5 + T9 + T10 | 规格名称；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `priceFen` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `price_fen` | — | — | T3 + T11 + T10 | 规格售价，整数分；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC |
| `inventoryMode` | **保留** | `InventoryMode` | ENUM('MANAGED', 'UNMANAGED') | NO | —（显式填写） | `inventory_mode` | — | — | T3 + T10 | 是否参与库存管理；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `status` | **保留** | `CommonStatus` | ENUM('ACTIVE', 'DISABLED') | NO | —（显式填写） | `status` | IDX1(productId, status, sortOrder) | — | T3 + A1-A9 + T9 + T10 | 生命周期状态；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `sortOrder` | **保留** | `Int` | INT | NO | 0（最终） | `sort_order` | IDX1(productId, status, sortOrder) | — | T3 + T9 + T10 | 展示排序；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | — | — | T3 + T2 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `updatedAt` | **保留** | `DateTime` | DATETIME(3) | NO | 无数据库默认；Prisma Client 维护（T2） | `updated_at` | — | — | T3 + T2 + T10 | 更新时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `deletedAt` | **删除** | `—` | — | — | — | `—` | — | — | T5 | deleted at；ACC-ABS |

### VariantOptionGroup

数据库表名：`variant_option_groups`。物理字段 8 个，Prisma 关系字段 2 个。

目标唯一约束：`variantId + name（T6）`。

目标普通索引：无。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `variantId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `variant_id` | UQ(variantId, name; T6) | -> product_variants.id; N:1; onDelete Restrict | T3 + T8 + T6 + T9 + T10 | 关联标识；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `code` | **删除** | `—` | — | — | — | `—` | — | — | A1-A9 | code；ACC-ABS |
| `name` | **保留** | `String` | VARCHAR(80) | NO | —（显式填写） | `name` | UQ(variantId, name; T6) | — | T3 + T6 + T9 + T10 | 选项组名称；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `selectionType` | **保留** | `OptionSelectionType` | ENUM('SINGLE', 'MULTI') | NO | —（显式填写） | `selection_type` | — | — | T3 + T10 | 单选或多选；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `required` | **保留** | `Boolean` | TINYINT(1) | NO | —（显式填写） | `required` | — | — | T3 + T10 | 是否必选；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `sortOrder` | **保留** | `Int` | INT | NO | 0（最终） | `sort_order` | — | — | T3 + T9 + T10 | 展示排序；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `status` | **保留** | `CommonStatus` | ENUM('ACTIVE', 'DISABLED') | NO | —（显式填写） | `status` | — | — | T3 + A1-A9 + T10 | 生命周期状态；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |

### VariantOptionValue

数据库表名：`variant_option_values`。物理字段 7 个，Prisma 关系字段 3 个。

目标唯一约束：`optionGroupId + name（T6）`。

目标普通索引：无。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `optionGroupId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `option_group_id` | UQ(optionGroupId, name; T6) | -> variant_option_groups.id; N:1; onDelete Restrict | T3 + T8 + T6 + T9 + T10 | 关联标识；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `code` | **删除** | `—` | — | — | — | `—` | — | — | A1-A9 | code；ACC-ABS |
| `name` | **保留** | `String` | VARCHAR(80) | NO | —（显式填写） | `name` | UQ(optionGroupId, name; T6) | — | T3 + T6 + T9 + T10 | 选项值名称；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `priceDeltaFen` | **保留** | `BigInt` | BIGINT | NO | 0（最终） | `price_delta_fen` | — | — | T3 + T11 + T10 | 每份选项加价，整数分；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC |
| `sortOrder` | **保留** | `Int` | INT | NO | 0（最终） | `sort_order` | — | — | T3 + T9 + T10 | 展示排序；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `status` | **保留** | `CommonStatus` | ENUM('ACTIVE', 'DISABLED') | NO | —（显式填写） | `status` | — | — | T3 + A1-A9 + T10 | 生命周期状态；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |

### VariantRecipe

数据库表名：`variant_recipes`。物理字段 5 个，Prisma 关系字段 2 个。

目标唯一约束：`variantId + materialId + role（既有决策）`。

目标普通索引：无。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `variantId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `variant_id` | UQ(variantId, materialId, role; 既有决策) | -> product_variants.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 关联标识；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `materialId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `material_id` | UQ(variantId, materialId, role; 既有决策) | -> materials.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 配方原料；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `role` | **保留** | `RecipeMaterialRole` | ENUM('BASE', 'TAKEAWAY_EXTRA') | NO | —（显式填写） | `role` | UQ(variantId, materialId, role; 既有决策) | — | T3 + T9 + T10 | 基础或打包耗材；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-ENUM |
| `quantity` | **保留** | `Decimal` | DECIMAL(18,3) | NO | —（显式填写） | `quantity` | — | — | T3 + T11 + T10 + R5 | 每份配方用量；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-ROUND |

### RecipeModifier

数据库表名：`recipe_modifiers`。物理字段 6 个，Prisma 关系字段 3 个。

目标唯一约束：`variantId + optionValueId + materialId + targetRole（既有决策）`。

目标普通索引：`IDX1(optionValueId)`。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `variantId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `variant_id` | UQ(variantId, optionValueId, materialId, targetRole; 既有决策) | -> product_variants.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 关联标识；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `optionValueId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `option_value_id` | UQ(variantId, optionValueId, materialId, targetRole; 既有决策); IDX1(optionValueId) | -> variant_option_values.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 触发配方调整的选项；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `materialId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `material_id` | UQ(variantId, optionValueId, materialId, targetRole; 既有决策) | -> materials.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 被调整原料；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `targetRole` | **保留** | `RecipeModifierTarget` | ENUM('BASE', 'TAKEAWAY_EXTRA') | NO | —（显式填写） | `target_role` | UQ(variantId, optionValueId, materialId, targetRole; 既有决策) | — | T3 + T9 + T10 | 调整目标配方角色；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-ENUM |
| `quantityDelta` | **保留** | `Decimal` | DECIMAL(18,3) | NO | —（显式填写） | `quantity_delta` | — | — | T3 + T11 + T10 + R5 | 固定数量增减；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-ROUND |

### Material

数据库表名：`materials`。物理字段 13 个，Prisma 关系字段 6 个。

目标唯一约束：`storeId + name（T5-UQ）`。

目标普通索引：`IDX1(storeId, status)`。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `storeId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `store_id` | UQ(storeId, name; T5-UQ); IDX1(storeId, status) | -> stores.id; N:1; onDelete Restrict | T3 + T8 + T5 + T9 + T10 | 所属门店；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `name` | **保留** | `String` | VARCHAR(120) | NO | —（显式填写） | `name` | UQ(storeId, name; T5-UQ) | — | T3 + T5 + T9 + T10 | 原材料名称；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `unit` | **保留** | `String` | VARCHAR(20) | NO | —（显式填写） | `unit` | — | — | T3 + A1-A9 + T10 | 规范计量单位；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `onHand` | **保留** | `Decimal` | DECIMAL(18,3) | NO | 0（最终） | `on_hand` | — | — | T3 + T11 + T10 | 当前在手数量；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC |
| `reserved` | **保留** | `Decimal` | DECIMAL(18,3) | NO | 0（最终） | `reserved` | — | — | T3 + T11 + T10 | 当前预占数量；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC |
| `warningThreshold` | **删除** | `—` | — | — | — | `—` | — | — | A1-A9 | warning threshold；ACC-ABS |
| `averageCostPerUnit` | **保留** | `Decimal` | DECIMAL(18,6) | NO | 0（最终） | `average_cost_per_unit` | — | — | T3 + T11 + T10 + R5 | 移动加权平均单位成本；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-ROUND |
| `status` | **保留** | `CommonStatus` | ENUM('ACTIVE', 'DISABLED') | NO | —（显式填写） | `status` | IDX1(storeId, status) | — | T3 + A1-A9 + T9 + T10 | 原材料启停状态；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `version` | **保留** | `Int` | INT | NO | 1（T4） | `version` | — | — | T3 + T4 + T10 | 库存行乐观锁；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | — | — | T3 + T2 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `updatedAt` | **保留** | `DateTime` | DATETIME(3) | NO | 无数据库默认；Prisma Client 维护（T2） | `updated_at` | — | — | T3 + T2 + T10 | 更新时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `deletedAt` | **删除** | `—` | — | — | — | `—` | 调整旧 IDX1 | — | T5 | deleted at；ACC-ABS |

### StockMovement

数据库表名：`stock_movements`。物理字段 17 个，Prisma 关系字段 6 个。

目标唯一约束：无额外复合唯一约束。

目标普通索引：`IDX1(materialId, createdAt)`、`IDX2(orderId, movementType)`、`IDX3(storeId, movementType, createdAt)`。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `movementNo` | **删除** | `—` | — | — | — | `—` | 删除旧 UQ | — | A1-A9 | movement no；ACC-ABS |
| `dedupeKey` | **保留** | `String` | VARCHAR(160) | NO | —（显式填写） | `dedupe_key` | UQ(dedupeKey) | — | T3 + T9 + T10 | 库存动作幂等键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `storeId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `store_id` | IDX3(storeId, movementType, createdAt) | -> stores.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 所属门店；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `materialId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `material_id` | IDX1(materialId, createdAt) | -> materials.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 变动原料；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `movementType` | **保留** | `StockMovementType` | ENUM('OPENING_BALANCE', 'STOCK_IN', 'RESERVE', 'RELEASE', 'CONSUME', 'ADJUST') | NO | —（显式填写） | `movement_type` | IDX2(orderId, movementType); IDX3(storeId, movementType, createdAt) | — | T3 + T9 + T10 | 库存变动类型；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `quantityDelta` | **保留** | `Decimal` | DECIMAL(18,3) | NO | —（显式填写） | `quantity_delta` | CHECK(stock_movement_direction) | — | T3 + T11 + T10 + R3 + R5 | 在手数量变化；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-LEDGER-SIGN, ACC-ROUND |
| `reservedDelta` | **保留** | `Decimal` | DECIMAL(18,3) | NO | —（显式填写） | `reserved_delta` | CHECK(stock_movement_direction) | — | T3 + T11 + T10 + R3 + R5 | 预占数量变化；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-LEDGER-SIGN, ACC-ROUND |
| `onHandAfter` | **保留** | `Decimal` | DECIMAL(18,3) | NO | —（显式填写） | `on_hand_after` | CHECK(nonnegative_balance) | — | T3 + T11 + T10 + R3 + R5 | 变动后在手余额；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-LEDGER-SIGN, ACC-ROUND |
| `reservedAfter` | **保留** | `Decimal` | DECIMAL(18,3) | NO | —（显式填写） | `reserved_after` | CHECK(nonnegative_balance) | — | T3 + T11 + T10 + R3 + R5 | 变动后预占余额；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-LEDGER-SIGN, ACC-ROUND |
| `unitCostSnapshot` | **保留** | `Decimal?` | DECIMAL(18,6) | YES（非成本型流水可空） | —（可空） | `unit_cost_snapshot` | — | — | T3 + T11 + T10 + R5 + R4 | 变动时单位成本快照；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-ROUND, ACC-LOSS-MATCH |
| `totalCostSnapshot` | **保留** | `Decimal?` | DECIMAL(18,6) | YES（非成本型流水可空） | —（可空） | `total_cost_snapshot` | — | — | T3 + T11 + T10 + R5 + R4 | 变动时总成本快照；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-ROUND, ACC-LOSS-MATCH |
| `orderId` | **保留** | `BigInt?` | BIGINT | YES（无订单来源时为空） | —（可空） | `order_id` | IDX2(orderId, movementType) | -> orders.id; N:0..1; onDelete Restrict | T3 + A1-A9 + T8 + T9 + T10 | 来源订单；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `orderItemId` | **保留** | `BigInt?` | BIGINT | YES（无明细来源时为空） | —（可空） | `order_item_id` | — | -> order_items.id; N:0..1; onDelete Restrict | T3 + A1-A9 + T8 + T10 | 来源订单明细；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `operatorStaffId` | **保留** | `BigInt?` | BIGINT | YES（员工认证未冻结） | —（可空） | `operator_staff_id` | — | -> staff.id; N:0..1; onDelete Restrict | T3 + A1-A9 + T8 + T10 | 操作员工；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `reason` | **保留** | `String?` | VARCHAR(500) | YES（无原因时为空） | —（可空） | `reason` | — | — | T3 + A1-A9 + T10 | 变动原因；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | IDX1(materialId, createdAt); IDX3(storeId, movementType, createdAt) | — | T3 + T2 + T9 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |

### LossRecord

数据库表名：`loss_records`。物理字段 15 个，Prisma 关系字段 6 个。

目标唯一约束：无额外复合唯一约束。

目标普通索引：`IDX1(materialId, occurredAt)`、`IDX2(storeId, occurredAt)`。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `lossNo` | **删除** | `—` | — | — | — | `—` | 删除旧 UQ | — | A1-A9 | loss no；ACC-ABS |
| `dedupeKey` | **保留** | `String` | VARCHAR(160) | NO | —（显式填写） | `dedupe_key` | UQ(dedupeKey) | — | T3 + T9 + T10 | 损耗幂等键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `storeId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `store_id` | IDX2(storeId, occurredAt) | -> stores.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 所属门店；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `materialId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `material_id` | IDX1(materialId, occurredAt) | -> materials.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 损耗原料；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `orderId` | **保留** | `BigInt?` | BIGINT | YES（非订单损耗为空） | —（可空） | `order_id` | — | -> orders.id; N:0..1; onDelete Restrict | T3 + A1-A9 + T8 + T9 + T10 | 可选来源订单；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `orderItemId` | **保留** | `BigInt?` | BIGINT | YES（非订单明细损耗为空） | —（可空） | `order_item_id` | — | -> order_items.id; N:0..1; onDelete Restrict | T3 + A1-A9 + T8 + T10 | 可选来源订单明细；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `stockMovementId` | **保留** | `BigInt?` | BIGINT | YES（订单内报损为空） | —（可空） | `stock_movement_id` | UQ(stockMovementId) | -> stock_movements.id; N:0..1; onDelete Restrict | T3 + A1-A9 + T8 + T9 + T10 + R4 | 额外损耗关联库存流水；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK, ACC-LOSS-MATCH |
| `quantity` | **保留** | `Decimal` | DECIMAL(18,3) | NO | —（显式填写） | `quantity` | — | — | T3 + T11 + T10 + R4 + R5 | 损耗数量；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-LOSS-MATCH, ACC-ROUND |
| `unitCostSnapshot` | **保留** | `Decimal` | DECIMAL(18,6) | NO | —（显式填写） | `unit_cost_snapshot` | — | — | T3 + T11 + T10 + R5 + R4 | 损耗时单位成本；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-ROUND, ACC-LOSS-MATCH |
| `lossCostSnapshot` | **保留** | `Decimal` | DECIMAL(18,6) | NO | —（显式填写） | `loss_cost_snapshot` | — | — | T3 + T11 + T10 + R4 + R5 | 损耗总成本；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-LOSS-MATCH, ACC-ROUND |
| `reason` | **保留** | `String` | VARCHAR(500) | NO | —（显式填写） | `reason` | — | — | T3 + A1-A9 + T10 | 损耗原因；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `operatorStaffId` | **保留** | `BigInt?` | BIGINT | YES（员工认证未冻结） | —（可空） | `operator_staff_id` | — | -> staff.id; N:0..1; onDelete Restrict | T3 + A1-A9 + T8 + T10 | 登记损耗员工；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `occurredAt` | **保留** | `DateTime` | DATETIME(3) | NO | —（业务事务显式填写） | `occurred_at` | IDX1(materialId, occurredAt); IDX2(storeId, occurredAt) | — | T3 + T2 + T9 + T10 | 实际损耗时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | — | — | T3 + T2 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |

### DiningTable

数据库表名：`dining_tables`。物理字段 8 个，Prisma 关系字段 2 个。

目标唯一约束：`storeId + code（T5-UQ）`。

目标普通索引：无。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `storeId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `store_id` | UQ(storeId, code; T5-UQ) | -> stores.id; N:1; onDelete Restrict | T3 + T8 + T5 + T9 + T10 | 所属门店；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `name` | **保留** | `String` | VARCHAR(40) | NO | —（显式填写） | `name` | — | — | T3 + A1-A9 + T10 | 桌台展示名称；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `code` | **保留** | `String` | VARCHAR(40) | NO | —（显式填写） | `code` | UQ(storeId, code; T5-UQ) | — | T3 + T5 + T9 + T10 | 扫码桌码；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `capacity` | **删除** | `—` | — | — | — | `—` | — | — | A1-A9 | capacity；ACC-ABS |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | — | — | T3 + T2 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `updatedAt` | **保留** | `DateTime` | DATETIME(3) | NO | 无数据库默认；Prisma Client 维护（T2） | `updated_at` | — | — | T3 + T2 + T10 | 更新时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `deletedAt` | **删除** | `—` | — | — | — | `—` | 删除旧 IDX1 | — | T5 | deleted at；ACC-ABS |

### DiningSession

数据库表名：`dining_sessions`。物理字段 11 个，Prisma 关系字段 5 个。

目标唯一约束：无额外复合唯一约束。

目标普通索引：`IDX1(tableId, status)`、`IDX2(storeId, status, openedAt)`。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `storeId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `store_id` | IDX2(storeId, status, openedAt) | -> stores.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 所属门店；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `tableId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `table_id` | IDX1(tableId, status) | -> dining_tables.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 桌台；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `status` | **保留** | `DiningSessionStatus` | ENUM('OPEN', 'CLOSED') | NO | —（显式填写） | `status` | IDX1(tableId, status); IDX2(storeId, status, openedAt) | — | T3 + T9 + T10 | 桌单状态；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `discountFen` | **删除** | `—` | — | — | — | `—` | — | — | A1-A9 | discount fen；ACC-ABS |
| `version` | **保留** | `Int` | INT | NO | 1（T4） | `version` | — | — | T3 + T4 + T10 | 桌单乐观锁；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC |
| `openedAt` | **保留** | `DateTime` | DATETIME(3) | NO | —（业务事务显式填写） | `opened_at` | IDX2(storeId, status, openedAt) | — | T3 + T2 + T9 + T10 | 实际开台时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `closedAt` | **保留** | `DateTime?` | DATETIME(3) | YES（OPEN 时为空；CLOSED 时必填） | —（状态到达时显式填写） | `closed_at` | — | — | T3 + T2 + T10 | 实际关台时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `closedByStaffId` | **保留** | `BigInt?` | BIGINT | YES（OPEN 时为空；员工可不记录） | —（可空） | `closed_by_staff_id` | — | -> staff.id; N:0..1; onDelete Restrict | T3 + T8 + T10 | 关台员工；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | — | — | T3 + T2 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `updatedAt` | **保留** | `DateTime` | DATETIME(3) | NO | 无数据库默认；Prisma Client 维护（T2） | `updated_at` | — | — | T3 + T2 + T10 | 更新时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |

### Order

数据库表名：`orders`。物理字段 19 个，Prisma 关系字段 7 个。

目标唯一约束：无额外复合唯一约束。

目标普通索引：`IDX1(storeId, status, createdAt)`、`IDX2(sessionId, status)`、`IDX3(customerUserId, createdAt)`、`IDX4(completedAt)`。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `storeId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `store_id` | IDX1(storeId, status, createdAt) | -> stores.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 所属门店；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `customerUserId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `customer_user_id` | IDX3(customerUserId, createdAt) | -> users.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 下单顾客；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `orderNo` | **保留** | `String` | VARCHAR(40) | NO | —（显式填写） | `order_no` | UQ(orderNo) | — | T3 + T9 + T10 | 订单编号；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `idempotencyKey` | **保留** | `String` | VARCHAR(160) | NO | —（显式填写） | `idempotency_key` | UQ(idempotencyKey) | — | T3 + T9 + T10 | 创建订单幂等键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `channel` | **保留** | `OrderChannel` | ENUM('DINE', 'TAKEAWAY') | NO | —（显式填写） | `channel` | CHECK(order_channel_session) | — | T3 + T10 + R2 | 堂食或打包；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM, ACC-ORDER-TARGET |
| `sessionId` | **保留** | `BigInt?` | BIGINT | YES（仅 DINE 非空；TAKEAWAY 必须为空） | —（可空） | `session_id` | CHECK(order_channel_session); IDX2(sessionId, status) | -> dining_sessions.id; N:0..1; onDelete Restrict | T3 + T8 + T9 + T10 + R2 | 堂食桌单；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK, ACC-ORDER-TARGET |
| `status` | **保留** | `OrderStatus` | ENUM('PENDING_ACCEPTANCE', 'ACCEPTED', 'PREPARING', 'COMPLETED', 'CANCELLED') | NO | —（显式填写） | `status` | IDX1(storeId, status, createdAt); IDX2(sessionId, status) | — | T3 + T9 + T10 | 订单履约状态；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `subtotalFen` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `subtotal_fen` | — | — | T3 + T11 + T10 | 明细合计，整数分；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC |
| `discountFen` | **删除** | `—` | — | — | — | `—` | — | — | A1-A9 | discount fen；ACC-ABS |
| `totalAmountFen` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `total_amount_fen` | — | — | T3 + T11 + T10 | 订单总额，整数分；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC |
| `version` | **保留** | `Int` | INT | NO | 1（T4） | `version` | — | — | T3 + T4 + T10 | 订单乐观锁；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | IDX1(storeId, status, createdAt); IDX3(customerUserId, createdAt) | — | T3 + T2 + T9 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `acceptedAt` | **保留** | `DateTime?` | DATETIME(3) | YES（未接单时为空） | —（状态到达时显式填写） | `accepted_at` | — | — | T3 + T2 + T10 | 接单时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `preparingAt` | **保留** | `DateTime?` | DATETIME(3) | YES（未制作时为空） | —（状态到达时显式填写） | `preparing_at` | — | — | T3 + T2 + T10 | 开始制作时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `completedAt` | **保留** | `DateTime?` | DATETIME(3) | YES（未完成时为空） | —（状态到达时显式填写） | `completed_at` | IDX4(completedAt) | — | T3 + T2 + T9 + T10 | 完成时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `cancelledAt` | **保留** | `DateTime?` | DATETIME(3) | YES（未取消时为空） | —（状态到达时显式填写） | `cancelled_at` | — | — | T3 + T2 + T10 | 取消时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `cancelReason` | **保留** | `String?` | VARCHAR(500) | YES（仅取消可填写） | —（可空） | `cancel_reason` | — | — | T3 + T10 | 取消原因；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `updatedAt` | **保留** | `DateTime` | DATETIME(3) | NO | 无数据库默认；Prisma Client 维护（T2） | `updated_at` | — | — | T3 + T2 + T10 | 更新时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |

### OrderItem

数据库表名：`order_items`。物理字段 11 个，Prisma 关系字段 7 个。

目标唯一约束：无额外复合唯一约束。

目标普通索引：`IDX1(orderId)`、`IDX2(productId, createdAt)`、`IDX3(variantId, createdAt)`。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `orderId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `order_id` | IDX1(orderId) | -> orders.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 关联标识；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `productId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `product_id` | IDX2(productId, createdAt) | -> products.id; N:1; onDelete Restrict | T3 + A1-A9 + T8 + T9 + T10 | 商品追溯来源；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `variantId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `variant_id` | IDX3(variantId, createdAt) | -> product_variants.id; N:1; onDelete Restrict | T3 + A1-A9 + T8 + T9 + T10 | 规格追溯来源；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `productNameSnapshot` | **保留** | `String` | VARCHAR(120) | NO | —（显式填写） | `product_name_snapshot` | — | — | T3 + T10 | 下单商品名快照；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `variantNameSnapshot` | **保留** | `String` | VARCHAR(80) | NO | —（显式填写） | `variant_name_snapshot` | — | — | T3 + T10 | 下单规格名快照；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `unitPriceFen` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `unit_price_fen` | — | — | T3 + T11 + T10 | 下单单价，整数分；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC |
| `quantity` | **保留** | `Int` | INT | NO | —（显式填写） | `quantity` | — | — | T3 + T11 + T10 | 购买数量；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC |
| `lineSubtotalFen` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `line_subtotal_fen` | — | — | T3 + T11 + T10 | 明细金额，整数分；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC |
| `remark` | **保留** | `String?` | VARCHAR(500) | YES（无备注时为空） | —（可空） | `remark` | — | — | T3 + T10 | 制作备注；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | IDX2(productId, createdAt); IDX3(variantId, createdAt) | — | T3 + T2 + T9 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |

### OrderItemOption

数据库表名：`order_item_options`。物理字段 8 个，Prisma 关系字段 2 个。

目标唯一约束：`orderItemId + optionValueId（T7）`。

目标普通索引：`IDX1(optionValueId)`。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `orderItemId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `order_item_id` | UQ(orderItemId, optionValueId; T7) | -> order_items.id; N:1; onDelete Restrict | T3 + T8 + T7 + T9 + T10 | 关联标识；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `optionValueId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `option_value_id` | UQ(orderItemId, optionValueId; T7); IDX1(optionValueId) | -> variant_option_values.id; N:1; onDelete Restrict | T3 + A1-A9 + T8 + T7 + T9 + T10 | 选项来源；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `groupCodeSnapshot` | **删除** | `—` | — | — | — | `—` | — | — | A7 + T7 | group code snapshot；ACC-ABS |
| `groupNameSnapshot` | **保留** | `String` | VARCHAR(80) | NO | —（显式填写） | `group_name_snapshot` | — | — | T3 + T10 | 选项组名称快照；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `valueCodeSnapshot` | **删除** | `—` | — | — | — | `—` | — | — | A7 + T7 | value code snapshot；ACC-ABS |
| `valueNameSnapshot` | **保留** | `String` | VARCHAR(80) | NO | —（显式填写） | `value_name_snapshot` | — | — | T3 + T10 | 选项值名称快照；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `priceDeltaFenSnapshot` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `price_delta_fen_snapshot` | — | — | T3 + T11 + T10 | 每份选项加价快照；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |

### OrderItemMaterial

数据库表名：`order_item_materials`。物理字段 10 个，Prisma 关系字段 2 个。

目标唯一约束：`orderItemId + materialId + source（既有决策）`。

目标普通索引：`IDX1(materialId)`。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `orderItemId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `order_item_id` | UQ(orderItemId, materialId, source; 既有决策) | -> order_items.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 关联标识；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `materialId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `material_id` | UQ(orderItemId, materialId, source; 既有决策); IDX1(materialId) | -> materials.id; N:1; onDelete Restrict | T3 + A1-A9 + T8 + T9 + T10 | 原料追溯来源；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-FK |
| `materialNameSnapshot` | **保留** | `String` | VARCHAR(120) | NO | —（显式填写） | `material_name_snapshot` | — | — | T3 + T10 | 原料名称快照；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `unitSnapshot` | **保留** | `String` | VARCHAR(20) | NO | —（显式填写） | `unit_snapshot` | — | — | T3 + T10 | 原料单位快照；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `quantityPerItem` | **保留** | `Decimal` | DECIMAL(18,3) | NO | —（显式填写） | `quantity_per_item` | — | — | T3 + T11 + T10 + R5 | 每份用量快照；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-ROUND |
| `totalQuantity` | **保留** | `Decimal` | DECIMAL(18,3) | NO | —（显式填写） | `total_quantity` | — | — | T3 + T11 + T10 + R5 | 总用量快照；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-ROUND |
| `actualUnitCostSnapshot` | **保留** | `Decimal?` | DECIMAL(18,6) | YES（实际消耗前为空） | —（可空） | `actual_unit_cost_snapshot` | — | — | T3 + T11 + T10 + R5 | 实际消耗单位成本；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-ROUND |
| `actualTotalCostSnapshot` | **保留** | `Decimal?` | DECIMAL(18,6) | YES（实际消耗前为空） | —（可空） | `actual_total_cost_snapshot` | — | — | T3 + T11 + T10 + R5 | 实际消耗总成本；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC, ACC-ROUND |
| `source` | **保留** | `OrderItemMaterialSource` | ENUM('BASE', 'TAKEAWAY_EXTRA', 'MODIFIER') | NO | —（显式填写） | `source` | UQ(orderItemId, materialId, source; 既有决策) | — | T3 + T11 + T9 + T10 | 基础/打包耗材/选项调整来源；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ, ACC-ENUM |

### PaymentRecord

数据库表名：`payment_records`。物理字段 17 个，Prisma 关系字段 6 个。

目标唯一约束：无额外复合唯一约束。

目标普通索引：`IDX1(storeId, status, receivedAt)`、`IDX2(sessionId, status)`、`IDX3(orderId, status)`。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `paymentNo` | **保留** | `String` | VARCHAR(64) | NO | —（显式填写） | `payment_no` | UQ(paymentNo) | — | T3 + T9 + T10 | 收款编号；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `idempotencyKey` | **保留** | `String` | VARCHAR(160) | NO | —（显式填写） | `idempotency_key` | UQ(idempotencyKey) | — | T3 + T9 + T10 | 收款幂等键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `storeId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `store_id` | IDX1(storeId, status, receivedAt) | -> stores.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 所属门店；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `sessionId` | **保留** | `BigInt?` | BIGINT | YES（仅堂饮收款填写；与 orderId XOR） | —（可空） | `session_id` | IDX2(sessionId, status) | -> dining_sessions.id; N:0..1; onDelete Restrict | T3 + T8 + T9 + T10 | 堂饮收款归属桌单；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `orderId` | **保留** | `BigInt?` | BIGINT | YES（仅打包收款填写；与 sessionId XOR） | —（可空） | `order_id` | IDX3(orderId, status) | -> orders.id; N:0..1; onDelete Restrict | T3 + T8 + T9 + T10 | 打包收款归属订单；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `paymentMethod` | **保留** | `PaymentMethod` | ENUM('CASH', 'WECHAT', 'ALIPAY', 'POS', 'OTHER') | NO | —（显式填写） | `payment_method` | — | — | T3 + T10 | 付款方式；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `amountFen` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `amount_fen` | — | — | T3 + T11 + T10 | 实际收款金额，整数分；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC |
| `receivedAt` | **保留** | `DateTime` | DATETIME(3) | NO | —（业务事务显式填写） | `received_at` | IDX1(storeId, status, receivedAt) | — | T3 + T2 + T9 + T10 | 实际收款时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `operatorStaffId` | **保留** | `BigInt?` | BIGINT | YES（员工认证未冻结） | —（可空） | `operator_staff_id` | — | -> staff.id; N:0..1; onDelete Restrict | T3 + T8 + T10 | 收款员工；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `status` | **保留** | `PaymentStatus` | ENUM('ACTIVE', 'VOIDED') | NO | —（显式填写） | `status` | IDX1(storeId, status, receivedAt); IDX2(sessionId, status); IDX3(orderId, status) | — | T3 + T9 + T10 | 收款状态；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `remark` | **保留** | `String?` | VARCHAR(500) | YES（无备注时为空） | —（可空） | `remark` | — | — | T3 + T10 | 收款备注；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `voidedAt` | **保留** | `DateTime?` | DATETIME(3) | YES（ACTIVE 时为空；VOIDED 时填写） | —（状态到达时显式填写） | `voided_at` | — | — | T3 + T2 + T10 | 误登记作废时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `voidedByStaffId` | **保留** | `BigInt?` | BIGINT | YES（ACTIVE 时为空；VOIDED 时填写） | —（可空） | `voided_by_staff_id` | — | -> staff.id; N:0..1; onDelete Restrict | T3 + T8 + T10 | 误登记作废员工；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `voidReason` | **保留** | `String?` | VARCHAR(500) | YES（ACTIVE 时为空；VOIDED 时填写） | —（可空） | `void_reason` | — | — | T3 + T10 | 误登记作废原因；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | — | — | T3 + T2 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `updatedAt` | **保留** | `DateTime` | DATETIME(3) | NO | 无数据库默认；Prisma Client 维护（T2） | `updated_at` | — | — | T3 + T2 + T10 | 更新时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |

### RefundRecord

数据库表名：`refund_records`。物理字段 14 个，Prisma 关系字段 3 个。

目标唯一约束：无额外复合唯一约束。

目标普通索引：`IDX1(paymentRecordId, status, refundedAt)`。

| 字段 | 结果 | Prisma 类型（目标） | MySQL 类型（目标） | 允许 NULL | 默认/生成 | @map 列名 | 主键/唯一/索引 | 外键目标 / 基数 / onDelete | 决策依据 | 业务说明 / 验收 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | **保留** | `BigInt` | BIGINT | NO | AUTO_INCREMENT（T1） | `id` | PK | — | T3 + T1 + T10 | 内部主键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-PK, ACC-API |
| `refundNo` | **保留** | `String` | VARCHAR(64) | NO | —（显式填写） | `refund_no` | UQ(refundNo) | — | T3 + T9 + T10 | 退款编号；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `idempotencyKey` | **保留** | `String` | VARCHAR(160) | NO | —（显式填写） | `idempotency_key` | UQ(idempotencyKey) | — | T3 + T9 + T10 | 退款幂等键；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-UQ |
| `paymentRecordId` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `payment_record_id` | IDX1(paymentRecordId, status, refundedAt) | -> payment_records.id; N:1; onDelete Restrict | T3 + T8 + T9 + T10 | 原收款流水；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `amountFen` | **保留** | `BigInt` | BIGINT | NO | —（显式填写） | `amount_fen` | — | — | T3 + T11 + T10 | 实际退款金额，整数分；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-CALC |
| `reason` | **保留** | `String` | VARCHAR(500) | NO | —（显式填写） | `reason` | — | — | T3 + T10 | 退款原因；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `status` | **保留** | `RefundStatus` | ENUM('ACTIVE', 'VOIDED') | NO | —（显式填写） | `status` | IDX1(paymentRecordId, status, refundedAt) | — | T3 + T9 + T10 | 退款状态；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-ENUM |
| `refundedAt` | **保留** | `DateTime` | DATETIME(3) | NO | —（业务事务显式填写） | `refunded_at` | IDX1(paymentRecordId, status, refundedAt) | — | T3 + T2 + T9 + T10 | 实际退款时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `operatorStaffId` | **保留** | `BigInt?` | BIGINT | YES（员工认证未冻结） | —（可空） | `operator_staff_id` | — | -> staff.id; N:0..1; onDelete Restrict | T3 + T8 + T10 | 退款员工；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `voidedAt` | **保留** | `DateTime?` | DATETIME(3) | YES（ACTIVE 时为空；VOIDED 时填写） | —（状态到达时显式填写） | `voided_at` | — | — | T3 + T2 + T10 | 误登记作废时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `voidedByStaffId` | **保留** | `BigInt?` | BIGINT | YES（ACTIVE 时为空；VOIDED 时填写） | —（可空） | `voided_by_staff_id` | — | -> staff.id; N:0..1; onDelete Restrict | T3 + T8 + T10 | 误登记作废员工；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP, ACC-FK |
| `voidReason` | **保留** | `String?` | VARCHAR(500) | YES（ACTIVE 时为空；VOIDED 时填写） | —（可空） | `void_reason` | — | — | T3 + T10 | 误登记作废原因；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `createdAt` | **保留** | `DateTime` | DATETIME(3) | NO | CURRENT_TIMESTAMP(3)（T2） | `created_at` | — | — | T3 + T2 + T10 | 创建时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |
| `updatedAt` | **保留** | `DateTime` | DATETIME(3) | NO | 无数据库默认；Prisma Client 维护（T2） | `updated_at` | — | — | T3 + T2 + T10 | 更新时间；ACC-TYPE, ACC-NULL, ACC-DEFAULT, ACC-MAP |

## 5. 唯一约束

### 5.1 冻结的 8 组唯一约束

| 模型 | 唯一字段组 |
| --- | --- |
| Category | `storeId, name` |
| Product | `storeId, name` |
| ProductVariant | `productId, name` |
| Material | `storeId, name` |
| DiningTable | `storeId, code` |
| VariantOptionGroup | `variantId, name` |
| VariantOptionValue | `optionGroupId, name` |
| OrderItemOption | `orderItemId, optionValueId` |

### 5.2 其他保留唯一约束

- `User.openid`
- `Order.orderNo`
- `Order.idempotencyKey`
- `PaymentRecord.paymentNo`
- `PaymentRecord.idempotencyKey`
- `RefundRecord.refundNo`
- `RefundRecord.idempotencyKey`
- `StockMovement.dedupeKey`
- `LossRecord.dedupeKey`
- `LossRecord.stockMovementId`
- `VariantRecipe[variantId, materialId, role]`
- `RecipeModifier[variantId, optionValueId, materialId, targetRole]`
- `OrderItemMaterial[orderItemId, materialId, source]`

`StockMovement.movementNo`、`LossRecord.lossNo` 已删除，不保留对应唯一约束。

### 5.3 普通索引最终清单

普通索引仅用于实际菜单、订单、库存、资金和报表查询。未列出的普通索引不得创建；MySQL 为外键自动生成的支撑索引另在 Migration 中核验，不作为业务普通索引。

| 模型 | 普通索引 |
| --- | --- |
| Store | 无 |
| User | 无 |
| Staff | 无 |
| Category | 无 |
| Product | `categoryId + status + sortOrder` |
| ProductVariant | `productId + status + sortOrder` |
| VariantOptionGroup | 无 |
| VariantOptionValue | 无 |
| VariantRecipe | 无 |
| RecipeModifier | `optionValueId` |
| Material | `storeId + status` |
| StockMovement | `materialId + createdAt`、`orderId + movementType`、`storeId + movementType + createdAt` |
| LossRecord | `materialId + occurredAt`、`storeId + occurredAt` |
| DiningTable | 无 |
| DiningSession | `tableId + status`、`storeId + status + openedAt` |
| Order | `storeId + status + createdAt`、`sessionId + status`、`customerUserId + createdAt`、`completedAt` |
| OrderItem | `orderId`、`productId + createdAt`、`variantId + createdAt` |
| OrderItemOption | `optionValueId` |
| OrderItemMaterial | `materialId` |
| PaymentRecord | `storeId + status + receivedAt`、`sessionId + status`、`orderId + status` |
| RefundRecord | `paymentRecordId + status + refundedAt` |

## 6. 外键与删除策略

| 关系字段 | 外键列 | 目标 | 基数 | onDelete |
| --- | --- | --- | --- | --- |
| `Staff.store` | `store_id` | `stores.id` | 1 | Restrict |
| `Category.store` | `store_id` | `stores.id` | 1 | Restrict |
| `Product.store` | `store_id` | `stores.id` | 1 | Restrict |
| `Product.category` | `category_id` | `categories.id` | 1 | Restrict |
| `ProductVariant.product` | `product_id` | `products.id` | 1 | Restrict |
| `VariantOptionGroup.variant` | `variant_id` | `product_variants.id` | 1 | Restrict |
| `VariantOptionValue.optionGroup` | `option_group_id` | `variant_option_groups.id` | 1 | Restrict |
| `VariantRecipe.variant` | `variant_id` | `product_variants.id` | 1 | Restrict |
| `VariantRecipe.material` | `material_id` | `materials.id` | 1 | Restrict |
| `RecipeModifier.variant` | `variant_id` | `product_variants.id` | 1 | Restrict |
| `RecipeModifier.optionValue` | `option_value_id` | `variant_option_values.id` | 1 | Restrict |
| `RecipeModifier.material` | `material_id` | `materials.id` | 1 | Restrict |
| `Material.store` | `store_id` | `stores.id` | 1 | Restrict |
| `StockMovement.store` | `store_id` | `stores.id` | 1 | Restrict |
| `StockMovement.material` | `material_id` | `materials.id` | 1 | Restrict |
| `StockMovement.order` | `order_id` | `orders.id` | 0..1 | Restrict |
| `StockMovement.orderItem` | `order_item_id` | `order_items.id` | 0..1 | Restrict |
| `StockMovement.operatorStaff` | `operator_staff_id` | `staff.id` | 0..1 | Restrict |
| `LossRecord.store` | `store_id` | `stores.id` | 1 | Restrict |
| `LossRecord.material` | `material_id` | `materials.id` | 1 | Restrict |
| `LossRecord.order` | `order_id` | `orders.id` | 0..1 | Restrict |
| `LossRecord.orderItem` | `order_item_id` | `order_items.id` | 0..1 | Restrict |
| `LossRecord.stockMovement` | `stock_movement_id` | `stock_movements.id` | 0..1 | Restrict |
| `LossRecord.operatorStaff` | `operator_staff_id` | `staff.id` | 0..1 | Restrict |
| `DiningTable.store` | `store_id` | `stores.id` | 1 | Restrict |
| `DiningSession.store` | `store_id` | `stores.id` | 1 | Restrict |
| `DiningSession.table` | `table_id` | `dining_tables.id` | 1 | Restrict |
| `DiningSession.closedBy` | `closed_by_staff_id` | `staff.id` | 0..1 | Restrict |
| `Order.store` | `store_id` | `stores.id` | 1 | Restrict |
| `Order.customer` | `customer_user_id` | `users.id` | 1 | Restrict |
| `Order.session` | `session_id` | `dining_sessions.id` | 0..1 | Restrict |
| `OrderItem.order` | `order_id` | `orders.id` | 1 | Restrict |
| `OrderItem.product` | `product_id` | `products.id` | 1 | Restrict |
| `OrderItem.variant` | `variant_id` | `product_variants.id` | 1 | Restrict |
| `OrderItemOption.orderItem` | `order_item_id` | `order_items.id` | 1 | Restrict |
| `OrderItemOption.optionValue` | `option_value_id` | `variant_option_values.id` | 1 | Restrict |
| `OrderItemMaterial.orderItem` | `order_item_id` | `order_items.id` | 1 | Restrict |
| `OrderItemMaterial.material` | `material_id` | `materials.id` | 1 | Restrict |
| `PaymentRecord.store` | `store_id` | `stores.id` | 1 | Restrict |
| `PaymentRecord.session` | `session_id` | `dining_sessions.id` | 0..1 | Restrict |
| `PaymentRecord.order` | `order_id` | `orders.id` | 0..1 | Restrict |
| `PaymentRecord.operatorStaff` | `operator_staff_id` | `staff.id` | 0..1 | Restrict |
| `PaymentRecord.voidedByStaff` | `voided_by_staff_id` | `staff.id` | 0..1 | Restrict |
| `RefundRecord.paymentRecord` | `payment_record_id` | `payment_records.id` | 1 | Restrict |
| `RefundRecord.operatorStaff` | `operator_staff_id` | `staff.id` | 0..1 | Restrict |
| `RefundRecord.voidedByStaff` | `voided_by_staff_id` | `staff.id` | 0..1 | Restrict |

约束：

1. 上表所有关系均为 `Restrict`。
2. 禁止新增 Cascade 或 SetNull。
3. LossRecord 的订单、订单明细和库存流水关联均可空，但独立损耗必须填写 `stockMovementId`。
4. PaymentRecord 的 `sessionId`、`orderId` 必须恰好一个非空。
5. 员工操作人关系暂按当前可空关联保留，不推导员工认证结构。

## 7. 特殊业务规则

### 7.1 资金归属

`PaymentRecord` 必须且只能关联桌单或订单之一：

```text
session_id IS NULL XOR order_id IS NULL
```

数据库通过 CHECK 保证 XOR；服务层在事务内根据收款目标锁定对应 Session/Order，校验渠道、门店、未结金额和幂等键。任何一侧都不允许依赖前端传入归属。

### 7.2 订单渠道与桌单关联

| channel | session_id | 含义 |
| --- | --- | --- |
| DINE | NOT NULL | 堂食订单必须挂活动桌单 |
| TAKEAWAY | NULL | 打包订单不得挂桌单 |

数据库目标 CHECK：

```text
(channel = 'DINE' AND session_id IS NOT NULL)
OR
(channel = 'TAKEAWAY' AND session_id IS NULL)
```

服务层还必须在创建堂食订单时锁定并校验桌单为 OPEN、桌单属于当前 Store，并保证订单与该桌单同店。数据库 CHECK 负责最终组合完整性，服务层负责活动桌单和归属语义。

### 7.3 库存流水方向规则

| movementType | quantityDelta | reservedDelta | 额外语义 |
| --- | --- | --- | --- |
| OPENING_BALANCE | >= 0 | = 0 | 期初建账 |
| STOCK_IN | > 0 | = 0 | 采购入库 |
| RESERVE | = 0 | > 0 | 仅增加预占 |
| RELEASE | = 0 | < 0 | 仅释放预占 |
| CONSUME | < 0 | < 0 | 绝对值必须相等 |
| ADJUST | != 0 | = 0 | 正负方向由盘点或独立损耗决定 |

余额约束：

```text
on_hand_after >= 0
reserved_after >= 0
reserved_after <= on_hand_after
```

变化量字段允许为负数，不能套用非负 CHECK；非负约束只作用于变动后的余额。ADJUST 的正负方向必须由业务场景明确，独立损耗使用负数量。

### 7.4 库存与损耗成本

- 已计入订单材料消耗的报损：`LossRecord.stockMovementId IS NULL`，不再次扣库存，不再次累计成本。
- 独立损耗：同事务写入 `StockMovement(ADJUST, quantityDelta = -lossQty)` 和 `LossRecord`，并填写 `stockMovementId`。
- 成本唯一累计来源：`StockMovement(CONSUME).totalCostSnapshot` 加 `LossRecord(lossCostSnapshot) WHERE stockMovementId IS NOT NULL`。
- `OrderItemMaterial.actualTotalCostSnapshot` 只用于订单维度下钻和交叉核对，不重复累计。
- 所有数量使用 `Decimal(18,3)`，所有单位/总成本使用 `Decimal(18,6)`，禁止 JS 浮点计算。

### 7.5 独立损耗关联一致性

当 `LossRecord.stockMovementId` 非空时，服务层必须在同一事务内保证：

```text
LossRecord.storeId = StockMovement.storeId
LossRecord.materialId = StockMovement.materialId
StockMovement.movementType = 'ADJUST'
StockMovement.quantityDelta = -LossRecord.quantity
StockMovement.unitCostSnapshot IS NOT NULL
StockMovement.totalCostSnapshot IS NOT NULL
StockMovement.unitCostSnapshot = LossRecord.unitCostSnapshot
StockMovement.totalCostSnapshot = LossRecord.lossCostSnapshot
LossRecord.lossCostSnapshot = ROUND_HALF_UP(LossRecord.unitCostSnapshot × LossRecord.quantity, 6)
LossRecord.stockMovementId 唯一
```

独立损耗还必须满足：

```text
LossRecord.quantity > 0
LossRecord.unitCostSnapshot >= 0
LossRecord.lossCostSnapshot >= 0
```

即使两边总成本相同，只要单位成本不一致就必须拒绝。例如损耗 2kg、单位成本 10.000000 元/kg，总成本应为 ROUND_HALF_UP(10.000000 × 2, 6) = 20.000000 元；关联流水若记录单位成本 8.000000 元/kg，即使总成本填写 20.000000 元也不通过。

数据库负责 FK、唯一约束和余额约束；跨表字段等式由服务事务及集成测试保证。订单内已计入 CONSUME 的报损必须保持 `stockMovementId = NULL`，不得额外扣库存或重复累计成本。

### 7.6 历史快照生成时点

下单时冻结：

- 商品名称 `productNameSnapshot`
- 规格名称 `variantNameSnapshot`
- 明细单价 `unitPriceFen`
- 选项组名称 `groupNameSnapshot`
- 选项值名称 `valueNameSnapshot`
- 选项价格差 `priceDeltaFenSnapshot`
- 原料名称、单位、每份用量、总用量
- 商品、规格、选项和原料的来源外键

开始制作并实际消耗时冻结：

- `actualUnitCostSnapshot`
- `actualTotalCostSnapshot`
- `StockMovement.unitCostSnapshot`
- `StockMovement.totalCostSnapshot`

历史展示、计价和成本追溯只读快照，不得通过当前商品、规格、选项或配方覆盖。

### 7.7 金额与数量

- 金额全部使用整数分，禁止 Float/Double。
- 明细单价 = 规格价格 + 所有选项价格差。
- 选项价格差按每份商品计算，再乘购买数量。
- 明细金额 = 明细单价 × 数量。
- 订单小计 = 所有明细金额之和。
- 首版订单总额 = 订单小计。
- 数量使用整数或 `Decimal(18,3)`；成本使用 `Decimal(18,6)`。

### 7.8 成本与数量舍入

1. 金额使用整数分，整条金额链路不引入小数舍入。
2. 配方基础用量与选项调整量使用 Decimal 运算；每份用量按 ROUND_HALF_UP 保留 3 位小数后写入数量快照。
3. 总用量 = 每份用量 × 商品数量，使用 Decimal 精确计算，再按 ROUND_HALF_UP 保留 3 位写入。
4. 入库时移动加权单位成本 = (原在手数量 × 原平均成本 + 入库数量 × 入库单位成本) ÷ (原在手数量 + 入库数量)，使用 Decimal 精确计算，再按 ROUND_HALF_UP 保留 6 位写入 `Material.averageCostPerUnit`；原在手数量为 0 时直接采用本次入库单位成本并保留 6 位。
5. 实际总成本 = 消耗前单位成本 × 消耗数量，Decimal 精确计算后按 ROUND_HALF_UP 保留 6 位写入；禁止对已舍入总成本再次相乘。
6. `OrderItemMaterial.actualUnitCostSnapshot` 必须等于本次消耗使用的单位成本；`actualTotalCostSnapshot` 与共同统计范围内的 `StockMovement(CONSUME).totalCostSnapshot` 汇总必须一致。
7. 对账比较以最终 DECIMAL(18,6) 值做精确比较，不设置模糊容差。

示例：单位成本 12.345678 元/kg × 0.333 kg = 4.111110774 元，落库前 ROUND_HALF_UP 至 6 位为 4.111111 元。

## 8. 可重复计算示例

### 8.1 订单金额

假设：

- 规格价格：1800 分
- 选项 A 加价：300 分/份
- 选项 B 加价：200 分/份
- 数量：2

计算：

```text
明细单价 = 1800 + 300 + 200 = 2300 分
明细金额 = 2300 * 2 = 4600 分
订单小计 = 4600 + 另一明细 1200 = 5800 分
订单总额 = 5800 分
```

任何使用浮点数、按整单只加一次选项价差或出现金额为负的实现均不通过。

### 8.2 材料消耗成本

基础配方每份 0.050kg，选项追加 0.010kg，数量 2，移动平均单位成本 80.000000 元/kg：

```text
每份用量 = 0.050 + 0.010 = 0.060 kg
总用量 = 0.060 * 2 = 0.120 kg
单位成本快照 = 80.000000 元/kg
总成本快照 = 80.000000 * 0.120 = 9.600000 元
```

`StockMovement(CONSUME)` 的 quantityDelta 为 `-0.120`，`OrderItemMaterial.actualTotalCostSnapshot` 对应为 `9.600000`，只用于交叉核对，不再次计入总成本。

### 8.3 独立损耗

额外损耗 0.005kg，单位成本 80.000000 元/kg：

```text
库存调整 = -0.005 kg
损耗成本 = 80.000000 * 0.005 = 0.400000 元
```

必须同时写入一条 ADJUST StockMovement 和一条关联该流水的 LossRecord。若该损耗已经包含在 CONSUME 中，则不得再次扣库存，且 `stockMovementId` 为 NULL，不得再次计入累计成本。

## 9. 契约验收代码

| 代码 | 验收方法 |
| --- | --- |
| ACC-TYPE | 从 information_schema 核对 MySQL 类型、长度和精度。 |
| ACC-NULL | 对可空字段写入 NULL、对非空字段写入 NULL，验证结果。 |
| ACC-DEFAULT | 不提供字段值时验证默认值；检查默认值不掩盖业务遗漏。 |
| ACC-MAP | 核对 Prisma 字段到小写 snake_case 列名的 @map。 |
| ACC-PK | 核对单主键、BigInt 和自增。 |
| ACC-API | 构造超过 2^53 的 ID，验证 API 返回十进制字符串且不丢失精度。 |
| ACC-UQ | 插入重复组合，必须被数据库唯一约束拒绝。 |
| ACC-FK | 插入不存在引用必须失败；删除被引用记录必须被 Restrict 拒绝。 |
| ACC-ENUM | 写入未声明枚举值必须失败；默认枚举值符合契约。 |
| ACC-CALC | 使用固定样例复算金额、数量、成本、快照和状态统计。 |
| ACC-ABS | 目标 Schema 中字段、列、旧唯一约束和相关索引均已移除。 |
| ACC-USER-ID | `users.openid` 必须非空且唯一；无法取得真实微信身份时禁止创建可下单 User。 |
| ACC-ORDER-TARGET | DINE 必须有 session_id，TAKEAWAY 必须无 session_id；非法组合被数据库和服务层拒绝。 |
| ACC-LEDGER-SIGN | 六类 movementType 的方向必须符合规则表；余额不得为负，reserved 不得大于 onHand。 |
| ACC-LOSS-MATCH | 独立损耗与关联库存流水的门店、原料、数量、单位成本和总成本必须一致；总成本按公式复算。 |
| ACC-ROUND | 按 ROUND_HALF_UP 在指定落库点舍入，结果与可重复样例一致。 |

## 10. 属性收口结果

本轮已将原六类候选项全部关闭：

1. 字符串采用字段表中的最终 VARCHAR 长度；长说明统一 TEXT。
2. 只保留时间生成、排序、选项零价差、材料初始库存/成本和 version 默认值；业务状态、角色、类型、布尔选择和账本变动量必须显式写入。
3. `openedAt`、`receivedAt`、`refundedAt`、`occurredAt` 不得使用数据库 now() 默认，由业务事务记录真实事件时间。
4. 普通索引按字段表中的最终清单实施；未列出的普通索引不创建。
5. 枚举采用“枚举契约”中的最终取值。
6. 可空字段采用字段表中的最终语义；未说明的必填字段一律 NOT NULL。

当前不存在未决候选属性。若实施阶段需要改变上述任何值，必须先修订字段契约并重新审查。

## 11. 完整性声明

- 21 个模型完整覆盖。
- 当前 224 个物理字段逐项对应。
- 22 个删除字段均被排除在目标 Schema 之外。
- 202 个保留字段均进入契约。
- 8 组冻结唯一约束全部列出。
- 所有带 `fields:` 的外键均列出目标、基数和 onDelete。
- 未新增字段，未改变 A1-A9、T1-T11 的业务含义。
- 本文件不修改 Schema、Migration、依赖、业务代码或检查脚本。

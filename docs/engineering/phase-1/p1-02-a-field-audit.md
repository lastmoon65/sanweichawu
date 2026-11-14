# P1-02-A 字段级设计一致性审计

审计日期：2026-11-14（Asia/Shanghai）  
审计对象：Git 提交 `ff3a18d` 的 `backend/prisma/schema.prisma`  
唯一业务依据：用户提供的《三味茶屋单店经营系统 P1-02 最小可用数据模型最终设计报告》  
最终报告文件 SHA-256：`b329376bc01f35bba3d4bb2bd788589383778b73ac427e081e7683a4604263d5`  
Schema SHA-256：`d38dae5442f64f49c1f4faaf869a85908e8ef2e4e008eb91b87e5ff4caafc44b`  
审计性质：只读审查和报告；未修改 Schema、Migration、依赖或业务代码。

## 1. 审计结论

当前 Schema 恰好包含最终报告列出的 21 个模型，且明确删除的模型和指定字段未出现；但**无法证明 21 个模型的完整字段集合已按最终设计冻结**。

决定性原因：

1. 最终报告只逐项点名了少量字段，同时写了“保持现有字段结构完全不变”。但报告没有附“现有字段”的完整清单、类型、长度、默认值或可空性，形成指向报告外部旧版本的未闭合引用。
2. 当前 Schema 共 316 个 Prisma 字段，其中 224 个物理列、92 个关系/虚拟字段。审计标识结果：批准 119、继承 9、明确删除但现存 0、待确认 188。
3. “批准”表示最终报告能定位到该业务字段或关系语义，不代表所有实现属性已冻结；如最终报告未给 VARCHAR 长度、默认值或可空性，表中仍显示当前实现，迁移前不能把它当成已批准。
4. 最主要的未决冲突是 `Order.discountFen` 与 `DiningSession.discountFen`：最终报告第 8 节写“优惠体系删除”，但没有逐字段说明这两个既有字段是否删除，且第 2 节又总称现有字段结构不变。
5. 最终报告没有完整说明技术公共字段（主键、创建/更新时间、软删除、编号、操作人、备注等）和大量反向关系，因此当前 Schema 中存在合理的工程实现，也存在未经字段级授权的推断。

**审查建议：P1-02-B 暂缓。先由业务/架构负责人批准一份完整、可机器校验的字段契约，或对最终报告补充字段附录。**

## 2. 判定口径

- **批准**：最终报告明确点名该字段，或通过明确的业务规则/ER 关系唯一映射到该字段语义。
- **继承**：最终报告明确使用“保持”“保留”“并入”等表述，但字段的完整实现属性仍需从未附带的基线读取。
- **删除**：最终报告明确点名删除的模型或字段，但当前 Schema 仍存在；本次未发现此类确切路径。
- **待确认**：最终报告没有点名该字段；或只有笼统“现有字段不变”“业务需要”表述，不能据 V1.2 自动补全。

说明：关系数组和带关系的对象字段是 Prisma 虚拟字段，不生成 MySQL 列；“批准”只表示最终 ER/业务规则批准该关系语义，Prisma 字段别名本身不是业务字段。模型级索引只列 Prisma 显式声明项；MySQL 外键隐式索引不计。

## 3. 模型级汇总

| 模型 | 字段数 | 批准 | 继承 | 删除但现存 | 待确认 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `Store` | 21 | 7 | 3 | 0 | 11 |
| `User` | 9 | 1 | 1 | 0 | 7 |
| `Staff` | 15 | 4 | 0 | 0 | 11 |
| `Category` | 10 | 4 | 0 | 0 | 6 |
| `Product` | 15 | 5 | 0 | 0 | 10 |
| `ProductVariant` | 15 | 7 | 0 | 0 | 8 |
| `VariantOptionGroup` | 10 | 5 | 0 | 0 | 5 |
| `VariantOptionValue` | 10 | 4 | 0 | 0 | 6 |
| `VariantRecipe` | 7 | 5 | 0 | 0 | 2 |
| `RecipeModifier` | 9 | 5 | 0 | 0 | 4 |
| `Material` | 19 | 8 | 0 | 0 | 11 |
| `StockMovement` | 23 | 7 | 0 | 0 | 16 |
| `LossRecord` | 21 | 4 | 5 | 0 | 12 |
| `DiningTable` | 10 | 3 | 0 | 0 | 7 |
| `DiningSession` | 16 | 5 | 0 | 0 | 11 |
| `Order` | 26 | 13 | 0 | 0 | 13 |
| `OrderItem` | 18 | 6 | 0 | 0 | 12 |
| `OrderItemOption` | 10 | 4 | 0 | 0 | 6 |
| `OrderItemMaterial` | 12 | 6 | 0 | 0 | 6 |
| `PaymentRecord` | 23 | 10 | 0 | 0 | 13 |
| `RefundRecord` | 17 | 6 | 0 | 0 | 11 |

## 4. 21 个模型逐字段清单

### Store

普通索引：IDX1(status, deletedAt)。数据库表名：`stores`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `name` | `String` | VARCHAR(120) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `status` | `StoreStatus` | ENUM('ACTIVE', 'SUSPENDED') | 非空 | ACTIVE | IDX1(status, deletedAt) | — | — | **待确认** | 最终报告未点名该字段 |
| `timezone` | `String` | VARCHAR(64) | 非空 | "Asia/Shanghai" | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `businessDayCutoffMinute` | `Int` | INT | 非空 | 0 | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `pendingReminderMinutes` | `Int` | INT | 非空 | 10 | — | — | — | **继承** | 最终报告明确写“保留”或“并入 Store” |
| `maxPendingOrdersPerCustomer` | `Int` | INT | 非空 | 5 | — | — | — | **继承** | 最终报告明确写“保留”或“并入 Store” |
| `maxPendingOrdersPerSession` | `Int` | INT | 非空 | 30 | — | — | — | **继承** | 最终报告明确写“保留”或“并入 Store” |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | — | — | — | **待确认** | 最终报告未点名该字段 |
| `updatedAt` | `DateTime` | DATETIME(3) | 非空 | 无数据库默认；Prisma Client 维护 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `deletedAt` | `DateTime?` | DATETIME(3) | 可空 | — | IDX1(status, deletedAt) | — | — | **待确认** | 最终报告未点名该字段 |
| `staff` | `Staff[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N Staff | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `categories` | `Category[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N Category | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `products` | `Product[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N Product | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `materials` | `Material[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N Material | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `tables` | `DiningTable[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N DiningTable | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `sessions` | `DiningSession[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N DiningSession | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `orders` | `Order[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N Order | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `stockMovements` | `StockMovement[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N StockMovement | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `lossRecords` | `LossRecord[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N LossRecord | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `payments` | `PaymentRecord[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N PaymentRecord | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |

### User

普通索引：IDX1(status)。数据库表名：`users`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `openid` | `String?` | VARCHAR(128) | 可空 | — | UQ(openid) | — | — | **继承** | 最终报告明确写“保持 openid @unique” |
| `unionid` | `String?` | VARCHAR(128) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `nickname` | `String?` | VARCHAR(80) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `avatarUrl` | `String?` | VARCHAR(512) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `status` | `UserStatus` | ENUM('ACTIVE', 'DISABLED') | 非空 | ACTIVE | IDX1(status) | — | — | **待确认** | 最终报告未点名该字段 |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | — | — | — | **待确认** | 最终报告未点名该字段 |
| `updatedAt` | `DateTime` | DATETIME(3) | 非空 | 无数据库默认；Prisma Client 维护 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `orders` | `Order[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N Order | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |

### Staff

普通索引：IDX1(storeId, status, role)。数据库表名：`staff`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `storeId` | `BigInt` | BIGINT | 非空 | — | IDX1(storeId, status, role); FK(storeId) | FK -> Store.id; storeId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `name` | `String` | VARCHAR(80) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `role` | `StaffRole` | ENUM('OWNER', 'MANAGER', 'STAFF') | 非空 | — | IDX1(storeId, status, role) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `status` | `StaffStatus` | ENUM('ACTIVE', 'DISABLED') | 非空 | ACTIVE | IDX1(storeId, status, role) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | — | — | — | **待确认** | 最终报告未点名该字段 |
| `updatedAt` | `DateTime` | DATETIME(3) | 非空 | 无数据库默认；Prisma Client 维护 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `store` | `Store` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Store; FK storeId -> Store.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `stockMovements` | `StockMovement[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N StockMovement | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `lossRecords` | `LossRecord[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N LossRecord | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `payments` | `PaymentRecord[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N PaymentRecord | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `voidedPayments` | `PaymentRecord[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N PaymentRecord | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `refunds` | `RefundRecord[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N RefundRecord | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `voidedRefunds` | `RefundRecord[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N RefundRecord | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `closedSessions` | `DiningSession[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N DiningSession | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |

### Category

普通索引：IDX1(storeId, status, sortOrder)。数据库表名：`categories`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `storeId` | `BigInt` | BIGINT | 非空 | — | IDX1(storeId, status, sortOrder); FK(storeId) | FK -> Store.id; storeId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `name` | `String` | VARCHAR(80) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `sortOrder` | `Int` | INT | 非空 | 0 | IDX1(storeId, status, sortOrder) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `status` | `CommonStatus` | ENUM('ACTIVE', 'DISABLED') | 非空 | ACTIVE | IDX1(storeId, status, sortOrder) | — | — | **待确认** | 最终报告未点名该字段 |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | — | — | — | **待确认** | 最终报告未点名该字段 |
| `updatedAt` | `DateTime` | DATETIME(3) | 非空 | 无数据库默认；Prisma Client 维护 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `deletedAt` | `DateTime?` | DATETIME(3) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `store` | `Store` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Store; FK storeId -> Store.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `products` | `Product[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N Product | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |

### Product

普通索引：IDX1(storeId, categoryId, status, sortOrder)。数据库表名：`products`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `storeId` | `BigInt` | BIGINT | 非空 | — | IDX1(storeId, categoryId, status, sortOrder); FK(storeId) | FK -> Store.id; storeId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `categoryId` | `BigInt` | BIGINT | 非空 | — | IDX1(storeId, categoryId, status, sortOrder); FK(categoryId) | FK -> Category.id; categoryId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `name` | `String` | VARCHAR(120) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `description` | `String?` | TEXT | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `imageUrl` | `String?` | VARCHAR(512) | 可空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `status` | `CommonStatus` | ENUM('ACTIVE', 'DISABLED') | 非空 | ACTIVE | IDX1(storeId, categoryId, status, sortOrder) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `sortOrder` | `Int` | INT | 非空 | 0 | IDX1(storeId, categoryId, status, sortOrder) | — | — | **待确认** | 最终报告未点名该字段 |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | — | — | — | **待确认** | 最终报告未点名该字段 |
| `updatedAt` | `DateTime` | DATETIME(3) | 非空 | 无数据库默认；Prisma Client 维护 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `deletedAt` | `DateTime?` | DATETIME(3) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `store` | `Store` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Store; FK storeId -> Store.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `category` | `Category` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Category; FK categoryId -> Category.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `variants` | `ProductVariant[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N ProductVariant | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `orderItems` | `OrderItem[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N OrderItem | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |

### ProductVariant

普通索引：IDX1(productId, status, sortOrder)。数据库表名：`product_variants`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `productId` | `BigInt` | BIGINT | 非空 | — | IDX1(productId, status, sortOrder); FK(productId) | FK -> Product.id; productId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `name` | `String` | VARCHAR(80) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `priceFen` | `BigInt` | BIGINT | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `inventoryMode` | `InventoryMode` | ENUM('MANAGED', 'UNMANAGED') | 非空 | MANAGED | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `status` | `CommonStatus` | ENUM('ACTIVE', 'DISABLED') | 非空 | ACTIVE | IDX1(productId, status, sortOrder) | — | — | **待确认** | 最终报告未点名该字段 |
| `sortOrder` | `Int` | INT | 非空 | 0 | IDX1(productId, status, sortOrder) | — | — | **待确认** | 最终报告未点名该字段 |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | — | — | — | **待确认** | 最终报告未点名该字段 |
| `updatedAt` | `DateTime` | DATETIME(3) | 非空 | 无数据库默认；Prisma Client 维护 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `deletedAt` | `DateTime?` | DATETIME(3) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `product` | `Product` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Product; FK productId -> Product.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `optionGroups` | `VariantOptionGroup[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N VariantOptionGroup | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `variantRecipes` | `VariantRecipe[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N VariantRecipe | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `recipeModifiers` | `RecipeModifier[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N RecipeModifier | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `orderItems` | `OrderItem[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N OrderItem | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |

### VariantOptionGroup

唯一：UQ1(variantId, code)。普通索引：IDX1(variantId, sortOrder)。数据库表名：`variant_option_groups`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `variantId` | `BigInt` | BIGINT | 非空 | — | UQ1(variantId, code); IDX1(variantId, sortOrder); FK(variantId) | FK -> ProductVariant.id; variantId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `code` | `String` | VARCHAR(40) | 非空 | — | UQ1(variantId, code) | — | — | **待确认** | 最终报告未点名该字段 |
| `name` | `String` | VARCHAR(80) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `selectionType` | `OptionSelectionType` | ENUM('SINGLE', 'MULTI') | 非空 | SINGLE | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `required` | `Boolean` | TINYINT(1) | 非空 | TRUE | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `sortOrder` | `Int` | INT | 非空 | 0 | IDX1(variantId, sortOrder) | — | — | **待确认** | 最终报告未点名该字段 |
| `status` | `CommonStatus` | ENUM('ACTIVE', 'DISABLED') | 非空 | ACTIVE | — | — | — | **待确认** | 最终报告未点名该字段 |
| `variant` | `ProductVariant` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 ProductVariant; FK variantId -> ProductVariant.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `values` | `VariantOptionValue[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N VariantOptionValue | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |

### VariantOptionValue

唯一：UQ1(optionGroupId, code)。普通索引：IDX1(optionGroupId, sortOrder)。数据库表名：`variant_option_values`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `optionGroupId` | `BigInt` | BIGINT | 非空 | — | UQ1(optionGroupId, code); IDX1(optionGroupId, sortOrder); FK(optionGroupId) | FK -> VariantOptionGroup.id; optionGroupId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `code` | `String` | VARCHAR(40) | 非空 | — | UQ1(optionGroupId, code) | — | — | **待确认** | 最终报告未点名该字段 |
| `name` | `String` | VARCHAR(80) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `priceDeltaFen` | `BigInt` | BIGINT | 非空 | 0 | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `sortOrder` | `Int` | INT | 非空 | 0 | IDX1(optionGroupId, sortOrder) | — | — | **待确认** | 最终报告未点名该字段 |
| `status` | `CommonStatus` | ENUM('ACTIVE', 'DISABLED') | 非空 | ACTIVE | — | — | — | **待确认** | 最终报告未点名该字段 |
| `optionGroup` | `VariantOptionGroup` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 VariantOptionGroup; FK optionGroupId -> VariantOptionGroup.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `recipeModifiers` | `RecipeModifier[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N RecipeModifier | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `orderItemOptions` | `OrderItemOption[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N OrderItemOption | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |

### VariantRecipe

唯一：UQ1(variantId, materialId, role)。普通索引：IDX1(materialId)。数据库表名：`variant_recipes`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `variantId` | `BigInt` | BIGINT | 非空 | — | UQ1(variantId, materialId, role); FK(variantId) | FK -> ProductVariant.id; variantId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `materialId` | `BigInt` | BIGINT | 非空 | — | UQ1(variantId, materialId, role); IDX1(materialId); FK(materialId) | FK -> Material.id; materialId 位于 N:1 关系的多端 | Restrict | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `role` | `RecipeMaterialRole` | ENUM('BASE', 'TAKEAWAY_EXTRA') | 非空 | BASE | UQ1(variantId, materialId, role) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `quantity` | `Decimal` | DECIMAL(18,3) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `variant` | `ProductVariant` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 ProductVariant; FK variantId -> ProductVariant.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `material` | `Material` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Material; FK materialId -> Material.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |

### RecipeModifier

唯一：UQ1(variantId, optionValueId, materialId, targetRole)。普通索引：IDX1(optionValueId)；IDX2(materialId)。数据库表名：`recipe_modifiers`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `variantId` | `BigInt` | BIGINT | 非空 | — | UQ1(variantId, optionValueId, materialId, targetRole); FK(variantId) | FK -> ProductVariant.id; variantId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `optionValueId` | `BigInt` | BIGINT | 非空 | — | UQ1(variantId, optionValueId, materialId, targetRole); IDX1(optionValueId); FK(optionValueId) | FK -> VariantOptionValue.id; optionValueId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `materialId` | `BigInt` | BIGINT | 非空 | — | UQ1(variantId, optionValueId, materialId, targetRole); IDX2(materialId); FK(materialId) | FK -> Material.id; materialId 位于 N:1 关系的多端 | Restrict | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `targetRole` | `RecipeModifierTarget` | ENUM('BASE', 'TAKEAWAY_EXTRA') | 非空 | BASE | UQ1(variantId, optionValueId, materialId, targetRole) | — | — | **待确认** | 最终报告未点名该字段 |
| `quantityDelta` | `Decimal` | DECIMAL(18,3) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `variant` | `ProductVariant` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 ProductVariant; FK variantId -> ProductVariant.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `optionValue` | `VariantOptionValue` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 VariantOptionValue; FK optionValueId -> VariantOptionValue.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `material` | `Material` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Material; FK materialId -> Material.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |

### Material

普通索引：IDX1(storeId, status, deletedAt)。数据库表名：`materials`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `storeId` | `BigInt` | BIGINT | 非空 | — | IDX1(storeId, status, deletedAt); FK(storeId) | FK -> Store.id; storeId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `name` | `String` | VARCHAR(120) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `unit` | `String` | VARCHAR(20) | 非空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `onHand` | `Decimal` | DECIMAL(18,3) | 非空 | 0 | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `reserved` | `Decimal` | DECIMAL(18,3) | 非空 | 0 | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `warningThreshold` | `Decimal` | DECIMAL(18,3) | 非空 | 0 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `averageCostPerUnit` | `Decimal` | DECIMAL(18,6) | 非空 | 0 | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `status` | `CommonStatus` | ENUM('ACTIVE', 'DISABLED') | 非空 | ACTIVE | IDX1(storeId, status, deletedAt) | — | — | **待确认** | 最终报告未点名该字段 |
| `version` | `Int` | INT | 非空 | 1 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | — | — | — | **待确认** | 最终报告未点名该字段 |
| `updatedAt` | `DateTime` | DATETIME(3) | 非空 | 无数据库默认；Prisma Client 维护 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `deletedAt` | `DateTime?` | DATETIME(3) | 可空 | — | IDX1(storeId, status, deletedAt) | — | — | **待确认** | 最终报告未点名该字段 |
| `store` | `Store` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Store; FK storeId -> Store.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `variantRecipes` | `VariantRecipe[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N VariantRecipe | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `recipeModifiers` | `RecipeModifier[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N RecipeModifier | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `stockMovements` | `StockMovement[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N StockMovement | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `lossRecords` | `LossRecord[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N LossRecord | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `orderItemMaterials` | `OrderItemMaterial[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N OrderItemMaterial | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |

### StockMovement

普通索引：IDX1(storeId, movementType, createdAt)；IDX2(materialId, createdAt)；IDX3(orderId, materialId, movementType)。数据库表名：`stock_movements`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `movementNo` | `String` | VARCHAR(64) | 非空 | — | UQ(movementNo) | — | — | **待确认** | 最终报告未点名该字段 |
| `dedupeKey` | `String` | VARCHAR(160) | 非空 | — | UQ(dedupeKey) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `storeId` | `BigInt` | BIGINT | 非空 | — | IDX1(storeId, movementType, createdAt); FK(storeId) | FK -> Store.id; storeId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `materialId` | `BigInt` | BIGINT | 非空 | — | IDX2(materialId, createdAt); IDX3(orderId, materialId, movementType); FK(materialId) | FK -> Material.id; materialId 位于 N:1 关系的多端 | Restrict | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `movementType` | `StockMovementType` | ENUM('OPENING_BALANCE', 'STOCK_IN', 'RESERVE', 'RELEASE', 'CONSUME', 'ADJUST') | 非空 | — | IDX1(storeId, movementType, createdAt); IDX3(orderId, materialId, movementType) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `quantityDelta` | `Decimal` | DECIMAL(18,3) | 非空 | 0 | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `reservedDelta` | `Decimal` | DECIMAL(18,3) | 非空 | 0 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `onHandAfter` | `Decimal` | DECIMAL(18,3) | 非空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `reservedAfter` | `Decimal` | DECIMAL(18,3) | 非空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `unitCostSnapshot` | `Decimal?` | DECIMAL(18,6) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `totalCostSnapshot` | `Decimal?` | DECIMAL(18,6) | 可空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `orderId` | `BigInt?` | BIGINT | 可空 | — | IDX3(orderId, materialId, movementType); FK(orderId) | FK -> Order.id; orderId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `orderItemId` | `BigInt?` | BIGINT | 可空 | — | FK(orderItemId) | FK -> OrderItem.id; orderItemId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `operatorStaffId` | `BigInt?` | BIGINT | 可空 | — | FK(operatorStaffId) | FK -> Staff.id; operatorStaffId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `reason` | `String?` | VARCHAR(500) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | IDX1(storeId, movementType, createdAt); IDX2(materialId, createdAt) | — | — | **待确认** | 最终报告未点名该字段 |
| `store` | `Store` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Store; FK storeId -> Store.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `material` | `Material` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Material; FK materialId -> Material.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `order` | `Order?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 Order; FK orderId -> Order.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `orderItem` | `OrderItem?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 OrderItem; FK orderItemId -> OrderItem.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `operatorStaff` | `Staff?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 Staff; FK operatorStaffId -> Staff.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `lossRecord` | `LossRecord?` | —（Prisma 关系字段） | 0..1（关系） | — | — | 虚拟反向 1:1 LossRecord | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |

### LossRecord

普通索引：IDX1(storeId, occurredAt)；IDX2(materialId, occurredAt)；IDX3(orderId)。数据库表名：`loss_records`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `lossNo` | `String` | VARCHAR(64) | 非空 | — | UQ(lossNo) | — | — | **待确认** | 最终报告未点名该字段 |
| `dedupeKey` | `String` | VARCHAR(160) | 非空 | — | UQ(dedupeKey) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `storeId` | `BigInt` | BIGINT | 非空 | — | IDX1(storeId, occurredAt); FK(storeId) | FK -> Store.id; storeId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `materialId` | `BigInt` | BIGINT | 非空 | — | IDX2(materialId, occurredAt); FK(materialId) | FK -> Material.id; materialId 位于 N:1 关系的多端 | Restrict | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `orderId` | `BigInt?` | BIGINT | 可空 | — | IDX3(orderId); FK(orderId) | FK -> Order.id; orderId 位于 N:1 关系的多端 | Restrict | **继承** | 最终报告明确写“保留”或“并入 Store” |
| `orderItemId` | `BigInt?` | BIGINT | 可空 | — | FK(orderItemId) | FK -> OrderItem.id; orderItemId 位于 N:1 关系的多端 | Restrict | **继承** | 最终报告明确写“保留”或“并入 Store” |
| `stockMovementId` | `BigInt?` | BIGINT | 可空 | — | UQ(stockMovementId); FK(stockMovementId) | FK -> StockMovement.id; stockMovementId 位于 N:1 关系的多端 | Restrict | **继承** | 最终报告明确写“保留”或“并入 Store” |
| `quantity` | `Decimal` | DECIMAL(18,3) | 非空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `unitCostSnapshot` | `Decimal` | DECIMAL(18,6) | 非空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `lossCostSnapshot` | `Decimal` | DECIMAL(18,6) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `reason` | `String` | VARCHAR(500) | 非空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `operatorStaffId` | `BigInt?` | BIGINT | 可空 | — | FK(operatorStaffId) | FK -> Staff.id; operatorStaffId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `occurredAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | IDX1(storeId, occurredAt); IDX2(materialId, occurredAt) | — | — | **待确认** | 最终报告未点名该字段 |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | — | — | — | **待确认** | 最终报告未点名该字段 |
| `store` | `Store` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Store; FK storeId -> Store.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `material` | `Material` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Material; FK materialId -> Material.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `order` | `Order?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 Order; FK orderId -> Order.id | Restrict | **继承** | 最终报告明确写“保留”或“并入 Store” |
| `orderItem` | `OrderItem?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 OrderItem; FK orderItemId -> OrderItem.id | Restrict | **继承** | 最终报告明确写“保留”或“并入 Store” |
| `stockMovement` | `StockMovement?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 StockMovement; FK stockMovementId -> StockMovement.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `operatorStaff` | `Staff?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 Staff; FK operatorStaffId -> Staff.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |

### DiningTable

普通索引：IDX1(storeId, deletedAt)。数据库表名：`dining_tables`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `storeId` | `BigInt` | BIGINT | 非空 | — | IDX1(storeId, deletedAt); FK(storeId) | FK -> Store.id; storeId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `name` | `String` | VARCHAR(40) | 非空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `code` | `String` | VARCHAR(40) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `capacity` | `Int` | INT | 非空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | — | — | — | **待确认** | 最终报告未点名该字段 |
| `updatedAt` | `DateTime` | DATETIME(3) | 非空 | 无数据库默认；Prisma Client 维护 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `deletedAt` | `DateTime?` | DATETIME(3) | 可空 | — | IDX1(storeId, deletedAt) | — | — | **待确认** | 最终报告未点名该字段 |
| `store` | `Store` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Store; FK storeId -> Store.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `sessions` | `DiningSession[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N DiningSession | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |

### DiningSession

普通索引：IDX1(storeId, status, openedAt)；IDX2(tableId, status, openedAt)。数据库表名：`dining_sessions`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `storeId` | `BigInt` | BIGINT | 非空 | — | IDX1(storeId, status, openedAt); FK(storeId) | FK -> Store.id; storeId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `tableId` | `BigInt` | BIGINT | 非空 | — | IDX2(tableId, status, openedAt); FK(tableId) | FK -> DiningTable.id; tableId 位于 N:1 关系的多端 | Restrict | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `status` | `DiningSessionStatus` | ENUM('OPEN', 'CLOSED') | 非空 | OPEN | IDX1(storeId, status, openedAt); IDX2(tableId, status, openedAt) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `discountFen` | `BigInt` | BIGINT | 非空 | 0 | — | — | — | **待确认** | “优惠体系”被列为删除，但最终报告未明确点名该字段，存在解释冲突 |
| `version` | `Int` | INT | 非空 | 1 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `openedAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | IDX1(storeId, status, openedAt); IDX2(tableId, status, openedAt) | — | — | **待确认** | 最终报告未点名该字段 |
| `closedAt` | `DateTime?` | DATETIME(3) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `closedByStaffId` | `BigInt?` | BIGINT | 可空 | — | FK(closedByStaffId) | FK -> Staff.id; closedByStaffId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | — | — | — | **待确认** | 最终报告未点名该字段 |
| `updatedAt` | `DateTime` | DATETIME(3) | 非空 | 无数据库默认；Prisma Client 维护 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `store` | `Store` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Store; FK storeId -> Store.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `table` | `DiningTable` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 DiningTable; FK tableId -> DiningTable.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `closedBy` | `Staff?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 Staff; FK closedByStaffId -> Staff.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `orders` | `Order[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N Order | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `payments` | `PaymentRecord[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N PaymentRecord | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |

### Order

普通索引：IDX1(storeId, status, createdAt)；IDX2(sessionId, status)；IDX3(customerUserId, createdAt)；IDX4(completedAt)。数据库表名：`orders`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `storeId` | `BigInt` | BIGINT | 非空 | — | IDX1(storeId, status, createdAt); FK(storeId) | FK -> Store.id; storeId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `customerUserId` | `BigInt` | BIGINT | 非空 | — | IDX3(customerUserId, createdAt); FK(customerUserId) | FK -> User.id; customerUserId 位于 N:1 关系的多端 | Restrict | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `orderNo` | `String` | VARCHAR(40) | 非空 | — | UQ(orderNo) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `idempotencyKey` | `String` | VARCHAR(160) | 非空 | — | UQ(idempotencyKey) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `channel` | `OrderChannel` | ENUM('DINE', 'TAKEAWAY') | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `sessionId` | `BigInt?` | BIGINT | 可空 | — | IDX2(sessionId, status); FK(sessionId) | FK -> DiningSession.id; sessionId 位于 N:1 关系的多端 | Restrict | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `status` | `OrderStatus` | ENUM('PENDING_ACCEPTANCE', 'ACCEPTED', 'PREPARING', 'COMPLETED', 'CANCELLED') | 非空 | PENDING_ACCEPTANCE | IDX1(storeId, status, createdAt); IDX2(sessionId, status) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `subtotalFen` | `BigInt` | BIGINT | 非空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `discountFen` | `BigInt` | BIGINT | 非空 | 0 | — | — | — | **待确认** | “优惠体系”被列为删除，但最终报告未明确点名该字段，存在解释冲突 |
| `totalAmountFen` | `BigInt` | BIGINT | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `version` | `Int` | INT | 非空 | 1 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | IDX1(storeId, status, createdAt); IDX3(customerUserId, createdAt) | — | — | **待确认** | 最终报告未点名该字段 |
| `acceptedAt` | `DateTime?` | DATETIME(3) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `preparingAt` | `DateTime?` | DATETIME(3) | 可空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `completedAt` | `DateTime?` | DATETIME(3) | 可空 | — | IDX4(completedAt) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `cancelledAt` | `DateTime?` | DATETIME(3) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `cancelReason` | `String?` | VARCHAR(500) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `updatedAt` | `DateTime` | DATETIME(3) | 非空 | 无数据库默认；Prisma Client 维护 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `store` | `Store` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Store; FK storeId -> Store.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `customer` | `User` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 User; FK customerUserId -> User.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `session` | `DiningSession?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 DiningSession; FK sessionId -> DiningSession.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `items` | `OrderItem[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N OrderItem | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `stockMovements` | `StockMovement[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N StockMovement | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `lossRecords` | `LossRecord[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N LossRecord | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `payments` | `PaymentRecord[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N PaymentRecord | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |

### OrderItem

普通索引：IDX1(orderId)；IDX2(productId, createdAt)；IDX3(variantId, createdAt)。数据库表名：`order_items`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `orderId` | `BigInt` | BIGINT | 非空 | — | IDX1(orderId); FK(orderId) | FK -> Order.id; orderId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `productId` | `BigInt` | BIGINT | 非空 | — | IDX2(productId, createdAt); FK(productId) | FK -> Product.id; productId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `variantId` | `BigInt` | BIGINT | 非空 | — | IDX3(variantId, createdAt); FK(variantId) | FK -> ProductVariant.id; variantId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `productNameSnapshot` | `String` | VARCHAR(120) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `variantNameSnapshot` | `String` | VARCHAR(80) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `unitPriceFen` | `BigInt` | BIGINT | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `quantity` | `Int` | INT | 非空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `lineSubtotalFen` | `BigInt` | BIGINT | 非空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `remark` | `String?` | VARCHAR(500) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | IDX2(productId, createdAt); IDX3(variantId, createdAt) | — | — | **待确认** | 最终报告未点名该字段 |
| `order` | `Order` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Order; FK orderId -> Order.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `product` | `Product` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Product; FK productId -> Product.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `variant` | `ProductVariant` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 ProductVariant; FK variantId -> ProductVariant.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `options` | `OrderItemOption[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N OrderItemOption | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `materials` | `OrderItemMaterial[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N OrderItemMaterial | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `stockMovements` | `StockMovement[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N StockMovement | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |
| `lossRecords` | `LossRecord[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N LossRecord | 不适用（虚拟关系） | **待确认** | 最终报告未列出该反向/实现关系 |

### OrderItemOption

唯一：UQ1(orderItemId, groupCodeSnapshot, valueCodeSnapshot)。普通索引：IDX1(optionValueId)。数据库表名：`order_item_options`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `orderItemId` | `BigInt` | BIGINT | 非空 | — | UQ1(orderItemId, groupCodeSnapshot, valueCodeSnapshot); FK(orderItemId) | FK -> OrderItem.id; orderItemId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `optionValueId` | `BigInt` | BIGINT | 非空 | — | IDX1(optionValueId); FK(optionValueId) | FK -> VariantOptionValue.id; optionValueId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `groupCodeSnapshot` | `String` | VARCHAR(40) | 非空 | — | UQ1(orderItemId, groupCodeSnapshot, valueCodeSnapshot) | — | — | **待确认** | 最终报告未点名该字段 |
| `groupNameSnapshot` | `String` | VARCHAR(80) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `valueCodeSnapshot` | `String` | VARCHAR(40) | 非空 | — | UQ1(orderItemId, groupCodeSnapshot, valueCodeSnapshot) | — | — | **待确认** | 最终报告未点名该字段 |
| `valueNameSnapshot` | `String` | VARCHAR(80) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `priceDeltaFenSnapshot` | `BigInt` | BIGINT | 非空 | 0 | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `orderItem` | `OrderItem` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 OrderItem; FK orderItemId -> OrderItem.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `optionValue` | `VariantOptionValue` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 VariantOptionValue; FK optionValueId -> VariantOptionValue.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |

### OrderItemMaterial

唯一：UQ1(orderItemId, materialId, source)。普通索引：IDX1(materialId)。数据库表名：`order_item_materials`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `orderItemId` | `BigInt` | BIGINT | 非空 | — | UQ1(orderItemId, materialId, source); FK(orderItemId) | FK -> OrderItem.id; orderItemId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `materialId` | `BigInt` | BIGINT | 非空 | — | UQ1(orderItemId, materialId, source); IDX1(materialId); FK(materialId) | FK -> Material.id; materialId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `materialNameSnapshot` | `String` | VARCHAR(120) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `unitSnapshot` | `String` | VARCHAR(20) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `quantityPerItem` | `Decimal` | DECIMAL(18,3) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `totalQuantity` | `Decimal` | DECIMAL(18,3) | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `actualUnitCostSnapshot` | `Decimal?` | DECIMAL(18,6) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `actualTotalCostSnapshot` | `Decimal?` | DECIMAL(18,6) | 可空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `source` | `OrderItemMaterialSource` | ENUM('BASE', 'TAKEAWAY_EXTRA', 'MODIFIER') | 非空 | — | UQ1(orderItemId, materialId, source) | — | — | **待确认** | 最终报告未点名该字段 |
| `orderItem` | `OrderItem` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 OrderItem; FK orderItemId -> OrderItem.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `material` | `Material` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Material; FK materialId -> Material.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |

### PaymentRecord

普通索引：IDX1(storeId, status, receivedAt)；IDX2(sessionId, status)；IDX3(orderId, status)。数据库表名：`payment_records`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `paymentNo` | `String` | VARCHAR(64) | 非空 | — | UQ(paymentNo) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `idempotencyKey` | `String` | VARCHAR(160) | 非空 | — | UQ(idempotencyKey) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `storeId` | `BigInt` | BIGINT | 非空 | — | IDX1(storeId, status, receivedAt); FK(storeId) | FK -> Store.id; storeId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `sessionId` | `BigInt?` | BIGINT | 可空 | — | IDX2(sessionId, status); FK(sessionId) | FK -> DiningSession.id; sessionId 位于 N:1 关系的多端 | Restrict | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `orderId` | `BigInt?` | BIGINT | 可空 | — | IDX3(orderId, status); FK(orderId) | FK -> Order.id; orderId 位于 N:1 关系的多端 | Restrict | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `paymentMethod` | `PaymentMethod` | ENUM('CASH', 'WECHAT', 'ALIPAY', 'POS', 'OTHER') | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `amountFen` | `BigInt` | BIGINT | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `receivedAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | IDX1(storeId, status, receivedAt) | — | — | **待确认** | 最终报告未点名该字段 |
| `operatorStaffId` | `BigInt?` | BIGINT | 可空 | — | FK(operatorStaffId) | FK -> Staff.id; operatorStaffId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `status` | `PaymentStatus` | ENUM('ACTIVE', 'VOIDED') | 非空 | ACTIVE | IDX1(storeId, status, receivedAt); IDX2(sessionId, status); IDX3(orderId, status) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `remark` | `String?` | VARCHAR(500) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `voidedAt` | `DateTime?` | DATETIME(3) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `voidedByStaffId` | `BigInt?` | BIGINT | 可空 | — | FK(voidedByStaffId) | FK -> Staff.id; voidedByStaffId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `voidReason` | `String?` | VARCHAR(500) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | — | — | — | **待确认** | 最终报告未点名该字段 |
| `updatedAt` | `DateTime` | DATETIME(3) | 非空 | 无数据库默认；Prisma Client 维护 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `store` | `Store` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 Store; FK storeId -> Store.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `session` | `DiningSession?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 DiningSession; FK sessionId -> DiningSession.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `order` | `Order?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 Order; FK orderId -> Order.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `operatorStaff` | `Staff?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 Staff; FK operatorStaffId -> Staff.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `voidedByStaff` | `Staff?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 Staff; FK voidedByStaffId -> Staff.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `refunds` | `RefundRecord[]` | —（Prisma 关系字段） | 集合（非单值列） | — | — | 虚拟反向 1:N RefundRecord | 不适用（虚拟关系） | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |

### RefundRecord

普通索引：IDX1(paymentRecordId, status, refundedAt)。数据库表名：`refund_records`。

| 字段 | Prisma 类型 | MySQL 类型 | 可空性 | 默认值 | 键/索引 | 外键/关系基数 | onDelete | 结论 | 依据/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `id` | `BigInt` | BIGINT | 非空 | AUTO_INCREMENT（由主键策略生成） | PK | — | — | **待确认** | 最终报告未点名该字段 |
| `refundNo` | `String` | VARCHAR(64) | 非空 | — | UQ(refundNo) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `idempotencyKey` | `String` | VARCHAR(160) | 非空 | — | UQ(idempotencyKey) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `paymentRecordId` | `BigInt` | BIGINT | 非空 | — | IDX1(paymentRecordId, status, refundedAt); FK(paymentRecordId) | FK -> PaymentRecord.id; paymentRecordId 位于 N:1 关系的多端 | Restrict | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `amountFen` | `BigInt` | BIGINT | 非空 | — | — | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `reason` | `String` | VARCHAR(500) | 非空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `status` | `RefundStatus` | ENUM('ACTIVE', 'VOIDED') | 非空 | ACTIVE | IDX1(paymentRecordId, status, refundedAt) | — | — | **批准** | 最终报告明确点名或直接描述该业务字段 |
| `refundedAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | IDX1(paymentRecordId, status, refundedAt) | — | — | **待确认** | 最终报告未点名该字段 |
| `operatorStaffId` | `BigInt?` | BIGINT | 可空 | — | FK(operatorStaffId) | FK -> Staff.id; operatorStaffId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `voidedAt` | `DateTime?` | DATETIME(3) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `voidedByStaffId` | `BigInt?` | BIGINT | 可空 | — | FK(voidedByStaffId) | FK -> Staff.id; voidedByStaffId 位于 N:1 关系的多端 | Restrict | **待确认** | 最终报告未点名该字段 |
| `voidReason` | `String?` | VARCHAR(500) | 可空 | — | — | — | — | **待确认** | 最终报告未点名该字段 |
| `createdAt` | `DateTime` | DATETIME(3) | 非空 | CURRENT_TIMESTAMP(3) | — | — | — | **待确认** | 最终报告未点名该字段 |
| `updatedAt` | `DateTime` | DATETIME(3) | 非空 | 无数据库默认；Prisma Client 维护 | — | — | — | **待确认** | 最终报告未点名该字段 |
| `paymentRecord` | `PaymentRecord` | —（Prisma 关系字段） | 必选（关系） | — | — | N:1 PaymentRecord; FK paymentRecordId -> PaymentRecord.id | Restrict | **批准** | 最终 ER/关系规则明确；Prisma 别名本身非数据库字段 |
| `operatorStaff` | `Staff?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 Staff; FK operatorStaffId -> Staff.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |
| `voidedByStaff` | `Staff?` | —（Prisma 关系字段） | 0..1（关系） | — | — | N:0..1 Staff; FK voidedByStaffId -> Staff.id | Restrict | **待确认** | 最终报告未列出该反向/实现关系 |


## 5. 待确认字段及原因

### 5.1 待确认物理字段

以下字段不是自动判错，而是最终报告没有给出足以冻结名称和完整实现的依据：

- `Store.id`
- `Store.status`
- `Store.createdAt`
- `Store.updatedAt`
- `Store.deletedAt`
- `User.id`
- `User.unionid`
- `User.nickname`
- `User.avatarUrl`
- `User.status`
- `User.createdAt`
- `User.updatedAt`
- `Staff.id`
- `Staff.storeId`
- `Staff.createdAt`
- `Staff.updatedAt`
- `Category.id`
- `Category.storeId`
- `Category.status`
- `Category.createdAt`
- `Category.updatedAt`
- `Category.deletedAt`
- `Product.id`
- `Product.storeId`
- `Product.categoryId`
- `Product.description`
- `Product.sortOrder`
- `Product.createdAt`
- `Product.updatedAt`
- `Product.deletedAt`
- `ProductVariant.id`
- `ProductVariant.productId`
- `ProductVariant.status`
- `ProductVariant.sortOrder`
- `ProductVariant.createdAt`
- `ProductVariant.updatedAt`
- `ProductVariant.deletedAt`
- `VariantOptionGroup.id`
- `VariantOptionGroup.variantId`
- `VariantOptionGroup.code`
- `VariantOptionGroup.sortOrder`
- `VariantOptionGroup.status`
- `VariantOptionValue.id`
- `VariantOptionValue.optionGroupId`
- `VariantOptionValue.code`
- `VariantOptionValue.sortOrder`
- `VariantOptionValue.status`
- `VariantRecipe.id`
- `VariantRecipe.variantId`
- `RecipeModifier.id`
- `RecipeModifier.variantId`
- `RecipeModifier.optionValueId`
- `RecipeModifier.targetRole`
- `Material.id`
- `Material.storeId`
- `Material.unit`
- `Material.warningThreshold`
- `Material.status`
- `Material.version`
- `Material.createdAt`
- `Material.updatedAt`
- `Material.deletedAt`
- `StockMovement.id`
- `StockMovement.movementNo`
- `StockMovement.storeId`
- `StockMovement.reservedDelta`
- `StockMovement.onHandAfter`
- `StockMovement.reservedAfter`
- `StockMovement.unitCostSnapshot`
- `StockMovement.orderId`
- `StockMovement.orderItemId`
- `StockMovement.operatorStaffId`
- `StockMovement.reason`
- `StockMovement.createdAt`
- `LossRecord.id`
- `LossRecord.lossNo`
- `LossRecord.storeId`
- `LossRecord.quantity`
- `LossRecord.unitCostSnapshot`
- `LossRecord.reason`
- `LossRecord.operatorStaffId`
- `LossRecord.occurredAt`
- `LossRecord.createdAt`
- `DiningTable.id`
- `DiningTable.storeId`
- `DiningTable.name`
- `DiningTable.capacity`
- `DiningTable.createdAt`
- `DiningTable.updatedAt`
- `DiningTable.deletedAt`
- `DiningSession.id`
- `DiningSession.storeId`
- `DiningSession.discountFen`
- `DiningSession.version`
- `DiningSession.openedAt`
- `DiningSession.closedAt`
- `DiningSession.closedByStaffId`
- `DiningSession.createdAt`
- `DiningSession.updatedAt`
- `Order.id`
- `Order.storeId`
- `Order.subtotalFen`
- `Order.discountFen`
- `Order.version`
- `Order.createdAt`
- `Order.acceptedAt`
- `Order.cancelledAt`
- `Order.cancelReason`
- `Order.updatedAt`
- `OrderItem.id`
- `OrderItem.orderId`
- `OrderItem.productId`
- `OrderItem.variantId`
- `OrderItem.quantity`
- `OrderItem.lineSubtotalFen`
- `OrderItem.remark`
- `OrderItem.createdAt`
- `OrderItemOption.id`
- `OrderItemOption.orderItemId`
- `OrderItemOption.optionValueId`
- `OrderItemOption.groupCodeSnapshot`
- `OrderItemOption.valueCodeSnapshot`
- `OrderItemMaterial.id`
- `OrderItemMaterial.orderItemId`
- `OrderItemMaterial.materialId`
- `OrderItemMaterial.actualUnitCostSnapshot`
- `OrderItemMaterial.source`
- `PaymentRecord.id`
- `PaymentRecord.storeId`
- `PaymentRecord.receivedAt`
- `PaymentRecord.operatorStaffId`
- `PaymentRecord.remark`
- `PaymentRecord.voidedAt`
- `PaymentRecord.voidedByStaffId`
- `PaymentRecord.voidReason`
- `PaymentRecord.createdAt`
- `PaymentRecord.updatedAt`
- `RefundRecord.id`
- `RefundRecord.reason`
- `RefundRecord.refundedAt`
- `RefundRecord.operatorStaffId`
- `RefundRecord.voidedAt`
- `RefundRecord.voidedByStaffId`
- `RefundRecord.voidReason`
- `RefundRecord.createdAt`
- `RefundRecord.updatedAt`

### 5.2 待确认关系/虚拟字段

以下关系没有出现在最终报告的 ER 图或明确关系规则中：

- `Store.products`
- `Store.sessions`
- `Store.orders`
- `Store.stockMovements`
- `Store.lossRecords`
- `Store.payments`
- `Staff.stockMovements`
- `Staff.lossRecords`
- `Staff.payments`
- `Staff.voidedPayments`
- `Staff.refunds`
- `Staff.voidedRefunds`
- `Staff.closedSessions`
- `Product.store`
- `Product.orderItems`
- `ProductVariant.orderItems`
- `VariantOptionValue.orderItemOptions`
- `Material.lossRecords`
- `Material.orderItemMaterials`
- `StockMovement.store`
- `StockMovement.order`
- `StockMovement.orderItem`
- `StockMovement.operatorStaff`
- `LossRecord.store`
- `LossRecord.material`
- `LossRecord.operatorStaff`
- `DiningSession.store`
- `DiningSession.closedBy`
- `Order.store`
- `Order.stockMovements`
- `Order.lossRecords`
- `OrderItem.product`
- `OrderItem.variant`
- `OrderItem.stockMovements`
- `OrderItem.lossRecords`
- `OrderItemOption.optionValue`
- `OrderItemMaterial.material`
- `PaymentRecord.store`
- `PaymentRecord.operatorStaff`
- `PaymentRecord.voidedByStaff`
- `RefundRecord.operatorStaff`
- `RefundRecord.voidedByStaff`

### 5.3 重点歧义

1. `Order.discountFen`、`DiningSession.discountFen`：最终报告一边总称现有字段结构不变，一边把“优惠体系”列为删除项。当前保留字段不能被审计为明确批准，也不能被审计为明确删除。
2. `Store.pendingReminderMinutes`、`maxPendingOrdersPerCustomer`、`maxPendingOrdersPerSession`：最终报告明确写 `StoreOrderPolicy` 已合入 Store，但没有列出合并后的字段名、默认值和类型。当前实现只能判为继承，不能据此推导完整约束。
3. `User.openid`：最终报告明确写“保持 openid @unique”，但未明确可空性、VARCHAR 长度。当前 `String? @db.VarChar(128)` 只有唯一约束被明确继承。
4. `OrderItem.productId`/`variantId`、`OrderItemOption.optionValueId`、`OrderItemMaterial.materialId` 等实时外键：最终报告强调历史快照，但没有在 ER 图中逐一批准这些活外键。它们是否必须、是否应仅保留用于追溯，需要确认。
5. `Store.products`、`Store.sessions`、`Store.orders`、`Store.stockMovements`、`Store.lossRecords`、`Store.payments` 等反向关系未出现在最终 ER，不能仅因存在 `storeId` 就自动视为最终设计批准。

## 6. 枚举取值核对

| 枚举 | 当前取值 | 结论 | 依据/缺口 |
| --- | --- | --- | --- |
| `StoreStatus` | `ACTIVE`, `SUSPENDED` | **待确认** | 最终报告未明确该枚举名称或完整取值 |
| `UserStatus` | `ACTIVE`, `DISABLED` | **待确认** | 最终报告未明确该枚举名称或完整取值 |
| `StaffRole` | `OWNER`, `MANAGER`, `STAFF` | **批准** | 最终报告明确给出状态或取值集合 |
| `StaffStatus` | `ACTIVE`, `DISABLED` | **待确认** | 最终报告未明确该枚举名称或完整取值 |
| `CommonStatus` | `ACTIVE`, `DISABLED` | **待确认** | 最终报告未明确该枚举名称或完整取值 |
| `InventoryMode` | `MANAGED`, `UNMANAGED` | **批准** | 最终报告明确给出状态或取值集合 |
| `RecipeMaterialRole` | `BASE`, `TAKEAWAY_EXTRA` | **批准** | 最终报告明确给出状态或取值集合 |
| `RecipeModifierTarget` | `BASE`, `TAKEAWAY_EXTRA` | **待确认** | 业务语义明确，但精确枚举名/取值拼写未完全冻结 |
| `OptionSelectionType` | `SINGLE`, `MULTI` | **待确认** | 业务语义明确，但精确枚举名/取值拼写未完全冻结 |
| `StockMovementType` | `OPENING_BALANCE`, `STOCK_IN`, `RESERVE`, `RELEASE`, `CONSUME`, `ADJUST` | **批准** | 最终报告明确给出状态或取值集合 |
| `OrderItemMaterialSource` | `BASE`, `TAKEAWAY_EXTRA`, `MODIFIER` | **待确认** | BASE/TAKEAWAY_EXTRA 有语义依据，MODIFIER 未在最终报告点名 |
| `OrderChannel` | `DINE`, `TAKEAWAY` | **批准** | 最终报告明确给出状态或取值集合 |
| `OrderStatus` | `PENDING_ACCEPTANCE`, `ACCEPTED`, `PREPARING`, `COMPLETED`, `CANCELLED` | **批准** | 最终报告明确给出状态或取值集合 |
| `DiningSessionStatus` | `OPEN`, `CLOSED` | **批准** | 最终报告明确给出状态或取值集合 |
| `PaymentMethod` | `CASH`, `WECHAT`, `ALIPAY`, `POS`, `OTHER` | **待确认** | 业务语义明确，但精确枚举名/取值拼写未完全冻结 |
| `PaymentStatus` | `ACTIVE`, `VOIDED` | **批准** | 最终报告明确给出状态或取值集合 |
| `RefundStatus` | `ACTIVE`, `VOIDED` | **批准** | 最终报告明确给出状态或取值集合 |

## 7. 旧版残留和设计冲突

### 7.1 已确认不存在的确切删除项

以下最终报告明确删除的模型或字段均未出现在当前 Schema：

- 模型：`Merchant`、`RecipeVersion`、`IdempotencyRecord`、`AuditLog`、`StoreOrderPolicy`、`DiscountAllocation`、`StaffCredential`。
- 字段：`Staff.userId`、`Order.tableId`、`ProductVariant.activeRecipeVersionId`、旧配方版本外键、`DiningTable.activeSessionId`、`DiningSession.discountVersion`、`DiningSession.allocationFinalizedAt`、`OrderItem.recipeVersionId`、旧强度/冲泡方式快照。

### 7.2 不能证明已清除的旧版残留

- `Store.status`、`createdAt`、`updatedAt`、`deletedAt` 未被最终报告点名；其中 `status` 和软删除策略可能来自旧 Store 结构，必须确认。
- `Store.products` 及多数 Store 反向集合未在最终 ER 出现，属于旧结构延续或 ORM 导航属性的可能残留。
- `PaymentMethod`、作废审计字段、操作人字段、备注字段、编号字段多数只由业务语义间接推断，最终报告未逐字段给出定义。
- `OrderItem` 的商品/规格活外键、`OrderItemOption.optionValueId`、`OrderItemMaterial.materialId` 与最终报告强调的快照模型之间没有字段级对应说明。
- 当前 Schema 的全部字符串长度、枚举默认值、主键策略、时间精度和大量可空性均未在最终报告中逐字段出现，属于实现推断，不是最终报告已验证事实。

## 8. 契约脚本覆盖范围与缺口

### 8.1 当前覆盖范围

`backend/scripts/check-schema.mjs` 当前能够检查：

1. 21 个模型名称集合准确。
2. 七个禁止模型不存在。
3. 少量明确禁止字段不存在。
4. 17 个枚举的当前完整取值与脚本硬编码一致。
5. 所有模型 `id` 为 `BigInt`，指定金额字段为 `BigInt`。
6. 指定数量字段为 `DECIMAL(18,3)`、指定成本字段为 `DECIMAL(18,6)`。
7. 不存在 `Float`/`Double`、Cascade、SetNull。
8. 部分复合唯一约束、唯一字段、可选关系和两个 `discountFen @default(0)`。
9. 所有含 `fields:` 的 Prisma 外键声明为 `onDelete: Restrict`。
10. P1-02-A 阶段不存在 Migration 目录。

### 8.2 主要缺口

1. **不能冻结完整字段集合**：未声明白名单的额外字段不会被拒绝。
2. **不能检查全部字段类型、长度、精度、可空性和默认值**：目前只覆盖部分金额、数量和成本字段。
3. **不能检查完整索引集合**：只检查少量必须存在/禁止存在的唯一约束，额外索引不会被发现。
4. **不能检查完整关系契约**：未核对关系目标、外键列、关系名称、反向字段、可空基数和所有 `onDelete` 声明。
5. **不能检查完整枚举集合**：只核对已列枚举取值，未禁止额外枚举。
6. **文本正则容易被注释或格式变体绕过**：没有使用 Prisma AST/解析器，也未对脚本本身做变异测试。
7. **不能区分业务批准字段与继承/待确认字段**：当前“通过”只证明代码符合脚本假设，不证明假设来自最终设计。

### 8.3 建议的修复方案

1. 先由负责人批准机器可读的字段契约，至少包含模型、字段、Prisma 类型、MySQL 类型、可空性、默认值、数据库列名、关系目标、外键列、删除策略、唯一约束、索引和枚举。
2. 将契约与最终设计报告绑定，记录报告版本或 SHA；禁止用 V1.2 作为隐式补全来源。
3. 校验脚本改用完整字段集合比较，双向拒绝缺失字段和额外字段；关系/索引也应做完整集合比较，而不是只查包含关系。
4. 对字段属性做精确比较，包括 VARCHAR 长度、DECIMAL 精度、DateTime 精度、默认值表达式和可空性。
5. 对关系检查目标模型、目标列、关系名、反向关系、可空基数、唯一性和 `onDelete`。
6. 增加变异自测：临时副本中分别删除字段、增加字段、把非空改可空、改默认值、改长度、改精度、增加索引，脚本都必须失败。
7. 为待确认字段建立显式决策记录；未决策字段不得进入 Migration 白名单。
8. 保留当前脚本作为防回退检查，但不能把它等同于字段设计验收。

## 9. 文档一致性检查

| 文件 | 当前冲突 | 影响 | 建议 |
| --- | --- | --- | --- |
| `docs/engineering/phase-1/README.md` | 第 28、58 行仍把保留两个 `discountFen` 和 `Merchant → Store` 写成已接受/当前决策。 | 与最终报告“Merchant 删除”和“优惠体系删除”的表述直接冲突；旧评审决定未标明已被最终报告取代。 | 建议把该段标为历史评审记录，并新增指向最终报告的当前生效说明。 |
| `docs/engineering/phase-1/05-implementation-plan.md` | 第 69-70、168-170、207、280、297、370、378 行仍包含 Merchant/Store、非零 discountFen CHECK 拒绝、`activeSessionId` 清理、`StaffCredential` 等旧口径。 | 其中 Merchant、activeSessionId、StaffCredential 已被最终模型删除或推迟；优惠字段是否保留未由最终报告逐字段冻结。 | 建议在文件顶部标识为历史实施计划，另建“P1-02 最终决策差异”映射；不要直接删历史记录。 |
| `docs/engineering/phase-1/03-domain-model.md` | 全篇以 V1.2 为完整字段依据，仍包含 Merchant、Staff.userId、RecipeVersion、activeSessionId、Order.tableId、Int 金额、LossRecord 复合唯一键、IdempotencyRecord、AuditLog。 | 这是历史设计基线，但与最终 21 模型字段契约冲突；当前未明确标注“已被最终报告替代”。 | 建议在标题和开头标注历史/已替代，并链接最终报告；保留原文作为版本演进记录。 |

判断：`03-domain-model.md` 已自述以 V1.2 为基线，因此适合保留为历史版本，但必须显式标记“历史/已被最终报告替代”。`README.md` 和 `05-implementation-plan.md` 混合了历史评审结论、当前工程状态和未落地计划，不能直接作为当前字段契约。

## 10. 建议修复清单

### P0：进入 P1-02-B 前必须完成

1. 确认 `discountFen` 是否保留；若保留，明确允许值与 CHECK。
2. 确认 `Store` 的最终完整字段集，包括 `status`、时间戳、软删除和三个合并策略字段。
3. 确认最终报告所称“现有字段结构”的版本与完整字段清单，禁止继续引用未固定的 V1.2。
4. 确认所有实时 FK/反向关系是否属于最终设计，还是仅为 Prisma 实现便利。
5. 明确主要字符串长度、枚举默认值、可空性和时间字段精度，或明确这些由数据库设计负责人另行批准。

### P1：契约与文档

6. 将确认后的字段契约写入可审查文件，并让检查脚本做完整双向比较。
7. 标记 `03-domain-model.md` 为历史基线；在不删除历史内容的前提下补充“已被最终设计替代”说明。
8. 修正 `README.md` 和 `05-implementation-plan.md` 中 Merchant、activeSessionId、StaffCredential、discountFen 等当前口径，建议新建差异映射而不是覆盖历史评审。

### P2：P1-02-B 前完成

9. 为每个待确认字段形成“保留/删除/改名/补类型或约束”的决定。
10. 在契约冻结后再生成 Migration；本轮不生成任何 SQL 或数据库变更。

## 11. 最终判断

本轮没有发现可通过最终报告证明的完整字段级一致性。应视为“模型集合通过、字段集合未验收”。在字段契约完成人工确认前，不应进入 P1-02-B。

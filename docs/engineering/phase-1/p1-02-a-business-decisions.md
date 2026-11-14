# P1-02-A 业务决策落档

记录日期：2026-11-14（Asia/Shanghai）
适用项目：三味茶屋单店经营管理系统
决策状态：**A1-A9 已由业务负责人确认**
执行状态：仅文档落档；Schema、Migration、依赖和业务代码均未修改。

## 1. 正式业务决策

| 编号 | 主题 | 影响字段 | 正式结论 | 状态 |
| --- | --- | --- | --- | --- |
| A1 | 优惠字段 | `Order.discountFen`、`DiningSession.discountFen` | 删除两个字段；首版不实现优惠、分摊、审核及优惠 API。 | **已确认** |
| A2 | Store 生命周期 | `Store.status`、`Store.deletedAt` | 保留 `status`，取值 `ACTIVE / SUSPENDED`；删除 `deletedAt`。单店根数据不软删除。 | **已确认** |
| A3 | Store 订单策略 | `pendingReminderMinutes`、`maxPendingOrdersPerCustomer`、`maxPendingOrdersPerSession` | 三个字段全部删除。超时提醒等策略优先使用应用配置。 | **已确认** |
| A4 | 顾客资料 | `User.openid`、`User.status`、`User.nickname`、`User.avatarUrl`、`User.unionid` | 保留 `openid` 与 `status`；删除昵称、头像和 unionid。首版不建立顾客画像。 | **已确认** |
| A5 | 主数据启停 | Category / ProductVariant / VariantOptionGroup / VariantOptionValue / Material 的 `status` | 五类主数据保留独立状态，统一 `ACTIVE / DISABLED`。停用不等于删除。 | **已确认** |
| A6 | 历史订单外键 | `OrderItem.productId`、`variantId`、`OrderItemOption.optionValueId`、`OrderItemMaterial.materialId` | 四个实时外键保留，仅用于关联查询和追溯；历史展示、计价和成本以快照为准。 | **已确认** |
| A7 | 主数据运营字段 | `Product.description`、`VariantOptionGroup.code`、`VariantOptionValue.code`、`Material.unit`、`Material.warningThreshold`、`DiningTable.name`、`DiningTable.capacity` | 保留 `Product.description`、`Material.unit`、`DiningTable.name`；删除两个 option code、`DiningTable.capacity` 和 `Material.warningThreshold`。 | **已确认** |
| A8 | 库存与损耗追溯 | StockMovement/LossRecord 来源、操作人、原因、可选订单关联 | 保留必要追溯信息；订单内报损不重复扣库存或成本；独立损耗必须关联库存流水；不允许为满足非空约束制造虚假关联。 | **已确认** |
| A9 | 人工可读流水编号 | `StockMovement.movementNo`、`LossRecord.lossNo` | 两个字段删除；首版使用内部主键，不增加额外编号生成机制。 | **已确认** |

## 2. 决策后的字段总量

当前 Schema 物理字段 224 个。按本轮决定仅做字段删除后的目标字段数为 **209** 个；Prisma 关系字段不受本轮字段删除影响。

| 分类 | 字段数 | 含义 |
| --- | ---: | --- |
| 本轮明确删除 | 15 | 不得进入后续字段契约 |
| 本轮明确保留 | 24 | A1-A9 直接确认保留 |
| 既有批准/继承保留 | 71 | 最终报告或既有决策已覆盖 |
| 技术待确认 | 114 | 字段保留或删除未定，等待统一技术规范 |

说明：以上“保留*（既有批准/继承）”不等于其类型、长度、默认值和索引均已确认；只表示该字段本身不应在本轮业务决策中再次讨论。

## 3. 逐模型字段清单

标记规则：

- **删除**：A1-A9 明确删除。
- **保留**：A1-A9 明确保留。
- 保留*：此前最终报告已明确或继承批准，本轮不重复决策。
- 待确认：当前字段存在，但最终报告没有明确业务决定；等待技术规范或后续设计确认。

### Store

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `name` | `String` | **保留（既有批准/继承）** |
| `status` | `StoreStatus` | **保留（本轮确认）** |
| `timezone` | `String` | **保留（既有批准/继承）** |
| `businessDayCutoffMinute` | `Int` | **保留（既有批准/继承）** |
| `pendingReminderMinutes` | `Int` | **删除（本轮确认）** |
| `maxPendingOrdersPerCustomer` | `Int` | **删除（本轮确认）** |
| `maxPendingOrdersPerSession` | `Int` | **删除（本轮确认）** |
| `createdAt` | `DateTime` | **待技术确认** |
| `updatedAt` | `DateTime` | **待技术确认** |
| `deletedAt` | `DateTime?` | **删除（本轮确认）** |

### User

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `openid` | `String?` | **保留（本轮确认）** |
| `unionid` | `String?` | **删除（本轮确认）** |
| `nickname` | `String?` | **删除（本轮确认）** |
| `avatarUrl` | `String?` | **删除（本轮确认）** |
| `status` | `UserStatus` | **保留（本轮确认）** |
| `createdAt` | `DateTime` | **待技术确认** |
| `updatedAt` | `DateTime` | **待技术确认** |

### Staff

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `storeId` | `BigInt` | **待技术确认** |
| `name` | `String` | **保留（既有批准/继承）** |
| `role` | `StaffRole` | **保留（既有批准/继承）** |
| `status` | `StaffStatus` | **保留（既有批准/继承）** |
| `createdAt` | `DateTime` | **待技术确认** |
| `updatedAt` | `DateTime` | **待技术确认** |

### Category

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `storeId` | `BigInt` | **待技术确认** |
| `name` | `String` | **保留（既有批准/继承）** |
| `sortOrder` | `Int` | **保留（既有批准/继承）** |
| `status` | `CommonStatus` | **保留（本轮确认）** |
| `createdAt` | `DateTime` | **待技术确认** |
| `updatedAt` | `DateTime` | **待技术确认** |
| `deletedAt` | `DateTime?` | **待技术确认** |

### Product

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `storeId` | `BigInt` | **待技术确认** |
| `categoryId` | `BigInt` | **待技术确认** |
| `name` | `String` | **保留（既有批准/继承）** |
| `description` | `String?` | **保留（本轮确认）** |
| `imageUrl` | `String?` | **保留（既有批准/继承）** |
| `status` | `CommonStatus` | **保留（既有批准/继承）** |
| `sortOrder` | `Int` | **待技术确认** |
| `createdAt` | `DateTime` | **待技术确认** |
| `updatedAt` | `DateTime` | **待技术确认** |
| `deletedAt` | `DateTime?` | **待技术确认** |

### ProductVariant

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `productId` | `BigInt` | **待技术确认** |
| `name` | `String` | **保留（既有批准/继承）** |
| `priceFen` | `BigInt` | **保留（既有批准/继承）** |
| `inventoryMode` | `InventoryMode` | **保留（既有批准/继承）** |
| `status` | `CommonStatus` | **保留（本轮确认）** |
| `sortOrder` | `Int` | **待技术确认** |
| `createdAt` | `DateTime` | **待技术确认** |
| `updatedAt` | `DateTime` | **待技术确认** |
| `deletedAt` | `DateTime?` | **待技术确认** |

### VariantOptionGroup

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `variantId` | `BigInt` | **待技术确认** |
| `code` | `String` | **删除（本轮确认）** |
| `name` | `String` | **保留（既有批准/继承）** |
| `selectionType` | `OptionSelectionType` | **保留（既有批准/继承）** |
| `required` | `Boolean` | **保留（既有批准/继承）** |
| `sortOrder` | `Int` | **待技术确认** |
| `status` | `CommonStatus` | **保留（本轮确认）** |

### VariantOptionValue

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `optionGroupId` | `BigInt` | **待技术确认** |
| `code` | `String` | **删除（本轮确认）** |
| `name` | `String` | **保留（既有批准/继承）** |
| `priceDeltaFen` | `BigInt` | **保留（既有批准/继承）** |
| `sortOrder` | `Int` | **待技术确认** |
| `status` | `CommonStatus` | **保留（本轮确认）** |

### VariantRecipe

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `variantId` | `BigInt` | **待技术确认** |
| `materialId` | `BigInt` | **保留（既有批准/继承）** |
| `role` | `RecipeMaterialRole` | **保留（既有批准/继承）** |
| `quantity` | `Decimal` | **保留（既有批准/继承）** |

### RecipeModifier

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `variantId` | `BigInt` | **待技术确认** |
| `optionValueId` | `BigInt` | **待技术确认** |
| `materialId` | `BigInt` | **保留（既有批准/继承）** |
| `targetRole` | `RecipeModifierTarget` | **待技术确认** |
| `quantityDelta` | `Decimal` | **保留（既有批准/继承）** |

### Material

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `storeId` | `BigInt` | **待技术确认** |
| `name` | `String` | **保留（既有批准/继承）** |
| `unit` | `String` | **保留（本轮确认）** |
| `onHand` | `Decimal` | **保留（既有批准/继承）** |
| `reserved` | `Decimal` | **保留（既有批准/继承）** |
| `warningThreshold` | `Decimal` | **删除（本轮确认）** |
| `averageCostPerUnit` | `Decimal` | **保留（既有批准/继承）** |
| `status` | `CommonStatus` | **保留（本轮确认）** |
| `version` | `Int` | **待技术确认** |
| `createdAt` | `DateTime` | **待技术确认** |
| `updatedAt` | `DateTime` | **待技术确认** |
| `deletedAt` | `DateTime?` | **待技术确认** |

### StockMovement

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `movementNo` | `String` | **删除（本轮确认）** |
| `dedupeKey` | `String` | **保留（既有批准/继承）** |
| `storeId` | `BigInt` | **待技术确认** |
| `materialId` | `BigInt` | **保留（既有批准/继承）** |
| `movementType` | `StockMovementType` | **保留（既有批准/继承）** |
| `quantityDelta` | `Decimal` | **保留（既有批准/继承）** |
| `reservedDelta` | `Decimal` | **待技术确认** |
| `onHandAfter` | `Decimal` | **待技术确认** |
| `reservedAfter` | `Decimal` | **待技术确认** |
| `unitCostSnapshot` | `Decimal?` | **待技术确认** |
| `totalCostSnapshot` | `Decimal?` | **保留（既有批准/继承）** |
| `orderId` | `BigInt?` | **保留（本轮确认）** |
| `orderItemId` | `BigInt?` | **保留（本轮确认）** |
| `operatorStaffId` | `BigInt?` | **保留（本轮确认）** |
| `reason` | `String?` | **保留（本轮确认）** |
| `createdAt` | `DateTime` | **待技术确认** |

### LossRecord

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `lossNo` | `String` | **删除（本轮确认）** |
| `dedupeKey` | `String` | **保留（既有批准/继承）** |
| `storeId` | `BigInt` | **待技术确认** |
| `materialId` | `BigInt` | **保留（既有批准/继承）** |
| `orderId` | `BigInt?` | **保留（本轮确认）** |
| `orderItemId` | `BigInt?` | **保留（本轮确认）** |
| `stockMovementId` | `BigInt?` | **保留（本轮确认）** |
| `quantity` | `Decimal` | **待技术确认** |
| `unitCostSnapshot` | `Decimal` | **待技术确认** |
| `lossCostSnapshot` | `Decimal` | **保留（既有批准/继承）** |
| `reason` | `String` | **保留（本轮确认）** |
| `operatorStaffId` | `BigInt?` | **保留（本轮确认）** |
| `occurredAt` | `DateTime` | **待技术确认** |
| `createdAt` | `DateTime` | **待技术确认** |

### DiningTable

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `storeId` | `BigInt` | **待技术确认** |
| `name` | `String` | **保留（本轮确认）** |
| `code` | `String` | **保留（既有批准/继承）** |
| `capacity` | `Int` | **删除（本轮确认）** |
| `createdAt` | `DateTime` | **待技术确认** |
| `updatedAt` | `DateTime` | **待技术确认** |
| `deletedAt` | `DateTime?` | **待技术确认** |

### DiningSession

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `storeId` | `BigInt` | **待技术确认** |
| `tableId` | `BigInt` | **保留（既有批准/继承）** |
| `status` | `DiningSessionStatus` | **保留（既有批准/继承）** |
| `discountFen` | `BigInt` | **删除（本轮确认）** |
| `version` | `Int` | **待技术确认** |
| `openedAt` | `DateTime` | **待技术确认** |
| `closedAt` | `DateTime?` | **待技术确认** |
| `closedByStaffId` | `BigInt?` | **待技术确认** |
| `createdAt` | `DateTime` | **待技术确认** |
| `updatedAt` | `DateTime` | **待技术确认** |

### Order

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `storeId` | `BigInt` | **待技术确认** |
| `customerUserId` | `BigInt` | **保留（既有批准/继承）** |
| `orderNo` | `String` | **保留（既有批准/继承）** |
| `idempotencyKey` | `String` | **保留（既有批准/继承）** |
| `channel` | `OrderChannel` | **保留（既有批准/继承）** |
| `sessionId` | `BigInt?` | **保留（既有批准/继承）** |
| `status` | `OrderStatus` | **保留（既有批准/继承）** |
| `subtotalFen` | `BigInt` | **待技术确认** |
| `discountFen` | `BigInt` | **删除（本轮确认）** |
| `totalAmountFen` | `BigInt` | **保留（既有批准/继承）** |
| `version` | `Int` | **待技术确认** |
| `createdAt` | `DateTime` | **待技术确认** |
| `acceptedAt` | `DateTime?` | **待技术确认** |
| `preparingAt` | `DateTime?` | **保留（既有批准/继承）** |
| `completedAt` | `DateTime?` | **保留（既有批准/继承）** |
| `cancelledAt` | `DateTime?` | **待技术确认** |
| `cancelReason` | `String?` | **待技术确认** |
| `updatedAt` | `DateTime` | **待技术确认** |

### OrderItem

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `orderId` | `BigInt` | **待技术确认** |
| `productId` | `BigInt` | **保留（本轮确认）** |
| `variantId` | `BigInt` | **保留（本轮确认）** |
| `productNameSnapshot` | `String` | **保留（既有批准/继承）** |
| `variantNameSnapshot` | `String` | **保留（既有批准/继承）** |
| `unitPriceFen` | `BigInt` | **保留（既有批准/继承）** |
| `quantity` | `Int` | **待技术确认** |
| `lineSubtotalFen` | `BigInt` | **待技术确认** |
| `remark` | `String?` | **待技术确认** |
| `createdAt` | `DateTime` | **待技术确认** |

### OrderItemOption

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `orderItemId` | `BigInt` | **待技术确认** |
| `optionValueId` | `BigInt` | **保留（本轮确认）** |
| `groupCodeSnapshot` | `String` | **待技术确认** |
| `groupNameSnapshot` | `String` | **保留（既有批准/继承）** |
| `valueCodeSnapshot` | `String` | **待技术确认** |
| `valueNameSnapshot` | `String` | **保留（既有批准/继承）** |
| `priceDeltaFenSnapshot` | `BigInt` | **保留（既有批准/继承）** |

### OrderItemMaterial

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `orderItemId` | `BigInt` | **待技术确认** |
| `materialId` | `BigInt` | **保留（本轮确认）** |
| `materialNameSnapshot` | `String` | **保留（既有批准/继承）** |
| `unitSnapshot` | `String` | **保留（既有批准/继承）** |
| `quantityPerItem` | `Decimal` | **保留（既有批准/继承）** |
| `totalQuantity` | `Decimal` | **保留（既有批准/继承）** |
| `actualUnitCostSnapshot` | `Decimal?` | **待技术确认** |
| `actualTotalCostSnapshot` | `Decimal?` | **保留（既有批准/继承）** |
| `source` | `OrderItemMaterialSource` | **待技术确认** |

### PaymentRecord

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `paymentNo` | `String` | **保留（既有批准/继承）** |
| `idempotencyKey` | `String` | **保留（既有批准/继承）** |
| `storeId` | `BigInt` | **待技术确认** |
| `sessionId` | `BigInt?` | **保留（既有批准/继承）** |
| `orderId` | `BigInt?` | **保留（既有批准/继承）** |
| `paymentMethod` | `PaymentMethod` | **保留（既有批准/继承）** |
| `amountFen` | `BigInt` | **保留（既有批准/继承）** |
| `receivedAt` | `DateTime` | **待技术确认** |
| `operatorStaffId` | `BigInt?` | **待技术确认** |
| `status` | `PaymentStatus` | **保留（既有批准/继承）** |
| `remark` | `String?` | **待技术确认** |
| `voidedAt` | `DateTime?` | **待技术确认** |
| `voidedByStaffId` | `BigInt?` | **待技术确认** |
| `voidReason` | `String?` | **待技术确认** |
| `createdAt` | `DateTime` | **待技术确认** |
| `updatedAt` | `DateTime` | **待技术确认** |

### RefundRecord

| 物理字段 | Prisma 类型 | 状态 |
| --- | --- | --- |
| `id` | `BigInt` | **待技术确认** |
| `refundNo` | `String` | **保留（既有批准/继承）** |
| `idempotencyKey` | `String` | **保留（既有批准/继承）** |
| `paymentRecordId` | `BigInt` | **保留（既有批准/继承）** |
| `amountFen` | `BigInt` | **保留（既有批准/继承）** |
| `reason` | `String` | **待技术确认** |
| `status` | `RefundStatus` | **保留（既有批准/继承）** |
| `refundedAt` | `DateTime` | **待技术确认** |
| `operatorStaffId` | `BigInt?` | **待技术确认** |
| `voidedAt` | `DateTime?` | **待技术确认** |
| `voidedByStaffId` | `BigInt?` | **待技术确认** |
| `voidReason` | `String?` | **待技术确认** |
| `createdAt` | `DateTime` | **待技术确认** |
| `updatedAt` | `DateTime` | **待技术确认** |

## 4. 删除字段汇总

共有 15 个物理字段在本轮明确删除：

| 模型 | 删除字段 |
| --- | --- |
| `Store` | `pendingReminderMinutes`、`maxPendingOrdersPerCustomer`、`maxPendingOrdersPerSession`、`deletedAt` |
| `User` | `unionid`、`nickname`、`avatarUrl` |
| `VariantOptionGroup` | `code` |
| `VariantOptionValue` | `code` |
| `Material` | `warningThreshold` |
| `StockMovement` | `movementNo` |
| `LossRecord` | `lossNo` |
| `DiningTable` | `capacity` |
| `DiningSession` | `discountFen` |
| `Order` | `discountFen` |

## 5. 约束和索引影响

| Schema 对象 | 当前内容 | 决策后的影响 | 状态 |
| --- | --- | --- | --- |
| `Store @@index` | `[status, deletedAt]` | `deletedAt` 已删除，该索引必须调整或删除；是否保留 `[status]` 索引待技术确认。 | 待确认 |
| `VariantOptionGroup @@unique` | `[variantId, code]` | `code` 已删除，该唯一约束必须删除；是否改用名称唯一或依赖服务层校验待确认。 | 待确认 |
| `VariantOptionValue @@unique` | `[optionGroupId, code]` | `code` 已删除，该唯一约束必须删除；替代唯一性待确认。 | 待确认 |
| `StockMovement.movementNo @unique` | 人工编号唯一 | 字段删除，旧唯一约束同步删除；`dedupeKey @unique` 保留。 | 已确认 |
| `LossRecord.lossNo @unique` | 人工编号唯一 | 字段删除，旧唯一约束同步删除；`dedupeKey @unique` 保留。 | 已确认 |

其他约束不因本轮业务决策直接删除。后续字段契约仍需逐项列入外键、唯一索引、普通索引、生成列唯一索引和 CHECK。

## 6. 关系影响清单

本轮删除的 15 个字段全部是普通标量字段，没有直接删除外键列，因此**没有 Prisma 虚拟关系需要因字段删除而直接移除**。

需要特别关注的关系：

| 关系/字段 | 本轮状态 | 影响 |
| --- | --- | --- |
| `OrderItem.product` / `OrderItem.variant` | 物理外键已确认保留 | 历史展示和计价仍只读快照 |
| `OrderItemOption.optionValue` | 物理外键已确认保留 | 选项来源可追溯，但 `code` 源字段删除后，历史 code 快照是否保留待技术确认 |
| `OrderItemMaterial.material` | 物理外键已确认保留 | 原料维度和成本追溯保留 |
| `StockMovement.order` / `orderItem` / `operatorStaff` | A8 已确认保留 | 业务来源和操作人可追溯 |
| `LossRecord.order` / `orderItem` / `operatorStaff` / `stockMovement` | A8 已确认保留 | 订单内报损与独立损耗必须通过 `stockMovementId` 语义区分 |
| `Store.products`、`Store.orders` 等反向集合 | 未因本轮删除变化 | 是否保留属于 ORM 实现，不单独做业务审批，但必须映射到确认后的物理外键 |
| `Category/Product/ProductVariant/Material/DiningTable` 的 `deletedAt` | 未在本轮删除 | 是否使用软删除仍需逐表技术确认 |

`OrderItemOption.groupCodeSnapshot` 与 `valueCodeSnapshot` 未在 A7 中直接删除。由于源表的 `code` 字段已删除，这两个快照字段应作为单独技术问题讨论，不能自行推断删除或保留。

## 7. 技术规范待确认清单

以下事项仍需架构负责人确认，当前未批准：

| 编号 | 待确认事项 | 影响字段/对象 | 最简单建议 | 状态 |
| --- | --- | --- | --- | --- |
| T1 | 主键和 API 标识 | 21 个 `id` | 保持 BigInt 自增，API 输出字符串。 | 待确认 |
| T2 | 时间字段规范 | 所有 `createdAt/updatedAt`、业务事件时间 | 使用 `DATETIME(3)`、数据库存 UTC；`updatedAt` 由 Prisma Client 维护，原生 SQL 显式更新。 | 待确认 |
| T3 | 字符串长度、可空性、枚举取值和默认值 | 所有 String/枚举字段 | 以业务语义分层：code 40、编号 64、幂等/dedupe 160、名称 40/80/120、URL 512、备注/原因 500；逐字段写入契约。 | 待确认 |
| T4 | 乐观锁 | `Material.version`、`DiningSession.version`、`Order.version` | 分别按真实并发路径评估。若能使用条件更新、事务和行锁，就不保留无必要版本字段。 | 待确认 |
| T5 | 软删除矩阵 | `Category.deletedAt`、`Product.deletedAt`、`ProductVariant.deletedAt`、`Material.deletedAt`、`DiningTable.deletedAt` | 仅对需要历史保留和同名重建的主数据保留；Store 已明确删除；订单、库存、资金事实不软删除。 | 待确认 |
| T6 | 选项唯一性 | `VariantOptionGroup`、`VariantOptionValue` | 删除 code 后，建议使用 active name 生成列唯一索引；需确认名称是否业务唯一。 | 待确认 |
| T7 | 历史选项代码快照 | `OrderItemOption.groupCodeSnapshot`、`valueCodeSnapshot` | 源 code 删除后，建议删除代码快照、保留组名/值名/价格快照；需确认是否仍需历史代码。 | 待确认 |
| T8 | 外键和删除策略 | 全部外键 | 保持单列 FK、`onDelete: Restrict`；可选关系必须反映真实业务可空性。 | 待确认 |
| T9 | 索引与 CHECK 清单 | 所有模型 | 在字段契约中显式列出唯一、普通、生成列索引及 CHECK；不增加触发器。 | 待确认 |
| T10 | 列名与命名映射 | 全部表/列 | 表名继续 snake_case；列名是否保持 Prisma 字段名需一次性确认。 | 待确认 |
| T11 | 订单计算与快照字段 | `Order.subtotalFen`、订单状态时间、`OrderItem.quantity`、`OrderItem.lineSubtotalFen`、选项快照、材料实际成本及来源 | 在字段契约中明确派生公式、快照写入时机和一致性校验。 | 待确认 |

## 8. 已明确但尚未实现

- 本轮只记录决策，当前 `schema.prisma` 仍保留待删除字段。
- 当前 Migration 目录不存在。
- 不进入 P1-02-B。
- 不生成数据库变更，不连接真实 MySQL。
- 下一步先由 ChatGPT 独立审查本决策文档，再由架构负责人确认 T1-T11。

## 9. 决策生效边界

A1-A9 从本文件记录起作为后续字段契约的业务输入。任何与旧 V1.2、旧 P1-02-A 报告或旧实施计划冲突的内容，以本文件和后续正式字段契约为准；在 Schema 尚未修改前，不得把目标字段集合误报为当前已实现状态。

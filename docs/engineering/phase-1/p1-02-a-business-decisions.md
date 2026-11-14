# P1-02-A 业务与技术决策落档

记录日期：2026-11-14（Asia/Shanghai）

适用项目：三味茶屋单店经营管理系统

决策状态：**A1-A9 业务决策已确认；T1-T11 技术决策已全部冻结**

执行状态：仅文档落档；Schema、Migration、依赖和业务代码均未修改。

本文件是后续字段契约的唯一业务与技术决策输入。具体字段类型、长度、默认值、索引和约束必须在字段契约中按本文件落实；未生成字段契约不代表决策仍待确认。

## 1. 正式业务决策 A1-A9

| 编号 | 主题 | 影响字段 | 正式结论 |
| --- | --- | --- | --- |
| A1 | 优惠字段 | `Order.discountFen`、`DiningSession.discountFen` | 删除两个字段；首版不实现优惠、分摊、审核及优惠 API。 |
| A2 | Store 生命周期 | `Store.status`、`Store.deletedAt` | 保留 `status`，取值 `ACTIVE / SUSPENDED`；删除 `deletedAt`。 |
| A3 | Store 订单策略 | `pendingReminderMinutes`、`maxPendingOrdersPerCustomer`、`maxPendingOrdersPerSession` | 三个字段全部删除，超时提醒等策略使用应用配置。 |
| A4 | 顾客资料 | `User.openid`、`User.status`、`User.nickname`、`User.avatarUrl`、`User.unionid` | 保留 `openid` 与 `status`；删除昵称、头像和 unionid。 |
| A5 | 主数据启停 | 五类主数据的 `status` | 统一使用 `ACTIVE / DISABLED`，停用不等于删除。 |
| A6 | 历史订单外键 | `OrderItem.productId`、`variantId`、`OrderItemOption.optionValueId`、`OrderItemMaterial.materialId` | 保留四个实时外键；历史展示、计价、成本以快照为准。 |
| A7 | 主数据运营字段 | `Product.description`、`VariantOptionGroup.code`、`VariantOptionValue.code`、`Material.unit`、`Material.warningThreshold`、`DiningTable.name`、`DiningTable.capacity` | 保留 `Product.description`、`Material.unit`、`DiningTable.name`；删除两个 option code、`DiningTable.capacity`、`Material.warningThreshold`。 |
| A8 | 库存与损耗追溯 | StockMovement/LossRecord 来源、操作人、原因、可选订单关联 | 保留追溯信息；订单内报损不重复扣库存/成本；独立损耗必须关联库存流水。 |
| A9 | 人工可读流水编号 | `StockMovement.movementNo`、`LossRecord.lossNo` | 删除两个字段；使用内部主键，不增加额外编号生成机制。 |

## 2. 正式技术决策 T1-T11

| 编号 | 主题 | 正式规则 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- |
| T1 | 主键与 API 标识 | 数据库 BigInt 自增主键；API 中 BigInt 标识使用十进制字符串；禁止转换为 JS Number；业务服务内部使用 BigInt。 | 21 个模型主键均为 BigInt；所有 BigInt 标识响应为字符串；超过 2^53 的 ID 可无损传递。 | **已冻结** |
| T2 | 时间规范 | MySQL DATETIME(3)，统一 UTC；API 使用带 Z 的 ISO 8601；前端按 Store.timezone 展示；createdAt 自动生成，updatedAt 由 Prisma @updatedAt 维护。 | 数据库列精度为 DATETIME(3)；API 时间均带 Z；跨时区展示测试通过；createdAt/updatedAt 行为符合约定。 | **已冻结** |
| T3 | 字符串、可空性、枚举和默认值 | 字符串长度按实际用途确定；只有业务上确实可能不存在的字段为 NULL；不用空字符串替代 NULL；Enum 只保留实际业务状态；默认值不掩盖业务遗漏。 | 每个字符串字段有明确长度依据；每个可空字段有业务理由；无空字符串哨兵；枚举和默认值均有契约记录。 | **已冻结** |
| T4 | 乐观锁 | 保留 Material.version、DiningSession.version、Order.version，默认 1；更新校验原版本并递增；冲突拒绝覆盖；其他模型不增加 version；乐观锁不替代事务和库存行锁。 | 三处 version 字段存在且默认 1；并发测试覆盖旧版本拒绝；不额外增加 version；事务与行锁策略不被乐观锁替代。 | **已冻结** |
| T5 | 软删除与主数据唯一性 | 主数据不使用 deletedAt；停用记录继续占用名称或桌号；恢复原记录；被引用数据物理删除使用 Restrict；不引入 active name 生成列。 | 五类 deletedAt 不存在；被引用记录无法删除；停用记录阻止同名新增。 | **已冻结** |
| T6 | 选项名称唯一 | VariantOptionGroup 按 [variantId, name] 唯一；VariantOptionValue 按 [optionGroupId, name] 唯一；不区分 ACTIVE/DISABLED；不引入生成列。 | 两组唯一约束存在；停用记录仍占名；无 active name 唯一机制。 | **已冻结** |
| T7 | 选项 code 快照 | 删除 OrderItemOption.groupCodeSnapshot、valueCodeSnapshot；保留组名、值名和价格差快照；唯一约束改为 [orderItemId, optionValueId]；历史展示只读快照。 | 两个 code 快照字段不存在；历史订单展示不依赖当前主数据；Option 唯一约束按 optionValueId。 | **已冻结** |
| T8 | 外键与删除策略 | 外键指向真实记录；必填关系不得随意可空；真正可能不存在的关系才允许 NULL；被引用数据删除统一 Restrict，不使用 Cascade；LossRecord 三个关联按 A8 可空；PaymentRecord 两个资金归属可空但业务必须明确归属；员工操作人字段暂按现状保留。 | 所有 FK 目标存在且 onDelete Restrict；无 Cascade；可空性有明确业务场景；Payment 目标互斥仍由服务/约束保证。 | **已冻结** |
| T9 | 唯一约束、普通索引和 CHECK | 继承 T5-T7 的 8 组唯一约束；订单号、幂等键、资金记录编号保持唯一；普通索引只服务实际查询；CHECK 仅限制明显非法数值；状态机和复杂资金规则由事务及服务层保证；不增加数据库触发器；以 MySQL 8.4 实测为准。 | 唯一约束和索引在字段契约中逐项列明；无无依据索引；CHECK 仅覆盖简单非法值；无触发器；MySQL 8.4 验证证据完整。 | **已冻结** |
| T10 | 表名和列名映射 | Prisma 模型 PascalCase；字段 camelCase；MySQL 表名和列名统一小写 snake_case；使用 @@map 和 @map 显式映射；映射不改变字段含义、类型、可空性和关系。 | information_schema 中表名、列名均为小写 snake_case；每个字段有显式 @map；映射前后类型、可空性和业务含义一致。 | **已冻结** |
| T11 | 订单计算与历史快照 | 金额以整数分计算，不用浮点数；明细单价 = 规格价格 + 选项价格差；选项价格差按每份商品计算后乘数量；明细金额 = 单价 × 数量；小计 = 明细金额之和；总额 = 小计；下单保存商品、规格、选项名称、价格及配方用量快照；配方使用 Decimal(18,3)；消耗时锁定单位成本和总成本；历史成本不随采购价变化；成本唯一累计来源为 CONSUME 流水及独立损耗；OrderItemMaterial 仅用于下钻和交叉核对；已计入订单材料消耗的报损不得重复扣库存或成本；营业额按完成时点，退款独立统计，收退款记录真实发生时间；OrderItemMaterial 与 StockMovement 按共同统计范围汇总核对，不强制逐行一一对应。 | 金额计算无浮点；订单、明细、快照公式断言通过；改价和改配方不影响历史订单；成本来源无重复累计；营业额与退款口径分别验证；交叉核对按共同统计范围执行。 | **已冻结** |

## 3. 决策后的字段总量

当前 Schema 物理字段 224 个。A1-A9、T5、T7 明确删除 22 个；其余 202 个物理字段全部保留，目标物理字段数为 **202**。Prisma 关系字段不受本轮字段删除影响。

| 分类 | 字段数 | 含义 |
| --- | ---: | --- |
| 明确删除 | 22 | 不得进入后续字段契约 |
| A1-A9 明确保留 | 24 | 业务决策直接确认保留 |
| 既有批准/继承保留 | 71 | 最终报告或既有决策已覆盖 |
| T1-T11 技术规范保留 | 107 | 字段保留，具体属性由 T1-T11 在字段契约中落实 |

不存在新的“待技术确认”字段。字段契约尚未生成，是下一阶段文档工作，不是尚未做出的技术决策。

## 4. 逐模型字段清单

所有物理字段只分为“保留”或“删除”。字段若标为 T1-T11，表示字段本身保留，具体长度、默认值、索引或映射按对应技术规则写入后续字段契约。

### Store

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `name` | `String` | **保留** | 既有批准/继承 |
| `status` | `StoreStatus` | **保留** | A1-A9 |
| `timezone` | `String` | **保留** | 既有批准/继承 |
| `businessDayCutoffMinute` | `Int` | **保留** | 既有批准/继承 |
| `pendingReminderMinutes` | `Int` | **删除** | A1-A9 |
| `maxPendingOrdersPerCustomer` | `Int` | **删除** | A1-A9 |
| `maxPendingOrdersPerSession` | `Int` | **删除** | A1-A9 |
| `createdAt` | `DateTime` | **保留** | T2 |
| `updatedAt` | `DateTime` | **保留** | T2 |
| `deletedAt` | `DateTime?` | **删除** | A1-A9 |

### User

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `openid` | `String?` | **保留** | A1-A9 |
| `unionid` | `String?` | **删除** | A1-A9 |
| `nickname` | `String?` | **删除** | A1-A9 |
| `avatarUrl` | `String?` | **删除** | A1-A9 |
| `status` | `UserStatus` | **保留** | A1-A9 |
| `createdAt` | `DateTime` | **保留** | T2 |
| `updatedAt` | `DateTime` | **保留** | T2 |

### Staff

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `storeId` | `BigInt` | **保留** | T8 |
| `name` | `String` | **保留** | 既有批准/继承 |
| `role` | `StaffRole` | **保留** | 既有批准/继承 |
| `status` | `StaffStatus` | **保留** | 既有批准/继承 |
| `createdAt` | `DateTime` | **保留** | T2 |
| `updatedAt` | `DateTime` | **保留** | T2 |

### Category

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `storeId` | `BigInt` | **保留** | T8 |
| `name` | `String` | **保留** | 既有批准/继承 |
| `sortOrder` | `Int` | **保留** | 既有批准/继承 |
| `status` | `CommonStatus` | **保留** | A1-A9 |
| `createdAt` | `DateTime` | **保留** | T2 |
| `updatedAt` | `DateTime` | **保留** | T2 |
| `deletedAt` | `DateTime?` | **删除** | T5 |

### Product

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `storeId` | `BigInt` | **保留** | T8 |
| `categoryId` | `BigInt` | **保留** | T8 |
| `name` | `String` | **保留** | 既有批准/继承 |
| `description` | `String?` | **保留** | A1-A9 |
| `imageUrl` | `String?` | **保留** | 既有批准/继承 |
| `status` | `CommonStatus` | **保留** | 既有批准/继承 |
| `sortOrder` | `Int` | **保留** | T3/T2/T9 |
| `createdAt` | `DateTime` | **保留** | T2 |
| `updatedAt` | `DateTime` | **保留** | T2 |
| `deletedAt` | `DateTime?` | **删除** | T5 |

### ProductVariant

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `productId` | `BigInt` | **保留** | T8 |
| `name` | `String` | **保留** | 既有批准/继承 |
| `priceFen` | `BigInt` | **保留** | 既有批准/继承 |
| `inventoryMode` | `InventoryMode` | **保留** | 既有批准/继承 |
| `status` | `CommonStatus` | **保留** | A1-A9 |
| `sortOrder` | `Int` | **保留** | T3/T2/T9 |
| `createdAt` | `DateTime` | **保留** | T2 |
| `updatedAt` | `DateTime` | **保留** | T2 |
| `deletedAt` | `DateTime?` | **删除** | T5 |

### VariantOptionGroup

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `variantId` | `BigInt` | **保留** | T8 |
| `code` | `String` | **删除** | A1-A9 |
| `name` | `String` | **保留** | 既有批准/继承 |
| `selectionType` | `OptionSelectionType` | **保留** | 既有批准/继承 |
| `required` | `Boolean` | **保留** | 既有批准/继承 |
| `sortOrder` | `Int` | **保留** | T3/T2/T9 |
| `status` | `CommonStatus` | **保留** | A1-A9 |

### VariantOptionValue

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `optionGroupId` | `BigInt` | **保留** | T8 |
| `code` | `String` | **删除** | A1-A9 |
| `name` | `String` | **保留** | 既有批准/继承 |
| `priceDeltaFen` | `BigInt` | **保留** | 既有批准/继承 |
| `sortOrder` | `Int` | **保留** | T3/T2/T9 |
| `status` | `CommonStatus` | **保留** | A1-A9 |

### VariantRecipe

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `variantId` | `BigInt` | **保留** | T8 |
| `materialId` | `BigInt` | **保留** | 既有批准/继承 |
| `role` | `RecipeMaterialRole` | **保留** | 既有批准/继承 |
| `quantity` | `Decimal` | **保留** | 既有批准/继承 |

### RecipeModifier

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `variantId` | `BigInt` | **保留** | T8 |
| `optionValueId` | `BigInt` | **保留** | T8 |
| `materialId` | `BigInt` | **保留** | 既有批准/继承 |
| `targetRole` | `RecipeModifierTarget` | **保留** | T3/T2/T9 |
| `quantityDelta` | `Decimal` | **保留** | 既有批准/继承 |

### Material

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `storeId` | `BigInt` | **保留** | T8 |
| `name` | `String` | **保留** | 既有批准/继承 |
| `unit` | `String` | **保留** | A1-A9 |
| `onHand` | `Decimal` | **保留** | 既有批准/继承 |
| `reserved` | `Decimal` | **保留** | 既有批准/继承 |
| `warningThreshold` | `Decimal` | **删除** | A1-A9 |
| `averageCostPerUnit` | `Decimal` | **保留** | 既有批准/继承 |
| `status` | `CommonStatus` | **保留** | A1-A9 |
| `version` | `Int` | **保留** | T4 |
| `createdAt` | `DateTime` | **保留** | T2 |
| `updatedAt` | `DateTime` | **保留** | T2 |
| `deletedAt` | `DateTime?` | **删除** | T5 |

### StockMovement

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `movementNo` | `String` | **删除** | A1-A9 |
| `dedupeKey` | `String` | **保留** | 既有批准/继承 |
| `storeId` | `BigInt` | **保留** | T8 |
| `materialId` | `BigInt` | **保留** | 既有批准/继承 |
| `movementType` | `StockMovementType` | **保留** | 既有批准/继承 |
| `quantityDelta` | `Decimal` | **保留** | 既有批准/继承 |
| `reservedDelta` | `Decimal` | **保留** | T11 |
| `onHandAfter` | `Decimal` | **保留** | T11 |
| `reservedAfter` | `Decimal` | **保留** | T11 |
| `unitCostSnapshot` | `Decimal?` | **保留** | T11 |
| `totalCostSnapshot` | `Decimal?` | **保留** | 既有批准/继承 |
| `orderId` | `BigInt?` | **保留** | A1-A9 |
| `orderItemId` | `BigInt?` | **保留** | A1-A9 |
| `operatorStaffId` | `BigInt?` | **保留** | A1-A9 |
| `reason` | `String?` | **保留** | A1-A9 |
| `createdAt` | `DateTime` | **保留** | T2 |

### LossRecord

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `lossNo` | `String` | **删除** | A1-A9 |
| `dedupeKey` | `String` | **保留** | 既有批准/继承 |
| `storeId` | `BigInt` | **保留** | T8 |
| `materialId` | `BigInt` | **保留** | 既有批准/继承 |
| `orderId` | `BigInt?` | **保留** | A1-A9 |
| `orderItemId` | `BigInt?` | **保留** | A1-A9 |
| `stockMovementId` | `BigInt?` | **保留** | A1-A9 |
| `quantity` | `Decimal` | **保留** | T11 |
| `unitCostSnapshot` | `Decimal` | **保留** | T11 |
| `lossCostSnapshot` | `Decimal` | **保留** | 既有批准/继承 |
| `reason` | `String` | **保留** | A1-A9 |
| `operatorStaffId` | `BigInt?` | **保留** | A1-A9 |
| `occurredAt` | `DateTime` | **保留** | T2 |
| `createdAt` | `DateTime` | **保留** | T2 |

### DiningTable

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `storeId` | `BigInt` | **保留** | T8 |
| `name` | `String` | **保留** | A1-A9 |
| `code` | `String` | **保留** | 既有批准/继承 |
| `capacity` | `Int` | **删除** | A1-A9 |
| `createdAt` | `DateTime` | **保留** | T2 |
| `updatedAt` | `DateTime` | **保留** | T2 |
| `deletedAt` | `DateTime?` | **删除** | T5 |

### DiningSession

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `storeId` | `BigInt` | **保留** | T8 |
| `tableId` | `BigInt` | **保留** | 既有批准/继承 |
| `status` | `DiningSessionStatus` | **保留** | 既有批准/继承 |
| `discountFen` | `BigInt` | **删除** | A1-A9 |
| `version` | `Int` | **保留** | T4 |
| `openedAt` | `DateTime` | **保留** | T2 |
| `closedAt` | `DateTime?` | **保留** | T2 |
| `closedByStaffId` | `BigInt?` | **保留** | T8 |
| `createdAt` | `DateTime` | **保留** | T2 |
| `updatedAt` | `DateTime` | **保留** | T2 |

### Order

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `storeId` | `BigInt` | **保留** | T8 |
| `customerUserId` | `BigInt` | **保留** | 既有批准/继承 |
| `orderNo` | `String` | **保留** | 既有批准/继承 |
| `idempotencyKey` | `String` | **保留** | 既有批准/继承 |
| `channel` | `OrderChannel` | **保留** | 既有批准/继承 |
| `sessionId` | `BigInt?` | **保留** | 既有批准/继承 |
| `status` | `OrderStatus` | **保留** | 既有批准/继承 |
| `subtotalFen` | `BigInt` | **保留** | T11 |
| `discountFen` | `BigInt` | **删除** | A1-A9 |
| `totalAmountFen` | `BigInt` | **保留** | 既有批准/继承 |
| `version` | `Int` | **保留** | T4 |
| `createdAt` | `DateTime` | **保留** | T2 |
| `acceptedAt` | `DateTime?` | **保留** | T2 |
| `preparingAt` | `DateTime?` | **保留** | 既有批准/继承 |
| `completedAt` | `DateTime?` | **保留** | 既有批准/继承 |
| `cancelledAt` | `DateTime?` | **保留** | T2 |
| `cancelReason` | `String?` | **保留** | T3/T2/T9 |
| `updatedAt` | `DateTime` | **保留** | T2 |

### OrderItem

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `orderId` | `BigInt` | **保留** | T8 |
| `productId` | `BigInt` | **保留** | A1-A9 |
| `variantId` | `BigInt` | **保留** | A1-A9 |
| `productNameSnapshot` | `String` | **保留** | 既有批准/继承 |
| `variantNameSnapshot` | `String` | **保留** | 既有批准/继承 |
| `unitPriceFen` | `BigInt` | **保留** | 既有批准/继承 |
| `quantity` | `Int` | **保留** | T11 |
| `lineSubtotalFen` | `BigInt` | **保留** | T11 |
| `remark` | `String?` | **保留** | T3/T2/T9 |
| `createdAt` | `DateTime` | **保留** | T2 |

### OrderItemOption

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `orderItemId` | `BigInt` | **保留** | T8 |
| `optionValueId` | `BigInt` | **保留** | A1-A9 |
| `groupCodeSnapshot` | `String` | **删除** | T7 |
| `groupNameSnapshot` | `String` | **保留** | 既有批准/继承 |
| `valueCodeSnapshot` | `String` | **删除** | T7 |
| `valueNameSnapshot` | `String` | **保留** | 既有批准/继承 |
| `priceDeltaFenSnapshot` | `BigInt` | **保留** | 既有批准/继承 |

### OrderItemMaterial

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `orderItemId` | `BigInt` | **保留** | T8 |
| `materialId` | `BigInt` | **保留** | A1-A9 |
| `materialNameSnapshot` | `String` | **保留** | 既有批准/继承 |
| `unitSnapshot` | `String` | **保留** | 既有批准/继承 |
| `quantityPerItem` | `Decimal` | **保留** | 既有批准/继承 |
| `totalQuantity` | `Decimal` | **保留** | 既有批准/继承 |
| `actualUnitCostSnapshot` | `Decimal?` | **保留** | T11 |
| `actualTotalCostSnapshot` | `Decimal?` | **保留** | 既有批准/继承 |
| `source` | `OrderItemMaterialSource` | **保留** | T11 |

### PaymentRecord

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `paymentNo` | `String` | **保留** | 既有批准/继承 |
| `idempotencyKey` | `String` | **保留** | 既有批准/继承 |
| `storeId` | `BigInt` | **保留** | T8 |
| `sessionId` | `BigInt?` | **保留** | 既有批准/继承 |
| `orderId` | `BigInt?` | **保留** | 既有批准/继承 |
| `paymentMethod` | `PaymentMethod` | **保留** | 既有批准/继承 |
| `amountFen` | `BigInt` | **保留** | 既有批准/继承 |
| `receivedAt` | `DateTime` | **保留** | T2 |
| `operatorStaffId` | `BigInt?` | **保留** | T8 |
| `status` | `PaymentStatus` | **保留** | 既有批准/继承 |
| `remark` | `String?` | **保留** | T3/T2/T9 |
| `voidedAt` | `DateTime?` | **保留** | T2 |
| `voidedByStaffId` | `BigInt?` | **保留** | T8 |
| `voidReason` | `String?` | **保留** | T3/T2/T9 |
| `createdAt` | `DateTime` | **保留** | T2 |
| `updatedAt` | `DateTime` | **保留** | T2 |

### RefundRecord

| 物理字段 | Prisma 类型 | 决策结果 | 依据 |
| --- | --- | --- | --- |
| `id` | `BigInt` | **保留** | T1 |
| `refundNo` | `String` | **保留** | 既有批准/继承 |
| `idempotencyKey` | `String` | **保留** | 既有批准/继承 |
| `paymentRecordId` | `BigInt` | **保留** | 既有批准/继承 |
| `amountFen` | `BigInt` | **保留** | 既有批准/继承 |
| `reason` | `String` | **保留** | T3/T2/T9 |
| `status` | `RefundStatus` | **保留** | 既有批准/继承 |
| `refundedAt` | `DateTime` | **保留** | T2 |
| `operatorStaffId` | `BigInt?` | **保留** | T8 |
| `voidedAt` | `DateTime?` | **保留** | T2 |
| `voidedByStaffId` | `BigInt?` | **保留** | T8 |
| `voidReason` | `String?` | **保留** | T3/T2/T9 |
| `createdAt` | `DateTime` | **保留** | T2 |
| `updatedAt` | `DateTime` | **保留** | T2 |

## 5. 删除字段汇总

共有 22 个物理字段明确删除：

| 模型 | 删除字段 |
| --- | --- |
| `Store` | `pendingReminderMinutes`、`maxPendingOrdersPerCustomer`、`maxPendingOrdersPerSession`、`deletedAt` |
| `User` | `unionid`、`nickname`、`avatarUrl` |
| `Category` | `deletedAt` |
| `Product` | `deletedAt` |
| `ProductVariant` | `deletedAt` |
| `VariantOptionGroup` | `code` |
| `VariantOptionValue` | `code` |
| `Material` | `warningThreshold`、`deletedAt` |
| `StockMovement` | `movementNo` |
| `LossRecord` | `lossNo` |
| `DiningTable` | `capacity`、`deletedAt` |
| `DiningSession` | `discountFen` |
| `Order` | `discountFen` |
| `OrderItemOption` | `groupCodeSnapshot`、`valueCodeSnapshot` |

## 6. 唯一约束和索引决策

### 6.1 冻结的 8 组唯一约束

| 模型 | 唯一约束 |
| --- | --- |
| Category | `[storeId, name]` |
| Product | `[storeId, name]` |
| ProductVariant | `[productId, name]` |
| Material | `[storeId, name]` |
| DiningTable | `[storeId, code]` |
| VariantOptionGroup | `[variantId, name]` |
| VariantOptionValue | `[optionGroupId, name]` |
| OrderItemOption | `[orderItemId, optionValueId]` |

### 6.2 其他保持唯一的字段

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

`StockMovement.movementNo`、`LossRecord.lossNo` 已删除，不再保留对应唯一约束。

### 6.3 索引与 CHECK 边界

- 普通索引只服务实际查询，最终清单在字段契约中逐项给出。
- CHECK 仅限制明显非法数值。
- 状态机、资金和复杂业务规则由事务及服务层保证。
- 不增加数据库触发器。
- 以 MySQL 8.4 实际执行结果作为最终验证依据。

## 7. 关系影响清单

1. 22 个删除字段均为普通标量字段，没有直接删除外键列。
2. 现有 Prisma 虚拟关系不需要因字段删除直接移除。
3. A6 保留的历史实时外键对应关系继续存在，但订单展示、计价和成本以快照为准。
4. A8 保留库存、损耗的订单/明细/操作人关系。
5. T7 删除选项 code 快照，不删除 `OrderItemOption.optionValue` 关系。
6. T5 删除主数据软删除字段后，历史引用通过 `Restrict` 和快照保留。
7. Prisma 反向关系属于 ORM 实现，不单独作为业务字段审批，但必须映射到已确认的物理外键。
8. PaymentRecord 的 sessionId/orderId 业务上必须且只能有一个明确资金归属，具体数据库 CHECK 与服务层校验在字段契约及 Migration 中验证。

## 8. 已明确但尚未实现

- 当前 `schema.prisma` 尚未按本决策修改。
- 当前 Migration 目录不存在。
- 未连接或修改真实数据库。
- 未修改依赖、业务代码或检查脚本。
- 不进入 P1-02-B。
- 下一步应基于本文件形成完整字段契约，再进行独立字段级审查。

## 9. 决策生效边界

A1-A9 与 T1-T11 从本文件记录起作为后续字段契约的正式输入。任何与旧 V1.2、旧 P1-02-A 报告或旧实施计划冲突的内容，以本文件和后续正式字段契约为准。

本文件不代表 P1-02-A 已验收；在 Schema 与字段契约完成独立审查前，不得进入 P1-02-B。

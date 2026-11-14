# P1-02-A 字段决策收敛状态

更新日期：2026-11-14（Asia/Shanghai）

基线提交：`1f02a37`

正式业务决策：[p1-02-a-business-decisions.md](./p1-02-a-business-decisions.md)

上一轮字段审计：[p1-02-a-field-audit.md](./p1-02-a-field-audit.md)
## 1. 当前状态

| 类别 | 状态 | 说明 |
| --- | --- | --- |
| A 类业务决策 | **A1-A9 已确认** | 结果已写入 `p1-02-a-business-decisions.md`。 |
| T5-T7 技术决策 | **已冻结** | 软删除、主数据唯一性、选项名称唯一和选项 code 快照已收敛。 |
| 其余技术规范 | **待架构负责人确认** | 保留 T1、T2、T3、T4、T8、T9、T10、T11 共 8 项。 |
| Schema 实现 | **未开始** | `schema.prisma` 尚未按本决策修改。 |
| Migration | **未开始** | 未生成、未执行，未连接真实数据库。 |

结论：A1-A9 与 T5-T7 已冻结；P1-02-A 仍待剩余技术规范和完整字段契约审查，不能进入 P1-02-B。

## 2. 已确认业务决策

| 编号 | 正式结论 |
| --- | --- |
| A1 | 删除 `Order.discountFen`、`DiningSession.discountFen`；首版不实现优惠。 |
| A2 | 保留 `Store.status`；删除 `Store.deletedAt`。 |
| A3 | 删除三个 Store 订单策略字段，策略改用应用配置。 |
| A4 | 保留 `User.openid`、`User.status`；删除昵称、头像、unionid。 |
| A5 | 五类主数据保留 ACTIVE/DISABLED 状态。 |
| A6 | 保留 OrderItem、OrderItemOption、OrderItemMaterial 的四个历史实时外键，展示仍以快照为准。 |
| A7 | 保留 Product.description、Material.unit、DiningTable.name；删除两个 option code、DiningTable.capacity、Material.warningThreshold。 |
| A8 | 保留库存与损耗的来源、操作人、原因和可选订单关联。 |
| A9 | 删除 `StockMovement.movementNo`、`LossRecord.lossNo`，首版使用内部主键。 |

## 3. 已冻结技术决策

### T5：不使用软删除，补齐主数据唯一性

- 删除 Category、Product、ProductVariant、Material、DiningTable 的 `deletedAt`。
- 主数据使用 `ACTIVE / DISABLED` 管理生命周期。
- 停用记录继续占用名称或桌号；恢复原记录，不创建同名新记录。
- 被历史业务引用的数据通过外键 `Restrict` 阻止物理删除。
- 不增加 active name 生成列。

冻结的唯一约束：

| 模型 | 唯一约束 | 业务范围 |
| --- | --- | --- |
| Category | `[storeId, name]` | 同一 Store 下分类名称唯一 |
| Product | `[storeId, name]` | 全店商品名称唯一，不按分类拆分 |
| ProductVariant | `[productId, name]` | 同一 Product 下规格名称唯一 |
| Material | `[storeId, name]` | 同一 Store 下原料名称唯一 |
| DiningTable | `[storeId, code]` | 同一 Store 下桌码唯一；name 仅用于展示 |

### T6：选项名称唯一

| 模型 | 唯一约束 |
| --- | --- |
| VariantOptionGroup | `[variantId, name]` |
| VariantOptionValue | `[optionGroupId, name]` |

该唯一性不区分 ACTIVE/DISABLED，不引入生成列或软删除。

### T7：删除选项 code 快照

- 删除 `OrderItemOption.groupCodeSnapshot`。
- 删除 `OrderItemOption.valueCodeSnapshot`。
- 保留选项组名称快照、选项值名称快照和价格差快照。
- 唯一约束改为 `[orderItemId, optionValueId]`。
- 历史订单展示始终读取名称快照，不使用当前主数据名称覆盖历史。

## 4. 字段变更总量

当前 Schema 有 224 个物理字段。A1-A9 与 T5/T7 合并后共删除 22 个字段，目标物理字段数为 **202**，模型数仍为 21。

新增删除项：

- `Category.deletedAt`
- `Product.deletedAt`
- `ProductVariant.deletedAt`
- `Material.deletedAt`
- `DiningTable.deletedAt`
- `OrderItemOption.groupCodeSnapshot`
- `OrderItemOption.valueCodeSnapshot`

此前 A1-A9 已确认的 15 个删除项保持不变。完整清单和逐模型状态见正式业务决策文档。

## 5. 约束和索引影响

| 对象 | 影响 | 状态 |
| --- | --- | --- |
| 五类主数据 `deletedAt` | 删除字段，取消软删除机制 | **已冻结** |
| Category/Product/ProductVariant/Material/DiningTable | 新增上述普通复合唯一约束 | **已冻结** |
| VariantOptionGroup/VariantOptionValue | 删除 code 唯一约束，改用 name 唯一 | **已冻结** |
| OrderItemOption | 删除 code 快照及旧唯一约束，改用 `[orderItemId, optionValueId]` | **已冻结** |
| `Store @@index([status, deletedAt])` | `deletedAt` 删除后必须调整或移除 | 待确认 |
| `Material @@index([storeId, status, deletedAt])` | `deletedAt` 删除后必须调整 | 待确认 |
| `DiningTable @@index([storeId, deletedAt])` | `deletedAt` 删除后必须替换或移除 | 待确认 |
| 其他唯一、普通和 CHECK 约束 | 进入完整字段契约统一核对 | 待确认 |

## 6. 关系影响

- 本轮所有删除字段均为普通标量字段，不删除任何外键列。
- 现有 Prisma 虚拟关系不需要因字段删除直接移除。
- `OrderItemOption.optionValue` 继续保留，历史展示只能使用名称/价格快照。
- `Category/Product/ProductVariant/Material/DiningTable` 的历史引用通过 `Restrict` 保护，不依赖 `deletedAt`。
- 反向关系仍属于 Prisma/ORM 实现，不单独作为业务字段审批。

## 7. 剩余技术待确认

| 编号 | 待确认事项 | 状态 |
| --- | --- | --- |
| T1 | 主键和 API 标识：BigInt 自增、API 字符串输出 | 待确认 |
| T2 | 时间规范：DATETIME(3)、UTC、updatedAt 维护方式 | 待确认 |
| T3 | 字符串长度、可空性、枚举取值和默认值 | 待确认 |
| T4 | Material/DiningSession/Order 是否保留 version，或采用条件更新与行锁 | 待确认 |
| T8 | 全部外键目标、可空性、基数和 onDelete 策略 | 待确认 |
| T9 | 唯一约束、普通索引和 CHECK 的完整清单 | 待确认 |
| T10 | 表名/列名映射规范 | 待确认 |
| T11 | 订单计算与快照字段的派生公式与写入时机 | 待确认 |

## 8. 下一步

1. 由架构负责人确认剩余 T1、T2、T3、T4、T8、T9、T10、T11。
2. 根据 A1-A9、T5-T7 和剩余技术规范形成机器可读字段契约。
3. 独立审查字段契约与当前 Schema 的差异。
4. 另行授权后，才能修改 `schema.prisma` 和检查脚本。
5. 通过 Schema 审查后，才考虑进入 Migration。

本文件不授权任何代码、Schema 或数据库变更。P1-02-A 尚未整体验收，不进入 P1-02-B。

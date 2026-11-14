# P1-02-A 字段决策收敛状态

更新日期：2026-11-14（Asia/Shanghai）
基线提交：`2efeee7`
正式业务决策：[p1-02-a-business-decisions.md](./p1-02-a-business-decisions.md)
上一轮字段审计：[p1-02-a-field-audit.md](./p1-02-a-field-audit.md)

## 1. 当前状态

| 类别 | 状态 | 说明 |
| --- | --- | --- |
| A 类业务决策 | **A1-A9 已确认** | 结果已写入 `p1-02-a-business-decisions.md`。 |
| B 类技术规范 | **待架构负责人确认** | 主键、时间、长度、索引、约束及少量字段取舍仍需形成可执行契约。 |
| C 类 Prisma/ORM 关系 | **实现层处理** | 不作为独立业务字段审批；关系目标、基数和外键必须可核对。 |
| Schema 实现 | **未开始** | `schema.prisma` 尚未按本决策修改。 |
| Migration | **未开始** | 未生成、未执行，未连接真实数据库。 |

结论：业务层的 A1-A9 已冻结；P1-02-A 仍待技术规范确认和字段契约审查，不能进入 P1-02-B。

## 2. 已确认业务决策

| 编号 | 正式结论 | 影响 |
| --- | --- | --- |
| A1 | 删除 `Order.discountFen`、`DiningSession.discountFen` | 首版不实现优惠、分摊、审核或优惠 API。 |
| A2 | 保留 `Store.status`；删除 `Store.deletedAt` | Store 使用 ACTIVE/SUSPENDED，单店根数据不做软删除。 |
| A3 | 删除三个 Store 订单策略字段 | 提醒和挂单限制优先使用应用配置。 |
| A4 | 保留 `User.openid`、`User.status`；删除昵称、头像、unionid | 首版不建立顾客画像。 |
| A5 | 保留五类主数据状态 | Category、ProductVariant、VariantOptionGroup、VariantOptionValue、Material 使用 ACTIVE/DISABLED。 |
| A6 | 保留四个历史实时外键 | 订单展示、计价、成本以快照为准，外键只用于追溯。 |
| A7 | 保留 Product.description、Material.unit、DiningTable.name；删除两个 option code、DiningTable.capacity、Material.warningThreshold | 首版不做库存预警，不保留无用运营描述。 |
| A8 | 保留库存和损耗来源、操作人、原因及可选订单关联 | 订单内报损不重复扣库存/成本；独立损耗必须关联库存流水。 |
| A9 | 删除 `StockMovement.movementNo`、`LossRecord.lossNo` | 使用数据库内部主键，不增加额外编号生成机制。 |

完整字段级决定见正式业务决策文档。

## 3. 已确认字段变更

本轮确认删除 15 个物理字段：

- `Store.deletedAt`
- `Store.pendingReminderMinutes`
- `Store.maxPendingOrdersPerCustomer`
- `Store.maxPendingOrdersPerSession`
- `User.nickname`
- `User.avatarUrl`
- `User.unionid`
- `VariantOptionGroup.code`
- `VariantOptionValue.code`
- `DiningTable.capacity`
- `Material.warningThreshold`
- `StockMovement.movementNo`
- `LossRecord.lossNo`
- `DiningSession.discountFen`
- `Order.discountFen`

删除字段后，目标物理字段数为 209，模型数仍为 21。当前 Schema 尚未实施这些删除。

## 4. 已确认的关系影响

1. 本轮删除均为普通标量字段，没有直接删除外键列，因此没有 Prisma 虚拟关系需要直接移除。
2. A6 保留 `OrderItem.productId`、`OrderItem.variantId`、`OrderItemOption.optionValueId`、`OrderItemMaterial.materialId`；对应关系字段可以继续存在。
3. A8 保留库存、损耗的订单/明细/操作人追溯字段；对应关系字段可以继续存在。
4. `VariantOptionGroup.code`、`VariantOptionValue.code` 删除后，相关唯一索引必须调整；这不影响当前关系字段本身。
5. `OrderItemOption.groupCodeSnapshot`、`valueCodeSnapshot` 未被业务决策直接删除，但因源 `code` 字段删除，必须作为技术问题单独确认。

## 5. 待确认技术规范

B 类不再按物理字段数量拆分，以下 11 项为真正待架构确认事项：

| 编号 | 待确认事项 | 状态 |
| --- | --- | --- |
| T1 | 主键和 API 标识：BigInt 自增、API 字符串输出 | 待确认 |
| T2 | 时间规范：DATETIME(3)、UTC、updatedAt 维护方式 | 待确认 |
| T3 | 字符串长度、可空性、枚举取值和默认值 | 待确认 |
| T4 | Material/DiningSession/Order 是否保留 `version`，或采用条件更新与行锁 | 待确认 |
| T5 | Category/Product/ProductVariant/Material/DiningTable 的软删除矩阵 | 待确认 |
| T6 | 删除 option code 后，Group/Value 的业务唯一性方案 | 待确认 |
| T7 | OrderItemOption 的 code 快照字段是否删除 | 待确认 |
| T8 | 全部外键目标、可空性、基数与 onDelete 策略 | 待确认 |
| T9 | 唯一约束、普通索引、生成列唯一索引和 CHECK 的完整清单 | 待确认 |
| T10 | 表名/列名映射规范 | 待确认 |
| T11 | 订单计算与快照字段：小计、状态时间、数量、行金额、选项快照、材料实际成本及来源 | 待确认 |

建议值、影响字段和理由见业务决策文档第 7 节。以上事项均未批准。

## 6. Prisma/ORM 关系处理

C 类包含 42 个此前被标为待确认的虚拟关系字段，以及 2 个继承关系字段。它们不生成物理列，不逐项要求业务负责人确认，但仍须满足：

- 每个虚拟关系必须映射到一个已确认的外键关系或明确的 Prisma 一对一关系。
- `onDelete`、可空性和关系基数必须与字段契约一致。
- 反向关系名称可以按 ORM 需要调整，但不得改变业务关系。
- 不得把没有物理依据的虚拟关系用于销售、库存或财务统计口径。

## 7. 下一步

1. 架构负责人确认 T1-T11。
2. 根据 A1-A9 和 T1-T11 形成机器可读字段契约。
3. 对契约做完整双向 Schema 校验和三端工程回归。
4. 另行授权后才修改 `schema.prisma` 并进入 P1-02-B。

本文件不授权任何代码、Schema 或数据库变更。
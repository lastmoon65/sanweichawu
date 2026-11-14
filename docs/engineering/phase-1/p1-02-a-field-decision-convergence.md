# P1-02-A 字段决策收敛状态

更新日期：2026-11-14（Asia/Shanghai）

基线提交：`c3c8422`

正式决策文件：[p1-02-a-business-decisions.md](./p1-02-a-business-decisions.md)

历史字段审计：[p1-02-a-field-audit.md](./p1-02-a-field-audit.md)

## 1. 当前状态

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| A1-A9 业务决策 | **已确认** | 业务字段保留、删除和历史快照原则已冻结。 |
| T1-T11 技术决策 | **已全部冻结** | 主键、时间、字段约束、乐观锁、外键、索引、命名和订单计算规则已确认。 |
| 字段决策冲突 | **已清除** | 当前以正式决策文件为唯一依据。 |
| 字段契约 | **未生成** | 下一步按已冻结决策编写完整字段契约。 |
| Schema 实现 | **未开始** | `schema.prisma` 尚未修改。 |
| Migration | **未开始** | 未生成、未执行，未连接真实数据库。 |
| P1-02-A 验收 | **未通过** | 字段契约和 Schema 一致性尚未独立审查。 |

`p1-02-a-field-audit.md` 是提交 `ff3a18d` 时的历史字段盘点，其中“188 个待确认字段”和 T5-T7 阶段状态仅用于追溯；它不是当前技术决策来源，也不代表仍有 188 个未决业务问题。

## 2. 已冻结技术决策汇总

| 编号 | 决策状态 | 一句话结论 |
| --- | --- | --- |
| T1 | **已冻结** | 数据库使用 BigInt 自增主键；API 标识使用十进制字符串；内部使用 BigInt。 |
| T2 | **已冻结** | MySQL 使用 DATETIME(3) 和 UTC；API 使用 ISO 8601 UTC；前端按 Store 时区展示。 |
| T3 | **已冻结** | 字符串、NULL、枚举和默认值按真实业务语义定义，不制造哨兵值或掩盖遗漏。 |
| T4 | **已冻结** | 只保留 Material、DiningSession、Order 的 version；校验原版本并拒绝覆盖。 |
| T5 | **已冻结** | 五类主数据删除 `deletedAt`；停用记录继续占用名称或桌号；被引用数据禁止物理删除。 |
| T6 | **已冻结** | 选项组按 `[variantId, name]` 唯一，选项值按 `[optionGroupId, name]` 唯一。 |
| T7 | **已冻结** | 删除两个选项 code 快照；保留名称和价格差快照；唯一约束改为 `[orderItemId, optionValueId]`。 |
| T8 | **已冻结** | 外键指向真实记录；只有真实可空关系才允许 NULL；删除策略统一 Restrict。 |
| T9 | **已冻结** | 保持已确认唯一约束；索引服务真实查询；CHECK 仅限制明显非法数值；不使用触发器。 |
| T10 | **已冻结** | Prisma 使用 PascalCase/camelCase；MySQL 表列使用 snake_case，并通过 `@@map`/`@map` 显式映射。 |
| T11 | **已冻结** | 订单金额、选项加价、快照、移动加权成本和经营统计按冻结公式及唯一成本来源执行。 |

完整规则和验收标准见正式决策文件第 2 节。

## 3. 已冻结字段变更

当前 Schema 有 224 个物理字段。确认删除 22 个，目标物理字段数为 **202**；21 个模型和 92 个 Prisma 关系字段不因本轮标量字段删除而改变数量。

已确认删除：

- `Store.deletedAt`
- `Store.pendingReminderMinutes`
- `Store.maxPendingOrdersPerCustomer`
- `Store.maxPendingOrdersPerSession`
- `User.nickname`
- `User.avatarUrl`
- `User.unionid`
- `Category.deletedAt`
- `Product.deletedAt`
- `ProductVariant.deletedAt`
- `VariantOptionGroup.code`
- `VariantOptionValue.code`
- `Material.warningThreshold`
- `Material.deletedAt`
- `StockMovement.movementNo`
- `LossRecord.lossNo`
- `DiningTable.capacity`
- `DiningTable.deletedAt`
- `DiningSession.discountFen`
- `Order.discountFen`
- `OrderItemOption.groupCodeSnapshot`
- `OrderItemOption.valueCodeSnapshot`

其余 202 个物理字段全部保留。具体字符串长度、默认值、索引和映射将在字段契约中按 T1-T11 落实到字段级。

## 4. 冻结的唯一约束

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

其他保留的唯一字段包括 `User.openid`、订单号和幂等键、收退款编号和幂等键、库存/损耗 dedupeKey，以及 `LossRecord.stockMovementId`。`movementNo` 和 `lossNo` 的唯一约束随字段删除。

## 5. 关系影响

- 本轮删除的都是标量字段，没有删除任何外键列。
- 现有 Prisma 虚拟关系不需要因删除字段直接移除。
- A6 保留的历史实时外键仍用于追溯，但展示、计价和成本以快照为准。
- A8 保留库存与损耗到订单、明细和操作人的追溯关系。
- PaymentRecord 的 `sessionId`、`orderId` 允许物理可空，但业务必须保证资金归属明确。
- Prisma 反向关系属于 ORM 实现，必须映射到已确认的物理外键，不作为独立业务字段审批。

## 6. 当前不再存在待确认事项

T1-T11 已全部关闭。以下内容不是待决策项，而是后续字段契约必须完成的机械落实：

1. 逐字段写出 MySQL 类型、可空性、默认值、长度和 `@map`。
2. 逐项列出唯一约束、普通索引、外键和 CHECK。
3. 按 T11 写出金额、数量、成本和快照公式的验收断言。
4. 核对 202 个目标字段与 Schema 的双向一致性。
5. 验证没有字段因实现方便而改变业务语义。

## 7. 下一步

1. 基于 A1-A9、T1-T11 生成完整字段契约。
2. 新增或改造契约检查脚本，对字段集合和属性做完整双向校验。
3. 独立审查字段契约。
4. 另行授权后，才修改 `schema.prisma` 和业务代码。
5. Schema 审查通过后，才考虑进入 P1-02-B 和 Migration。

本轮不修改 Schema、Migration、依赖、业务代码或检查脚本。P1-02-A 尚未验收，不进入 P1-02-B。
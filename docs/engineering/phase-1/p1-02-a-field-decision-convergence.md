# P1-02-A 字段待确认项收敛报告

审计日期：2026-11-14（Asia/Shanghai）  
基线提交：`2efeee7`  
上一轮审计：[p1-02-a-field-audit.md](./p1-02-a-field-audit.md)  
本轮性质：审计方法修正和决策收敛；未修改 Schema、Migration、依赖或业务代码。

## 1. 结论

上一轮的“188 个待确认字段”是字段库存，不是 188 个业务问题。重新分类后：

- **A 类：业务决策 9 项**，覆盖原 188 中的 31 个物理字段；另将 3 个已继承的 Store 策略字段合并进 A3。
- **B 类：统一技术规范 14 项**，覆盖原 188 中的 115 个物理字段。
- **C 类：Prisma/ORM 实现关系 1 类**，覆盖原 188 中的 42 个虚拟关系字段。
- 另有上一轮标为“继承”的 9 个 Prisma 字段：A 类 3 个、B 类 4 个、C 类 2 个；它们也已归位，但不需要展开成 9 个业务决策。

核对：31 + 115 + 42 = **188**。  
扩展核对：A 31+3、B 115+4、C 42+2，覆盖原 188 及 9 个继承项。

**P1-02-A 仍未验收。** 本轮不宣布任何 A 类建议已批准，也不生成字段白名单或 Migration。

## 2. 分类口径

| 类别 | 定义 | 谁决定 | 产出 |
| --- | --- | --- | --- |
| A 业务决策 | 涉及首版功能范围、是否保留业务历史、是否配置某项运营策略 | 业务负责人 | 保留/删除及业务语义 |
| B 技术规范 | 主键、时间、精度、外键、索引、状态值、软删除实现等横切规则 | 架构负责人 | 统一规范，不逐模型重复拍板 |
| C ORM 实现 | Prisma 反向关系、关系别名、虚拟字段 | 开发/架构 | 由物理 FK 和查询需求推导，不作为独立业务字段 |

C 类虚拟字段不产生 MySQL 列，但**不能不检查关系目标**。每个虚拟关系必须映射到已批准的物理外键或明确的一对一关系；反向关系命名可以按 Prisma 需要调整。

## 3. A 类：真正需要业务负责人确认的短清单

| 编号 | 决策主题 | 原 188 中字段数 | 继承字段数 | 涉及字段 | 初步建议（未批准） | 必须回答 |
| --- | --- | ---: | ---: | --- | --- | --- |
| A1 | 优惠字段与首版优惠范围 | 2 | 0 | `Order.discountFen`、`DiningSession.discountFen` | 建议删除两个字段；首版不做优惠。删除后同步移除零值写入和 CHECK 设计。 | 确认是否删除这两个字段，还是保留并强制为 0？ |
| A2 | Store 生命周期 | 2 | 0 | `Store.status`、`Store.deletedAt` | 建议保留 ACTIVE/SUSPENDED；Store 是单店根数据，暂不保留软删除。 | 确认 Store 是否需要停用状态；确认是否取消 Store 软删除。 |
| A3 | Store 订单策略字段 | 0 | 3 | `Store.pendingReminderMinutes`、`Store.maxPendingOrdersPerCustomer`、`Store.maxPendingOrdersPerSession` | 逐项确认是否真实使用。若没有明确运营场景，不保留死配置。 | 三项是否保留；若保留，确认默认值 10、5、30 是否合理。 |
| A4 | 顾客资料与账号状态 | 4 | 0 | `User.unionid`、`User.nickname`、`User.avatarUrl`、`User.status` | 建议保留可选资料字段和 ACTIVE/DISABLED 状态；openid 的技术属性归入 B 类。 | 是否存储微信昵称/头像及 unionid；是否允许顾客账号停用。 |
| A5 | 主数据可用状态语义 | 5 | 0 | `Category.status`、`ProductVariant.status`、`VariantOptionGroup.status`、`VariantOptionValue.status`、`Material.status` | 建议统一使用 ACTIVE/DISABLED，表达可选择/不可选择；归档删除由软删除单独表达。 | 五类主数据是否都需要独立启停状态，还是只依赖软删除？ |
| A6 | 历史订单实时外键 | 4 | 0 | `OrderItem.productId`、`OrderItem.variantId`、`OrderItemOption.optionValueId`、`OrderItemMaterial.materialId` | 建议保留外键用于追溯；历史展示和计价仍以快照字段为唯一依据。 | 确认是否保留四个实时外键，还是改为仅保存快照和源 ID。 |
| A7 | 主数据运营描述字段 | 7 | 0 | `Product.description`、`VariantOptionGroup.code`、`VariantOptionValue.code`、`Material.unit`、`Material.warningThreshold`、`DiningTable.name`、`DiningTable.capacity` | 建议保留；均为菜单、库存预警和桌台运营所需的显式业务字段。 | 确认这些字段是否有真实使用场景，尤其 Material.warningThreshold 和 DiningTable.capacity。 |
| A8 | 库存与损耗来源及操作人 | 5 | 0 | `StockMovement.orderId`、`StockMovement.orderItemId`、`StockMovement.operatorStaffId`、`StockMovement.reason`、`LossRecord.operatorStaffId` | 建议保留来源和操作人；损耗数量、成本和发生时间已由最终业务规则确定，归入 B 类技术实现。 | 确认库存流水和损耗记录是否需要追到订单、订单明细、操作人和原因。 |
| A9 | 人工可读流水编号 | 2 | 0 | `StockMovement.movementNo`、`LossRecord.lossNo` | 建议保留并与 PaymentRecord.paymentNo、RefundRecord.refundNo 保持同一规范；内部主键仍使用自增 BigInt。 | 确认库存与损耗是否需要人工客服可读编号。 |

### A 类建议的提交方式

业务负责人只需逐项回复“按建议”或明确替代方案。未回复项继续保持待确认，不进入字段白名单。

## 4. B 类：建议的统一技术规范

以下为架构规范建议，尚待确认，不代表已经修改 Schema。

| 编号 | 规范主题 | 覆盖字段数 | 建议规范 | 字段 |
| --- | --- | ---: | --- | --- |
| B1 | 主键 | 21 | 统一 BigInt 自增主键；API 序列化为字符串。 | `Store.id`、`User.id`、`Staff.id`、`Category.id`、`Product.id`、`ProductVariant.id`、`VariantOptionGroup.id`、`VariantOptionValue.id`、`VariantRecipe.id`、`RecipeModifier.id`、`Material.id`、`StockMovement.id`、`LossRecord.id`、`DiningTable.id`、`DiningSession.id`、`Order.id`、`OrderItem.id`、`OrderItemOption.id`、`OrderItemMaterial.id`、`PaymentRecord.id`、`RefundRecord.id` |
| B2 | 通用创建/更新时间 | 27 | 可变实体统一 DATETIME(3)；createdAt 默认当前时间，updatedAt 由 Prisma Client 维护。 | `Store.createdAt`、`Store.updatedAt`、`User.createdAt`、`User.updatedAt`、`Staff.createdAt`、`Staff.updatedAt`、`Category.createdAt`、`Category.updatedAt`、`Product.createdAt`、`Product.updatedAt`、`ProductVariant.createdAt`、`ProductVariant.updatedAt`、`Material.createdAt`、`Material.updatedAt`、`StockMovement.createdAt`、`LossRecord.createdAt`、`DiningTable.createdAt`、`DiningTable.updatedAt`、`DiningSession.createdAt`、`DiningSession.updatedAt`、`Order.createdAt`、`Order.updatedAt`、`OrderItem.createdAt`、`PaymentRecord.createdAt`、`PaymentRecord.updatedAt`、`RefundRecord.createdAt`、`RefundRecord.updatedAt` |
| B3 | 门店归属外键 | 10 | 统一 BigInt FK -> Store.id，onDelete Restrict；跨店一致性由服务事务校验。 | `Staff.storeId`、`Category.storeId`、`Product.storeId`、`Material.storeId`、`StockMovement.storeId`、`LossRecord.storeId`、`DiningTable.storeId`、`DiningSession.storeId`、`Order.storeId`、`PaymentRecord.storeId` |
| B4 | 已批准关系的物理外键列 | 9 | 统一 BigInt FK，onDelete Restrict；关系字段本身不生成列。 | `Product.categoryId`、`ProductVariant.productId`、`VariantOptionGroup.variantId`、`VariantOptionValue.optionGroupId`、`VariantRecipe.variantId`、`RecipeModifier.variantId`、`OrderItem.orderId`、`OrderItemOption.orderItemId`、`OrderItemMaterial.orderItemId` |
| B5 | 排序字段 | 4 | 统一 Int NOT NULL DEFAULT 0；相同排序值不承诺稳定业务顺序。 | `Product.sortOrder`、`ProductVariant.sortOrder`、`VariantOptionGroup.sortOrder`、`VariantOptionValue.sortOrder` |
| B6 | 库存余额与成本流水 | 4 | 数量 DECIMAL(18,3)，单位成本 DECIMAL(18,6)；余额与成本在事务内锁定写入。 | `StockMovement.reservedDelta`、`StockMovement.onHandAfter`、`StockMovement.reservedAfter`、`StockMovement.unitCostSnapshot` |
| B7 | 乐观锁版本 | 3 | 统一 Int NOT NULL DEFAULT 1；所有状态 CAS 都检查 version。 | `Material.version`、`DiningSession.version`、`Order.version` |
| B8 | 业务事件时间 | 3 | 统一 DATETIME(3)，填写真实业务发生时间；不能与 createdAt 混用。 | `DiningSession.openedAt`、`PaymentRecord.receivedAt`、`RefundRecord.refundedAt` |
| B9 | 主数据软删除字段 | 5 | 保留 deletedAt DateTime? 以配合 active_name/active_code 生成列唯一索引；Store 单独由 A2 决定。 | `Category.deletedAt`、`Product.deletedAt`、`ProductVariant.deletedAt`、`Material.deletedAt`、`DiningTable.deletedAt` |
| B10 | 订单金额、数量与快照字段 | 11 | 金额 BigInt，数量 Decimal(18,3)/Int，成本 Decimal(18,6)，状态时间 DATETIME(3)；快照值在下单/消耗时冻结。 | `Order.subtotalFen`、`Order.acceptedAt`、`Order.cancelledAt`、`Order.cancelReason`、`OrderItem.quantity`、`OrderItem.lineSubtotalFen`、`OrderItem.remark`、`OrderItemOption.groupCodeSnapshot`、`OrderItemOption.valueCodeSnapshot`、`OrderItemMaterial.actualUnitCostSnapshot`、`OrderItemMaterial.source` |
| B11 | 配方调整关系与目标角色 | 2 | optionValueId 为 BigInt FK -> VariantOptionValue.id；targetRole 使用明确枚举；两者均由最终配方关系直接推导。 | `RecipeModifier.optionValueId`、`RecipeModifier.targetRole` |
| B12 | 桌单关闭审计 | 2 | closedAt DATETIME(3) 可空，closedByStaffId BigInt FK 可空；CLOSED 时必须成组填写。 | `DiningSession.closedAt`、`DiningSession.closedByStaffId` |
| B13 | 损耗数量、成本与发生时间 | 4 | 数量 DECIMAL(18,3)，单位成本 DECIMAL(18,6)，原因 VARCHAR(500)，occurredAt DATETIME(3)；由最终损耗口径直接推导。 | `LossRecord.quantity`、`LossRecord.unitCostSnapshot`、`LossRecord.reason`、`LossRecord.occurredAt` |
| B14 | 资金审计与作废字段 | 10 | 操作人/作废人为可空 Staff 外键，时间和原因配套可空；ACTIVE 与 VOIDED 的字段完整性由 CHECK/事务校验。 | `PaymentRecord.operatorStaffId`、`PaymentRecord.remark`、`PaymentRecord.voidedAt`、`PaymentRecord.voidedByStaffId`、`PaymentRecord.voidReason`、`RefundRecord.reason`、`RefundRecord.operatorStaffId`、`RefundRecord.voidedAt`、`RefundRecord.voidedByStaffId`、`RefundRecord.voidReason` |

### B 类补充规范

1. **内部主键**：所有模型使用 `BIGINT` 自增；API 层统一输出字符串，不使用数据库 ID 作为业务编号。
2. **时间**：数据库统一存 UTC，使用 `DATETIME(3)`；`createdAt` 系统生成，`updatedAt` 由 Prisma Client 维护，业务事件时间独立表达。
3. **金额/数量/成本**：金额 `BIGINT` 分；材料数量 `DECIMAL(18,3)`；单位成本和总成本 `DECIMAL(18,6)`。
4. **字符串长度建议**：业务编码 40；业务流水编号 64；幂等键/dedupeKey 160；名称按当前 40/80/120；图片 URL 512；长文本说明使用 TEXT；原因/备注 500。
5. **枚举**：类型使用 PascalCase，值使用 UPPER_SNAKE_CASE；能用枚举表达的业务状态不再退化为自由字符串。
6. **外键**：数据库列使用 `BIGINT`，所有外键 `ON DELETE RESTRICT`；必选关系默认非空。
7. **索引**：唯一约束和查询索引必须由字段契约显式声明；不接受“实现时看到需要再加”的隐式状态。生成列唯一索引留给 Migration。
8. **软删除**：仅对需要保留历史且允许重建同名的业务主数据使用 `deletedAt`；与业务启停 `status` 分开表达，不把两者混为同一开关。
9. **乐观锁**：需要状态 CAS 的聚合使用 `version Int @default(1)`，更新时必须同时校验旧版本。
10. **关系虚拟字段**：不作为独立业务字段审批；但必须保证每个关系有明确目标和基数，外键列、唯一性和删除策略由契约验证。
11. **历史快照**：订单显示、计价、成本追溯以快照为准；活外键只作为追溯和关联查询，不得回填历史。
12. **数据库命名**：当前表名通过 `@@map` 使用 snake_case；列名暂保持 Prisma 字段名，除非单独批准全局列名映射，避免本轮扩大变更。

## 5. C 类：Prisma/ORM 实现字段

以下 42 个虚拟关系字段不需要业务负责人逐项批准，但必须由已批准关系或物理外键支撑：

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

补充的 2 个继承关系字段：

- `LossRecord.order`
- `LossRecord.orderItem`

C 类验收规则：

1. 关系目标、可空基数和 `onDelete` 必须与最终物理契约一致。
2. 反向关系可以改名，但不得改变业务基数。
3. 没有物理外键或明确一对一关系的虚拟字段不得作为“业务事实”写入统计口径。
4. A6 等业务外键一旦删改，C 类对应关系必须同步调整。

## 6. 上一轮 9 个“继承”字段的归位

| 字段 | 新类别 | 处理 |
| --- | --- | --- |
| `Store.pendingReminderMinutes` | A3 | 需确认是否真实使用及默认值 |
| `Store.maxPendingOrdersPerCustomer` | A3 | 需确认是否真实使用及默认值 |
| `Store.maxPendingOrdersPerSession` | A3 | 需确认是否真实使用及默认值 |
| `User.openid` | B | 作为顾客外部身份键，建议保留 `VARCHAR(128)` 可空唯一；仅真实微信用户登录后必填由服务层保证 |
| `LossRecord.orderId` | B | 作为可选追溯外键，关系正确性由服务和测试校验 |
| `LossRecord.orderItemId` | B | 作为可选追溯外键，关系正确性由服务和测试校验 |
| `LossRecord.stockMovementId` | B | 唯一可选外键，维持“最多一条损耗关联一条库存流水” |
| `LossRecord.order` | C | 虚拟关系，跟随 `orderId` |
| `LossRecord.orderItem` | C | 虚拟关系，跟随 `orderItemId` |

## 7. 需要人工回答的最小集合

建议只要求负责人回答以下 9 组 A 类问题：

1. A1：优惠字段删除还是保留零值？
2. A2：Store 是否保留 ACTIVE/SUSPENDED，是否取消 Store 软删除？
3. A3：三个订单策略字段是否真实使用，默认值是否接受？
4. A4：顾客昵称、头像、unionid、账号状态是否首版保留？
5. A5：五类主数据是否都需要 ACTIVE/DISABLED 启停？
6. A6：四个历史实时外键是否保留用于追溯？
7. A7：七个主数据运营描述字段是否都有真实使用场景？
8. A8：库存和损耗是否需要追溯到订单、明细及操作人？
9. A9：库存与损耗是否保留人工可读流水编号？

回答后可形成冻结字段契约；B 类技术规范由架构负责人一并确认。未确认前，不进入 P1-02-B。

## 8. 下一步（本轮不执行）

1. 业务负责人回答 A1-A9；架构负责人确认 B1-B14 及补充规范。
2. 把确认结果整理成机器可读字段契约。
3. 改造检查脚本为完整双向校验，并增加 Schema 变异测试。
4. 字段契约通过审查后，才生成首轮 Migration，并在真实 MySQL 8.4 验证。

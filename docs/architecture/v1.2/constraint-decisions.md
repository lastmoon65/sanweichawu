# 山隐茶事 V1.2 约束与类型设计说明

## 1. 金额、数量与标识精度

| 数据类别 | 类型 | 示例 | 说明 |
| --- | --- | --- | --- |
| 交易金额 | `Int`，单位分 | `priceFen`, `amountFen`, `discountFen` | 禁止浮点；所有应收、实收、退款、优惠使用整数分 |
| 成本与采购单价 | `Decimal(18,6)` 元 | `purchasePricePerUnit`, `unitCostSnapshot` | 保留到百万分之一元，适用于低价原料和分摊成本 |
| 原料数量 | `Decimal(18,3)` | 克、个、毫升 | 每个 Material 只使用一个规范单位，不隐式换算 |
| 商品数量 | `Int` | 份数 | 不支持半份商品；若业务出现 0.5 份，应新增规格而不是改商品数量语义 |
| 主键/外键 | `BigInt` | 各实体 ID | API DTO 必须转字符串，避免 JS number 精度丢失 |
| 业务编号 | `VarChar(40/64)` | `orderNo`, `paymentNo`, `dedupeKey` | 用户可读/追踪，不替代主键 |
| 时间 | `DateTime` | `createdAt`, `completedAt` | 统一 UTC 存储，按 Store.timezone 和 cutoff 展示营业日 |

## 2. 核心唯一约束

| 表 | 唯一约束 | 作用 |
| --- | --- | --- |
| users | `openid` | 微信用户唯一身份；null 只允许未绑定记录 |
| staff | `(storeId, userId)` | 一个员工在一个门店只有一条关系 |
| store_order_policies | `storeId` | 每个门店最多一套政策 |
| product_variants | `activeRecipeVersionId` | 每个 Variant 最多指向一个活动配方版本 |
| recipe_versions | `(variantId, versionNo)` | 配方版本号在 Variant 内唯一 |
| variant_recipes | `(recipeVersionId, materialId, role)` | 同一配方同一角色同一材料只出现一次 |
| variant_option_groups | `(variantId, code)` | 规格内选项组编码唯一 |
| variant_option_values | `(optionGroupId, code)` | 同一选项组内值编码唯一 |
| recipe_modifiers | `(recipeVersionId, optionValueId, materialId, targetRole)` | 同一调整项对同一材料只配置一次 |
| stock_movements | `dedupeKey` | 同一业务库存动作只能成功写一次 |
| loss_records | `dedupeKey` | 同一损耗归因只写一次 |
| loss_records | `(orderItemId, materialId)` | BASE/MODIFIER 等来源聚合后，同一明细同一材料只有一条损耗 |
| dining_tables | `(storeId, code)` | 桌码在门店内唯一 |
| dining_tables | `activeSessionId` | 一个桌位最多绑定一个活动桌单 |
| orders | `orderNo` | 订单业务编号全局唯一 |
| order_item_options | `(orderItemId, groupCodeSnapshot, valueCodeSnapshot)` | 同一订单明细同一选项值只快照一次 |
| order_item_materials | `(orderItemId, materialId, source)` | 同一明细的 BASE/EXTRA/MODIFIER 分账不重复 |
| payment_records | `paymentNo` | 收款流水编号唯一 |
| refund_records | `refundNo` | 退款流水编号唯一 |
| discount_allocations | `(sessionId, orderItemId)` | 每个桌单明细只有一条当前分摊记录 |
| idempotency_records | `(storeId, endpoint, idempotencyKey)` | 同一门店、同一接口、同一幂等键只能产生一个执行结果 |

补充 SQL 生成列唯一约束：

- `dining_sessions.open_table_guard`：保证每桌最多一个 `OPEN` session。
- `recipe_versions.active_variant_guard`：保证每个 variant 最多一个 `ACTIVE` recipe version。

## 3. 不设置唯一约束的字段及原因

### 商品名、分类名、原料名

未对 `(storeId, name)` 设置唯一约束：MySQL 唯一索引对 `NULL` 的行为不利于软删除后的同名字段。MVP 由服务层做同门店名称重复提示，不把名称当业务主键。

如果正式经营必须强唯一，建议新增非空的 `code`/SKU 字段，使用 `(storeId, code)` 唯一，而不是限制名称。

### Staff 软删除

Staff 使用 `status` 停用，不使用 `deletedAt`。`(storeId,userId)` 保持唯一，避免同一员工在同一店铺产生多条历史权限记录。

### Idempotency 作用域

幂等键按 Store + endpoint + key 限定。同一 UUID 被错误复用于不同接口时不会互相阻塞；同一接口同 Key 不同 requestHash 必须返回 409。

### PaymentRecord 金额

不设置金额唯一约束，因为同一桌单可能合法发生两笔金额相同的收款。重复提交依靠幂等键识别，而不是依靠金额比较。

### StockMovement 数量

不设置数量唯一约束；同一原料的合法入库、调整和消耗都可以重复发生。重复业务动作通过 `dedupeKey` 识别。

## 4. 软删除策略

| 实体 | 软删除 | 原因 |
| --- | --- | --- |
| Merchant / Store | `deletedAt` | 组织主体停用后保留历史 |
| Category / Product / ProductVariant / Material | `deletedAt` | 历史订单和报表仍引用 |
| DiningTable | `deletedAt` | 历史桌单需要保留原桌 |
| Staff | 仅 `status=DISABLED` | 保留同店唯一员工关系 |
| RecipeVersion | `ARCHIVED` | 配方以版本归档，不物理删除 |
| Order / OrderItem / StockMovement / LossRecord / PaymentRecord / RefundRecord / DiscountAllocation / AuditLog | 不删除 | 业务事实和账务事实必须可追溯 |

## 5. 历史快照字段

订单创建时固化：

- `OrderItem.productNameSnapshot`
- `OrderItem.variantNameSnapshot`
- `OrderItem.unitPriceFen`
- `OrderItem.quantity`
- `OrderItem.lineSubtotalFen`
- `OrderItem.strengthSnapshot`
- `OrderItem.brewingMethodSnapshot`
- `OrderItem.remark`
- `OrderItemOption.*Snapshot`
- `OrderItemMaterial.materialNameSnapshot`
- `OrderItemMaterial.unitSnapshot`
- `OrderItemMaterial.quantityPerItem`
- `OrderItemMaterial.totalQuantity`
- `OrderItemMaterial.unitCostSnapshot`
- `OrderItemMaterial.totalCostSnapshot`

业务展示历史订单时只能读取快照，不能回查当前商品价或配方重算历史成本。

## 6. 订单金额字段的语义

`Order.subtotalFen`：订单创建时商品明细金额快照。

`Order.discountFen`：当前分摊到该订单的优惠总额，默认 0，只能由 DiscountAllocation 汇总事务更新。

`Order.totalAmountFen`：`subtotalFen - discountFen`，由同一事务维护，数据库 CHECK 强制等式。

`Order.subtotalFen` 和明细 `lineSubtotalFen` 的关系也必须被对账：

```sql
SELECT o.id, o.subtotalFen, SUM(oi.lineSubtotalFen) AS item_total
FROM orders o
JOIN order_items oi ON oi.orderId = o.id
GROUP BY o.id, o.subtotalFen
HAVING o.subtotalFen <> SUM(oi.lineSubtotalFen);
```

## 7. 状态枚举

- MerchantStatus：ACTIVE / SUSPENDED
- StoreStatus：ACTIVE / SUSPENDED
- UserStatus：ACTIVE / DISABLED
- StaffRole：OWNER / MANAGER / STAFF
- StaffStatus：ACTIVE / DISABLED
- InventoryMode：MANAGED / UNMANAGED
- RecipeStatus：DRAFT / ACTIVE / ARCHIVED
- OrderStatus：PENDING_ACCEPTANCE / ACCEPTED / PREPARING / COMPLETED / CANCELLED
- DiningSessionStatus：OPEN / CLOSED
- PaymentStatus：ACTIVE / VOIDED
- RefundStatus：ACTIVE / VOIDED
- IdempotencyStatus：PROCESSING / SUCCEEDED / FAILED

## 8. Prisma 无法直接表达的约束

以下内容必须由 `constraints.sql`、事务或对账任务补足：

1. 每桌只有一个 OPEN session。
2. 每 variant 只有一个 ACTIVE recipe。
3. activeSessionId 与 OPEN session 的表内一致性。
4. activeRecipeVersionId 与同 variant ACTIVE recipe 的一致性。
5. 收款目标 `sessionId` / `orderId` XOR。
6. 有效退款总额不超过原收款。
7. 优惠后的净实收不超过应收。
8. 优惠分摊总和严格等于桌单优惠。
9. 关闭桌单时所有订单终态且未结为 0。
10. 顾客订单查询归属。
11. ACTIVE/ARCHIVED 配方明细禁止 INSERT/UPDATE/DELETE。
12. RecipeVersion 只能 DRAFT → ACTIVE → ARCHIVED 单向流转。
13. OrderItem.recipeVersionId 必须属于 OrderItem.variantId。
14. Product.categoryId 必须属于 Product.storeId，且归属根字段不可迁移。

不能把 `constraints.sql` 中的触发器当装饰：CI 必须在真实 MySQL 8 上执行迁移、触发器和并发用例。

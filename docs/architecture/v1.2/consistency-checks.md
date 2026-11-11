# 山隐茶事 V1.2 数据一致性检查

## 1. 一致性防线分层

| 层级 | 责任 | 示例 |
| --- | --- | --- |
| 数据库约束 | 拒绝确定性非法值 | 负库存、金额非法、收款两种归属同时为空或同时存在 |
| 唯一索引 | 防止重复事实 | 活动桌单、活动配方、库存流水 dedupeKey、退款/收款编号 |
| 事务与行锁 | 保护跨行和聚合不变量 | 同桌首单、预占、收款、优惠、退款、关闭桌单 |
| 幂等记录 | 防止同一请求重复执行 | 创建订单、状态流转、收款、退款、盘点 |
| 对账任务 | 发现无法静态约束的漂移 | onHand/reserved 与流水、优惠分摊合计、净实收与应收 |
| 接入层鉴权 | 防止越权读取 | 顾客订单只能按 customerUserId 查询 |

数据库约束不能代替事务锁；事务锁也不能代替唯一索引和幂等记录。

## 2. 核心不变量与落点

| 编号 | 不变量 | 落点 |
| --- | --- | --- |
| I01 | 同一桌最多一张 OPEN DiningSession | `DiningTable.activeSessionId` 唯一 + `dining_sessions.open_table_guard` 生成列唯一 + `DiningTable` 行锁 |
| I02 | `available = onHand - reserved >= 0` | Material CHECK + 条件 UPDATE + 行锁 |
| I03 | 同一订单/材料/动作最多成功消费一次 | OrderStateMachine version + `StockMovement.dedupeKey` 唯一 + IdempotencyRecord |
| I04 | 同一请求最多登记一次收款 | `IdempotencyRecord (storeId,idempotencyKey)` 唯一 + 同事务响应固化 |
| I05 | 有效退款合计不超过原收款 | PaymentRecord 行锁 + RefundRecord 服务校验 + `trg_refund_record_limit_bi` |
| I06 | 优惠后净实收不超过优惠后应收 | DiningSession 行锁 + 修改优惠/收款事务内重新计算 + 对账 SQL |
| I07 | 未完成订单不能关闭桌单 | 关闭事务锁 DiningTable + DiningSession + Order 并对订单状态复核 |
| I08 | 顾客不能查询别人的订单 | API 必须固定 `where customerUserId = auth.user.id` |
| I09 | 商品/配方/成本修改不能污染历史 | OrderItem/OrderItemOption/OrderItemMaterial 快照 + append-only 触发器 + RecipeVersion 版本化 |
| I10 | 每个 Variant 最多一个 ACTIVE RecipeVersion | `recipe_versions.active_variant_guard` 生成列唯一 + DRAFT→ACTIVE 事务 |
| I11 | 关闭桌单时优惠分摊合计严格等于桌单优惠 | 最大余数法 + 关闭前合计校验 + `DiscountAllocation.isFinal` |
| I12 | 制作后取消不重复扣库存 | Cancel 只新增 LossRecord，不新增 StockMovement |

## 3. 顾客订单越权检查

MySQL 本身没有通用的行级安全策略。因此以下规则必须在 NestJS 数据访问层统一实现：

```text
customer order list/detail:
  WHERE order.id = :id
    AND order.customerUserId = auth.user.id
    AND order.storeId = auth.storeId

merchant order:
  require active Staff(storeId, role IN OWNER/MANAGER/STAFF)
  WHERE order.storeId = staff.storeId
```

禁止先按 `order.id` 查询，再在应用层做“如果不相等就返回”的二次判断。权限条件必须进入查询条件。

## 4. 发布前对账 SQL

以下查询正常结果必须为空。建议作为定时任务和每日关店检查执行。

### 4.1 同一桌多个活动桌单

```sql
SELECT tableId, COUNT(*) AS open_count
FROM dining_sessions
WHERE status = 'OPEN'
GROUP BY tableId
HAVING COUNT(*) > 1;
```

### 4.2 DiningTable 指针与活动桌单不一致

```sql
SELECT t.id, t.name, t.activeSessionId, s.id AS sessionId, s.status
FROM dining_tables t
LEFT JOIN dining_sessions s ON s.id = t.activeSessionId
WHERE t.deletedAt IS NULL
  AND (
    (t.activeSessionId IS NULL AND EXISTS (
      SELECT 1 FROM dining_sessions x WHERE x.tableId = t.id AND x.status = 'OPEN'
    ))
    OR
    (t.activeSessionId IS NOT NULL AND (s.id IS NULL OR s.status <> 'OPEN' OR s.tableId <> t.id))
  );
```

### 4.3 reserved 与库存流水不一致

```sql
SELECT m.id, m.name, m.reserved,
       COALESCE(SUM(sm.reservedDelta), 0) AS ledgerReserved
FROM materials m
LEFT JOIN stock_movements sm ON sm.materialId = m.id
GROUP BY m.id, m.name, m.reserved
HAVING m.reserved <> COALESCE(SUM(sm.reservedDelta), 0);
```

要求 Material 创建时的初始库存也写一条 `STOCK_IN` 流水，否则 onHand 无法从流水完整重放。

### 4.4 onHand 与流水不一致

```sql
SELECT m.id, m.name, m.onHand,
       COALESCE(SUM(sm.quantityDelta), 0) AS ledgerOnHand
FROM materials m
LEFT JOIN stock_movements sm ON sm.materialId = m.id
GROUP BY m.id, m.name, m.onHand
HAVING m.onHand <> COALESCE(SUM(sm.quantityDelta), 0);
```

该查询要求库存启用前通过 `STOCK_IN` 记录期初库存，不允许直接写入一个无来源的 onHand。

### 4.5 同一订单同一材料重复消费

```sql
SELECT orderId, materialId, COUNT(*) AS consume_count
FROM stock_movements
WHERE movementType = 'CONSUME'
GROUP BY orderId, materialId
HAVING COUNT(*) > 1;
```

唯一 `dedupeKey` 是硬约束；该查询作为防御性审计。

### 4.6 同一订单同一材料重复记损耗

```sql
SELECT orderId, orderItemId, materialId, COUNT(*) AS loss_count
FROM loss_records
GROUP BY orderId, orderItemId, materialId
HAVING COUNT(*) > 1;
```

### 4.7 有效退款超过原收款

```sql
SELECT p.id, p.amountFen, COALESCE(SUM(r.amountFen), 0) AS refunded
FROM payment_records p
LEFT JOIN refund_records r
  ON r.paymentRecordId = p.id AND r.status = 'ACTIVE'
WHERE p.status = 'ACTIVE'
GROUP BY p.id, p.amountFen
HAVING refunded > p.amountFen;
```

### 4.8 桌单净实收超过优惠后应收

```sql
WITH order_sum AS (
  SELECT sessionId, SUM(subtotalFen) AS subtotal
  FROM orders
  WHERE sessionId IS NOT NULL AND status <> 'CANCELLED'
  GROUP BY sessionId
),
payment_sum AS (
  SELECT s.id AS sessionId,
         COALESCE(SUM(p.bucket), 0) AS paid,
         COALESCE(SUM(p.refunded), 0) AS refunded
  FROM dining_sessions s
  LEFT JOIN (
    SELECT p2.id, p2.sessionId, p2.amountFen AS bucket,
           COALESCE(SUM(CASE WHEN r.status = 'ACTIVE' THEN r.amountFen ELSE 0 END), 0) AS refunded
    FROM payment_records p2
    LEFT JOIN refund_records r ON r.paymentRecordId = p2.id
    WHERE p2.status = 'ACTIVE'
    GROUP BY p2.id, p2.sessionId, p2.amountFen
  ) p ON p.sessionId = s.id
  GROUP BY s.id
)
SELECT s.id, o.subtotal, s.discountFen, ps.paid, ps.refunded,
       (ps.paid - ps.refunded) AS netPaid,
       (o.subtotal - s.discountFen) AS due
FROM dining_sessions s
JOIN order_sum o ON o.sessionId = s.id
JOIN payment_sum ps ON ps.sessionId = s.id
WHERE ps.paid - ps.refunded > o.subtotal - s.discountFen;
```

### 4.9 关闭桌单存在未完成订单

```sql
SELECT s.id, s.tableId, o.id AS orderId, o.status
FROM dining_sessions s
JOIN orders o ON o.sessionId = s.id
WHERE s.status = 'CLOSED'
  AND o.status IN ('PENDING_ACCEPTANCE', 'ACCEPTED', 'PREPARING');
```

### 4.10 关闭桌单未结金额不为 0

使用 4.8 的 CTE，把最终条件改为：

```sql
WHERE s.status = 'CLOSED'
  AND (o.subtotal - s.discountFen) <> (ps.paid - ps.refunded);
```

### 4.11 优惠分摊合计不匹配

```sql
SELECT s.id, s.discountFen, COALESCE(SUM(da.discountFen), 0) AS allocated
FROM dining_sessions s
LEFT JOIN discount_allocations da ON da.sessionId = s.id
GROUP BY s.id, s.discountFen
HAVING s.discountFen <> COALESCE(SUM(da.discountFen), 0);
```

### 4.12 已关闭桌单分摊未全部冻结

```sql
SELECT s.id, COUNT(*) AS unfinalized_count
FROM dining_sessions s
JOIN discount_allocations da ON da.sessionId = s.id
WHERE s.status = 'CLOSED' AND da.isFinal = 0
GROUP BY s.id;
```

### 4.13 同一 Variant 多个 ACTIVE 配方

数据库生成列唯一索引已经阻断；审计查询：

```sql
SELECT variantId, COUNT(*) AS active_count
FROM recipe_versions
WHERE status = 'ACTIVE'
GROUP BY variantId
HAVING COUNT(*) > 1;
```

### 4.14 Variant 的活动配方指针错误

```sql
SELECT v.id, v.activeRecipeVersionId
FROM product_variants v
LEFT JOIN recipe_versions r ON r.id = v.activeRecipeVersionId
WHERE v.activeRecipeVersionId IS NOT NULL
  AND (r.id IS NULL OR r.variantId <> v.id OR r.status <> 'ACTIVE');
```

## 5. 历史快照持久性检查

以下列必须由数据库触发器禁止 UPDATE/DELETE：

- `order_items`：商品名、规格名、售价、数量、冲泡方式、备注。
- `order_item_options`：选项名称、价格差。
- `order_item_materials`：材料名、单位、用量、单价、成本。
- `stock_movements`：所有库存事实。
- `loss_records`：所有损耗事实。
- `audit_logs`：所有审计事实。

订单金额显示的规则：

```text
商品明细历史金额 = OrderItem.lineSubtotalFen
历史材料成本 = OrderItemMaterial.totalCostSnapshot
历史优惠 = DiscountAllocation.discountFen
当前商品名称/售价/配方只用于新建订单，禁止回填历史订单展示
```

## 6. 并发测试要求

必须使用至少 20 个独立数据库连接并发执行，不能只在一个 Node.js 进程内串行调用：

- 两顾客同时创建 T01 首单。
- 两人同时抢库存最后一份材料。
- 同时点击两次“开始制作”。
- 两店员同时给同一桌登记收款。
- 退款与作废收款并发。
- 修改优惠与登记收款并发。
- 关闭桌单与新订单同时发起。
- 同一幂等 Key 并发创建订单和收款。

每个场景必须断言：

- 只有一条业务事实成功。
- 库存流水和库存值一致。
- 金额流水合计与报表一致。
- 失败请求返回 409/422，而不是静默成功。

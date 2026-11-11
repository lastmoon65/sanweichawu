# 山隐茶事 V1.2 关键事务伪代码

## 0. 全局约定

- 数据库：MySQL 8 / InnoDB，默认 `SERIALIZABLE` 不使用；写事务使用 `READ COMMITTED` 或 MySQL 默认 `REPEATABLE READ`，关键行显式 `SELECT ... FOR UPDATE`。
- 金额：交易金额统一为整数“分”。采购单价、成本快照为 `DECIMAL(18,6)` 元。写库前使用十进制定点运算。
- 数量：原料用量为 `DECIMAL(18,3)`，单位由 `Material.unit` 固定；禁止克和千克隐式混用。
- 锁顺序固定：`DiningTable → DiningSession → Order → Material（materialId 升序）→ PaymentRecord → RefundRecord`。
- 所有写请求先检查或创建幂等记录；业务记录和幂等结果必须在同一个数据库事务内提交。
- `IdempotencyRecord` 唯一键为 `(storeId, endpoint, idempotencyKey)`：
  - 同 Key、同 `requestHash`、状态 SUCCEEDED：返回已保存响应。
  - 同 Key、不同 `requestHash`：返回 409。
  - 同 Key、PROCESSING：等待短时间后重新读取；不执行第二份业务写入。若原请求已回滚，允许按原 Key 重新领取。
  - 业务事务回滚时，PROCESSING 记录一并回滚，允许用户用同 Key 重试。
  - 业务记录与 SUCCEEDED 响应必须在同一事务提交，禁止先提交业务再异步保存幂等结果。
- 所有聚合金额均在事务内按事实表重新计算，不采用前端传来的余额。
- 跨门店边界统一在事务内调用 `assertStoreOwnership(tx, storeId, refs)`；SQL 触发器再做数据库兜底。
- `refs` 至少覆盖：`tableId`、`sessionId`、`orderId`、`orderItemId`、`categoryId`、`productId`、`variantId`、`recipeVersionId`、`materialId`、`paymentId`、`staffId`。
- 下单校验配方时传 `requireActiveRecipe: true`；历史订单读取不要求 ACTIVE，因为归档配方仍是历史事实。`staffId` 必须来自认证上下文，不能信任请求体。`- 关键组合规则：
  - Product.categoryId → Category.storeId。
  - OrderItem.variantId → ProductVariant.productId → Product.storeId。
  - OrderItem.recipeVersionId → RecipeVersion.variantId，且必须等于 OrderItem.variantId。
  - VariantRecipe.recipeVersionId + materialId 必须同门店。
  - PaymentRecord 的 session/order 必须同店。
  - DiscountAllocation.orderItemId 必须属于 session 对应订单。

## 1. 创建堂饮订单

```text
createDineOrder(request):
  BEGIN

  idem = claimIdempotency(request.key, request.hash)
  if idem.exists:
      return idem.response or ConflictIfDifferentHash

  customer = lockAndValidateUser(request.customerUserId, ACTIVE)
  store = readStoreForUpdate(request.storeId)
  assert store.status == ACTIVE

  table = SELECT * FROM dining_tables
          WHERE id = request.tableId AND storeId = request.storeId AND deletedAt IS NULL
          FOR UPDATE
  assert table exists

  if table.activeSessionId is null:
      session = INSERT dining_sessions(
          storeId, tableId, status=OPEN, discountFen=0, discountVersion=0, version=1
      )
      UPDATE dining_tables SET activeSessionId = session.id WHERE id = table.id
  else:
      session = SELECT * FROM dining_sessions
                WHERE id = table.activeSessionId AND status = OPEN
                FOR UPDATE
      assert session exists and session.tableId = table.id

  assert countPendingOrders(customer) < policy.maxPendingOrdersPerCustomer
  assert countPendingOrders(session) < policy.maxPendingOrdersPerSession

  for each requested item: assertStoreOwnership(tx, storeId, { categoryId, productId, variantId, recipeVersionId, requireActiveRecipe: true })
  serverCart = validateProductsAndRecomputePrice(request.items)
  variants = SELECT active recipes / variants FOR SHARE
  snapshots = buildOrderItemSnapshots(serverCart, variants)
  requirements = aggregateMaterials(snapshots, channel=DINE, selectedOptions)
  assert all requirements.quantity > 0

  order = INSERT orders(
      storeId, customerUserId, channel=DINE, tableId, sessionId,
      status=PENDING_ACCEPTANCE,
      subtotalFen = sum(snapshots.lineSubtotalFen),
      discountFen = 0,
      totalAmountFen = subtotalFen,
      version = 1
  )
  INSERT order_items, order_item_options, order_item_materials

  reserveStock(order.id, requirements, dedupePrefix=order.id)

  updateIdempotencyResult(request.key, SUCCEEDED, order)
  INSERT audit_log(action='ORDER_CREATE_DINE', target=order.id, after=order)
  COMMIT
  return order
```

禁止把“先查询桌单，再创建”拆成两个事务；桌位行锁和 `active_session_id` 必须与创建桌单、创建订单、预占库存处于同一事务。

## 2. 创建打包订单

```text
createTakeawayOrder(request):
  BEGIN
  claimIdempotency(...)

  customer = lockAndValidateUser(...)
  store = readStoreForUpdate(...)
  assert store.status == ACTIVE
  assert request.tableId == null and request.sessionId == null

  policy = read StoreOrderPolicy
  assert countPendingTakeawayOrders(customer) < policy.maxPendingOrdersPerCustomer

  for each requested item: assertStoreOwnership(tx, storeId, { categoryId, productId, variantId, recipeVersionId, requireActiveRecipe: true })
  serverCart = validateProductsAndRecomputePrice(...)
  snapshots = buildOrderItemSnapshots(channel=TAKEAWAY)
  requirements = aggregateMaterials(BASE + TAKEAWAY_EXTRA + MODIFIER)
  order = INSERT orders(channel=TAKEAWAY, tableId=null, sessionId=null, status=PENDING_ACCEPTANCE)
  INSERT snapshots
  reserveStock(order.id, requirements, dedupePrefix=order.id)

  saveIdempotencyResult(order)
  audit(...)
  COMMIT
```

打包订单完成时不创建 PaymentRecord；只有店员确认实际收到钱后才登记收款。

## 3. 同桌并发首单

### 3.1 第一个请求

```text
BEGIN
SELECT dining_table WHERE id=T01 FOR UPDATE
active_session_id IS NULL
INSERT dining_session(table=T01,status=OPEN)
UPDATE dining_table SET active_session_id = newSessionId
INSERT order(sessionId=newSessionId)
reserveStock(...)
COMMIT
```

### 3.2 第二个并发请求

```text
BEGIN
SELECT dining_table WHERE id=T01 FOR UPDATE  -- 等待第一个事务提交
active_session_id = firstSessionId
SELECT dining_session WHERE id=firstSessionId FOR UPDATE
INSERT order(sessionId=firstSessionId)
reserveStock(...)
COMMIT
```

数据库保护：

- `DiningTable.activeSessionId` 唯一。
- 补充触发器和唯一生成列/事务锁共同保证同一 `tableId` 只能存在一个 `OPEN` DiningSession。
- 关闭桌单与新桌单创建必须锁定同一 DiningTable 行。

## 4. 库存预占

```text
reserveStock(orderId, aggregatedRequirements, dedupePrefix):
  sorted = requirements ORDER BY materialId ASC

  for item in sorted:
      affected = UPDATE materials
                 SET reserved = reserved + item.qty,
                     version = version + 1
                 WHERE id = item.materialId
                   AND status = ACTIVE
                   AND on_hand - reserved >= item.qty

      if affected != 1:
          throw STOCK_INSUFFICIENT(materialId, required, available)
          // 整个事务 ROLLBACK；不能部分预占

      dedupeKey = dedupePrefix + ':RESERVE:' + item.materialId
      INSERT stock_movements(movementType=RESERVE,
          quantityDelta=0, reservedDelta=item.qty,
          onHandAfter, reservedAfter, dedupeKey)

  return
```

库存需求先按 `materialId` 聚合，再预占。不能按订单明细逐条预占，否则同一原料会被重复校验和重复扣减。

## 5. 开始制作

```text
startPreparation(storeId, orderId, request):
  BEGIN
  claimIdempotency(...)

  order = SELECT * FROM orders WHERE id=orderId FOR UPDATE
  assertStoreOwnership(tx, storeId, { orderId, staffId: actor.staffId })
  assert order.status == ACCEPTED
  assert order.version == request.expectedVersion

  materialsNeed = aggregate OrderItemMaterial by materialId for this order
  for each material in materialId ASC:
      assertStoreOwnership(tx, storeId, { orderId, materialId: material.materialId, staffId: actor.staffId })
      affected = UPDATE materials
                 SET onHand = onHand - qty,
                     reserved = reserved - qty,
                     version = version + 1
                 WHERE id=materialId
                   AND onHand >= qty
                   AND reserved >= qty

      if affected != 1: throw INVARIANT_VIOLATION
      INSERT stock_movements(CONSUME,
          quantityDelta=-qty,
          reservedDelta=-qty,
          dedupeKey=orderId+':CONSUME:'+materialId)

  UPDATE orders
  SET status=PREPARING, preparingAt=now(), version=version+1
  WHERE id=orderId AND status=ACCEPTED AND version=request.expectedVersion

  if affected != 1: throw CONFLICT
  saveIdempotencyResult()
  audit(...)
  COMMIT
```

同一订单重复“开始制作”会先被幂等记录拦截；不同幂等 Key 的重复状态请求会被状态机和 version CAS 拒绝。

## 5.1 配方版本 DRAFT → ACTIVE → ARCHIVED

```text
publishRecipeVersion(storeId, variantId, draftVersionId, request):
  BEGIN
  claimIdempotency(...)

  variant = SELECT * FROM product_variants WHERE id=variantId FOR UPDATE
  assertStoreOwnership(tx, storeId, { variantId, recipeVersionId: draftVersionId, staffId: actor.staffId })

  versions = SELECT * FROM recipe_versions
             WHERE variantId=variantId
             ORDER BY id
             FOR UPDATE

  draft = versions.find(id=draftVersionId)
  assert draft exists and draft.status == DRAFT

  validate draft.materials and draft.modifiers:
      every final quantity > 0
      material store == variant product store
      option value belongs to this variant
      inventoryMode == MANAGED

  current = versions.find(id=variant.activeRecipeVersionId)
  if current exists:
      UPDATE recipe_versions SET status='ARCHIVED', archivedAt=now()
      WHERE id=current.id AND status='ACTIVE'

  UPDATE recipe_versions SET status='ACTIVE', effectiveAt=now()
  WHERE id=draft.id AND status='DRAFT'

  UPDATE product_variants
  SET activeRecipeVersionId=draft.id
  WHERE id=variantId

  audit(...)
  saveIdempotencyResult()
  COMMIT
```

修改已发布配方时，应复制 ACTIVE 版本为新的 DRAFT，再修改 DRAFT。ACTIVE/ARCHIVED 配方的子表由触发器禁止更新或删除。
## 5.2 盘点调整

```text
adjustStock(storeId, materialId, physicalCount, reason, request):
  BEGIN
  claimIdempotency(...)
  assertStoreOwnership(tx, storeId, { materialId, staffId: actor.staffId })
  material = SELECT * FROM materials WHERE id=materialId FOR UPDATE

  assert physicalCount >= 0
  assert physicalCount >= material.reserved
  // 实盘低于 reserved 时拒绝普通盘点，进入异常处理，不允许产生负可用量

  delta = physicalCount - material.onHand
  if delta == 0:
      return no-op

  UPDATE materials SET onHand=physicalCount, version=version+1
  WHERE id=materialId

  INSERT stock_movements(
      movementType='ADJUST',
      quantityDelta=delta,
      reservedDelta=0,
      onHandAfter=physicalCount,
      reservedAfter=material.reserved,
      reason=reason,
      dedupeKey=request.idempotencyKey
  )
  audit(...)
  saveIdempotencyResult()
  COMMIT
```

库存入库同样必须锁定 Material 并写 STOCK_IN 流水。多材料预占按 materialId 升序处理，任一条件更新失败则整个事务回滚。
## 6. 制作后取消

```text
cancelAfterPreparation(storeId, orderId, request):
  BEGIN
  claimIdempotency(...)
  order = SELECT * FROM orders WHERE id=orderId FOR UPDATE
  assertStoreOwnership(tx, storeId, { orderId, staffId: actor.staffId })
  assert order.status == PREPARING

  // 库存已经在 CONSUME 时扣过，本次绝不修改 onHand/reserved。
  // BASE/MODIFIER/TAKEAWAY_EXTRA 等来源必须先按 orderItemId + materialId 聚合，
  // 同一明细同一材料只生成一条 LossRecord。
  aggregated_loss = GROUP BY orderItemId, materialId:
      SUM(totalQuantity), weighted unit cost snapshot, SUM(totalCostSnapshot)

  for each loss in aggregated_loss:
      assertStoreOwnership(tx, storeId, { orderId, orderItemId: loss.orderItemId, materialId: loss.materialId, staffId: actor.staffId })
      INSERT loss_records(
          materialId, orderId, orderItemId,
          quantity=loss.totalQuantity,
          unitCostSnapshot=loss.averageUnitCost,
          lossCostSnapshot=loss.totalCost,
          reason='PREPARING_CANCEL',
          dedupeKey=orderId+':LOSS:'+orderItemId+':'+materialId
      )

  // 已收款场景必须先退款再取消；取消后禁止出现超收。
  if order.channel == TAKEAWAY:
      netPaid = sum(active payments for order) - sum(active refunds)
      assert netPaid == 0
  else if order.sessionId:
      newDue = recalcSessionDueExcluding(order.sessionId, order.id)
      netPaid = recalcNetPaid(order.sessionId)
      assert netPaid <= newDue

  UPDATE orders
  SET status=CANCELLED, cancelledAt=now(), cancelReason=request.reason, version=version+1
  WHERE id=orderId AND status=PREPARING

  // 如果该桌存在收款，重算取消后的桌单应收；
  // 若净实收 > 应收，则拒绝取消，要求先完成退款或账务调整。
  if order.sessionId:
      assert recalcSessionDue(order.sessionId) >= recalcNetPaid(order.sessionId)

  audit(...)
  COMMIT
```

`LossRecord` 是损耗归因和成本事实；`StockMovement` 只记录库存数量变化。`LOSS` 不是库存变更类型。

## 7. 分次收款

```text
recordPayment(storeId, targetType, targetId, amountFen, request):
  BEGIN
  claimIdempotency(...)
  assert amountFen > 0
  paymentRefs = targetType == SESSION ? { sessionId: targetId } : { orderId: targetId }
  assertStoreOwnership(tx, storeId, { ...paymentRefs, staffId: actor.staffId })

  if targetType == SESSION:
      session = SELECT * FROM dining_sessions WHERE id=targetId FOR UPDATE
      assert session.status == OPEN
      due = sum(nonCancelledOrders.subtotalFen) - session.discountFen
      paid = sum(active PaymentRecord.amountFen WHERE sessionId=session.id)
      refunded = sum(active RefundRecord through those payments)
      netPaid = paid - refunded
      assert netPaid + amountFen <= due
      target = {sessionId: session.id, orderId: null}

  if targetType == ORDER:
      order = SELECT * FROM orders WHERE id=targetId FOR UPDATE
      assert order.channel == TAKEAWAY
      assert order.status != CANCELLED
      // 允许待接单、待制作、制作中、已完成阶段登记实际收款
      due = order.totalAmountFen
      paid = sum(active payments WHERE orderId=order.id)
      refunded = sum(active refunds through payments)
      netPaid = paid - refunded
      assert netPaid + amountFen <= due
      target = {sessionId: null, orderId: order.id}

  INSERT payment_records(target, amountFen, ACTIVE,
      receivedAt=now(), operatorStaffId, paymentNo)
  saveIdempotencyResult()
  audit(...)
  COMMIT
```

登记一笔收款不等于关闭桌单；即使未结金额变成 0，也必须单独调用关闭桌单事务。

## 8. 收款作废

```text
voidPayment(storeId, paymentId, reason, request):
  BEGIN
  claimIdempotency(...)
  payment = SELECT * FROM payment_records WHERE id=paymentId FOR UPDATE
  assertStoreOwnership(tx, storeId, { paymentId, staffId: actor.staffId })
  assert payment.status == ACTIVE
  activeRefundSum = sum RefundRecord WHERE paymentId=payment.id AND status=ACTIVE
  assert activeRefundSum == 0

  UPDATE payment_records
  SET status=VOIDED, voidedAt=now(), voidedByStaffId, voidReason=reason
  WHERE id=payment.id AND status=ACTIVE

  audit(...)
  saveIdempotencyResult()
  COMMIT
```

若该收款已有有效退款，先处理退款作废，不能直接作废原收款。

## 9. 实际退款登记

```text
registerRefund(storeId, paymentId, amountFen, reason, request):
  BEGIN
  claimIdempotency(...)
  assert amountFen > 0

  payment = SELECT * FROM payment_records WHERE id=paymentId FOR UPDATE
  assertStoreOwnership(tx, storeId, { paymentId, staffId: actor.staffId })
  assert payment.status == ACTIVE

  refunded = SELECT COALESCE(SUM(amountFen),0)
             FROM refund_records
             WHERE paymentRecordId=payment.id AND status=ACTIVE
  assert refunded + amountFen <= payment.amountFen

  INSERT refund_records(
      paymentRecordId, amountFen, status=ACTIVE,
      refundedAt=now(), operatorStaffId, reason, refundNo)
  audit(...)
  saveIdempotencyResult()
  COMMIT
```

退款记录绑定原收款，不直接修改原收款金额。已关闭桌单退款作为独立财务事实记录：不修改桌单 CLOSED 状态、不重新占用桌位、不生成订单，历史销售仍按订单 COMPLETED 时点统计，实收按有效收款减有效退款统计。

## 10. 修改桌单优惠

```text
changeDiscount(storeId, sessionId, newDiscountFen, reason, request):
  BEGIN
  claimIdempotency(...)
  session = SELECT * FROM dining_sessions WHERE id=sessionId FOR UPDATE
  assertStoreOwnership(tx, storeId, { sessionId, staffId: actor.staffId })
  assert session.status == OPEN
  assert request.expectedVersion == session.version

  subtotal = sum(nonCancelledOrders.subtotalFen)
  netPaid = sum(active payments for session) - sum(active refunds through those payments)
  assert 0 <= newDiscountFen <= subtotal
  newDue = subtotal - newDiscountFen
  assert netPaid <= newDue
  // 若净实收已经超过新应收，拒绝；先登记退款，再修改优惠。

  UPDATE dining_sessions
  SET discountFen=newDiscountFen,
      discountVersion=discountVersion+1,
      version=version+1
  WHERE id=sessionId AND version=request.expectedVersion

  finalItems = all non-cancelled order items
  allocations = largestRemainder(
      totalDiscount=newDiscountFen,
      items=[orderItem.id, orderItem.lineSubtotalFen]
  )
  UPSERT discount_allocations for each item
  final = false
  update each Order.discountFen and totalAmountFen from allocation sums

  audit(beforeDiscount, afterDiscount)
  saveIdempotencyResult()
  COMMIT
```

优惠分摊算法：

1. 计算每一项理论分摊：`floor(discount * itemSubtotal / totalSubtotal)`。
2. 记录未分配余数。
3. 计算剩余分。
4. 按小数余数从大到小补齐 1 分。
5. 断言所有 `discount_allocations.discountFen` 之和严格等于 `newDiscountFen`。

## 10.1 DiscountAllocation 版本与历史

- `DiningSession.discountVersion` 每次优惠修改加 1。
- `DiscountAllocation.allocationVersion` 必须等于本次优惠版本。
- `(sessionId, orderItemId)` 唯一记录当前分摊；OPEN 时允许由分摊事务更新该行。
- AuditLog 保存修改前后完整的 allocation 数组，因此当前行可更新，但历史变化不丢失。
- CLOSED 时 `isFinal=true`，数据库触发器禁止再修改或删除。
- 每次重算后必须断言 SUM(discountFen) == DiningSession.discountFen。
- allocationVersion 不是展示字段，必须参与对账；若不等于 session.discountVersion，视为数据漂移并告警。
## 11. 关闭桌单

```text
closeSession(storeId, sessionId, request):
  BEGIN
  claimIdempotency(...)

  sessionPreview = read DiningSession to get tableId
  table = SELECT * FROM dining_tables WHERE id=sessionPreview.tableId FOR UPDATE
  session = SELECT * FROM dining_sessions WHERE id=sessionId FOR UPDATE
  assertStoreOwnership(tx, storeId, { tableId: session.tableId, sessionId, staffId: actor.staffId })

  assert session.status == OPEN
  assert table.activeSessionId == session.id

  orders = SELECT * FROM orders WHERE sessionId=session.id FOR UPDATE
  for each order in orders: assertStoreOwnership(tx, storeId, { orderId: order.id, sessionId, staffId: actor.staffId })
  assert every order.status IN (COMPLETED, CANCELLED)
  assert no order.status IN (PENDING_ACCEPTANCE, ACCEPTED, PREPARING)

  subtotal = sum(order.subtotalFen WHERE status != CANCELLED)
  netPaid = sum(active payments for session) - sum(active refunds through those payments)
  due = subtotal - session.discountFen
  assert netPaid == due

  allocations = SELECT * FROM discount_allocations WHERE sessionId=session.id
  assert sum(allocations.discountFen) == session.discountFen

  UPDATE discount_allocations SET isFinal=true WHERE sessionId=session.id
  UPDATE dining_sessions
  SET status=CLOSED, closedAt=now(), closedByStaffId,
      allocationFinalizedAt=now(), version=version+1
  WHERE id=session.id AND status=OPEN

  UPDATE dining_tables
  SET activeSessionId=NULL
  WHERE id=table.id AND activeSessionId=session.id

  audit(...)
  saveIdempotencyResult()
  COMMIT
```

关闭后不能新增订单、修改优惠或登记新的桌单收款；退款作为独立记录处理，不自动重开桌单。

## 12. 桌单关闭与新订单创建并发

```text
newOrder:
  BEGIN
  SELECT dining_table WHERE id=T01 FOR UPDATE
  if activeSessionId is NULL:
      create session and set pointer
  else:
      use current open session
  create order / reserve stock
  COMMIT

closeSession:
  BEGIN
  SELECT dining_table WHERE id=T01 FOR UPDATE
  SELECT dining_session WHERE id=activeSessionId FOR UPDATE
  validate all orders final and due == netPaid
  close session / clear pointer
  COMMIT
```

两者都会先锁同一 `DiningTable` 行，因此发生严格串行：

- 若关闭先拿到锁：关闭完成后，新订单看到 `activeSessionId=NULL`，创建新的桌单。
- 若新订单先拿到锁：新订单提交后，关闭事务必须重新检查该新订单，未完成则关闭失败。

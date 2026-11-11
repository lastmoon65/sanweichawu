# V1.2 跨门店归属一致性

## 1. 设计结论

当前系统是单店 MVP，但不允许模型层出现“A 门店订单引用 B 门店数据”的脏关系。

约束分三层：

1. Prisma 单字段外键保证记录存在。
2. MySQL 触发器或服务事务保证关联记录的 `storeId` 相等。
3. 对无法可靠静态表达的写入，在 `StoreOwnershipService` 中统一校验并在同一事务内执行。

## 2. 具体关系清单

| 子实体/字段 | 父实体/字段 | 一致性规则 | 落点 |
| --- | --- | --- | --- |
| Product.storeId + categoryId | Category.id + storeId | Category 必须属于同一 Store | `constraints.sql` 可追加复合/触发器校验；服务层同步校验 |
| ProductVariant.productId | Product.id | Variant 通过 Product 推导门店 | Prisma 外键 + 服务层 |
| ProductVariant.activeRecipeVersionId | RecipeVersion.id / variantId | 配方必须属于当前 Variant 且 ACTIVE | `trg_variant_active_recipe_bi/bu` + 发布事务 |
| RecipeVersion.variantId | ProductVariant.id | 配方版本必须属于 Variant | Prisma 外键 |
| VariantRecipe.recipeVersionId + materialId | RecipeVersion / Material | 原材料门店必须等于 Variant → Product → Store | `trg_variant_recipe_store_bi/bu` |
| RecipeModifier.recipeVersionId + optionValueId + materialId | RecipeVersion / VariantOptionValue / Material | 选项必须属于当前 Variant；材料必须属于同门店 | `trg_recipe_modifier_store_bi/bu` |
| DiningSession.storeId + tableId | DiningTable.id + storeId | 桌单和桌必须同店 | `trg_session_store_bi/bu` |
| DiningTable.activeSessionId | DiningSession.id + storeId | 指针必须指向本桌本店的 OPEN session | `trg_dining_table_active_session_bi/bu` |
| Order.storeId + tableId/sessionId | DiningTable / DiningSession | 堂饮订单的桌和桌单必须同店；打包订单两者为空 | `trg_order_store_bi/bu` + CHECK |
| OrderItem.orderId + productId/variantId | Order / Product / ProductVariant | 商品规格必须属于订单门店 | `trg_order_item_store_bi` + 服务层 |
| OrderItemMaterial.orderItemId + materialId | OrderItem → Order / Material | 材料必须属于订单门店 | `trg_order_item_material_store_bi` |
| StockMovement.storeId + materialId/orderId | Store / Material / Order | 库存流水不得跨店 | `trg_stock_movement_store_bi` |
| LossRecord.storeId + materialId/orderId | Store / Material / Order | 损耗不得跨店 | `trg_loss_record_store_bi` |
| PaymentRecord.storeId + sessionId/orderId | Store / DiningSession / Order | 只能关联同店桌单或同店打包订单 | `trg_payment_target_store_bi` + XOR CHECK |
| RefundRecord.paymentRecordId | PaymentRecord | 退款通过原收款继承 Store | Prisma 外键 + 原收款锁 |
| DiscountAllocation.sessionId + orderItemId | DiningSession / OrderItem → Order | OrderItem 的订单必须属于该 Session | `trg_discount_allocation_store_bi` |
| AuditLog.storeId + actorStaffId | Store / Staff | Staff 必须属于同店 | 服务层 + 审计查询 |
| StoreOrderPolicy.storeId | Store.id | 一店一政策 | 唯一约束 |

## 3. 统一服务层校验

```text
assertStoreOwnership(tx, storeId, refs):
  if refs.tableId:
      assert tx.table(id=refs.tableId).storeId == storeId
  if refs.sessionId:
      session = tx.session(id=refs.sessionId)
      assert session.storeId == storeId
      if refs.tableId:
          assert session.tableId == refs.tableId
  if refs.orderId:
      assert tx.order(id=refs.orderId).storeId == storeId
  if refs.productId:
      assert tx.product(id=refs.productId).storeId == storeId
  if refs.materialId:
      assert tx.material(id=refs.materialId).storeId == storeId
  if refs.paymentId:
      assert tx.payment(id=refs.paymentId).storeId == storeId
```

调用时机：

- 创建堂饮订单。
- 创建打包订单。
- 收款登记。
- 退款登记。
- 库存入库/调整。
- 损耗记录。
- 优惠分摊。
- 审计日志写入。

## 4. 未由数据库完整覆盖的部分

1. `AuditLog.actorStaffId` 与 `storeId` 的同店关系还需服务层保证或追加触发器。
2. `RefundRecord` 的 Store 由 PaymentRecord 继承，查询接口需始终 join PaymentRecord 校验。
3. 顾客 User 是全局身份，不直接归属 Store；订单归属通过 Order.storeId 和 Order.customerUserId 共同控制。
4. 复合外键在当前 nullable 交易关系（PaymentRecord 的两个目标）上会使 Prisma 模型显著复杂化，因此采用数据库触发器 + 统一服务校验。

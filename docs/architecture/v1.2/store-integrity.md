# V1.2 跨门店归属一致性

## 1. 设计结论

当前系统是单店 MVP，但不允许模型层出现“A 门店订单引用 B 门店数据”的脏关系。

约束分三层：

1. Prisma 外键保证被引用记录存在。
2. MySQL 触发器校验跨店、跨 Variant 和配方状态。
3. 服务事务在写库前调用 `assertStoreOwnership`，与数据库约束形成双保险。

本轮已提供可执行的服务层参考实现：

- `reference/store-ownership.mjs`
- 单元验证：`tests/store_ownership_contract.mjs`

该实现使用 Prisma 风格的 `tx.<model>.findUnique()` 接口，尚未接入正式 NestJS 服务；接入时必须直接复用或逐行移植，不得另写一套弱化规则。

## 2. 具体关系清单

| 子实体/字段 | 父实体/字段 | 一致性规则 | 数据库落点 |
| --- | --- | --- | --- |
| Category.storeId | Store.id | 分类创建后不可迁店 | `trg_category_store_immutable_bu` |
| Product.storeId + categoryId | Store / Category | Product 与 Category 必须同店；Product 不可迁店 | `trg_product_category_store_bi/bu`、`trg_product_store_immutable_bu` |
| ProductVariant.productId | Product.id | Variant 必须属于 Product，创建后不可换 Product | `trg_variant_product_immutable_bu` |
| ProductVariant.activeRecipeVersionId | RecipeVersion.id / variantId / status | 必须指向当前 Variant 的 ACTIVE 配方 | `trg_variant_active_recipe_bi/bu` |
| RecipeVersion.variantId + versionNo | ProductVariant.id | 配方版本身份不可迁移 | `trg_recipe_version_identity_bu` |
| RecipeVersion.status | 无 | DRAFT → ACTIVE → ARCHIVED；不可回退或复活 | `trg_recipe_version_initial_draft_bi`、`trg_recipe_version_status_bu` |
| VariantRecipe.recipeVersionId + materialId | RecipeVersion / Material | 只有 DRAFT 可新增/修改/删除；材料必须同店 | `trg_variant_recipe_immutable_bi/bu/bd`、`trg_variant_recipe_store_bi/bu` |
| RecipeModifier.recipeVersionId + optionValueId + materialId | RecipeVersion / VariantOptionValue / Material | 只有 DRAFT 可新增/修改/删除；选项属于当前 Variant，材料同店 | `trg_recipe_modifier_immutable_bi/bu/bd`、`trg_recipe_modifier_store_bi/bu` |
| DiningSession.storeId + tableId | DiningTable.id + storeId | 桌单和桌必须同店 | `trg_session_store_bi/bu` |
| DiningTable.activeSessionId | DiningSession.id + storeId | 指针必须指向本桌本店的 OPEN session | `trg_dining_table_active_session_bi/bu` |
| Order.storeId + tableId/sessionId | DiningTable / DiningSession | 堂饮订单的桌和桌单必须同店；打包订单两者为空 | `trg_order_store_bi/bu` + CHECK |
| OrderItem.orderId + productId + variantId + recipeVersionId | Order / Product / ProductVariant / RecipeVersion | 商品、规格、订单同店；RecipeVersion.variantId 必须等于 OrderItem.variantId；MANAGED 规格必须带 ACTIVE 配方 | `trg_order_item_store_bi` |
| OrderItemMaterial.orderItemId + materialId | OrderItem → Order / Material | 材料必须属于订单门店 | `trg_order_item_material_store_bi` |
| StockMovement.storeId + materialId/orderId | Store / Material / Order | 库存流水不得跨店 | `trg_stock_movement_store_bi` |
| LossRecord.storeId + materialId/orderId | Store / Material / Order | 损耗不得跨店 | `trg_loss_record_store_bi` |
| PaymentRecord.storeId + sessionId/orderId | Store / DiningSession / Order | 只能关联同店桌单或同店打包订单 | `trg_payment_target_store_bi` + XOR CHECK |
| RefundRecord.paymentRecordId | PaymentRecord | 退款通过原收款继承 Store；锁原收款后校验累计退款 | Prisma 外键 + 原收款行锁 + `trg_refund_record_limit_bi` |
| DiscountAllocation.sessionId + orderItemId | DiningSession / OrderItem → Order | OrderItem 的订单必须属于该 Session | `trg_discount_allocation_store_bi` |
| AuditLog.storeId + actorStaffId | Store / Staff | Staff 必须属于同店 | 服务层校验；正式接入时补触发器或统一审计写入器 |

## 3. 服务层参数契约

`assertStoreOwnership(tx, storeId, refs)` 的 `refs` 支持：

`tableId`、`sessionId`、`orderId`、`orderItemId`、`categoryId`、`productId`、`variantId`、`recipeVersionId`、`materialId`、`paymentId`、`staffId`、`requireActiveRecipe`。

关键行为：

- Product 无论是否显式传 `categoryId`，都会加载其 Category 并校验同店。
- Variant 无论是否显式传 `productId`，都会加载其 Product 并校验门店。
- RecipeVersion 无论是否显式传 `variantId`，都会加载其 Variant；下单场景传 `requireActiveRecipe: true`。
- OrderItem 会加载并交叉校验 Order、Product、Variant 和 RecipeVersion，不允许只检查单一店铺字段。
- Payment 校验唯一收款目标；若调用点同时传 `sessionId` 或 `orderId`，必须与 Payment 目标一致。
- Staff 必须属于当前认证门店。

## 4. 调用点

| 事务 | 必须传入的 refs |
| --- | --- |
| 创建堂饮/打包订单 | 每个购物车项：`categoryId, productId, variantId, recipeVersionId, requireActiveRecipe: true`；员工写操作另带 `staffId` |
| 开始制作 | `orderId`；每种消耗材料 `materialId`；操作人 `staffId` |
| 制作后取消 | `orderId`；每条损耗 `orderItemId, materialId`；操作人 `staffId` |
| 盘点/入库 | `materialId`；操作人 `staffId` |
| 登记桌单/打包收款 | `sessionId` 或 `orderId`；操作人 `staffId` |
| 收款作废 | `paymentId`；操作人 `staffId` |
| 登记退款 | `paymentId`；操作人 `staffId` |
| 修改优惠 | `sessionId`；操作人 `staffId` |
| 关闭桌单 | `tableId, sessionId`；每张订单 `orderId`；操作人 `staffId` |
| 发布配方 | `variantId, recipeVersionId`；每个材料 `materialId`；操作人 `staffId` |

## 5. 未由数据库完整覆盖的部分

1. `AuditLog.actorStaffId` 与 `storeId` 的同店关系暂由统一审计写入器和参考服务保证；正式实现应补触发器或在同一事务封装。
2. `RefundRecord` 没有冗余 `storeId`，查询接口必须始终 join `PaymentRecord` 并校验门店。
3. 顾客 `User` 是全局身份，不直接归属 Store；订单归属同时使用 `Order.storeId` 和 `Order.customerUserId`。
4. `PaymentRecord` 的 session/order 二选一存在 nullable 关系，Prisma 复合外键会显著复杂化，因此使用 CHECK + 触发器 + 服务层三重保护。
5. 当前仓库没有正式 NestJS 服务，参考服务单测通过不等于后端接口已接入；正式开发首轮必须把该调用点纳入接口契约测试。

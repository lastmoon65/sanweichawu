# P1-02-A Prisma Schema 交付报告

实现日期：2026-11-13（Asia/Shanghai）

设计依据：用户提供的《三味茶屋单店经营系统 P1-02 最小可用数据模型最终设计报告》

Prisma：`6.19.0`  
目标数据库：MySQL 8.4 LTS  
本轮不生成 Migration，不连接真实数据库。

## A. 工程变更清单

| 文件 | 变更目的 |
| --- | --- |
| `backend/package.json` | 增加 `prisma@6.19.0` CLI 和只读 Schema 验证脚本；本轮不安装/生成 Client |
| `package-lock.json` | 锁定 Prisma 6.19.0 依赖树 |
| `backend/prisma/schema.prisma` | 正式 21 模型 Prisma Schema |
| `backend/scripts/check-schema.mjs` | 检查模型清单、禁用模型/字段、精度、删除策略和无 Migration |
| `docs/engineering/phase-1/p1-02-a-schema-report.md` | 本轮交付和差异报告 |
| `docs/engineering/phase-1/README.md` | 更新 P1-02-A 当前状态 |
| `docs/engineering/phase-1/05-implementation-plan.md` | 标记 Schema 已实现、Migration 仍未开始 |
| `README.md` | 增加 P1-02-A 当前状态入口 |

依赖变更：

- 新增 `prisma@6.19.0` CLI。
- 未安装 `@prisma/client`，本轮不生成 Client。
- 未升级其他依赖。

数据库变更：无。未生成或执行 Migration，未执行 `db push`，未连接 MySQL。

## B. 21 模型映射清单

### 1. Store

- 关键字段：`id BigInt`、`name`、`status`、`timezone`、`businessDayCutoffMinute`、`pendingReminderMinutes`、`maxPendingOrdersPerCustomer`、`maxPendingOrdersPerSession`。
- 关系：拥有 Staff、Category、Product、Material、DiningTable、DiningSession、Order、StockMovement、LossRecord、PaymentRecord。
- Prisma 约束/索引：`@@index([status, deletedAt])`。
- 原生待办：无。

### 2. User

- 关键字段：`id BigInt`、`openid String? @unique`、`unionid`、`nickname`、`avatarUrl`、`status`。
- 关系：`orders Order[]`。
- Prisma 约束/索引：`openid` 唯一；`@@index([status])`。
- 原生待办：无。

### 3. Staff

- 关键字段：`id BigInt`、`storeId`、`name`、`role`、`status`。
- 明确没有 `userId`。
- 关系：Store，以及库存、损耗、收款/退款、关台操作人关系。
- Prisma 约束/索引：`@@index([storeId, status, role])`。
- 原生待办：员工登录映射由后续 P1-04 服务层设计。

### 4. Category

- 关键字段：`id BigInt`、`storeId`、`name`、`sortOrder`、`status`、`deletedAt`。
- 关系：Store、Product。
- Prisma 约束/索引：`@@index([storeId, status, sortOrder])`。
- 原生待办：`(storeId, active_name)` STORED 生成列唯一索引。

### 5. Product

- 关键字段：`id BigInt`、`storeId`、`categoryId`、`name`、`description`、`imageUrl`、`status`、`sortOrder`、`deletedAt`。
- 关系：Store、Category、ProductVariant、OrderItem。
- Prisma 约束/索引：`@@index([storeId, categoryId, status, sortOrder])`。
- 原生待办：`(storeId, active_name)` STORED 生成列唯一索引。

### 6. ProductVariant

- 关键字段：`id BigInt`、`productId`、`name`、`priceFen BigInt`、`inventoryMode`、`status`、`sortOrder`、`deletedAt`。
- 明确没有 `activeRecipeVersionId`。
- 关系：Product、VariantOptionGroup、VariantRecipe、RecipeModifier、OrderItem。
- Prisma 约束/索引：`@@index([productId, status, sortOrder])`。
- 原生待办：`(productId, active_name)` STORED 生成列唯一索引。

### 7. VariantOptionGroup

- 关键字段：`id BigInt`、`variantId`、`code`、`name`、`selectionType`、`required`、`sortOrder`、`status`。
- 关系：ProductVariant、VariantOptionValue。
- Prisma 约束/索引：`@@unique([variantId, code])`；`@@index([variantId, sortOrder])`。
- 原生待办：无。

### 8. VariantOptionValue

- 关键字段：`id BigInt`、`optionGroupId`、`code`、`name`、`priceDeltaFen BigInt`、`sortOrder`、`status`。
- 关系：VariantOptionGroup、RecipeModifier、OrderItemOption。
- Prisma 约束/索引：`@@unique([optionGroupId, code])`；`@@index([optionGroupId, sortOrder])`。
- 原生待办：无。

### 9. VariantRecipe

- 关键字段：`id BigInt`、`variantId`、`materialId`、`role`、`quantity Decimal(18,3)`。
- 关系：直接关联 ProductVariant 与 Material，无 RecipeVersion。
- Prisma 约束/索引：`@@unique([variantId, materialId, role])`；`@@index([materialId])`。
- 原生待办：无。

### 10. RecipeModifier

- 关键字段：`id BigInt`、`variantId`、`optionValueId`、`materialId`、`targetRole`、`quantityDelta Decimal(18,3)`。
- 关系：直接关联 ProductVariant、VariantOptionValue、Material。
- Prisma 约束/索引：`@@unique([variantId, optionValueId, materialId, targetRole])`；option/material 普通索引。
- 原生待办：无。

### 11. Material

- 关键字段：`id BigInt`、`storeId`、`name`、`unit`、`onHand Decimal(18,3)`、`reserved Decimal(18,3)`、`warningThreshold Decimal(18,3)`、`averageCostPerUnit Decimal(18,6)`、`status`、`version`、`deletedAt`。
- 关系：Store、VariantRecipe、RecipeModifier、StockMovement、LossRecord、OrderItemMaterial。
- Prisma 约束/索引：`@@index([storeId, status, deletedAt])`。
- 原生待办：`(storeId, active_name)`；非负与 `reserved <= onHand` CHECK。

### 12. StockMovement

- 关键字段：`id BigInt`、`movementNo @unique`、`dedupeKey @unique`、`storeId`、`materialId`、`movementType`、数量/预占变动、变动后余额、成本快照、订单/明细/操作人、原因、时间。
- 关系：Store、Material、Order?、OrderItem?、Staff?、LossRecord?。
- Prisma 约束/索引：`movementNo`、`dedupeKey` 唯一；门店/类型/时间、材料/时间、订单/材料/类型索引。
- 原生待办：余额非负、6 类 movementType 数量/预占/成本语义 CHECK。

### 13. LossRecord

- 关键字段：`id BigInt`、`lossNo @unique`、`dedupeKey @unique`、`storeId`、`materialId`、`orderId?`、`orderItemId?`、`stockMovementId? @unique`、数量、成本快照、原因、操作人、时间。
- 关系：Store、Material、Order?、OrderItem?、StockMovement?、Staff?。
- Prisma 约束/索引：`lossNo`、`dedupeKey`、`stockMovementId` 唯一；门店/时间、材料/时间、订单索引。
- 明确未设置 `(orderItemId, materialId)` 唯一。
- 原生待办：无额外 CHECK；服务层控制关联合法性。

### 14. DiningTable

- 关键字段：`id BigInt`、`storeId`、`name`、`code`、`capacity`、`deletedAt`。
- 明确没有 `activeSessionId`。
- 关系：Store、DiningSession。
- Prisma 约束/索引：`@@index([storeId, deletedAt])`。
- 原生待办：`active_code` STORED 生成列 + `(storeId, active_code)` 唯一索引。

### 15. DiningSession

- 关键字段：`id BigInt`、`storeId`、`tableId`、`status`、`discountFen BigInt @default(0)`、`version`、`openedAt`、`closedAt`、`closedByStaffId`。
- 关系：Store、DiningTable、Staff?、Order、PaymentRecord。
- Prisma 约束/索引：门店/状态/开台时间、桌台/状态/开台时间索引。
- 原生待办：`open_table_guard` STORED 生成列唯一索引。

### 16. Order

- 关键字段：`id BigInt`、`storeId`、`customerUserId`、`orderNo @unique`、`idempotencyKey @unique`、`channel`、`sessionId?`、`status`、金额 `BigInt`、version、履约时间戳、取消原因。
- 明确没有 `tableId`。
- 关系：Store、User、DiningSession?、OrderItem、StockMovement、LossRecord、PaymentRecord。
- Prisma 约束/索引：订单号、幂等键唯一；门店/状态/创建时间、桌单/状态、顾客/时间、完成时间索引。
- 原生待办：无。

### 17. OrderItem

- 关键字段：`id BigInt`、`orderId`、`productId`、`variantId`、商品/规格名称快照、`unitPriceFen BigInt`、数量、`lineSubtotalFen BigInt`、备注。
- 明确没有 `recipeVersionId`、`strengthSnapshot`、`brewingMethodSnapshot`。
- 关系：Order、Product、ProductVariant、OrderItemOption、OrderItemMaterial、StockMovement、LossRecord。
- Prisma 约束/索引：订单、商品/时间、规格/时间索引。
- 原生待办：无。

### 18. OrderItemOption

- 关键字段：`id BigInt`、`orderItemId`、`optionValueId`、组/值编码和名称快照、`priceDeltaFenSnapshot BigInt`。
- 关系：OrderItem、VariantOptionValue。
- Prisma 约束/索引：`@@unique([orderItemId, groupCodeSnapshot, valueCodeSnapshot])`；optionValue 索引。
- 原生待办：无。

### 19. OrderItemMaterial

- 关键字段：`id BigInt`、`orderItemId`、`materialId`、材料名/单位快照、单份/总数量 `Decimal(18,3)`、实际单位/总成本 `Decimal(18,6)?`、来源。
- 明确不保存预估/实际双口径；实际成本仅在 CONSUME 后填写。
- 关系：OrderItem、Material。
- Prisma 约束/索引：`@@unique([orderItemId, materialId, source])`；material 索引。
- 原生待办：无。

### 20. PaymentRecord

- 关键字段：`id BigInt`、`paymentNo @unique`、`idempotencyKey @unique`、`storeId`、`sessionId?`、`orderId?`、`paymentMethod`、`amountFen BigInt`、时间、操作人、状态、作废审计字段。
- 关系：Store、DiningSession?、Order?、Staff?、Staff?、RefundRecord。
- Prisma 约束/索引：收款号、幂等键唯一；门店/状态/时间、session/状态、order/状态索引。
- 原生待办：`sessionId`/`orderId` XOR CHECK；金额与作废字段完整性 CHECK。

### 21. RefundRecord

- 关键字段：`id BigInt`、`refundNo @unique`、`idempotencyKey @unique`、`paymentRecordId`、`amountFen BigInt`、原因、状态、时间、操作人、作废审计字段。
- 关系：PaymentRecord、Staff?、Staff?。
- Prisma 约束/索引：退款号、幂等键唯一；payment/status/time 索引。
- 原生待办：金额与作废字段完整性 CHECK；累计退款上限由服务事务控制。

## C. Migration 原生约束待办清单

### C1. STORED 生成列与唯一索引

1. `dining_sessions.open_table_guard`：
   - `CASE WHEN status = 'OPEN' THEN tableId ELSE NULL END`
   - `UNIQUE(open_table_guard)`
2. `dining_tables.active_code`：
   - `CASE WHEN deletedAt IS NULL THEN code ELSE NULL END`
   - `UNIQUE(storeId, active_code)`
3. `categories.active_name`：
   - `UNIQUE(storeId, active_name)`
4. `products.active_name`：
   - `UNIQUE(storeId, active_name)`
5. `materials.active_name`：
   - `UNIQUE(storeId, active_name)`
6. `product_variants.active_name`：
   - `UNIQUE(productId, active_name)`

这些生成列不得作为 Prisma 普通字段声明，避免 Client 写入生成列。

### C2. CHECK 约束

1. Material：数量、预占、预警值、平均成本非负；`reserved <= onHand`。
2. StockMovement：变动后余额非负；`reservedAfter <= onHandAfter`。
3. StockMovement 六类语义：
   - 期初/入库增加数量且无预占变化。
   - RESERVE 只增加 reserved。
   - RELEASE 只减少 reserved。
   - CONSUME 同时减少 onHand 和 reserved，两者相等。
   - ADJUST 改变 onHand，不改变 reserved。
4. PaymentRecord：金额 > 0；`sessionId`/`orderId` XOR；VOIDED 状态字段完整。
5. RefundRecord：金额 > 0；VOIDED 状态字段完整。
6. Order / DiningSession：`discountFen = 0`，拒绝非零 INSERT/UPDATE（对应 MySQL 验证矩阵 C16）。

### C3. 仍需原生保留的约束

- 所有外键已经使用 `onDelete: Restrict`。
- 生产环境应用账号对订单、快照、库存、损耗、收退款表执行 `REVOKE DELETE`，属于数据库权限部署项。
- 无触发器。
- 无复合外键。
- 不生成 Migration。

## D. 自检结果

执行环境：

```text
Node.js: v22.22.3
Prisma CLI: 6.19.0
@prisma/client: 未安装/未生成
TypeScript: 6.0.3
```

依赖安装与锁文件复现：

```powershell
npm ci
```

结果：成功，`added 379 packages, and audited 383 packages`。安装输出同时报告 4 个 high 级开发依赖漏洞，明细见本节“失败项、风险与未验证项”。

Prisma format：

```powershell
npm run prisma:format --workspace @sanweichawu/backend
```

结果：通过，Schema 已格式化。

Prisma validate：

第一次直接执行：

```powershell
npm run prisma:validate --workspace @sanweichawu/backend
```

结果：失败，Prisma CLI 6.19.0 返回 P1012 `Environment variable not found: DATABASE_URL`。本轮不连接数据库，也不创建真实 `.env`；这是缺少校验所需的 env 引用值，不是 Schema 关系或字段错误。

设置仅用于 Schema 解析的占位地址后重跑：

```powershell
$env:DATABASE_URL = 'mysql://placeholder:placeholder@127.0.0.1:3306/sanweichawu_schema_validation_only'
npm run prisma:validate --workspace @sanweichawu/backend
```

结果：通过，输出 `The schema at prisma\schema.prisma is valid`。`prisma validate` 只解析 Schema，不连接该地址，也没有修改数据库。

Schema 契约检查：

```powershell
npm run prisma:check-contract --workspace @sanweichawu/backend
```

结果：

```text
PASS: schema contract (21 models, frozen fields/enums, BigInt/Decimal precision, unique keys, Restrict FKs)
```

现有工程回归：

```powershell
npm run lint
npm run format:check
npm run test
npm run build
```

结果：

- ESLint 通过。
- Prettier 通过。
- backend、web-admin、mini-program 三个测试 workspace 全部通过。
- backend、web-admin、mini-program 三个构建全部通过。

其他结果：

- 模型数：21。
- Migration 文件数：0。
- 禁止模型：未发现。
- 禁止字段：未发现。
- Float/Double：未发现。
- 所有模型主键均为 `BigInt`。
- 所有金额 `*Fen` 字段均为 `BigInt`，未使用 `Int`。
- 契约脚本已逐项核对全部枚举取值、标准唯一字段、精度、可选关系、两个 `discountFen @default(0)` 以及无 Migration。
- 所有含 `fields:` 的 Prisma 外键均为 `onDelete: Restrict`；未出现 `Cascade` 或 `SetNull`。

失败项、风险与未验证项：

- 已执行但首次失败：未设置 `DATABASE_URL` 的 `prisma validate` 返回 P1012；设置不连接数据库的占位 URL 后通过。该失败已在本节保留，未伪装成一次通过。
- `npm audit --omit=dev`：0 漏洞。
- 完整 `npm audit` 仍报告 Prisma 6.19.0 CLI 的开发配置依赖有 4 个 high 级传递漏洞，修复建议要求升级 Prisma 7/8。由于任务冻结 Prisma 6.19.0，本轮未升级、未使用不安全 override，记录为已知开发依赖风险。
- 尚未执行：真实 MySQL 8.4 建库、Migration、生成列、CHECK 与并发事务测试；本轮没有数据库执行证据，不得标记数据库验证通过。

## E. 设计差异报告

### 完全一致

- 恰好 21 个模型。
- 未包含 Merchant、StaffCredential、AuditLog、RecipeVersion、StoreOrderPolicy、DiscountAllocation、IdempotencyRecord。
- Staff 无 userId。
- Order 无 tableId。
- VariantRecipe / RecipeModifier 直接关联 Variant。
- Material 使用 `averageCostPerUnit`。
- StockMovement 使用 6 类 movementType。
- LossRecord 有可选唯一 `stockMovementId`，不设置 `(orderItemId, materialId)` 唯一。
- DiningTable 无 activeSessionId。
- 金额 BigInt，材料数量 Decimal(18,3)，成本 Decimal(18,6)。
- 所有外键 Restrict。
- 未生成 Migration。

### Prisma 能力限制

- STORED 生成列与生成列唯一索引未写入 Schema。
- CHECK、Payment 目标 XOR、VOIDED 完整性未写入 Schema。
- 累计退款上限、订单/桌单状态机、堂食售后退款需 CLOSED、库存余额与流水一致性由后续服务事务保证。
- 物理 DELETE 禁用需要数据库账号权限配置。

### 需要确认

1. 最终报告将 `Merchant`、`Staff.userId`、配方版本、优惠分摊等列为删除项；此前已接受的评审意见同时明确保留 `Order.discountFen`、`DiningSession.discountFen` 并固定为 0。本 Schema 按该冻结决定保留两个零值字段，不创建优惠表、优惠 API、分摊或优惠触发器，并已把非零写入 CHECK 列入 Migration 待办。
2. `PaymentMethod` 使用 `CASH/WECHAT/ALIPAY/POS/OTHER`，对应报告中的现金/微信/支付宝/POS/其他；枚举命名将在 Migration 前随数据库字典一起审查。
3. 最终报告未逐项列出全部历史字段的类型、长度与默认值；未明确删除的 V1.2 基础字段按“现有字段结构不变”保留。Migration 前仍需独立架构审查确认字段级映射。

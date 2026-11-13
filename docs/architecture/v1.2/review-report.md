# 山隐茶事 V1.2 数据模型审查报告（SQL 与销售口径修订）

修订日期：2026-11-13（Asia/Shanghai）

本轮起点提交：`8b1b993`

本轮实现提交：`a068e25286187c103105c05cdf8812f3ad81b9b7`

## 0. 本轮追加修订（2026-11-13）

### 0.1 P0 SQL 可执行性

- `constraints.sql` 中发现 32 处非法 `END$$$`，已全部改为 `END$$`。
- 当前存在 7 个配对完整的 `DELIMITER $$ ... DELIMITER ;` 区块。
- 结构解析确认共有 53 个触发器，名称全部唯一。
- 多语句触发器均以唯一的 `END$$` 结束；单语句触发器均以 `;` 结束。
- `tests/architecture_checks.py` 已改为状态机和触发器边界解析，并带三种负向自测，不再只依赖文本包含检查。
- 当前环境没有 MySQL/MariaDB 客户端、服务或可用 Docker daemon，因此 SQL 仍未执行验证，不能声明 MySQL 语法或运行通过。

### 0.2 P1 销售统计口径

已确认并实现：

- 只有 `status = COMPLETED` 的订单计入销售。
- 销售额、商品排行、商品材料毛利、桌位销售和小时趋势统一按 `completedAt` 所在营业日归属。
- `createdAt` 不再决定销售归属日。
- 已取消订单不计销售。
- 损耗按 `cancelledAt` 单独统计，不混入正常销售毛利。
- 净实收独立按有效 `PaymentRecord.receivedAt` 减有效 `RefundRecord.refundedAt` 统计，不受销售完成日影响。
- 原型营业日暂按浏览器本地自然日计算；正式 `Store.businessDayCutoffMinute` 尚未接入。

## 1. 前期结论

本轮不推翻 V1.2 模型，只闭合三项 P1：

1. 配方明细 INSERT 状态保护与 RecipeVersion 状态流转。
2. 跨门店、跨 Product/Variant/RecipeVersion 归属校验。
3. 打包订单 PaymentRecord 的原型退款闭环。

当前结果可以作为后续 NestJS/Prisma/MySQL 实现的架构基线，但**不能宣称 MySQL 约束、触发器和事务已通过实机验收**。当前主机没有 MySQL 客户端、MySQL 服务和可用 Docker daemon。

## 2. P1 闭合情况

### 2.1 P1-1 配方 INSERT 与状态机

已完成：

- `RecipeVersion.status` 默认值从 ACTIVE 改为 DRAFT。
- 新增 `trg_recipe_version_initial_draft_bi`：新版本只能以 DRAFT 创建。
- 新增 `trg_recipe_version_status_bu`：
  - DRAFT → ACTIVE 允许。
  - ACTIVE → ARCHIVED 允许。
  - ACTIVE → DRAFT 拒绝。
  - ARCHIVED → 任意其他状态拒绝。
- 新增 `trg_variant_recipe_immutable_bi`：只有 DRAFT 配方可新增原料明细。
- 新增 `trg_recipe_modifier_immutable_bi`：只有 DRAFT 配方可新增选项材料调整。
- 原有 UPDATE/DELETE 保护继续保留，因此 ACTIVE/ARCHIVED 明细不可增、改、删。
- 生成列唯一索引继续保证每个 Variant 最多一个 ACTIVE 版本。

发布顺序仍为：锁 Variant 与版本行 → 旧 ACTIVE 归档 → 新 DRAFT 激活 → 更新 Variant 活动配方指针。

### 2.2 P1-2 跨门店与配方归属

数据库已完成：

- `trg_order_item_store_bi` 同时校验：
  - Order、Product、Variant 同门店。
  - Variant 必须属于 Product。
  - RecipeVersion 必须属于 OrderItem.variantId。
  - MANAGED Variant 的 OrderItem 必须带 ACTIVE RecipeVersion。
  - UNMANAGED Variant 的 OrderItem 不得带 RecipeVersion。
- `trg_product_category_store_bi/bu`：Product 与 Category 必须同门店。
- 归属根字段不可迁移，避免通过改父记录绕过子表触发器：
  - `Category.storeId`
  - `Product.storeId`
  - `ProductVariant.productId`
  - `RecipeVersion.variantId/versionNo`
- 新增可执行服务层参考实现：
  - `docs/architecture/v1.2/reference/store-ownership.mjs`
  - 参数覆盖 `tableId/sessionId/orderId/orderItemId/categoryId/productId/variantId/recipeVersionId/materialId/paymentId/staffId`。
  - 支持 `requireActiveRecipe`，下单要求 ACTIVE，历史读取不要求。
- `transactions.md` 的下单、制作、盘点、取消、收款、作废、退款、优惠、关桌、配方发布调用点均补充了归属校验。

服务参考实现已用 Node 单测验证，但尚未接入正式 NestJS 服务。正式开发开始后必须在接口契约测试中再次验证数据库回滚和服务层拒绝。

### 2.3 P1-3 原型退款闭环

原型已实现并自动化验证：

- 对打包订单已有 PaymentRecord 登记部分退款。
- 退款必须关联原 PaymentRecord。
- 累计有效退款不得超过原收款。
- 原收款记录不修改、不删除。
- 净实收 = 有效收款 − 有效退款。
- 部分退款且净实收仍大于 0 时，订单不能取消。
- 退清后允许取消。
- 经营分析冲减退款，并单列当日退款金额。
- 已取消订单的退款仍保留在当日退款统计中，不因订单取消而消失。

明确限制：

- 此闭环只覆盖原型中的打包订单 PaymentRecord。
- 堂饮桌单仍使用简化一次结账模型，没有实现正式的分次收款、退款登记和已关闭桌单退款 UI。
- 因此只能声明“打包原型退款闭环通过”；不能声明堂饮正式退款闭环已验收。

## 3. 已确认业务规则

1. 已关闭桌单退款不重开桌单。退款是独立财务事实，不改订单销售完成记录、不重新占桌、不生成订单。
2. 已收款订单取消必须先实际退款；退款登记成功后允许再次执行取消。
3. 已收款后增加优惠导致超收时，先实际退款，再调整优惠；已关闭桌单不允许直接改优惠。
4. 多个选项的固定材料调整直接相加。第一版不支持组合覆盖、优先级、条件公式或动态公式引擎。
5. 打包订单实际收到钱后由店员手动登记收款；不要求订单先 COMPLETED，制作完成也不会自动登记收款。

## 4. 尚未解决但不阻塞本轮模型的问题

1. 正式营业日切点是否保持 00:00。
2. 普通店员是否有优惠录入权限；建议仅老板/店长。
3. 选项价格差是否在 MVP 启用。
4. 退款是否需要区分现金、抹零、价格调整。
5. 待接单提醒分钟数、每顾客上限、每桌单上限的正式数值。
6. 同一顾客上限是否同时统计堂饮与打包订单。
7. 已关闭桌单退款是否需要老板二次确认。
8. 是否需要小票、标签或叫号屏。
9. 是否引入原料单位换算；当前每个 Material 只能使用一个规范单位。
10. 审计日志和幂等记录的保留周期。

## 5. MySQL 8 验证状态

**未验证。**

当前环境确认：

- 没有 `mysql` 客户端。
- 没有运行中的 MySQL/MariaDB 服务。
- Docker daemon 不可用。

因此以下内容只有静态检查或脚本准备，没有实机结果：

- `constraints.sql` 全部 CHECK、生成列和触发器执行。
- ACTIVE/ARCHIVED 配方明细 INSERT 失败。
- ARCHIVED 重新激活失败。
- Product 引用其他门店 Category 失败。
- OrderItem 引用其他规格 RecipeVersion 失败。
- 归属根字段迁移失败。
- DRAFT → ACTIVE → ARCHIVED 正式事务。
- 20 连接并发测试。

测试材料已准备：

- `tests/mysql/run_p1_constraint_tests.ps1`
- `tests/mysql/p1_fixture.sql`

脚本会断言预期错误消息，避免“因为其他约束失败”被误判为目标测试通过。

## 6. 并发与一致性风险

| 场景 | 控制设计 | 当前验证 |
| --- | --- | --- |
| 同桌并发首单 | DiningTable 行锁 + open_table_guard 唯一 | 设计完成，MySQL 未验证 |
| 多订单抢最后库存 | materialId 排序 + 条件 UPDATE | 设计完成，MySQL 未验证 |
| 重复开始制作 | 状态机 + version CAS + dedupeKey + 幂等记录 | 设计完成，MySQL 未验证 |
| 并发退款 | PaymentRecord 行锁 + 退款聚合 + 触发器兜底 | 设计完成，MySQL 未验证 |
| 优惠与收款并发 | 都锁 DiningSession 后重算 | 设计完成，MySQL 未验证 |
| 关闭桌单与加单并发 | 两事务都先锁 DiningTable | 设计完成，MySQL 未验证 |
| 配方发布与下单并发 | Variant/版本行锁 + 活动指针 + 订单快照 | 设计完成，MySQL 未验证 |

数据库退款触发器单独执行时不能代替服务层 PaymentRecord 行锁；并发退款必须由服务事务串行化。

## 7. 数据冗余结论

- `Material.onHand/reserved` 是库存流水上的性能缓存，必须每日对账。
- `Order.subtotalFen/discountFen/totalAmountFen` 是汇总缓存，必须可从明细与优惠分摊重算。
- `DiningTable.activeSessionId` 是活动桌单指针，权威判断仍以 OPEN session 和行锁为准。
- `RecipeVersion.status` 与 `ProductVariant.activeRecipeVersionId` 双重表达活动配方，由生成列唯一索引和发布事务共同守护。
- `OrderItem` 的文字快照与选项/材料快照存在受控重复，用于历史可读性和查询便利。

## 8. 经营报表口径

```text
销售额 = completedAt 落在当日营业日、且状态为 COMPLETED 的订单优惠前商品金额
优惠后销售额 = 销售额 - 优惠分摊
净实收 = 当日 receivedAt 的有效 PaymentRecord 合计 - 当日 refundedAt 的有效 RefundRecord 合计
未结 = 当日完成销售的优惠后应收 - 这些销售对应的有效收款净额
材料毛利 = 当日完成销售的优惠后销售额 - 历史材料成本快照
退款金额 = 当日 refundedAt 的有效 RefundRecord 单列统计
损耗 = 当日 cancelledAt 的取消订单损耗成本
```

退款不删除或修改历史销售订单，也不冲减 COMPLETED 时点的销售额；只在净实收和退款统计中体现。

## 9. 本轮验证矩阵

| 验证项 | 结果 |
| --- | --- |
| Prisma format | 通过 |
| Prisma validate | 通过 |
| MySQL 基线 DDL 重新生成 | 通过，27 张表 |
| RecipeVersion DDL 默认值 | `DRAFT`，通过 |
| SQL 结构解析：7 个 DELIMITER 区块、53 个触发器 | 通过 |
| SQL 非法终止符负向自测：`END$$$` / 未闭合区块 / 重复名称 | 通过 |
| 跨日 completedAt 销售归属测试 | Playwright 自动化通过 |
| 商品排行、材料毛利、桌位、小时趋势统一使用 completedAt | Playwright 自动化通过 |
| 净实收按收款/退款事件日期独立统计 | Playwright 自动化通过 |
| 服务层归属参考实现单测 | 9 组场景通过 |
| 打包部分退款、超额拒绝、退清取消 | Playwright 自动化通过 |
| 退款后净实收与退款单列统计 | Playwright 自动化通过 |
| 既有订单、库存、分析、交互回归 | Playwright 自动化通过 |
| MySQL constraints.sql 完整执行 | **未验证：无 MySQL 8 环境** |
| MySQL 关键事务和 20 连接并发 | **未验证：无 MySQL 8 环境** |

## 10. 下一轮复核门槛

本轮到此停止，不进入全量后端开发。下一轮开始前必须先提供真实 MySQL 8 执行证据：

1. 空库执行 Prisma DDL + constraints.sql 成功。
2. P1 约束脚本所有预期失败均命中指定错误。
3. 关键事务与 20 连接并发至少完成一次可复现执行。
4. 再决定 NestJS/Prisma 服务层接入和正式业务接口开发。

# V1.2 修订清单

## 1. 业务规则修订

| 事项 | 原状态 | 修订结果 | 涉及文件 |
| --- | --- | --- | --- |
| 关闭桌单后退款 | P0 待确认 | 不重开桌单，退款独立记录，历史销售不变 | schema, transactions, review |
| 已收款后取消 | 待确认 | 先退款，再取消；禁止系统伪造退款 | transactions, review, prototype |
| 已收款后增加优惠 | 待确认 | 新应收低于净实收时拒绝，先退款再调整 | transactions, review |
| 多选项配方调整 | 待确认 | 固定数量直接相加，不支持组合覆盖 | schema, transactions, review |
| 打包订单收款 | 有 COMPLETED 前置 | 收款与制作状态解耦；未完成也可登记；完成不自动收款 | schema, transactions, prototype, tests |

## 2. Schema 修订

| 文件 | 修改 |
| --- | --- |
| `schema.prisma` | 保留 `Order.customerUserId` |
| `schema.prisma` | 增加 `LossRecord` |
| `schema.prisma` | 增加 `RecipeModifier`、选项组、选项值、订单选项快照 |
| `schema.prisma` | 增加 `RefundRecord` |
| `schema.prisma` | 增加 `DiscountAllocation` |
| `schema.prisma` | 增加 `StoreOrderPolicy` |
| `schema.prisma` | DiningTable 不保存动态桌位状态，只保存 activeSessionId |
| `schema.prisma` | PaymentRecord 收款目标 XOR |
| `schema.prisma` | RecipeStatus 包含 DRAFT / ACTIVE / ARCHIVED |
| `schema.prisma` | LossRecord 增加 `(orderItemId, materialId)` 唯一 |
| `schema.prisma` | 金额使用整数分，成本 Decimal(18,6)，原料数量 Decimal(18,3) |

## 3. 约束修订

| 文件 | 修改 |
| --- | --- |
| `constraints.sql` | 生成列唯一：每桌一个 OPEN session |
| `constraints.sql` | 生成列唯一：每 Variant 一个 ACTIVE recipe |
| `constraints.sql` | CHECK：PaymentRecord session/order XOR |
| `constraints.sql` | CHECK：订单渠道与 table/session 匹配 |
| `constraints.sql` | CHECK：金额、数量、版本和状态合法性 |
| `constraints.sql` | 配方 DRAFT 才可修改；ACTIVE/ARCHIVED 子表 immutable |
| `constraints.sql` | 库存、损耗、审计、订单快照 append-only |
| `constraints.sql` | 退款总额不得超过原有效收款 |
| `constraints.sql` | 跨门店触发器：桌单/订单/商品/配方/材料/收款/分摊 |
| `store-integrity.md` | 给出完整跨门店关系清单和服务层校验伪代码 |

## 4. 事务修订

| 文件 | 修改 |
| --- | --- |
| `transactions.md` | 打包收款删除 `status == COMPLETED` 限制，改为 `status != CANCELLED` |
| `transactions.md` | LossRecord 按 orderItemId + materialId 聚合 |
| `transactions.md` | 制作后取消时检查打包订单或桌单净实收是否超收 |
| `transactions.md` | 关闭桌单退款不重开规则 |
| `transactions.md` | 增加 DRAFT → ACTIVE → ARCHIVED 发布事务 |
| `transactions.md` | 增加 PROCESSING 幂等处理和事务一致性 |
| `transactions.md` | 增加统一 `assertStoreOwnership` 调用 |

## 5. 原型修订

| 文件 | 修改 |
| --- | --- |
| `data.js` | Schema version 升为 2，新增 payments 集合；示例打包订单改为 Payment 记录 |
| `store.js` | 删除完成时自动 `recordTakeawaySettlement` |
| `store.js` | 新增 `recordTakeawayPayment`，不要求 COMPLETED |
| `store.js` | 已收打包订单取消前检查是否需要先退款 |
| `app.js` | 工作台显示打包应收/实收/未结 |
| `app.js` | 新增打包订单“登记收款”弹窗 |
| `app.js` | 订单详情显示打包实收状态 |
| `app.js` | 经营分析实收纳入手动 PaymentRecord，并扣除有效退款 |
| `app.js` | 新增打包订单部分/全额退款交互，退款关联原 PaymentRecord |
| `store.js` | 新增退款流水与累计退款上限校验，净实收重算 |
| `bundle.js` | 已重新生成 |

## 6. 测试修订与结果

| 测试 | 结果 |
| --- | --- |
| `tests/manual_payment.py` 打包未完成登记收款 | 通过 |
| `tests/manual_payment.py` 完成不自动新增收款 | 通过 |
| `tests/manual_payment.py` 已完成未付款仍保持未结 | 通过 |
| `tests/manual_payment.py` 已收款不退款不能取消 | 通过 |
| `tests/refund_flow.py` 部分退款 | 通过 |
| `tests/refund_flow.py` 超额退款拒绝 | 通过 |
| `tests/refund_flow.py` 全额退款后取消 | 通过 |
| `tests/prototype_acceptance.py` | 通过 |
| `tests/extended_acceptance.py` | 通过 |
| `tests/edge_acceptance.py` | 通过 |
| `tests/interaction_checks.py` | 通过 |
| Prisma 6.19.0 format | 通过 |
| Prisma 6.19.0 validate | 通过 |
| Prisma 生成 MySQL DDL | 通过 |
| MySQL 8 constraints.sql 实际执行 | 未验证：当前无运行中的 MySQL 8 |
| MySQL 20 连接并发测试 | 未验证：需要真实数据库环境 |

## 7. 后续必须补验

1. MySQL 8 从空库执行 Prisma DDL + constraints.sql。
2. DRAFT → ACTIVE → ARCHIVED 事务及唯一索引实测。
3. 同桌并发首单、库存并发、并发收款、退款与作废并发。
4. 跨门店触发器全部通过。
5. BASE + MODIFIER 同材料取消后仅一条 LossRecord。
6. 已关闭桌单退款后的经营报表口径。
7. 优惠调整和取消订单的退款前后流程。



## 8. 最后一轮 P1 修订

| 项目 | 修改 |
| --- | --- |
| RecipeVersion 默认状态 | 从 ACTIVE 改为 DRAFT |
| 配方触发器 | 新增 VariantRecipe / RecipeModifier INSERT 的 DRAFT-only 保护 |
| 配方状态机 | ARCHIVED 不可重新激活，ACTIVE 不可回退 DRAFT |
| Product/Category | 增加跨门店 INSERT/UPDATE 触发器；Category/Product 的 storeId 不可迁移 |
| OrderItem/RecipeVersion | 增加同 Store、同 Product、同 Variant 归属校验；RecipeVersion variant/version 身份不可修改 |
| StoreOwnershipService | 新增可执行参考实现，覆盖 category/product/variant/recipe/orderItem/payment/staff 关联 |
| 原型退款 | 新增部分退款、全额退款、超额拦截、净实收和退款单列统计 |
| 原型取消 | 仅当打包订单净实收归零后才允许取消 |
| SQL 完整性 | 修复损坏的 `END$`，增加 DELIMITER/触发器重名检查 |`n| 测试 | 新增 `tests/refund_flow.py`、`tests/store_ownership_contract.mjs` 和 MySQL P1 约束脚本 |

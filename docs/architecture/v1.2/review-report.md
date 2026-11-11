# 山隐茶事 V1.2 数据模型审查报告（修订版）

## 1. 已闭合的业务决定

以下五项已从“待确认”移入正式规则：

1. 已关闭桌单退款不重开桌单。退款是独立财务事实，不修改销售完成记录、不重新占桌、不生成订单。
2. 已收款订单取消必须先实际退款；退款登记成功后允许重新执行取消。禁止自动伪造退款。
3. 已收款后增加优惠导致超收时，先实际退款，再调整优惠；已关闭桌单不允许直接改优惠。
4. 多个选项的固定材料调整直接相加。第一版不支持组合覆盖、优先级、条件公式或动态公式引擎。
5. 打包订单实际收到钱后，可由店员在订单未取消时手动登记收款；不要求订单先 COMPLETED，也不允许制作完成时自动登记。

## 2. 已修复的设计矛盾

### 2.1 配方状态

- `RecipeStatus` 完整为 `DRAFT / ACTIVE / ARCHIVED`。
- 只有 DRAFT 可修改配方明细和 RecipeModifier。
- 发布配方在同一事务中完成：旧 ACTIVE → ARCHIVED，新 DRAFT → ACTIVE，切换 Variant 活动配方指针。
- 数据库生成列唯一索引保证每个 Variant 最多一个 ACTIVE 配方。
- 订单继续保存 RecipeVersion 引用和材料成本快照。

### 2.2 打包订单自动收款

- 原型已删除制作完成时自动创建打包订单实收记录的逻辑。
- 新增店员手动“登记收款”交互。
- 打包订单在待接单/待制作/制作中也可登记实收。
- COMPLETED 只代表制作完成，不再触发收款。
- 登记金额不能超过订单应收减已实收金额。

### 2.3 LossRecord 聚合

- 制作后取消前按 `(orderItemId, materialId)` 聚合全部 BASE、MODIFIER 和 TAKEAWAY_EXTRA 来源。
- 同一订单明细的同一种原材料只生成一条 LossRecord。
- LossRecord 记录损耗数量归因和成本，不改变 onHand/reserved。
- 实际库存扣减只发生在 StockMovement.CONSUME。

### 2.4 跨门店关系

- 已增加 `store-integrity.md` 的具体关系和校验落点清单。
- `constraints.sql` 增加核心跨门店触发器：桌单/桌子、订单/桌单、订单明细/商品、配方/原料、选项调整、材料快照、库存流水、损耗、收款和优惠分摊。
- 其余无法可靠用单表触发器表达的关系由事务内 `assertStoreOwnership` 统一校验。

## 3. 尚未解决但不阻塞数据模型结构的问题

以下事项会影响配置、权限或运营参数，不改变核心实体关系：

1. 正式营业日切点是否保持默认 00:00，还是按凌晨固定时间切日。
2. 普通店员是否有优惠录入权限；建议仅老板/店长。
3. 选项价格差是否在 MVP 启用；模型已预留 `priceDeltaFen`。
4. 退款是否需要区分“现金退款、抹零、价格调整”；当前统一为 RefundRecord。
5. 待接单提醒分钟数、每顾客上限、每桌单上限的正式数值。
6. 同一顾客上限是否同时统计堂饮与打包订单。
7. 已关闭桌单退款是否需要老板二次确认；建议需要。
8. 是否需要小票、标签或叫号屏；当前不在 MVP。
9. 是否需要原料单位换算；当前要求每个 Material 使用唯一规范单位。
10. 审计日志和幂等记录的保留周期。

## 4. 尚未解决的实现层技术问题

1. **MySQL 8 未实际运行验证**
   - 当前环境未启动 MySQL/Docker 数据库引擎。
   - Prisma format、validate 和基线 DDL 生成已验证。
   - `constraints.sql` 的 CHECK、生成列和触发器尚未执行，不能标记为数据库验证通过。

2. **配方激活事务**
   - 必须按 `Variant → 旧 ACTIVE → 新 DRAFT` 顺序加锁。
   - 旧 ACTIVE 先归档，再将 DRAFT 置 ACTIVE，最后更新 Variant 指针。
   - 生成列唯一索引会拒绝顺序错误的并发发布。

3. **跨门店触发器**
   - Prisma 的 nullable 交易关系不适合全部使用复合外键。
   - 服务层必须在同一事务执行门店归属校验，触发器作为兜底。

4. **BigInt 与 Decimal**
   - BigInt DTO 序列化、Decimal 运算、最大余数法舍入必须在工程层统一工具化。

5. **幂等 PROCESSING 状态**
   - 并发重复请求应等待并读取已提交结果。
   - 事务回滚时 PROCESSING 同行回滚；不得留下永久 PROCESSING。

6. **审计与 append-only**
   - 触发器可能影响 Prisma 迁移与测试清理脚本。
   - CI 必须使用真实 MySQL，不允许只在 SQLite/H2 上模拟 MySQL 行为。

## 5. 并发风险与已验证/待验证状态

| 场景 | 控制设计 | 当前验证 |
| --- | --- | --- |
| 同桌并发首单 | DiningTable 行锁 + open_table_guard 唯一 | 设计完成，待 MySQL 20 连接测试 |
| 多笔订单抢最后库存 | materialId 排序 + 条件 UPDATE | 设计完成，待真实并发测试 |
| 重复开始制作 | 状态机 + version CAS + dedupeKey + 幂等记录 | 设计完成，待多连接重放 |
| 分次收款 | DiningSession/Order 行锁 + 聚合余额 | 设计完成，待真实并发测试 |
| 退款与退款并发 | PaymentRecord 行锁 + 退款总额校验 + 触发器 | 设计完成，待真实并发测试 |
| 优惠与收款并发 | 都锁 DiningSession 后重算 | 设计完成，待真实并发测试 |
| 关闭桌单与加单并发 | 两事务都先锁 DiningTable | 设计完成，待真实并发测试 |
| 配方发布与下单并发 | 版本表/活动指针锁 + 订单快照 | 设计完成，待隔离测试 |

## 6. 数据冗余结论

- Material.onHand/reserved 是流水之上的性能缓存，必须每日对账。
- Order.subtotalFen/discountFen/totalAmountFen 是订单级汇总缓存，必须可从 OrderItem 与 DiscountAllocation 重算。
- DiningTable.activeSessionId 是活动桌单指针，权威判断仍以 OPEN session 和行锁为准。
- RecipeVersion.status 与 ProductVariant.activeRecipeVersionId 双重表达活动配方，生成列唯一索引和发布事务共同守护。
- OrderItem 的文字快照与 OrderItemOption 明细有受控重复，用于历史可读性和查询便利。

## 7. 对经营报表的确定口径

```text
销售额 = 已 COMPLETED 且未取消订单的优惠前商品金额

优惠后销售额 = 销售额 - 优惠分摊

实收 = 有效 PaymentRecord 合计 - 有效 RefundRecord 合计

未结 = 优惠后应收 - 净实收

材料毛利 = 优惠后销售额 - 历史材料成本快照

退款金额 = RefundRecord.amountFen 单列统计
```

退款不会删除或修改历史销售订单，也不会冲减 COMPLETED 时点的销售额；只在实收和退款口径中体现。

已关闭桌单退款不自动重开桌单。退款影响实收净额和独立退款统计，但桌单仍保持 CLOSED，桌位不重新占用。

## 8. 本轮验证状态

| 验证项 | 结果 |
| --- | --- |
| Prisma format | 通过 |
| Prisma validate | 通过 |
| Prisma 生成 MySQL 基线 DDL | 通过生成 |
| Schema 要求的 21 个核心实体 | 27 个模型全部包含，无遗漏 |
| 原型打包订单完成不自动收款 | 自动化通过 |
| 打包订单未完成可手动登记实收 | 自动化通过 |
| MySQL constraints.sql 完整执行 | 未验证：当前无 MySQL 8 运行环境 |
| DRAFT → ACTIVE → ARCHIVED 数据库实测 | 未验证：需要真实 MySQL |
| 跨门店触发器实测 | 未验证：需要真实 MySQL |
| 20 连接并发测试 | 未验证：需要真实 MySQL |

## 9. 结论

V1.2 的业务规则和模型结构已内部一致，可以作为后续 NestJS/Prisma/MySQL 实现基线。

但正式迁移前仍必须先搭建 MySQL 8，执行全部迁移和补充 SQL，并完成 T01–T20 的多连接并发验收。不能用 Prisma validate 代替数据库与事务验证。

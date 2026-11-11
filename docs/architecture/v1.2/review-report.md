# 山隐茶事 V1.2 数据模型审查报告

## 1. 验证结论

- Prisma Schema 已通过 Prisma 6.19.0 `format` 与 `validate`。
- 四个核心链路均有落库模型：
  - 订单状态机；
  - 原材料预占、消耗、释放、损耗；
  - 桌单优惠、分次收款、退款、关闭；
  - 完成订单、成本快照和经营统计。
- 强约束分为两层：
  - Prisma Schema：主外键、唯一索引、普通索引、枚举、软删除和历史快照。
  - `constraints.sql`：MySQL CHECK、生成列唯一索引、append-only 与状态转换触发器。
- 聚合型不变量无法只靠 Prisma 表达，必须用行锁事务和每日对账共同保证。
- 当前结论：**模型可以作为开发基线，但下列业务规则确认前不应冻结最终 DDL。**

## 2. 尚未解决的业务问题

### P0

1. **桌单关闭后发生实际退款如何处理**
   - 当前模型允许退款记录独立存在，不会自动重开已关闭桌单。
   - 需确认：退款只作为后续财务事件，还是需要生成“重开/调整桌单”。
   - 建议：MVP 不自动重开，退款作为独立退款事实计入实收净额，并在报表中单列。

2. **已收款后取消订单**
   - 取消会降低应收，可能使净实收大于新应收。
   - 当前事务规则是拒绝该操作，要求先退款。
   - 需确认店员能否在已收款场景直接取消订单。

3. **优惠修改与退款顺序**
   - 增加优惠会降低应收，若已有净实收，可能超过应收。
   - 当前规则为拒绝修改，必须先退款；不能自动生成退款。

4. **套餐/规格选项是否允许加价**
   - 模型预留 `VariantOptionValue.priceDeltaFen`，但 V1.1 只确认规格价格。
   - 若不使用选项加价，应固定为 0 或从 MVP UI/API 禁止。

5. **选项组合的配方调整是加法还是组合规则**
   - 当前 `RecipeModifier` 按单个选项值追加固定数量，多个选项的结果相加。
   - 如果“浓郁 + 冷泡”存在特殊组合用量，需要新增组合规则模型。

6. **打包订单何时允许登记实收**
   - schema 不强绑状态；事务伪代码采用“必须 COMPLETED”。
   - 需确认是否允许先收款后制作。

7. **桌单退款是否允许在关闭后登记**
   - 与第 1 项相关，需要明确角色权限、原因必填和报表口径。

### P1

1. 待接单提醒、每顾客上限、每桌单上限的具体数值。
2. 顾客是否可以取消待接单订单；V1.1 建议由店员取消。
3. 店员是否允许修改优惠，还是仅老板/店长。
4. 同一顾客待接单订单上限的计算范围：仅堂饮、仅打包或全部订单。
5. 打包入口是门店统一码还是固定小程序入口。
6. 订单取消是否支持部分条目取消，MVP 当前按整单取消。
7. 是否需要将原料单位换算纳入 MVP；当前模型规定每个 Material 使用单一规范单位。

## 3. 尚未解决的技术问题

### P0

1. **幂等记录与业务事务必须共库同事务**
   - 不能先写业务、再单独写幂等结果。
   - 并发同 Key 时依赖唯一索引阻塞，第二个请求需读取第一个已提交结果。

2. **BigInt 序列化**
   - Prisma BigInt 不能直接被 `JSON.stringify` 正确序列化。
   - NestJS DTO 层需统一转字符串或安全数字，不能静默丢精度。

3. **Decimal 运算与舍入**
   - 成本 `DECIMAL(18,6)`，原料数量 `DECIMAL(18,3)`。
   - 所有成本汇总必须用 Decimal，不得转为 JS number 后做金额汇总。
   - 优惠最大余数法只使用整数分。

4. **Prisma 与补充 SQL 的迁移管理**
   - 生成列、CHECK 和触发器不属于 Prisma Schema 可完整表达范围。
   - 必须放在手写 migration，并在 CI 中用真实 MySQL 执行迁移测试。
   - `prisma db pull` 可能把生成列识别为 Unsupported，团队必须固定迁移流程。

5. **聚合约束不能只靠注释**
   - 退款合计、优惠后净实收、优惠分摊合计等跨行约束必须由锁事务与触发器/对账共同保证。
   - 当前设计已给出服务事务和补充触发器，但最终实现必须继续有自动化并发测试。

### P1

1. 初始库存必须写 `STOCK_IN` 流水，不能直接写没有来源的 onHand。
2. 对账任务以单实例 NestJS Scheduler 运行；未来多实例需要分布式锁，MVP 禁止为此引入 Redis。
3. AppSecret、数据库密码、JWT Secret 必须来自环境变量或密钥系统。
4. 日志必须带 requestId，禁止输出 token 和完整支付个人信息。
5. 每日备份必须包含 MySQL 数据、迁移版本和恢复演练记录。

## 4. 可能存在的并发漏洞

| 风险 | 防护 | 仍需验证 |
| --- | --- | --- |
| 同桌两人同时创建首单 | DiningTable 行锁 + activeSessionId 唯一 | 20 连接并发唯一桌单测试 |
| 关闭桌单与新订单并发 | 两事务都先锁 DiningTable | 关闭后新开桌单是否得到新 session |
| 两笔订单抢最后原料 | materialId 排序 + 条件 UPDATE | 真实 MySQL 并发测试 |
| 重复开始制作 | version CAS + dedupeKey + 幂等记录 | 多连接重放测试 |
| 两店员同时收款 | 锁 DiningSession/Order 后重算余额 | 并发不超过应收 |
| 收款与优惠同时发生 | 两者都锁 DiningSession | 净实收不得超过新应收 |
| 退款与作废收款并发 | 都锁 PaymentRecord；有退款时禁止作废 | 多连接竞争测试 |
| 退款合计超原收款 | 锁 PaymentRecord + 触发器 | 并发两笔退款测试 |
| 关闭桌单与修改优惠并发 | 都锁 DiningSession | 关闭前最终优惠一致 |
| 配方切换与下单并发 | 订单事务锁/读取 activeRecipeVersion 并快照 | 新订单使用旧或新版本必须确定 |
| 商品改价与下单并发 | 订单事务内读取价格并写快照 | 订单价格与下单时刻一致 |

## 5. 可能存在的数据冗余

| 数据 | 权威来源 | 处理方式 |
| --- | --- | --- |
| Material.onHand / reserved | StockMovement 流水 | 允许作为高性能缓存，每日重算并告警，不自动修复 |
| DiningTable.activeSessionId | OPEN DiningSession | 作为快速指针，生成列唯一索引和触发器守护 |
| ProductVariant.activeRecipeVersionId | ACTIVE RecipeVersion | 唯一指针；生成列保证每个 Variant 只有一个 ACTIVE 版本 |
| Order.subtotalFen / discountFen / totalAmountFen | OrderItem + DiscountAllocation | 允许订单级快照/缓存，但必须能在同一事务重算核对 |
| DiningSession.discountFen | 人工输入的业务值 | DiscountAllocation 和 Order.discountFen 必须与其一致 |
| OrderItem 的 strength/brewing 快照 | OrderItemOption 明细 | 保留字符串快照便于查询；OrderItemOption 保存完整选项结构 |
| OrderItemMaterial 总成本 | 用量 × 单位成本快照 | 下单时固化，不允许用当前采购价重算 |

结论：这些冗余不是全部删除，而是必须定义“谁是事实来源、谁是缓存、谁负责重算”。

## 6. 正式开发前必须确认的字段或规则

### 字段

1. `Store.businessDayCutoffMinute` 的取值范围与结算跨日规则。
2. `Material.unit` 是否禁止同一原料在生命周期内修改。
3. `RecipeModifier.quantityDelta` 是否允许负数，以及合计后必须大于 0 的校验。
4. `VariantOptionValue.priceDeltaFen` 是否进入 MVP。
5. `OrderItem.quantity` 是否只允许整数，当前设计为整数。
6. `RefundRecord` 是否需要区分现金退款、抹零和价格调整。
7. `PaymentRecord` 是否需要独立支付方式枚举；当前 MVP 仅人工确认收款。

### 规则

1. 订单进入 COMPLETED 后是否仍允许取消；当前状态机建议禁止，后续通过退款/调整单处理。
2. 关闭桌单后是否允许新收款；当前建议禁止。
3. 退款后是否允许再次补款；当前 schema 支持，业务需确认。
4. 桌单负应收处理；当前通过 CHECK 和事务拒绝。
5. 选中多个配方调整项时，固定调整是否一律相加。
6. 顾客看到的同桌摘要中允许出现哪些字段；禁止暴露完整备注和个人信息。
7. 同一手机/同一顾客可以同时持有多少待接单订单。

## 7. 初始库存与可审计性要求

库存启用时必须执行：

```text
Material 创建
  → 写入一条 STOCK_IN 流水
  → onHand 增加相同期初数量
```

盘点调整也必须新增 `ADJUST` 流水。禁止：

- 直接改 onHand 不留流水；
- 直接改 reserved；
- 删除或修正旧库存流水；
- 用 LossRecord 代替库存数量变化。

## 8. 最终判定

模型已经支撑订单、库存、资金、经营四条链路的实体和关系，并且对高风险重复写入提供了幂等键、dedupeKey、版本号和行锁方案。

但在以下事项确认前，不应冻结 Prisma migration：

- 退款与已关闭桌单关系；
- 已收款订单取消规则；
- 优惠与退款处理顺序；
- 选项加价与组合配方规则；
- 打包订单收款时点；
- 初始库存和对账作业的所有权。

确认后，建议先输出：

1. 最终 Prisma migration。
2. MySQL 补充约束 migration。
3. OpenAPI v1。
4. T01–T20 自动化并发验收脚本。
5. 初始库存和每日对账作业。

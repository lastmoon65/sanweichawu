# V1.2 关键测试案例

## 验证状态说明

- **自动化通过**：已在当前浏览器原型中实际执行。
- **设计静态检查通过**：Schema/SQL/文档结构检查通过。
- **未验证**：当前环境没有运行中的 MySQL 8；不得把 Prisma validate 当成数据库验证。

## A. 原型自动化

| 编号 | 场景 | 步骤 | 预期 | 当前状态 |
| --- | --- | --- | --- | --- |
| P-01 | 打包完成不自动收款 | 创建打包订单，执行接单/开始制作/完成，不点登记收款 | PaymentRecord 数量在完成前后不变，订单保持未结 | 自动化通过 |
| P-02 | 打包制作前可收款 | 创建未完成打包订单，点击登记收款并填写合法金额 | 创建一条 ACTIVE PaymentRecord | 自动化通过 |
| P-03 | 已完成未付款仍可收款 | 完成打包订单但不登记收款，之后再登记 | 允许登记，和完成状态无关 | 自动化通过 |
| P-04 | 已收打包订单取消 | 登记实收后直接取消 | 拒绝取消，要求先退款 | 自动化通过 |
| P-05 | 部分/全额退款后可取消 | 先部分退款，再退清余款，然后取消订单 | 部分退款时仍拒绝取消；退清后允许取消 | 自动化通过 |
| P-05b | 超额退款 | 本次退款超过原收款剩余可退金额 | 拒绝，不新增退款记录 | 自动化通过 |
| P-05c | 退款后报表口径 | 部分退款后检查净实收；退清并取消后检查退款单列统计 | 净实收等于有效收款减退款；取消订单的退款仍显示在当日退款统计 | 自动化通过 |
| P-06 | 优惠导致超收 | 已收款后把优惠调整到净实收以上 | 拒绝修改并提示先退款 | 未实现完整桌单分次收款 UI，未验证 |
| P-07 | BASE + MODIFIER 同材料损耗 | 制作含基础与选项追加的茶品后取消 | 按 orderItemId + materialId 合并为一条 LossRecord | 正式模型未实现，未验证 |
| P-08 | 多材料预占一处失败 | 第一项材料成功、第二项库存不足 | 整个事务回滚，无部分预占 | 正式模型未实现，未验证 |
| P-09 | 同桌同时首单 | 两连接同时提交 T01 首单 | 仅产生一张 OPEN session | 正式模型未实现，未验证 |
| P-10 | completedAt 营业日口径 | 构造昨天创建今天完成、今天创建明天完成、未完成和已取消订单 | 只统计今天 COMPLETED 的订单；商品排行、材料毛利、桌位、小时趋势一致；实收按收款/退款事件日独立统计 | 自动化通过 |

## B. Schema / SQL / 服务契约检查

| 编号 | 场景 | 预期 | 当前状态 |
| --- | --- | --- | --- |
| S-01 | Prisma format | 无格式错误 | 通过 |
| S-02 | Prisma validate | 无 P1012 校验错误 | 通过 |
| S-03 | RecipeStatus | 包含 DRAFT / ACTIVE / ARCHIVED，默认 DRAFT | 通过 |
| S-04 | LossRecord 唯一 | `(orderItemId, materialId)` 唯一 | 通过 |
| S-05 | Payment 目标 XOR | `sessionId` 与 `orderId` 必须且只能一个 | SQL CHECK 已写，MySQL 未验证 |
| S-06 | 活动桌单唯一 | 生成列 `open_table_guard` 唯一 | SQL 已写，MySQL 未验证 |
| S-07 | 活动配方唯一 | 生成列 `active_variant_guard` 唯一 | SQL 已写，MySQL 未验证 |
| S-08 | 退款不超原收款 | PaymentRecord 锁 + 触发器 | SQL 已写，MySQL 未验证 |
| S-09 | append-only 事实表 | 更新/删除被触发器拒绝 | SQL 已写，MySQL 未验证 |
| S-10 | 跨门店归属 | 核心关系有触发器或服务事务清单 | 设计和服务契约通过，MySQL 未验证 |
| S-11 | ACTIVE/ARCHIVED 配方明细 INSERT | 直接插入 VariantRecipe / RecipeModifier 必须失败 | 测试脚本已提供，MySQL 未验证 |
| S-12 | ARCHIVED 配方重新激活 | 状态更新必须失败 | 测试脚本已提供，MySQL 未验证 |
| S-13 | Product 跨店 Category | 插入/更新必须失败 | 测试脚本已提供，MySQL 未验证 |
| S-14 | OrderItem 使用其他规格 RecipeVersion | 插入必须失败 | 测试脚本已提供，MySQL 未验证 |
| S-15 | 归属根字段迁店/换父 | Category/Product/Variant/RecipeVersion 的归属根不可修改 | 测试脚本已提供，MySQL 未验证 |
| S-16 | 服务层归属参考实现 | 跨店分类、错规格配方、错订单项组分、DRAFT 配方下单、错员工门店均被拒绝 | Node 单测通过 |
| S-17 | SQL 结构完整性 | DELIMITER 配对、触发器不重名、不存在损坏的 `END$` | 静态检查通过 |
| S-18 | 生成 DDL | MySQL DDL 中 RecipeVersion 默认值为 DRAFT | 通过 |
| S-19 | SQL 触发器结构 | DELIMITER 配对；每个触发器按单语句或 BEGIN/END 正确结束；不存在 END$；名称不重复 | 结构解析和三种负向自测通过，MySQL 未验证 |
| S-20 | 经营统计源码口径 | 销售使用 completedAt；取消/收款/退款分别使用 cancelledAt/receivedAt/refundedAt | 静态检查通过 |

MySQL 约束测试脚本：`tests/mysql/run_p1_constraint_tests.ps1`；fixture：`tests/mysql/p1_fixture.sql`。当前主机没有 MySQL 客户端、MySQL 服务和可用 Docker daemon，因此脚本尚未实际运行。
## C. 必须补做的 MySQL 8 并发验收

执行环境必须使用真实 MySQL 8，推荐 20 个独立连接、事务隔离级别按实现配置。

1. T01 同桌两人并发首单：仅一个活动桌单。
2. T02 同桌连续加单：归入同一 session。
3. T03 两订单抢最后原料：一成功一失败，不超卖。
4. T04 一订单多明细共用材料：先聚合后预占。
5. T05/T06 制作前取消：释放预占，只写一次 RELEASE。
6. T07 制作中取消：写 LossRecord，不写第二次 CONSUME。
7. T08 重复开始制作：只扣一次库存。
8. T09 同 Key 重复创建订单：只创建一单，并返回相同响应。
9. T10 打包完成：不自动创建 PaymentRecord。
10. T11 打包未完成但已收钱：允许创建 PaymentRecord。
11. T12/T13 分次收款和补款：每条独立流水，未结正确。
12. T14 两店员并发收款：不超应收。
13. T15 未完成订单关闭：拒绝。
14. T16 未结不为零关闭：拒绝。
15. T17 完成未收款：算销售，不算实收。
16. T18 改配方/改成本：历史快照不变。
17. T19 实盘小于 reserved：普通盘点拒绝，进入异常处理。
18. T20 顾客查同桌：不能获取其他顾客完整订单。

## D. 必备证据

每次 MySQL 测试至少保留：

- 请求和响应。
- 业务表关键行。
- StockMovement / LossRecord / PaymentRecord / RefundRecord 流水。
- 事务隔离级别与锁等待日志。
- 自动化测试报告。
- 失败请求的 HTTP 状态与错误码。

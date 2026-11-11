# 山隐茶事 V1.2 数据模型设计 Baseline

## 交付物

1. [Prisma Schema](./schema.prisma)
2. [ER 图](./er-diagram.md)
3. [关键事务伪代码](./transactions.md)
4. [数据一致性检查](./consistency-checks.md)
5. [约束与类型决策](./constraint-decisions.md)
6. [审查报告](./review-report.md)
7. [MySQL 补充约束](./constraints.sql)
8. [由 Prisma 生成的 MySQL 基线 DDL](./generated-mysql-ddl.sql)

## 设计范围

模型覆盖 27 个 Prisma 实体：

- 用户要求的 21 个核心实体全部存在。
- 额外加入 `Merchant`、`Category`、`StoreOrderPolicy`、`VariantOptionGroup`、`VariantOptionValue`、`OrderItemOption`，承载组织、商品选项和运营政策。
- `StockMovement` 只记录库存数量事实；制作后取消的损耗由 `LossRecord` 记录。
- 金额交易字段使用整数分；成本快照使用 `DECIMAL(18,6)`，原料数量使用 `DECIMAL(18,3)`。
- 采用模块化单体所需的数据模型，不引入 Redis、消息队列、微服务或在线支付字段。

## 验证

已使用 Prisma 6.19.0 执行：

```powershell
$env:DATABASE_URL='mysql://root:root@127.0.0.1:3306/tea_house_v12'
$env:PRISMA_ENGINES_MIRROR='https://npmmirror.com/mirrors/prisma'
npx --yes prisma@6.19.0 format --schema docs/architecture/v1.2/schema.prisma
npx --yes prisma@6.19.0 validate --schema docs/architecture/v1.2/schema.prisma
```

结果：Schema 语法和关系有效。

## 重要限制

Prisma Schema 无法完整表达以下跨行/跨表规则，因此补充了 `constraints.sql` 和事务伪代码：

- 一个桌位只能有一个 OPEN session；
- 一个 Variant 只能有一个 ACTIVE recipe；
- PaymentRecord 必须且只能关联桌单或打包订单之一；
- 退款总量不能超过原收款；
- 优惠后的净实收不能超过应收；
- 优惠分摊合计必须等于桌单优惠；
- 历史快照和账务事实必须 append-only；
- 顾客订单归属必须进入 API 查询条件。

这些规则必须配套真实 MySQL 8 迁移测试和多连接并发测试，不能只做单元测试。

## 当前状态

这是设计基线，不是可直接上线的业务实现。正式开发前先处理 `review-report.md` 中 P0 业务确认项。


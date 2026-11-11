# V1.2 验证证据

验证时间：2026-11-11（Asia/Shanghai）

## 1. Prisma 验证

执行：

```powershell
$env:DATABASE_URL='mysql://root:root@127.0.0.1:3306/tea_house_v12'
$env:PRISMA_ENGINES_MIRROR='https://npmmirror.com/mirrors/prisma'
npx --yes prisma@6.19.0 format --schema docs/architecture/v1.2/schema.prisma
npx --yes prisma@6.19.0 validate --schema docs/architecture/v1.2/schema.prisma
npx --yes prisma@6.19.0 migrate diff --from-empty --to-schema-datamodel docs/architecture/v1.2/schema.prisma --script --output docs/architecture/v1.2/generated-mysql-ddl.sql
```

结果：

- Prisma format 成功。
- Prisma validate 成功，输出 `The schema ... is valid`。
- 空库到 Schema 的 MySQL baseline DDL 成功生成，共 27 张表。
- 生成 DDL 中 `RecipeStatus` 为 `DRAFT, ACTIVE, ARCHIVED`。
- 生成 DDL 中 LossRecord 存在 `(orderItemId, materialId)` 唯一索引。
- 生成 DDL 中 IdempotencyRecord 存在 `(storeId, endpoint, idempotencyKey)` 唯一索引。

## 2. Schema 静态检查

执行：

```powershell
python tests/architecture_checks.py
```

结果：

```text
PASS: required models, customer ownership, recipe states and loss uniqueness
PASS: supplemental SQL core constraints present
PASS: transaction rules and prototype manual-payment correction
PASS: confirmed business decisions reflected in review report
```

检查内容包括：

- 21 个要求实体全部存在。
- `Order.customerUserId`。
- Recipe DRAFT / ACTIVE / ARCHIVED。
- LossRecord 聚合唯一键。
- Payment XOR、活动桌单、活动配方、退款上限、append-only、跨门店触发器在 SQL 中存在。
- 打包收款事务不再要求 COMPLETED。
- 原型不再调用自动打包结账逻辑。

## 3. 原型浏览器验收

执行：

```powershell
python tests/prototype_acceptance.py
python tests/extended_acceptance.py
python tests/edge_acceptance.py
python tests/interaction_checks.py
python tests/manual_payment.py
```

结果：

- 顾客 T01 连续两单，共用一个桌单：通过。
- 打包订单独立于桌位：通过。
- 门店订单状态机与库存消耗：通过。
- 桌单部分/全额结账和释放桌位：通过。
- 库存不足阻断、补货恢复：通过。
- 制作前取消释放预占：通过。
- 制作后取消记录损耗：通过。
- 历史价格/配方/成本快照：通过。
- 超卖阻断、经营指标与订单一致、响应式无横向溢出：通过。
- 打包订单未完成时手动登记实收：通过。
- 打包订单完成前/后都不会自动新建 Payment：通过。
- 已收打包订单未退款时不能取消：通过。
- 本地 HTTP 服务加载：通过。

## 4. MySQL 8 验证状态

**未验证。**

原因：当前主机没有运行中的 MySQL 8，Docker daemon 也不可用。

因此以下 SQL 尚未实际执行：

- `constraints.sql` 中全部 CHECK。
- `open_table_guard` / `active_variant_guard` 生成列唯一索引。
- append-only 和跨门店触发器。
- `trg_refund_record_limit_bi`。
- DRAFT → ACTIVE → ARCHIVED 数据库事务。
- 20 连接并发测试。

必须在可运行 MySQL 8 的环境中补验，不能把 Prisma validate 作为数据库验证。

## 5. 截图

- `tests/screenshots/analytics.png`
- `tests/screenshots/workbench.png`
- `tests/screenshots/tables.png`
- `tests/screenshots/inventory.png`
- `tests/screenshots/customer-mobile.png`
- `tests/screenshots/flows-complete.png`
- `tests/screenshots/extended-analysis.png`
- `tests/screenshots/server-live.png`

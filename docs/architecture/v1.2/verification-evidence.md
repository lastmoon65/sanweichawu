# V1.2 验证证据

验证时间：2026-11-11（Asia/Shanghai）

基线提交：`25dda034`

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
- 空库到 Schema 的 MySQL baseline DDL 重新生成成功，共 27 张表。
- DDL 中 `RecipeVersion.status` 为 `ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT'`。

## 2. 架构静态检查

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
PASS: final P1 recipe, ownership and refund guards present
PASS: SQL delimiter blocks and trigger names are structurally consistent
PASS: executable ownership contract and transaction call sites are present
PASS: generated MySQL DDL defaults RecipeVersion to DRAFT
```

本轮静态检查额外发现并修复：

- `trg_order_item_store_bi` 的 `END$$` 曾被写成损坏的 `END$`。
- 新增 DELIMITER 配对、触发器重名、损坏结束符检查。
- `ProductVariant`、`Category`、`Product`、`RecipeVersion` 的归属根字段增加不可迁移触发器。

## 3. 服务层归属契约单测

执行：

```powershell
node tests/store_ownership_contract.mjs
```

结果全部通过：

- 合法同店订单、原料、员工和收款组合通过。
- Product 引用其他门店 Category 被拒绝。
- Variant 引用其他 Variant 的 RecipeVersion 被拒绝。
- OrderItem 保留其他 Variant 的 RecipeVersion 被拒绝。
- OrderItem 引用其他门店商品被拒绝。
- DRAFT 配方用于下单被拒绝。
- Payment 挂到不匹配的线下单/订单被拒绝。
- Payment session/order 目标不为 XOR 被拒绝。
- 外店 Staff 被拒绝。

该实现位于 `docs/architecture/v1.2/reference/store-ownership.mjs`，尚未接入正式 NestJS 服务。

## 4. 原型浏览器回归

执行：

```powershell
python tests/prototype_acceptance.py
python tests/extended_acceptance.py
python tests/edge_acceptance.py
python tests/interaction_checks.py
python tests/manual_payment.py
python tests/refund_flow.py
python tests/server_smoke.py
```

结果：

- 顾客 T01 连续两单共用一个桌单：通过。
- 打包订单独立于桌位：通过。
- 订单状态机与库存消耗：通过。
- 桌单部分/全额结账和释放桌位：通过。
- 库存不足阻断、补货恢复：通过。
- 制作前取消释放预占：通过。
- 制作后取消记录损耗：通过。
- 历史价格/配方/成本快照：通过。
- 超卖阻断、经营指标与订单一致、响应式无横向溢出：通过。
- 购物车配置编辑、四种商品排行：通过。
- 打包订单未完成时手动登记实收：通过。
- 打包订单完成前后都不会自动新建 Payment：通过。
- 已收打包订单未退款时不能取消：通过。
- 部分退款、超额退款阻断、退清后取消：通过。
- 原收款不被修改、退款流水保留：通过。
- 部分退款后净实收按有效收款减退款展示：通过。
- 全额退款并取消后，退款仍保留在当日退款统计：通过。
- 本地 HTTP 服务加载：通过。

## 5. MySQL 8 验证状态

**未验证。**

当前主机实测：

```text
mysql client: NOT FOUND
mysql service: NOT FOUND
Docker daemon: unavailable
```

因此以下 SQL 尚未实际执行：

- `constraints.sql` 中全部 CHECK。
- `open_table_guard` / `active_variant_guard` 生成列唯一索引。
- append-only 和跨门店触发器。
- 配方 INSERT 状态保护与状态机触发器。
- Product/Category 跨店触发器。
- 归属根字段不可迁移触发器。
- `trg_refund_record_limit_bi`。
- DRAFT → ACTIVE → ARCHIVED 数据库事务。
- 20 连接并发测试。

MySQL 测试材料：

- `tests/mysql/run_p1_constraint_tests.ps1`
- `tests/mysql/p1_fixture.sql`

脚本 PowerShell 语法检查通过；会从空测试库执行生成 DDL 和 constraints.sql，并验证以下操作必须失败：

- 新 RecipeVersion 直接以 ACTIVE 创建。
- ACTIVE/ARCHIVED 配方 INSERT 明细或选项材料调整。
- ACTIVE 回退 DRAFT。
- ARCHIVED 重新激活。
- Product 引用其他门店 Category。
- OrderItem 引用其他规格 RecipeVersion。
- Category/Product/Variant/RecipeVersion 的归属根字段迁移。

不能把 Prisma validate、SQL 文本检查或 Node 参考服务单测当作 MySQL 实机验证。

## 6. 证据文件

- `tests/screenshots/analytics.png`
- `tests/screenshots/workbench.png`
- `tests/screenshots/tables.png`
- `tests/screenshots/inventory.png`
- `tests/screenshots/customer-mobile.png`
- `tests/screenshots/flows-complete.png`
- `tests/screenshots/extended-analysis.png`
- `tests/screenshots/server-live.png`

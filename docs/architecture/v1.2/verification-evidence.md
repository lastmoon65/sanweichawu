# V1.2 验证证据（SQL 可执行性与销售统计口径）

验证日期：2026-11-13（Asia/Shanghai）

本轮起点提交：`8b1b993`

本轮实现提交：`a068e25286187c103105c05cdf8812f3ad81b9b7`

## 1. SQL 修订结果

文件：`docs/architecture/v1.2/constraints.sql`

- 原文件发现并修复 **32 处**非法 `END$$$`，全部改为正确的 `END$$`。
- 当前全文 `END$$$` 数量：0。
- 结构解析结果：
  - `DELIMITER $$` / `DELIMITER ;` 区块：7 组，全部配对。
  - `CREATE TRIGGER`：53 个，名称全部唯一。
  - 多语句触发器：均以唯一的 `END$$` 结束，且 `END$$` 后无其他语句。
  - 单语句触发器：均以 `;` 结束。

`tests/architecture_checks.py` 不再只检查文本包含，而是：

1. 逐行维护 `DELIMITER` 状态，拒绝未闭合、嵌套和成对错误。
2. 提取每个 `CREATE TRIGGER` 的完整边界。
3. 区分单语句触发器与 `BEGIN/END$$` 触发器，并验证各自的结束方式。
4. 检查触发器名称唯一。
5. 显式拒绝 `END$$$`。
6. 对故意破坏的 SQL 副本执行负向自测，确认验证器会拒绝：
   - 三元结束符 `END$$$`；
   - 未闭合的 `DELIMITER $$`；
   - 重复触发器名称。

注意：上述是结构验证，不等同于 MySQL 8 语法/执行通过。

## 2. Prisma 与生成 DDL

执行：

```powershell
$env:DATABASE_URL='mysql://root:root@127.0.0.1:3306/tea_house_v12'
$env:PRISMA_ENGINES_MIRROR='https://npmmirror.com/mirrors/prisma'
npx --yes prisma@6.19.0 validate --schema docs/architecture/v1.2/schema.prisma
npx --yes prisma@6.19.0 migrate diff --from-empty --to-schema-datamodel docs/architecture/v1.2/schema.prisma --script --output docs/architecture/v1.2/generated-mysql-ddl.sql
```

结果：

- Prisma validate 通过，输出 `The schema ... is valid`。
- MySQL baseline DDL 重新生成成功。
- **generated-mysql-ddl.sql 未在真实 MySQL 8 中执行。**

## 3. 架构与 SQL 自动化检查

执行：

```powershell
python tests/architecture_checks.py
```

结果：通过。

```text
PASS: required models, customer ownership, recipe states and loss uniqueness
PASS: supplemental SQL core constraints present
PASS: transaction rules and prototype manual-payment correction
PASS: confirmed business decisions reflected in review report
PASS: final P1 recipe, ownership and refund guards present
PASS: MySQL delimiter/trigger structure parsed (7 delimiter blocks, 53 triggers)
PASS: SQL structural validator rejects malformed terminators, unclosed blocks and duplicate trigger names
PASS: executable ownership contract and transaction call sites are present
PASS: generated MySQL DDL defaults RecipeVersion to DRAFT
PASS: analytics source uses completion, cancellation and cash-event dates consistently
```

## 4. 销售统计口径测试

执行：

```powershell
python tests/analytics_completion_day.py
```

结果：通过。

```text
PASS: sales uses completedAt day while net cash follows payment/refund event day
PASS: product ranking and material gross include only orders completed today
PASS: table sales include completed dine orders only
PASS: hourly sales use completedAt, not createdAt or a future completion date
PASS: cancellation loss remains separate from normal sales gross profit
```

测试覆盖：

- 昨天创建、今天完成：计入今天销售额。
- 今天创建、明天完成：不提前计入今天销售额。
- 今天创建但未完成：不计销售。
- 已取消订单：不计销售。
- 商品排行和材料毛利：只使用今天完成的订单。
- 桌位销售：只包含今天完成的堂饮订单。
- 小时销售趋势：完成小时取 `completedAt`，不取 `createdAt`。
- 今日净实收：独立使用 `receivedAt/refundedAt` 事件日期；未来完成订单在今天收到的钱仍计入今天实收。
- 取消损耗：继续单独统计，不进入正常销售毛利。

当前原型按浏览器本地自然日归属营业日；正式模型中的 `Store.businessDayCutoffMinute` 尚未接入原型。

## 5. 原型回归

执行：

```powershell
python tests/prototype_acceptance.py
python tests/extended_acceptance.py
python tests/edge_acceptance.py
python tests/interaction_checks.py
python tests/manual_payment.py
python tests/refund_flow.py
node tests/store_ownership_contract.mjs
python tests/server_smoke.py
```

结果：

- 下单、桌单、打包订单、状态机、库存预占/消耗/释放：通过。
- 历史价格、配方和成本快照：通过。
- 经营分析销售额与更新后的 completedAt 口径一致：通过。
- 响应式布局：通过。
- 部分退款、超额退款、退款后取消、退款流水保留：通过。
- 门店归属参考实现 9 组场景：通过。
- 本地 HTTP 页面加载：通过。

## 6. MySQL 8 实际执行状态

**未验证，未执行。**

环境检查结果：

```text
mysql: NOT FOUND
mysqld: NOT FOUND
mysqlsh: NOT FOUND
mariadb: NOT FOUND
mariadbd: NOT FOUND
mysql service: NOT FOUND
Docker daemon: unavailable
```

尝试执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tests\mysql\run_p1_constraint_tests.ps1
```

实际失败项：

```text
mysql client not found. Install MySQL 8 client and set MYSQL_HOST/MYSQL_PORT/MYSQL_USER before running.
```

因此以下项目如实标记为未验证：

- `generated-mysql-ddl.sql` 在空库执行。
- `constraints.sql` 在 MySQL 8 执行。
- CHECK、生成列、触发器创建。
- `tests/mysql/run_p1_constraint_tests.ps1` 预期失败场景。
- 关键事务和 20 连接并发测试。

`tests/mysql/run_p1_constraint_tests.ps1` 的 PowerShell 语法检查通过，但这只证明脚本可解析，不证明 SQL 可执行。

## 7. 结论

- P0：32 处非法 `END$$$` 已修正；结构检查已增强。
- P1：销售统计已统一为 `completedAt` 营业日口径。
- P2：自动化验证已完成；MySQL 8 实机验证因环境缺失继续明确标记“未验证”。

未开始 NestJS 全量开发。

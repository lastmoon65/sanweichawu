# P1-02-B4 真实 MySQL 8.4 验证执行计划

编制日期：2026-11-14（Asia/Shanghai）

固定基线：`a5641f29e8338a8b339f450ea3e195836c5c1cf9`

当前状态：环境准备已完成；已启动隔离 MySQL 8.4 容器并核对版本，尚未执行 Migration。

## 1. 工作边界

本轮只验证冻结数据库设计在真实 MySQL 8.4 上能否可靠部署和拒绝非法数据。

冻结且禁止修改：

- P1-01 工程骨架。
- P1-02-A 字段契约。
- P1-02-B1 Prisma Schema。
- P1-02-B2 Schema 静态契约检查。
- P1-02-B3 两份 Migration 与 Migration 静态检查器。

禁止：

- 开发商品、订单、库存、收款等业务模块。
- 修改 `backend/prisma/schema.prisma`。
- 修改 `backend/prisma/migrations/` 下已关闭的 Migration。
- 使用 `prisma db push`。
- 通过手写或删除 `_prisma_migrations` 记录伪造部署成功。
- 通过修改约束或绕过校验来让失败测试变成通过。
- 连接、修改或清理任何非本轮创建的数据库。
- 在环境准备阶段执行 Migration 或修改数据库结构。

## 2. 当前环境检查结果

### 2.1 Git 基线

```text
Branch: main
HEAD: a5641f29e8338a8b339f450ea3e195836c5c1cf9
origin/main: a5641f2
Working tree at start: clean
```

结论：当前工作区与批准基线 `a5641f2` 一致。

### 2.2 容器与数据库环境

检查结果：

| 项目 | 结果 | 判断 |
| --- | --- | --- |
| Docker Desktop | `4.99.0`，安装于 D 盘 Docker Desktop 安装目录 | 已安装 |
| Docker CLI | `29.9.3`，随 Docker Desktop 安装在 D 盘 | 可用 |
| Docker context | `desktop-linux` | 已配置 |
| Docker daemon | Linux engine `29.9.3` | 可用 |
| WSL 数据根 | D 盘 Docker Desktop WSL 数据目录 | 位于 D 盘 |
| MySQL 容器 | `sanweichawu-b4-mysql` | 运行中 |
| MySQL 版本 | `8.4.13` MySQL Community Server | 符合 8.4 |
| MySQL 镜像 | `mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902` | digest 已固定 |
| 数据卷 | `sanweichawu-b4-mysql-data` | 位于 D 盘的 Docker WSL 数据盘 |
| 网络端口 | `127.0.0.1:33316 -> 3306/tcp` | 仅本地访问 |
| 主机 MySQL CLI/Server | 仍未安装 | 不影响容器验证，使用容器内客户端 |
| Windows MySQL/MariaDB 服务 | 无匹配服务 | 不使用本机服务 |

结论：真实 MySQL 8.4 环境已就绪，可以按本计划进入数据库验证；Migration 尚未执行。

### 2.3 Node.js 与 Prisma

```text
Node.js: v22.22.3
Prisma CLI: 6.19.0
Prisma Schema Engine: 6.19.0
Database provider: mysql
```

### 2.4 数据库连接配置

当前状态：

- `backend/prisma/schema.prisma` 使用 `url = env("DATABASE_URL")`，没有硬编码连接串。
- 当前 shell 中 `DATABASE_URL=NOT_SET`。
- 当前 shell 中 `TEST_DATABASE_URL=NOT_SET`。
- 根目录只有 `.env.example`，没有实际 `.env`。
- `backend/` 下没有 `.env` 文件。
- B4 临时凭证保存在仓库外、D 盘受 ACL 保护的本地目录，不纳入 Git。

安全方案：

- B4 只通过当前进程环境变量注入临时连接信息。
- 不把连接串、用户名密码或容器 root 密码写入仓库、日志或报告。
- 测试数据库名必须包含唯一运行标识 `b4`，并在执行前检查目标库不存在。
- Prisma 只连接本轮专用的 MySQL 临时实例和专用测试库。
- 不读取 `.env.example` 中的占位账号作为真实凭据。

结论：连接配置可以通过进程级 `DATABASE_URL` 安全指向独立测试库；环境已经具备，等待 Migration 执行授权。

## 3. Migration 清单

### 3.1 执行顺序

Prisma Migration 目录按名称字典序执行：

1. `20261114120000_initial_schema`
2. `20261114120100_domain_constraints`

`migration_lock.toml` 内容为：

```text
provider = "mysql"
```

### 3.2 文件指纹

| 顺序 | Migration | SQL 字节数 | SHA-256 |
| --- | --- | ---: | --- |
| 1 | `20261114120000_initial_schema` | 23,909 | `AD2274E7A964EA753661B8C037C486F4B4A1855C0DFE74ECB9613CF0190CE19B` |
| 2 | `20261114120100_domain_constraints` | 5,033 | `8C07ACFD2F657D5CF1E58A1250AA315416A6D73D97CF1BC9B2729092332C4333` |

### 3.3 内容边界

`20261114120000_initial_schema/migration.sql`：

- 21 个 `CREATE TABLE`。
- 202 个物理列。
- 21 个唯一索引。
- 24 个普通索引。
- 46 个外键，全部 `ON DELETE RESTRICT ON UPDATE CASCADE`。
- 不包含 CHECK、触发器、生成列或 DML。

`20261114120100_domain_constraints/migration.sql`：

- 22 个 `ALTER TABLE ... ADD CONSTRAINT ... CHECK`。
- 不包含建表、普通索引、外键、触发器、生成列或 DML。

当前 B3 静态检查实际结果：

```text
PASS: migration SQL contract + 11 self-tests
21 tables, 202 columns, 21 unique indexes, 24 ordinary indexes,
46 foreign keys, 22 checks
```

静态检查只用于确认文件结构与冻结契约一致，不能代替 MySQL 执行。

## 4. 临时 MySQL 8.4 环境方案

以下环境已经完成初始化；Migration 仍未执行，需下一批明确授权。

### 4.1 镜像固定

- 使用官方 `mysql:8.4` LTS。
- 拉取后记录实际 image digest 和 `SELECT VERSION()`。
- 证据中同时记录 tag、digest、操作系统和架构。
- 如果实际版本不是 8.4.x，停止验证，不继续填写通过结果。

### 4.2 实例隔离

建议使用一次性容器和临时数据卷：

- 容器名包含唯一 B4 运行标识。
- 端口只绑定 `127.0.0.1`，建议使用非默认测试端口。
- 字符集固定 `utf8mb4`，排序规则固定 `utf8mb4_unicode_ci`。
- 数据库时区使用 UTC；同时记录 MySQL 实际 `@@time_zone`。
- 不复用已有 MySQL 数据卷、服务、端口或数据库。
- 凭证使用运行时环境变量或仓库外 D 盘受 ACL 保护的本地文件，不写入仓库。
- 库名使用类似 `sanweichawu_b4_main_<runId>`、`sanweichawu_b4_failure_<runId>`、`sanweichawu_b4_recovery_<runId>`。
- 所有清理命令在执行前校验完整库名，只允许包含本轮 `runId` 的测试库。

### 4.3 环境基线记录

开始迁移前执行并保存：

```sql
SELECT VERSION();
SELECT @@version_comment;
SELECT @@transaction_isolation;
SELECT @@sql_mode;
SELECT @@character_set_server;
SELECT @@collation_server;
SELECT @@lower_case_table_names;
SELECT @@default_storage_engine;
SELECT @@time_zone;
```

同时记录：

- Docker image digest。
- Prisma CLI 版本。
- Node.js 版本。
- Git commit SHA。
- 容器启动时间和健康检查结果。
- 主测试库、失败测试库和恢复测试库名称。

## 5. 空库首次部署

目标库：`sanweichawu_b4_main_<runId>`。

步骤：

1. 创建全新空库；确认库中无业务表和 `_prisma_migrations`。
2. 使用只指向该库的进程级 `DATABASE_URL`。
3. 执行：

```powershell
npx prisma migrate deploy --schema backend/prisma/schema.prisma
```

4. 记录命令开始时间、结束时间、退出码和原始输出。
5. 查询并保存 `_prisma_migrations`：

```sql
SELECT migration_name, checksum, started_at, finished_at,
       rolled_back_at, applied_steps_count, logs
FROM _prisma_migrations
ORDER BY started_at, migration_name;
```

预期：

- 两个 Migration 均按目录顺序记录。
- `finished_at IS NOT NULL`。
- `rolled_back_at IS NULL`。
- 最终结构为 21 张业务表、202 列、46 个外键、22 个 CHECK。

## 6. 重复部署与结构不变性

本项验证“再次运行 Prisma 部署命令不会重复执行已经应用的 Migration”，不要求直接重复执行原始 SQL。

步骤：

1. 首次部署后生成结构快照 A。
2. 再次执行相同的 `prisma migrate deploy`。
3. 记录输出，预期没有待执行 Migration。
4. 生成结构快照 B。
5. 比较 A/B 的规范化结构摘要。
6. 比较部署前后 `_prisma_migrations` 记录。

结构快照至少包含：

- 表名、引擎、字符集、排序规则。
- 列名、顺序、类型、可空性、默认值、额外属性。
- 索引名、唯一性、列顺序。
- CHECK 名和 `CHECK_CLAUSE`。
- 外键名、列、目标表列、删除/更新规则。
- Migration 名称、checksum 和应用时间。

预期：结构摘要哈希完全一致，Migration 记录不重复、不改变。

任一项变化均判重复部署验证失败。

## 7. 失败恢复方案

目标库：`sanweichawu_b4_failure_<runId>`。

### 7.1 受控失败注入

不修改 Migration 文件。先在该专用空库创建一个与初始 Migration 后段冲突的哨兵对象，例如哨兵表 `orders`。随后执行 `prisma migrate deploy`。

目的：让前面的合法 DDL 已执行，之后命中 `CREATE TABLE orders` 冲突而中途失败，从而观察 MySQL DDL 隐式提交和 Prisma 失败状态。

### 7.2 失败证据

失败后立即保存：

- 完整错误输出和退出码。
- 已创建的业务表清单。
- 未创建的后续表清单。
- 哨兵表现状。
- `_prisma_migrations` 完整记录和 `logs`。
- 失败前后结构快照。
- `prisma migrate status` 输出。

预期：

- 命令以非零状态结束。
- 至少一个 Migration 被记录为失败或未完成。
- 已成功执行的 DDL 仍可能残留，符合 MySQL DDL 隐式提交特性。
- 后续约束 Migration 不应被标记为成功。

### 7.3 禁止的伪恢复

禁止：

- 删除失败 Migration 记录后再次部署并声称恢复成功。
- 手工更新 `_prisma_migrations.finished_at`、`rolled_back_at`。
- 使用 `prisma migrate resolve --applied` 伪造应用成功。
- 使用 `prisma db push` 补齐结构。

### 7.4 恢复验证

保留失败库和全部证据，不原地删除失败记录。

另外创建全新空库 `sanweichawu_b4_recovery_<runId>`，重新执行 `prisma migrate deploy`。确认：

- 两份 Migration 均成功。
- 失败库残留结构不会污染恢复库。
- 恢复库结构与主测试库结构摘要一致。

如果需要原地恢复，必须先由人工审查 MySQL 残留结构并书面确认步骤；不能把删除记录当成通用修复方案。

## 8. 约束验证矩阵

测试使用最小合法数据图，每个负向用例独立事务，执行后回滚；失败后额外核对无部分行残留。错误必须同时断言 SQLSTATE/MySQL 错误码和业务拒绝原因。

### 8.1 22 个 CHECK

| ID | CHECK | 合法基线 | 必须拒绝 |
| --- | --- | --- | --- |
| C01 | `chk_stores_business_day_cutoff_minute` | 0、1439 | -1、1440 |
| C02 | `chk_product_variants_price_fen_nonnegative` | 0 | -1 |
| C03 | `chk_variant_recipes_quantity_positive` | 0.001 | 0、-0.001 |
| C04 | `chk_materials_nonnegative_balances` | `on_hand=10,reserved=0,cost=0` | 任一余额为负；`reserved > on_hand` |
| C05 | `chk_materials_version_positive` | 1 | 0、-1 |
| C06 | `chk_stock_movements_balance` | 非负且 `reserved_after <= on_hand_after` | 任一余额为负；`reserved_after > on_hand_after` |
| C07 | `chk_stock_movements_direction` | 六类合法方向各测一次 | `STOCK_IN` 数量非正、`RESERVE` 数量不为零或预占非正、`RELEASE` 预占非负、`CONSUME` 数量与预占不相等或不均为负、`ADJUST` 数量为零或预占非零 |
| C08 | `chk_stock_movements_cost_nonnegative` | 成本为 NULL 或非负 | 任一成本为负 |
| C09 | `chk_loss_records_values_nonnegative` | `quantity>0` 且成本非负 | 数量为 0；任一成本为负 |
| C10 | `chk_dining_sessions_version_positive` | 1 | 0、-1 |
| C11 | `chk_dining_sessions_closed_fields` | OPEN 无关闭字段；CLOSED 有 `closed_at` | OPEN 带 `closed_at`；CLOSED 缺 `closed_at` |
| C12 | `chk_orders_version_positive` | 1 | 0、-1 |
| C13 | `chk_orders_amounts` | `total = subtotal >= 0` | 任一金额为负；总额不等于小计 |
| C14 | `chk_orders_channel_session` | DINE 有 session；TAKEAWAY 无 session | DINE 无 session；TAKEAWAY 有 session |
| C15 | `chk_order_items_values` | `quantity>0` 且金额公式成立 | 数量为 0；单价为负；行小计不等于单价乘数量 |
| C16 | `chk_order_item_materials_quantities` | 两个数量均非负 | 任一数量为负 |
| C17 | `chk_order_item_materials_cost_pair` | 两成本均为 NULL，或均非负且非 NULL | 仅一个为 NULL；任一成本为负 |
| C18 | `chk_payment_records_target_xor` | session/order 恰好一个非空 | 两者都空；两者都非空 |
| C19 | `chk_payment_records_amount_positive` | `amount_fen > 0` | 0、-1 |
| C20 | `chk_payment_records_void_audit` | ACTIVE 无作废字段；VOIDED 有完整作废字段 | ACTIVE 带任作废字段；VOIDED 缺作废时间、操作人、原因 |
| C21 | `chk_refund_records_amount_positive` | `amount_fen > 0` | 0、-1 |
| C22 | `chk_refund_records_void_audit` | ACTIVE 无作废字段；VOIDED 有完整作废字段 | ACTIVE 带任作废字段；VOIDED 缺作废时间、操作人、原因 |

### 8.2 46 个外键

通过 `information_schema` 动态枚举全部 46 个外键，再由数据驱动测试逐项执行：

- 子表插入不存在父键：必须因外键失败。
- 有子记录时删除父记录：必须因 `ON DELETE RESTRICT` 失败。
- 每次失败后确认没有部分写入。
- 外键目标、列、删除策略、更新策略与结构回读结果一致。

任一外键未覆盖，整体不通过。

### 8.3 唯一约束

8 组冻结主数据复合唯一：

- `categories(store_id,name)`
- `products(store_id,name)`
- `product_variants(product_id,name)`
- `materials(store_id,name)`
- `dining_tables(store_id,code)`
- `variant_option_groups(variant_id,name)`
- `variant_option_values(option_group_id,name)`
- `order_item_options(order_item_id,option_value_id)`

另外覆盖：

- 其余复合唯一约束，包括 VariantRecipe、RecipeModifier、OrderItemMaterial。
- 字段级唯一约束：User.openid、订单号、幂等键、资金记录编号、库存/损耗 dedupeKey、LossRecord.stockMovementId。
- `LossRecord.stockMovementId` 为可空唯一字段，需验证多个 NULL 的 MySQL 语义符合设计预期。

每个唯一约束至少执行一次重复值写入并断言失败。

### 8.4 关键跨字段约束

单独增加四个高优先级用例：

1. PaymentRecord 同时关联 session 和 order：拒绝。
2. PaymentRecord 两者都不关联：拒绝。
3. Order 为 DINE 但 session 为空：拒绝；TAKEAWAY 但 session 非空：拒绝。
4. Material `reserved > on_hand`：拒绝；VariantRecipe 数量为 0 或负数：拒绝。

## 9. information_schema 结构回读

所有查询限定：

```sql
WHERE table_schema = DATABASE()
```

业务表统计排除 `_prisma_migrations`。

### 9.1 表与列

查询 `information_schema.tables`、`information_schema.columns`，核对：

- 21 张业务表。
- 202 个物理列。
- 表引擎、字符集、排序规则。
- 列类型、精度、可空性、默认值。

### 9.2 CHECK

查询 `information_schema.table_constraints` 与 `information_schema.check_constraints`，核对：

- 22 个 CHECK。
- 约束名称和所属表。
- `CHECK_CLAUSE` 实际表达式。
- 与 B3 的规范化表达式逐项对应。

### 9.3 外键

查询 `referential_constraints`、`key_column_usage`、`table_constraints`，核对：

- 46 个外键。
- 源列、目标表、目标列。
- `DELETE_RULE = RESTRICT`。
- `UPDATE_RULE = CASCADE`。

### 9.4 索引

查询 `information_schema.statistics`，核对：

- 21 个唯一索引。
- 24 个普通业务索引。
- 索引列顺序和唯一性。
- 主键和外键支撑索引单独分类，不混入业务普通索引计数。

### 9.5 Migration 历史

查询 `_prisma_migrations`，核对：

- 两份 Migration 名称。
- checksum。
- 开始/完成时间。
- 失败和回滚状态。
- 应用步骤数。
- 日志。

## 10. 证据保存

未来真实执行时，证据保存到：

```text
docs/engineering/phase-1/evidence/p1-02-b4/<runId>/
```

建议文件：

| 文件 | 内容 |
| --- | --- |
| `run-manifest.json` | 时间、Git SHA、Node/Prisma 版本、镜像 digest、运行标识 |
| `environment.txt` | MySQL 版本和关键系统变量原始输出 |
| `migration-01.stdout.log` | 首次部署输出和耗时 |
| `migration-02.stdout.log` | 重复部署输出和耗时 |
| `migration-status.txt` | 首次、重复、失败后的状态输出 |
| `migration-history.json` | `_prisma_migrations` 查询结果 |
| `schema-main-before.json` | 主测试库首次部署后结构快照 |
| `schema-main-after.json` | 主测试库重复部署后结构快照 |
| `schema-diff.txt` | 两次结构快照差异 |
| `schema-failure.json` | 失败库残留结构 |
| `schema-recovery.json` | 恢复库完整结构 |
| `check-cases.csv` | 22 个 CHECK 的用例、SQLSTATE、错误码和结果 |
| `foreign-key-cases.csv` | 46 个外键的行为结果 |
| `unique-cases.csv` | 唯一约束行为结果 |
| `information-schema.json` | 结构回读汇总 |
| `failures.md` | 所有失败项的原始证据和结论 |

证据文件不得包含明文密码或完整连接串。

## 11. 判定规则

只有同时满足以下条件，B4 才能标记通过：

- 真实 MySQL 版本为 8.4.x。
- 空库首次 `prisma migrate deploy` 成功。
- 两份 Migration 按顺序完成并登记。
- 第二次部署不重复执行已应用 Migration，结构摘要不变。
- 失败模拟产生真实失败记录和残留结构证据。
- 恢复库从空库完整部署成功。
- 22 个 CHECK 的实际表达式和拒绝行为通过。
- 46 个外键数量和拒绝行为通过。
- 冻结唯一约束和四个关键跨字段场景通过。
- `information_schema` 回读数量完全一致。
- 所有失败项已记录，没有通过修改 Migration、Schema 或历史记录绕过。

任一条件未满足，B4 保持未通过。

## 12. 风险与恢复

1. Docker Desktop 当前 `AutoStart=false`，机器重启后需要手动启动 Docker Desktop；MySQL 容器设置为 `unless-stopped`，daemon 启动后会恢复。
2. 本机未安装 MySQL 客户端，验证命令应使用容器内 `mysql` 客户端或 Prisma。
3. 官方 8.4 镜像 digest 尚未确定，执行时必须固定并记录。
4. MySQL DDL 会隐式提交，失败迁移可能留下部分表；失败测试必须保留该现场，不能假定自动回滚。
5. 连接凭证若出现在命令历史或日志中，应立即停止并销毁临时实例，重新生成凭证。
6. 任何清理命令都必须先验证目标是本轮唯一测试库或唯一容器/卷。
7. 失败库在证据归档和人工审查前不得删除。
8. 如果 MySQL 8.4 执行暴露 Migration 错误，本轮只记录问题并停止；修复 Migration 需要新的明确授权，不能边测边改。

## 13. 当前阻塞与下一批条件

当前已具备：

- Git 基线与工作区检查。
- Prisma 6.19.0 和 Node.js 22.22.3。
- 两份冻结 Migration 及静态契约检查。
- 安全使用进程级 `DATABASE_URL` 的配置基础。

当前尚未执行：

- 空库首次 `prisma migrate deploy`。
- 重复部署与结构摘要对比。
- 失败恢复模拟。
- 22 个 CHECK、46 个外键和唯一约束的真实行为测试。
- `information_schema` 回读和证据归档。

环境阻塞已经解除。Migration 执行仍需：

1. 执行计划获批。
2. 明确授权下一批开始数据库操作。
3. 继续保持 Schema、Migration 和业务代码不变。

本计划获批前，不执行 Migration。
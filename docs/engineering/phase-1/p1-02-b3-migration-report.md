# P1-02-B3 Migration 生成与静态审查报告

审查基线：`5da0a13`

状态：Migration SQL 已生成并通过静态契约检查；真实 MySQL 8.4 执行未验证。

独立审查修订：在 `2deb8e5` 基础上补齐 `VariantRecipe.quantity > 0`，并将 Migration 检查器升级为核对全部 CHECK 的规范化表达式。

## 1. 本轮范围

本轮只把已冻结的 Prisma Schema 落为 Migration SQL，并建立可重复执行的 SQL 结构检查。

未执行：

- `prisma migrate dev`
- `prisma migrate deploy`
- `prisma db push`
- 任何真实数据库 DDL/DML
- NestJS Controller、Service、Repository 或业务接口开发

未修改：

- `backend/prisma/schema.prisma`
- 现有业务代码
- 依赖版本
- P1-01 已验收工程基线

## 2. Migration 结构

### 2.1 初始结构迁移

文件：`backend/prisma/migrations/20261114120000_initial_schema/migration.sql`

由以下命令从空库方向生成：

```powershell
npx prisma migrate diff `
  --from-empty `
  --to-schema-datamodel backend/prisma/schema.prisma `
  --script
```

内容核对：

| 项目 | 数量/结果 |
| --- | --- |
| 表 | 21 |
| 物理列 | 202 |
| 唯一索引 | 21 |
| 普通索引 | 24 |
| 外键 | 46 |
| 外键删除策略 | 全部 `ON DELETE RESTRICT` |
| 外键更新策略 | Prisma 默认 `ON UPDATE CASCADE` |
| 金额 | `BIGINT`，单位分 |
| 材料数量 | `DECIMAL(18,3)` |
| 单位/总成本 | `DECIMAL(18,6)` |
| 时间 | `DATETIME(3)` |
| 表/列命名 | 小写 snake_case |

用同一 Schema 重新执行 `migrate diff`，生成结果与候选初始 Migration 规范化换行后完全一致。

### 2.2 领域约束迁移

文件：`backend/prisma/migrations/20261114120100_domain_constraints/migration.sql`

该迁移只包含 `ALTER TABLE ... ADD CONSTRAINT ... CHECK`，不包含：

- 表或列删除
- DML
- 触发器
- 生成列
- 优惠分摊结构

共 22 个 CHECK：

1. `chk_stores_business_day_cutoff_minute`
2. `chk_product_variants_price_fen_nonnegative`
3. `chk_variant_recipes_quantity_positive`
4. `chk_materials_nonnegative_balances`
5. `chk_materials_version_positive`
6. `chk_stock_movements_balance`
7. `chk_stock_movements_direction`
8. `chk_stock_movements_cost_nonnegative`
9. `chk_loss_records_values_nonnegative`
10. `chk_dining_sessions_version_positive`
11. `chk_dining_sessions_closed_fields`
12. `chk_orders_version_positive`
13. `chk_orders_amounts`
14. `chk_orders_channel_session`
15. `chk_order_items_values`
16. `chk_order_item_materials_quantities`
17. `chk_order_item_materials_cost_pair`
18. `chk_payment_records_target_xor`
19. `chk_payment_records_amount_positive`
20. `chk_payment_records_void_audit`
21. `chk_refund_records_amount_positive`
22. `chk_refund_records_void_audit`

覆盖范围包括：

- 营业日切点范围。
- 商品规格价格非负。
- 基础配方用量必须大于 0。
- 材料在手、预占、平均成本及版本边界。
- 六类库存流水的数量/预占方向。
- 库存余额及 `reserved <= on_hand`。
- 损耗数量与成本非负。
- 桌单关闭字段一致性。
- 订单版本、金额恒等式和渠道/桌单关联。
- 订单明细数量与金额恒等式。
- 订单材料数量和实际成本成对填写。
- 收款桌单/订单恰好一个归属。
- 收款、退款金额与作废审计字段一致性。

## 3. 静态检查器

文件：`backend/scripts/check-migration-sql.mjs`

检查器以当前 Prisma Schema 和 Migration 目录为输入，核对：

- 21 张表及 202 个物理列。
- Prisma 类型到 MySQL 类型。
- 可空性。
- 21 个唯一索引的列组合。
- 24 个普通索引的列组合。
- 46 个外键的目标列、`ON DELETE RESTRICT` 和 `ON UPDATE CASCADE`。
- 22 个 CHECK 的名称、所在表、数量和规范化表达式。
- Migration 目录集合和 `migration_lock.toml` provider。
- 初始迁移中的破坏性 DDL、DML、触发器或生成列。
- 约束迁移中仅允许 `ALTER TABLE ... ADD CONSTRAINT ... CHECK`。
- 括号和语句结构。
- 11 个变异测试：缺表、错类型、多列、级联删除、缺唯一索引、缺普通索引、触发器、缺 CHECK、篡改 CHECK 表达式、DML、括号不闭合。

执行入口：

```powershell
npm run prisma:check-migrations --workspace @sanweichawu/backend
```

根 `npm run verify` 已接入该检查。

## 4. 实际执行证据

环境：

```text
Node.js v22.22.3
Prisma 6.19.0
Windows x64
```

Prisma 只读验证使用占位连接串，不连接数据库：

```powershell
$env:DATABASE_URL = 'mysql://placeholder:placeholder@127.0.0.1:3306/sanweichawu_schema_validation_only'
npm run prisma:format --workspace @sanweichawu/backend
npm run prisma:validate --workspace @sanweichawu/backend
npm run prisma:check-contract --workspace @sanweichawu/backend
npm run prisma:check-migrations --workspace @sanweichawu/backend
```

结果：

```text
Prisma schema valid
PASS: contract + 17 self-tests (21 models, 202 physical fields, 92 relations, 22 deletions, 8 composite uniques, 46 foreign keys, 17 enums)
PASS: migration SQL contract + 11 self-tests (21 tables, 202 columns, 21 unique indexes, 24 ordinary indexes, 46 foreign keys, 22 checks)
```

Schema format 后 `git diff -- backend/prisma/schema.prisma` 为空。

完整根验证：

```powershell
npm run verify
```

结果：

- ESLint：通过，0 warning。
- Prettier check：通过。
- Schema 字段契约：通过，17 个负向自测。
- Migration SQL 静态契约：通过，10 个负向自测。
- backend、web-admin、mini-program：各 1 个测试文件、1 个测试通过。
- 三个 workspace 构建：通过。
- `npm audit --omit=dev`：0 vulnerabilities。

重新执行：
```powershell
npx prisma migrate diff `
  --from-empty `
  --to-schema-datamodel backend/prisma/schema.prisma `
  --script
```

结果与 `20261114120000_initial_schema/migration.sql` 完全一致。

## 5. 真实 MySQL 8.4 状态

本轮检查时：

```text
docker info: failed to connect to Docker API; daemon is not running
mysql/mysqld/mysqlsh/mariadb/mariadbd: NOT_FOUND
MySQL/MariaDB Windows 服务: 无
```

因此以下事项均标记为“尚未执行 / 未验证”，不能视为通过：

- `generated-mysql-ddl.sql` 等价物已在空库执行。
- `migration.sql` 和约束迁移在 MySQL 8.4 执行。
- `CHECK` 的真实拒绝行为。
- Prisma `migrate deploy` 的迁移登记和第二次执行 no-op。
- MySQL DDL 隐式提交后的失败恢复。
- 21 张表、46 个外键、22 个 CHECK 的 `information_schema` 回读。
- 迁移后的业务边界、事务和并发测试。

这些验证留到 P1-02-B4，并必须在真实 MySQL 8.4 环境执行。

## 6. 已知边界与风险

1. **静态检查不等于 SQL 引擎验证。** 当前只能证明 Migration 文本与已冻结 Schema/预期结构一致，不能证明 MySQL 8.4 已接受全部 DDL。
2. **CHECK 不能表达全部业务约束。** 同笔退款累计上限、库存预占一致性、独立损耗与库存流水的跨表一致、桌单关闭与新订单并发等仍需事务和服务层保证。
3. **MySQL DDL 会隐式提交。** B4 若迁移失败，应删除并重建独立测试库，不沿用半初始化数据库。
4. **首个迁移必须按目录顺序应用。** 初始表、索引和外键完成后，才能应用领域 CHECK。
5. **Prisma 外键默认带 `ON UPDATE CASCADE`。** 已冻结要求是删除使用 `RESTRICT`；更新策略保持 Prisma 默认，并在静态检查中显式核对。

## 7. 文件变更

新增：

- `backend/prisma/migrations/migration_lock.toml`
- `backend/prisma/migrations/20261114120000_initial_schema/migration.sql`
- `backend/prisma/migrations/20261114120100_domain_constraints/migration.sql`
- `backend/scripts/check-migration-sql.mjs`
- `docs/engineering/phase-1/p1-02-b3-migration-report.md`

修改：

- `backend/package.json`：增加 `prisma:check-migrations`。
- `package.json`：将 Migration 静态检查接入根 `verify`。
- `README.md`：更新当前阶段状态与验证入口。
- `docs/engineering/phase-1/README.md`：更新当前进度和权威依据。
- `docs/engineering/phase-1/04-mysql-verification-plan.md`：标注历史方案范围，避免旧字段和旧约束口径被误用。

没有新增依赖，没有数据库连接，没有 Schema 或业务代码变更。
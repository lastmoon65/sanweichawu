# P1-02-B4 MySQL 8.4 兼容性修复报告

实施基线：`a5641f29e8338a8b339f450ea3e195836c5c1cf9`

实施日期：2026-11-14

状态：第一轮兼容性修复已由后续真实 MySQL 实验修正。

> 更新说明（2026-11-15）：第一轮实现把 DROP/ADD 放在同一条 ALTER TABLE，真实 MySQL 8.4 返回 1826。当前生效实现已改为每个外键独立 DROP、独立 ADD，详见 `p1-02-b4-fk-rebuild-compatibility-report.md`。

## 1. 修改范围

本批只修改：

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20261114120100_domain_constraints/migration.sql`
- `backend/scripts/check-schema.mjs`
- `backend/scripts/check-migration-sql.mjs`
- B4 执行和修复文档

未修改：

- `backend/prisma/migrations/20261114120000_initial_schema/migration.sql`
- P1-01 已关闭内容
- P1-02-A 字段契约
- 业务代码
- 依赖

## 2. Schema 修改结果

仅以下 6 个关系增加 `onUpdate: Restrict`：

| 模型 | 关系字段 | onDelete | onUpdate |
| --- | --- | --- | --- |
| `DiningSession` | `closedBy` | `Restrict` | `Restrict` |
| `Order` | `session` | `Restrict` | `Restrict` |
| `PaymentRecord` | `session` | `Restrict` | `Restrict` |
| `PaymentRecord` | `order` | `Restrict` | `Restrict` |
| `PaymentRecord` | `voidedByStaff` | `Restrict` | `Restrict` |
| `RefundRecord` | `voidedByStaff` | `Restrict` | `Restrict` |

其他 40 个关系未增加 `onUpdate` 属性，继续使用 Prisma 默认 `Cascade`。

最终静态语义：

```text
46 foreign keys
46 onDelete Restrict
6 onUpdate Restrict
40 onUpdate Cascade
```

## 3. Migration 修改结果

文件：

`backend/prisma/migrations/20261114120100_domain_constraints/migration.sql`

在全部 22 个 CHECK 之前增加 6 个兼容性外键调整：

| 外键 | 表 | 列 | 目标 |
| --- | --- | --- | --- |
| `dining_sessions_closed_by_staff_id_fkey` | `dining_sessions` | `closed_by_staff_id` | `staff.id` |
| `orders_session_id_fkey` | `orders` | `session_id` | `dining_sessions.id` |
| `payment_records_session_id_fkey` | `payment_records` | `session_id` | `dining_sessions.id` |
| `payment_records_order_id_fkey` | `payment_records` | `order_id` | `orders.id` |
| `payment_records_voided_by_staff_id_fkey` | `payment_records` | `voided_by_staff_id` | `staff.id` |
| `refund_records_voided_by_staff_id_fkey` | `refund_records` | `voided_by_staff_id` | `staff.id` |

每个外键使用单条 `ALTER TABLE` 完成：

```sql
ALTER TABLE child
  DROP FOREIGN KEY fk_name,
  ADD CONSTRAINT fk_name
    FOREIGN KEY (column_name) REFERENCES target(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;
```

要求均满足：

- 外键名称不变。
- 源字段不变。
- 引用目标不变。
- `ON DELETE RESTRICT` 不变。
- 只有指定 6 个外键使用 `ON UPDATE RESTRICT`。
- 其余 40 个外键继续由初始 Migration 创建为 `ON UPDATE CASCADE`。
- 22 个 CHECK 的名称、表达式和顺序未改变。

## 4. 初始 Migration 不变

文件：

`backend/prisma/migrations/20261114120000_initial_schema/migration.sql`

修改前后 SHA-256：

```text
AD2274E7A964EA753661B8C037C486F4B4A1855C0DFE74ECB9613CF0190CE19B
```

结果：完全一致。

Git 也确认该文件没有 diff。

因此：

- 初始 Migration 的已成功记录可以保留。
- 初始 Migration checksum 不变。
- 其余 40 个外键仍按初始 Migration 创建为 Cascade。
- 6 个兼容性外键调整由后续尚未成功的领域约束 Migration 完成。

## 5. 检查脚本修改

### 5.1 `check-schema.mjs`

新增：

- 解析每条关系的显式 `onUpdate`。
- 固定 6 个受影响关系必须为 `Restrict`。
- 其他关系按 Prisma 默认值计算为 `Cascade`，若显式改成其他动作则失败。
- 所有关系的 `onDelete` 继续必须为 `Restrict`。

新增 3 个负向测试：

1. 受影响关系缺少 `onUpdate: Restrict`。
2. 受影响关系写成 `Cascade`。
3. 非受影响关系被误改成 `Restrict`。

当前自测数量：20。

### 5.2 `check-migration-sql.mjs`

新增：

- 初始 Migration 的 46 个外键继续全部要求 `ON UPDATE CASCADE`。
- domain constraints 中必须恰好存在 6 个指定外键更新。
- 每个改写必须保留名称、源列、目标表、目标列和 `ON DELETE RESTRICT`。
- 6 个外键的更新动作必须为 `RESTRICT`。
- 外键更新必须位于所有 CHECK 之前。
- 计算初始 46 个外键叠加 6 次覆盖后的最终状态。
- 最终必须为 6 个 `RESTRICT`、40 个 `CASCADE`。
- 最终 46 个外键的删除动作必须全部为 `RESTRICT`。
- 最终外键状态必须与更新后的 Prisma Schema 一致。
- 约束迁移只允许 CHECK 和指定外键更新，不允许 DML、触发器、生成列、表/列/索引删除。

新增负向测试：

1. 遗漏一个外键 Restrict 调整。
2. 错误增加第 7 个外键调整。
3. 外键调整误改 `onDelete`。
4. 外键调整误改引用目标。
5. 删除原 CHECK。
6. 篡改 CHECK 表达式。

其中“删除原 CHECK”和“篡改 CHECK 表达式”沿用已有的严格断言，并在当前 15 个迁移负向测试中继续执行。

## 6. 失败测试库恢复设计

本批不在失败库执行恢复，也不重新部署 Migration。

失败库：

```text
sanweichawu_b4_main_20261114t152855z
```

### 6.1 当前失败现场

- 初始 Migration 成功。
- 领域约束 Migration 失败。
- 业务表 21 个。
- 外键 46 个。
- 已创建 CHECK 10 个。
- 失败迁移记录保留，未伪造成功。

### 6.2 清理失败的 10 个 CHECK

仅清理：

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

每个使用精确表名和约束名执行 `ALTER TABLE ... DROP CHECK ...`。

不得删除：

- 表。
- 外键。
- 初始 Migration 成功记录。
- 失败 Migration 记录和日志。

清理后验证：

```text
business_tables=21
foreign_keys=46
checks=0
```

### 6.3 检查六个外键是否部分调整

由于新 Migration 尚未在失败库重试，当前预期 6 个外键仍全部为 `ON UPDATE CASCADE`。

重试前必须逐项查询：

```sql
SELECT constraint_name, table_name, referenced_table_name,
       update_rule, delete_rule
FROM information_schema.referential_constraints
WHERE constraint_schema = DATABASE()
  AND constraint_name IN (...);
```

如果前一次修复尝试在某个外键之后中断，可能出现：

- 部分外键已经是 `RESTRICT`。
- 某些外键仍是 `CASCADE`。
- 单个 `ALTER TABLE` 内 DROP 与 ADD 应作为原子操作，不应出现“同一名称删掉但未重建”的正常结果。

恢复策略：

1. 如果外键存在，无论是 Cascade 还是 Restrict，都保留。
2. 重试时修改后的 Migration 会按名称先 DROP 再 ADD，不会产生重复外键。
3. 如果检测到某个指定外键缺失，先停止自动重试，记录现场。
4. 人工修复时只能按批准的名称、列、目标和策略补回该外键，不得修改其他外键。
5. 如果发现第 7 个外键被改写，停止恢复并重新审查。

### 6.4 处理失败 Migration 状态

CHECK 清理完成且 6 个外键状态确认后执行：

```powershell
npx prisma migrate resolve `
  --rolled-back "20261114120100_domain_constraints" `
  --schema backend/prisma/schema.prisma
```

该命令只标记失败尝试已回滚，不删除历史。

禁止：

- 删除 `_prisma_migrations` 行。
- 手工改 `finished_at` 或 `rolled_back_at`。
- 使用 `migrate resolve --applied`。
- 使用 `prisma db push`。

### 6.5 避免重复 DROP/ADD

修改后的每个兼容性语句都是：

```sql
DROP FOREIGN KEY 同名字外键,
ADD CONSTRAINT 同名字外键 ...
```

在重试时：

- 外键存在：DROP 成功后立即 ADD，不会重复。
- 外键已为 Restrict：仍可 DROP 后再 ADD，结果幂等。
- 外键缺失：不直接重跑，先按恢复策略确认并补回。
- 不单独执行 ADD 后再重复执行 Migration，避免重复执行造成人工与迁移双重操作。

### 6.6 重新执行

状态处理完成后：

```powershell
npx prisma migrate deploy --schema backend/prisma/schema.prisma
```

验收：

- 6 个外键调整成功。
- 22 个 CHECK 全部成功。
- 初始 Migration 无新记录、checksum 不变。
- 原失败记录保留且 `rolled_back_at` 非空。
- 新成功尝试的 `finished_at` 非空。
- 最终 46 个外键为 6 Restrict / 40 Cascade。

## 7. 本批验证结果

执行命令：

```powershell
npm run prisma:format --workspace @sanweichawu/backend
# 将 DATABASE_URL 设置为仅供 schema 语法校验的普通占位值，不连接数据库
$env:DATABASE_URL = '<schema-validation-placeholder>'
npm run prisma:validate --workspace @sanweichawu/backend
npm run prisma:check-contract --workspace @sanweichawu/backend
npm run prisma:check-migrations --workspace @sanweichawu/backend
npm run verify
```

结果：

```text
Prisma schema valid
PASS: contract + 20 self-tests
      21 models, 202 physical fields, 92 relations, 22 deletions,
      8 composite uniques, 46 foreign keys,
      6 Restrict updates, 40 Cascade updates, 17 enums

PASS: migration SQL contract + 15 self-tests
      21 tables, 202 columns, 21 unique indexes, 24 ordinary indexes,
      46 initial foreign keys, 6 update overrides,
      6 Restrict updates, 40 Cascade updates, 22 checks
```

完整根验证：

```text
ESLint: PASS
Prettier check: PASS
Schema contract + 20 self-tests: PASS
Migration SQL contract + 15 self-tests: PASS
backend/web-admin/mini-program tests: PASS
backend/web-admin/mini-program builds: PASS
npm audit --omit=dev: 0 vulnerabilities
```

## 8. 当前状态

- Schema 兼容性修复：完成。
- 领域约束 Migration 修复：完成。
- 静态检查脚本修复：完成。
- 初始 Migration：未修改，SHA-256 不变。
- 真实失败库恢复：未执行。
- 修复后 Migration 重部署：未执行。
- 真实 MySQL 行为复验：等待下一轮授权。
- Git：未提交。
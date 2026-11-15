# P1-02-B4 MySQL 8.4 同名外键重建兼容性修复报告

实施日期：2026-11-15

实验 MySQL：`8.4.13 Community Server - GPL`

独立实验库：`sanweichawu_b4_fk_rebuild_split_20261115`

结论：拆分后的 6 组 DROP/ADD 在独立 MySQL 8.4 环境中全部成功；Migration 静态检查与全仓验证通过。正式失败库在本批中没有执行任何 DDL。

## 1. 实验目标

复现并解决：

```text
ERROR 1826 (HY000)
Duplicate foreign key constraint name
```

问题来源：同一条 `ALTER TABLE` 中先 DROP 再 ADD 同名外键，MySQL 8.4 在检查新约束名称时仍认为旧名称被占用。

## 2. 独立实验库

实验库：

```text
sanweichawu_b4_fk_rebuild_split_20261115
```

创建顺序：

1. 创建 `staff`、`dining_sessions`、`orders`、`payment_records`、`refund_records` 临时表。
2. 创建与生产设计相同的 6 个外键名称、源字段、目标表和目标字段。
3. 初始 6 个外键均为 `ON DELETE RESTRICT ON UPDATE CASCADE`。

证据：

- `foreign-keys-before.json`

## 3. 六组拆分 DROP/ADD 实验结果

每组均执行：

```sql
ALTER TABLE `table` DROP FOREIGN KEY `fk_name`;

ALTER TABLE `table`
  ADD CONSTRAINT `fk_name`
  FOREIGN KEY (`column`) REFERENCES `target`(`id`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
```

结果：

| 外键 | DROP | ADD | 最终 ON DELETE | 最终 ON UPDATE |
| --- | --- | --- | --- | --- |
| `dining_sessions_closed_by_staff_id_fkey` | 成功 | 成功 | RESTRICT | RESTRICT |
| `orders_session_id_fkey` | 成功 | 成功 | RESTRICT | RESTRICT |
| `payment_records_session_id_fkey` | 成功 | 成功 | RESTRICT | RESTRICT |
| `payment_records_order_id_fkey` | 成功 | 成功 | RESTRICT | RESTRICT |
| `payment_records_voided_by_staff_id_fkey` | 成功 | 成功 | RESTRICT | RESTRICT |
| `refund_records_voided_by_staff_id_fkey` | 成功 | 成功 | RESTRICT | RESTRICT |

汇总：

```text
6 / 6 DROP 成功
6 / 6 ADD 成功
6 / 6 最终为 ON DELETE RESTRICT + ON UPDATE RESTRICT
```

证据：

- `split-rebuild.log`
- `foreign-keys-after.json`

## 4. ADD 失败状态实验

额外创建 `failure_probe` 表和外键 `fk_failure_probe`：

1. 单独 DROP 成功。
2. 单独 ADD 引用不存在的 `missing_parent_table`。
3. ADD 按预期失败：`ERROR 1824`。
4. 回读结果：

```text
FK_COUNT=0
TABLE_EXISTS=1
```

结论：独立 DROP 会保留表，但外键在 ADD 成功前处于缺失状态。因此后续重试前必须逐个确认六组外键是否完整；任何外键缺失都必须先停止自动恢复。

证据：

- `failure-state.txt`

## 5. 领域约束 Migration 修改

只修改：

`backend/prisma/migrations/20261114120100_domain_constraints/migration.sql`

兼容性部分从 6 条组合 ALTER 改为 12 条独立 ALTER：

- 6 条 `DROP FOREIGN KEY`
- 6 条 `ADD CONSTRAINT`
- 每组 DROP 紧邻对应 ADD
- 全部位于 22 个 CHECK 之前
- 外键名称、字段、引用目标不变
- `ON DELETE RESTRICT` 不变
- 6 个目标外键为 `ON UPDATE RESTRICT`
- 其余 40 个外键仍由初始 Migration 创建为 `ON UPDATE CASCADE`
- 22 个 CHECK 的名称、表达式和顺序未改变

## 6. Migration 检查器修改

文件：`backend/scripts/check-migration-sql.mjs`

新增校验：

- 初始 Migration 仍是 46 个 Cascade 外键。
- 领域约束 Migration 必须恰好包含 6 个 DROP。
- 必须恰好包含 6 个 ADD。
- 每个指定外键必须各有一个 DROP 和一个 ADD。
- DROP 必须位于对应 ADD 之前。
- 所有 DROP/ADD 必须位于任何 CHECK 之前。
- ADD 的名称、表、字段、引用表、引用字段必须正确。
- ADD 必须为 `ON DELETE RESTRICT ON UPDATE RESTRICT`。
- 不允许指定列表之外的第 7 个外键被修改。
- 初始 46 个外键叠加 6 次重建后，必须是 6 Restrict / 40 Cascade。
- 最终状态必须和 Prisma Schema 一致。
- 22 个 CHECK 的名称、所属表和表达式保持不变。

负向测试增加到 18 个，其中新增覆盖：

- 漏掉一个 DROP。
- 漏掉一个 ADD。
- ADD 位于 DROP 之前。
- 修改第 7 个外键。
- ADD 使用错误字段。
- ADD 使用错误引用目标。
- ADD 误改 `ON DELETE`。
- 删除原 CHECK。
- 篡改 CHECK 表达式。

## 7. 22 个 CHECK

未修改任何 CHECK：

- 22 个名称保持不变。
- 22 个所属表保持不变。
- 22 个表达式保持不变。
- 静态检查按规范化表达式逐项核对通过。

## 8. 初始 Migration

文件未修改。

SHA-256：

```text
AD2274E7A964EA753661B8C037C486F4B4A1855C0DFE74ECB9613CF0190CE19B
```

## 9. 验证结果

```text
Prisma format: PASS
Prisma validate: PASS
Schema contract: PASS (20 self-tests)
Migration SQL contract: PASS (18 self-tests)
ESLint: PASS
Prettier: PASS
backend tests: PASS
web-admin tests: PASS
mini-program tests: PASS
backend build: PASS
web-admin build: PASS
mini-program build: PASS
npm audit --omit=dev: 0 vulnerabilities
npm run verify: PASS
```

Migration 检查摘要：

```text
21 tables
202 columns
21 unique indexes
24 ordinary indexes
46 initial foreign keys
6 FK drops
6 FK adds
6 Restrict updates
40 Cascade updates
22 checks
```

## 10. 正式失败库状态

本批没有向正式失败库执行任何 DDL、`migrate resolve` 或 `migrate deploy`。

实验结束后只读核对：

```json
{"checks": 0, "tables": 21, "columns": 202, "foreignKeys": 46, "cascadeUpdates": 46, "restrictUpdates": 0, "migrationRecords": 3}
```

正式失败库仍保持上一批 deploy 失败后的状态。

证据：

- `formal-db-unchanged-after-experiment.json`

## 11. 证据目录

`docs/engineering/phase-1/evidence/p1-02-b4/fk-rebuild-split-20261115/`

包含：

- `foreign-keys-before.json`
- `foreign-keys-after.json`
- `split-rebuild.log`
- `failure-state.txt`
- `formal-db-unchanged-after-experiment.json`

## 12. 本批边界

未执行：

- 正式失败库 DDL。
- `migrate resolve`。
- `migrate deploy`。
- 数据库删除。
- MODEL/字段/业务数据修改。
- Git 提交。

当前停止，等待下一轮审核和正式库恢复授权。
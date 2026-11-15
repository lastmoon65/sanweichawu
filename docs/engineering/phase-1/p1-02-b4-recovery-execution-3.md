# P1-02-B4 第三次恢复与真实 MySQL 部署记录

执行日期：2026-11-15（Asia/Shanghai）

运行标识：`recovery3-20261115T102149Z`

目标数据库：`sanweichawu_b4_main_20261114t152855z`

MySQL：`8.4.13 Community Server - GPL`

结论：**本批部署与数据库结构验收通过。**

## 1. 执行前检查

全部条件通过：

- 当前数据库名称正确。
- MySQL 版本 8.4.13。
- 业务表 21 张。
- 物理字段 202 个。
- 外键 46 个，全部 `ON DELETE RESTRICT`、`ON UPDATE CASCADE`。
- CHECK 为 0。
- 六个目标外键全部存在且仍为 Cascade。
- initial_schema 成功且 checksum 不变。
- 两条旧 domain_constraints 中，一条已 rolled back，另一条为唯一 active failed。
- initial_schema 文件 SHA-256：`AD2274E7A964EA753661B8C037C486F4B4A1855C0DFE74ECB9613CF0190CE19B`。
- domain_constraints 文件 SHA-256：`A8E247D1F2555AC2A1FD505369BEC1532EDEA6CA44847E446AF3D4BF426F4949`。
- `prisma migrate status` 退出码为 1，符合恢复前预期。

证据：

- `precheck.json`
- `precheck-migrate-status.log`

## 2. 恢复 Migration 状态

执行：

```powershell
npx prisma migrate resolve --rolled-back "20261114120100_domain_constraints" --schema backend/prisma/schema.prisma
```

结果：

```text
EXIT=0
DURATION_MS=2641
Migration 20261114120100_domain_constraints marked as rolled back.
```

Resolve 后只读验证：

- Migration 记录仍为 3 条。
- initial_schema 仍成功，checksum 不变。
- 两条旧 domain_constraints 均已 rolled back。
- active failed 数量为 0。
- 外键仍为 46 个 Cascade。
- CHECK 仍为 0。

证据：

- `migrate-resolve.log`
- `migration-history-after-resolve.json`
- `post-resolve-state.json`

## 3. 重新部署

执行：

```powershell
npx prisma migrate deploy --schema backend/prisma/schema.prisma
```

结果：

```text
EXIT=0
DURATION_MS=7899
Applying migration 20261114120100_domain_constraints
All migrations have been successfully applied.
```

实际效果：

- initial_schema 被跳过。
- 6 组独立 DROP / ADD 成功执行。
- 6 个目标外键改为 `ON DELETE RESTRICT ON UPDATE RESTRICT`。
- 22 个 CHECK 全部创建。
- 新增一条成功的 domain_constraints 执行记录。

证据：

- `migration-deploy.log`

## 4. 最终结构与约束验收

### 表、字段和索引

```text
业务表：21
物理字段：202
唯一索引：21
显式业务普通索引：24
MySQL 自动外键支撑普通索引：13
普通索引总数：37
```

24 个显式业务索引全部匹配；13 个额外普通索引全部是为外键提供的支撑索引。

证据：

- `final-indexes.json`
- `final-index-validation.json`

### 外键

```text
总数：46
ON DELETE RESTRICT：46
ON UPDATE RESTRICT：6
ON UPDATE CASCADE：40
定义差异：0
```

六个目标外键：

| 外键 | 表 | 字段 | 目标 | ON DELETE | ON UPDATE |
| --- | --- | --- | --- | --- | --- |
| `dining_sessions_closed_by_staff_id_fkey` | `dining_sessions` | `closed_by_staff_id` | `staff.id` | RESTRICT | RESTRICT |
| `orders_session_id_fkey` | `orders` | `session_id` | `dining_sessions.id` | RESTRICT | RESTRICT |
| `payment_records_session_id_fkey` | `payment_records` | `session_id` | `dining_sessions.id` | RESTRICT | RESTRICT |
| `payment_records_order_id_fkey` | `payment_records` | `order_id` | `orders.id` | RESTRICT | RESTRICT |
| `payment_records_voided_by_staff_id_fkey` | `payment_records` | `voided_by_staff_id` | `staff.id` | RESTRICT | RESTRICT |
| `refund_records_voided_by_staff_id_fkey` | `refund_records` | `voided_by_staff_id` | `staff.id` | RESTRICT | RESTRICT |

完整 46 个外键清单：

- `final-foreign-keys.json`

### CHECK

```text
总数：22
名称差异：0
所属表差异：0
规范化表达式差异：0
```

22 个 CHECK 的完整名称、所属表和实际 MySQL `CHECK_CLAUSE`：

- `final-check-constraints.json`

### Migration 历史

最终共有 4 条记录：

1. 第一次 domain_constraints 失败记录：已 rolled back。
2. initial_schema：成功，checksum 未变。
3. 第二次 domain_constraints 失败记录：已 rolled back。
4. 第三次 domain_constraints：成功，checksum 为当前文件 checksum。

最终状态：

```text
initial_schema 成功记录：1
domain_constraints 已回滚记录：2
domain_constraints 成功记录：1
active failed：0
```

完整记录：

- `final-migration-history.json`

### Prisma 状态

```text
Database schema is up to date!
exitCode=0
```

证据：

- `final-migrate-status.log`

## 5. 最终汇总

```json
{
  "tables": 21,
  "columns": 202,
  "uniqueIndexes": 21,
  "ordinaryIndexes": 37,
  "foreignKeys": 46,
  "deleteRestrict": 46,
  "updateRestrict": 6,
  "updateCascade": 40,
  "checks": 22,
  "fkDiffs": 0,
  "checkDiffs": 0,
  "migrationRecords": 4,
  "initialRows": 1,
  "initialFinished": true,
  "initialChecksumMatches": true,
  "domainRows": 3,
  "domainRolledBack": 2,
  "domainSuccessful": 1,
  "activeFailed": 0,
  "latestDomainChecksumMatches": true,
  "statusExit": 0
}
```

证据：

- `final-validation.json`
- `final-schema-snapshot.json`

完整结构快照 SHA-256：

```text
0E7A70CD58C6473828F30604E8B89E9D4E80CF07A134E260941A84F7713324C9
```

## 6. 本批边界

本批没有：

- 修改 Schema。
- 修改 Migration。
- 修改检查脚本。
- 修改业务代码。
- 执行 `prisma db push`。
- 删除 Migration 历史。
- 提交 Git。

数据库凭证和完整连接串未写入任何报告或证据文件。

当前停止，等待独立审查。
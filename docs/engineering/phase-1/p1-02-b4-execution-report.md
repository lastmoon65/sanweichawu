# P1-02-B4 真实 MySQL 8.4 执行报告

执行日期：2026-11-14（Asia/Shanghai）

实现基线：`a5641f29e8338a8b339f450ea3e195836c5c1cf9`

运行标识：`20261114T152855Z`

结论：**首次验证未通过，第二个 Migration 在第 11 个 CHECK 处停止。**

最终状态：第五次兼容性修订通过独立 MySQL 验证；第六批已成功执行 `migrate resolve --rolled-back` 和 `migrate deploy`。最终数据库结构、46 个外键、22 个 CHECK 和 Migration 状态均通过只读验收。详见 `p1-02-b4-recovery-execution-3.md`。

## 1. 环境

| 项目 | 实际值 |
| --- | --- |
| Docker Desktop | `4.99.0` |
| Docker CLI / Server | `29.9.3` / `29.9.3` |
| Docker Desktop 安装目录 | D 盘 Docker Desktop 安装目录 |
| WSL 数据根 | D 盘 Docker Desktop WSL 数据目录 |
| MySQL | `8.4.13 MySQL Community Server - GPL` |
| MySQL 镜像 | `mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902` |
| 容器 | `sanweichawu-b4-mysql` |
| 数据卷 | `sanweichawu-b4-mysql-data` |
| 端口 | `127.0.0.1:33316` |
| 字符集 / 排序规则 | `utf8mb4` / `utf8mb4_unicode_ci` |
| 时区 | UTC |
| 隔离级别 | `REPEATABLE-READ` |
| Prisma | `6.19.0` |
| Node.js | `22.22.3` |

本机未安装 MySQL 客户端；验证使用 MySQL 容器内客户端和 Host 上的 Prisma。

## 2. 测试数据库

本轮创建：

- 主测试库：`sanweichawu_b4_main_20261114t152855z`
- 失败恢复库：`sanweichawu_b4_failure_20261114t152855z`
- 恢复验证库：`sanweichawu_b4_recovery_20261114t152855z`
- 隔离复现库：`sanweichawu_b4_scratch_20261114t152855z`

所有库均独立创建，不触碰已有业务数据库。

## 3. 首次部署

执行命令：

```powershell
npx prisma migrate deploy --schema backend/prisma/schema.prisma
```

执行结果：

```text
exitCode=1
durationMs=17432
```

Migration 顺序：

1. `20261114120000_initial_schema`：成功。
2. `20261114120100_domain_constraints`：失败。

失败详情：

```text
Error: P3018
Migration name: 20261114120100_domain_constraints
Database error code: 3823
Column 'closed_by_staff_id' cannot be used in a check constraint
'chk_dining_sessions_closed_fields': needed in a foreign key constraint
'dining_sessions_closed_by_staff_id_fkey' referential action.
Please check the query number 11 from the migration file.
```

对应迁移 SQL：

```sql
ALTER TABLE `dining_sessions`
  ADD CONSTRAINT `chk_dining_sessions_closed_fields`
  CHECK (
    (`status` = 'OPEN' AND `closed_at` IS NULL AND `closed_by_staff_id` IS NULL)
    OR (`status` = 'CLOSED' AND `closed_at` IS NOT NULL)
  );
```

对应现有外键：

```sql
CONSTRAINT `dining_sessions_closed_by_staff_id_fkey`
  FOREIGN KEY (`closed_by_staff_id`)
  REFERENCES `staff` (`id`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE
```

## 4. 失败后的实际数据库状态

MySQL DDL 隐式提交，失败未自动回滚全部结构。

实际回读：

```text
BUSINESS_TABLES=21
TOTAL_TABLES=22（包含 _prisma_migrations）
FOREIGN_KEYS=46
CHECKS=10
```

Migration 历史：

```text
20261114120000_initial_schema     finished_at=2026-11-14 15:29:12.212
20261114120100_domain_constraints finished_at=NULL, applied_steps_count=0, logs=P3018/3823
```

`prisma migrate status` 退出码为 `1`，明确将第二个 Migration 标记为 failed。

现场保留，没有删除失败记录、没有修改 `_prisma_migrations`、没有伪造应用状态。

## 5. 原因验证

在独立的 `sanweichawu_b4_scratch_20261114t152855z` 数据库中建立两个相同结构的外键做对照：

| 外键更新策略 | 对 FK 列添加 CHECK | 结果 |
| --- | --- | --- |
| `ON UPDATE CASCADE` | `CHECK (status='OPEN' AND parent_id IS NULL)` | 失败，MySQL 3823 |
| `ON UPDATE RESTRICT` | 同一 CHECK | 成功 |

复现输出：

```text
ON_UPDATE_CASCADE_CHECK_EXIT=1
ERROR 3823 (HY000): Column 'parent_id' cannot be used in a check constraint
'chk_cascade': needed in a foreign key constraint 'fk_cascade' referential action.

ON_UPDATE_RESTRICT_CHECK_EXIT=0
```

结论：问题不是 SQL 文本格式，而是 MySQL 8.4 对“同时参与 CHECK 和外键更新动作的列”的真实限制。当前 Prisma 默认生成的 `ON UPDATE CASCADE` 与该冻结 CHECK 不兼容。

## 6. 影响

- 初始 Schema 的 21 张表和 46 个外键可以在 MySQL 8.4 成功创建。
- 第二个 Migration 无法完整执行。
- 22 个 CHECK 中仅前 10 个成功创建。
- 因此 22 个 CHECK、重复部署、失败恢复、46 个外键行为测试和最终结构回读均不能继续视为通过。
- B4 当前不能标记通过。

## 7. 初始失败的修复方向

首次失败后完成了全量 CHECK/FK 交叉分析，确认受影响的不是单一外键，而是 6 个外键字段：

- `dining_sessions.closed_by_staff_id`
- `orders.session_id`
- `payment_records.session_id`
- `payment_records.order_id`
- `payment_records.voided_by_staff_id`
- `refund_records.voided_by_staff_id`

审核通过的修复方向是：保留全部 CHECK，仅将这 6 个外键的更新动作改为 `ON UPDATE RESTRICT`，删除动作继续 `RESTRICT`。

详见 `p1-02-b4-compatibility-fix-report.md`。

## 8. 后续处理状态

- Schema 和领域约束 Migration 的兼容性修复已实施。
- 检查脚本已同步增加外键更新策略验证和负向测试。
- 初始 Migration 未修改，SHA-256 保持不变。
- 失败测试库恢复未执行。
- 修复后的 Migration 未重新部署。

## 9. 证据目录

`docs/engineering/phase-1/evidence/p1-02-b4/20261114T152855Z/`

包含：

- `run-manifest.json`
- `initial-empty-state.txt`
- `migration-01.stdout.log`
- `migration-01.timing.txt`
- `migration-status-after-failure.txt`
- `migration-history-after-failure.txt`
- `schema-counts-after-failure.txt`
- `checks-after-failure.tsv`
- `dining-sessions-after-failure.txt`
- `referential-action-reproduction.txt`
- `fk-check-overlap.json`
- `six-fk-3823-matrix.csv`

## 10. 当前状态

- B4 真实 MySQL 部署：成功。
- 业务表：21。
- 物理字段：202。
- 外键：46，删除策略全部 RESTRICT。
- 外键更新策略：6 RESTRICT、40 CASCADE。
- CHECK：22。
- Migration：initial_schema 成功；两条旧 domain 失败记录已 rolled back；新 domain 记录成功；active failed 为 0。
- `prisma migrate status`：退出码 0，Database schema is up to date。
- 最终结构快照及命令日志：`docs/engineering/phase-1/evidence/p1-02-b4/recovery3-20261115T102149Z/`。
- 本批没有修改 Schema、Migration SQL、检查脚本或业务代码。
- Git：未提交。
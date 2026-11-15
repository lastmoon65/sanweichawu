# P1-02-B4 失败库恢复执行记录

执行日期：2026-11-15（Asia/Shanghai）

运行标识：`recovery-20261115T034638Z`

目标数据库：`sanweichawu_b4_main_20261114t152855z`

MySQL：`8.4.13 Community Server - GPL`

结论：**恢复流程在重新部署阶段失败，B4 尚未通过。已按授权停止，没有自动重试或修复。**

## 1. 执行前预检

执行前重新读取数据库，所有条件通过：

- 当前数据库名称一致。
- MySQL 版本为 8.4.13。
- 21 张业务表完整且表名集合一致。
- 46 个外键存在，全部 `ON DELETE RESTRICT`、`ON UPDATE CASCADE`。
- CHECK 恰好为预期 10 个，名称集合一致。
- `_prisma_migrations` 只有两条记录。
- initial_schema 已成功。
- domain_constraints 为 failed，`finished_at` 和 `rolled_back_at` 均为空。
- initial_schema 数据库 checksum 与文件一致。

预检证据：

- `precheck.txt`
- `precheck.json`

## 2. 清理 10 个 CHECK

按准确表名和约束名逐条执行 `ALTER TABLE ... DROP CHECK ...`，全部成功。

清理后实际结果：

```text
businessTables=21
foreignKeys=46
checkCount=0
cascadeUpdates=46
restrictUpdates=0
nonRestrictDeletes=0
```

Migration 历史仍为：

- initial_schema 成功。
- domain_constraints 失败，尚未 rolled back。

证据：

- `check-drop.log`
- `post-check-cleanup.json`
- `migration-history-before-resolve.json`

## 3. 恢复 Migration 状态

执行：

```powershell
npx prisma migrate resolve --rolled-back "20261114120100_domain_constraints" --schema backend/prisma/schema.prisma
```

结果：

```text
exitCode=0
Migration 20261114120100_domain_constraints marked as rolled back.
```

只读核对：

- 初始 Migration 仍成功。
- 初始 checksum 未改变。
- 原失败记录的 `rolled_back_at` 已写入。
- 没有伪造成功记录。
- 当时仍只有两条 Migration 记录。

证据：

- `migrate-resolve.log`
- `migration-history-after-resolve.json`

## 4. 重新部署

执行：

```powershell
npx prisma migrate deploy --schema backend/prisma/schema.prisma
```

结果：

```text
exitCode=1
Database error code: 1826
Database error:
Duplicate foreign key constraint name
'dining_sessions_closed_by_staff_id_fkey'
Please check the query number 1 from the migration file.
```

失败发生在领域约束 Migration 的第 1 条兼容性语句：

```sql
ALTER TABLE `dining_sessions`
  DROP FOREIGN KEY `dining_sessions_closed_by_staff_id_fkey`,
  ADD CONSTRAINT `dining_sessions_closed_by_staff_id_fkey`
    FOREIGN KEY (`closed_by_staff_id`) REFERENCES `staff`(`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;
```

MySQL 8.4 在同一个 `ALTER TABLE` 语句中处理 DROP 与 ADD 时，不会把待删除的外键名称提前释放，因此同名 ADD 被判定为重复。

证据：

- `migration-redeploy.log`

## 5. Deploy 失败后的实际状态

只读回读：

```text
businessTables=21
columns=202
foreignKeys=46
checks=0
cascadeUpdates=46
restrictUpdates=0
```

六个目标外键：

- 名称、字段、引用目标正确。
- 全部 `ON DELETE RESTRICT`。
- 全部仍为 `ON UPDATE CASCADE`。
- 没有任何外键被部分调整为 Restrict。

Migration 记录当前为三条：

1. 首次 domain_constraints 失败尝试：`rolled_back_at` 非空。
2. initial_schema 成功记录：checksum 不变。
3. 本次 domain_constraints 失败尝试：`finished_at=NULL`、`rolled_back_at=NULL`，错误码 1826。

没有删除历史，没有伪造成功。

`prisma migrate status` 退出码为 `1`，仍显示 domain_constraints failed。

证据：

- `post-deploy-failure-state.json`
- `post-deploy-failure-schema-snapshot.json`
- `migration-status-after-deploy-failure.log`

完整结构快照：

```text
SHA-256: C720F53FA918355396840344889EF2567D6254951ABCEB5484EC15C09DCA683B
```

## 6. 与授权预期的差异

预期：

- 第一条外键调整成功。
- 22 个 CHECK 全部创建。
- domain_constraints 记录为成功。

实际：

- 第一条外键调整即失败。
- 6 个外键均未调整。
- CHECK 数量仍为 0。
- 出现第三条 Migration 记录，表示本次 deploy 尝试失败。

因此 B4 最终验收未完成。

## 7. 下一步修复建议（未执行）

需要修改领域约束 Migration，将每个外键的 DROP 和 ADD 拆成两个独立语句：

```sql
ALTER TABLE `dining_sessions`
  DROP FOREIGN KEY `dining_sessions_closed_by_staff_id_fkey`;

ALTER TABLE `dining_sessions`
  ADD CONSTRAINT `dining_sessions_closed_by_staff_id_fkey`
    FOREIGN KEY (`closed_by_staff_id`) REFERENCES `staff`(`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;
```

原因：MySQL 8.4 不允许在同一个 ALTER 中复用正在删除的外键名称。

下一轮还需要：

1. 更新静态 Migration 检查器，要求 6 组 drop/add 分条出现。
2. 对当前新的失败记录执行 `migrate resolve --rolled-back`，但不能自动执行。
3. 再次部署并完成 22 个 CHECK 的真实测试。
4. 从全新空库重复完成 B4 全量验收。

## 8. 本批执行边界

本批实际执行：

- 删除 10 个 CHECK。
- `prisma migrate resolve --rolled-back`。
- `prisma migrate deploy` 一次，失败后停止。
- 只读查询和证据归档。

本批未执行：

- 第二次 deploy。
- 自动修复。
- 删除数据库或业务表。
- 删除 Migration 历史。
- 修改 Schema、Migration SQL、检查脚本或业务代码。
- `prisma db push`。
- Git 提交。
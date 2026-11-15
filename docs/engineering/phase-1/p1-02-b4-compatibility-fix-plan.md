# P1-02-B4 MySQL 8.4 兼容性修复影响分析

分析基线：`a5641f29e8338a8b339f450ea3e195836c5c1cf9`

分析日期：2026-11-14

状态：方案已审核通过；第一批兼容性修复已在静态层面实施，真实数据库恢复和重部署尚未执行。实施结果见 `p1-02-b4-compatibility-fix-report.md`。

## 1. 结论

修复方向确认：对受 CHECK 引用的 6 个外键显式设置：

```prisma
onUpdate: Restrict
```

继续保留：

```prisma
onDelete: Restrict
```

不删除或弱化任何 CHECK。

MySQL 8.4 实测结果：

- 6 个字段全部在 `ON UPDATE CASCADE` 下触发 `ERROR 3823`。
- 6 个字段全部在 `ON UPDATE RESTRICT` 下成功创建对应 CHECK。
- 共有 5 个 CHECK 引用外键字段，共涉及 6 个外键字段。
- 其他 40 个外键没有参与任何 CHECK，不应调整。

## 2. 影响面核实

### 2.1 核对方法

对两份 Migration 做机器交叉分析：

1. 从初始 Migration 提取全部 46 个外键及其源列、目标列、删除/更新策略。
2. 从领域约束 Migration 提取全部 22 个 CHECK 的表达式。
3. 提取每个 CHECK 引用的反引号列名。
4. 找出同时出现在 CHECK 和同表外键定义中的字段。

分析结果：

```text
FOREIGN_KEYS_TOTAL=46
CHECKS_WITH_FK_FIELDS=5
AFFECTED_FK_COLUMNS=6
```

机器结果证据：

`docs/engineering/phase-1/evidence/p1-02-b4/20261114T152855Z/fk-check-overlap.json`

### 2.2 受影响字段

| # | 模型关系字段 | 数据库列 | 所属 CHECK |
| --- | --- | --- | --- |
| 1 | `DiningSession.closedBy` | `dining_sessions.closed_by_staff_id` | `chk_dining_sessions_closed_fields` |
| 2 | `Order.session` | `orders.session_id` | `chk_orders_channel_session` |
| 3 | `PaymentRecord.session` | `payment_records.session_id` | `chk_payment_records_target_xor` |
| 4 | `PaymentRecord.order` | `payment_records.order_id` | `chk_payment_records_target_xor` |
| 5 | `PaymentRecord.voidedByStaff` | `payment_records.voided_by_staff_id` | `chk_payment_records_void_audit` |
| 6 | `RefundRecord.voidedByStaff` | `refund_records.voided_by_staff_id` | `chk_refund_records_void_audit` |

### 2.3 其余 CHECK 排除结果

其余 CHECK 即使可达外键表，也没有直接引用同表外键列：

- `chk_stores_business_day_cutoff_minute`
- `chk_product_variants_price_fen_nonnegative`
- `chk_variant_recipes_quantity_positive`
- `chk_materials_nonnegative_balances`
- `chk_materials_version_positive`
- `chk_stock_movements_balance`
- `chk_stock_movements_direction`
- `chk_stock_movements_cost_nonnegative`
- `chk_loss_records_values_nonnegative`
- `chk_dining_sessions_version_positive`
- `chk_orders_version_positive`
- `chk_orders_amounts`
- `chk_order_items_values`
- `chk_order_item_materials_quantities`
- `chk_order_item_materials_cost_pair`
- `chk_payment_records_amount_positive`
- `chk_refund_records_amount_positive`

因此除上述 6 个字段外，没有发现需要调整的外键。

## 3. MySQL 8.4 逐字段复现

测试环境：

```text
MySQL 8.4.13
隔离版本复现库：sanweichawu_b4_compat_20261114t152855z
```

每个用例先创建外键，再尝试添加对应 CHECK。

| 字段 | 对应业务判断 | `ON UPDATE CASCADE` | `ON UPDATE RESTRICT` |
| --- | --- | --- | --- |
| `dining_sessions.closed_by_staff_id` | OPEN 时关闭操作人必须为空 | 失败 3823 | 成功 |
| `orders.session_id` | DINE 必须有桌单、TAKEAWAY 必须无桌单 | 失败 3823 | 成功 |
| `payment_records.session_id` | 收款必须恰好关联桌单或订单之一 | 失败 3823 | 成功 |
| `payment_records.order_id` | 收款必须恰好关联桌单或订单之一 | 失败 3823 | 成功 |
| `payment_records.voided_by_staff_id` | 作废状态与作废操作人一致 | 失败 3823 | 成功 |
| `refund_records.voided_by_staff_id` | 作废状态与作废操作人一致 | 失败 3823 | 成功 |

汇总：

```text
CASCADE_FAILURES=6
RESTRICT_SUCCESSES=6
```

证据：

`docs/engineering/phase-1/evidence/p1-02-b4/20261114T152855Z/six-fk-3823-matrix.csv`

结论：问题不是单独的 `DiningSession.closedBy`，而是所有“CHECK 引用列 + 外键更新动作”组合。

## 4. 最小修改清单

### 4.1 Prisma Schema

文件：`backend/prisma/schema.prisma`

需要修改的 6 个关系：

| 模型 | 关系字段 | 当前 | 目标 |
| --- | --- | --- | --- |
| `DiningSession` | `closedBy` | `onDelete: Restrict`，隐式更新 CASCADE | `onDelete: Restrict, onUpdate: Restrict` |
| `Order` | `session` | `onDelete: Restrict`，隐式更新 CASCADE | `onDelete: Restrict, onUpdate: Restrict` |
| `PaymentRecord` | `session` | `onDelete: Restrict`，隐式更新 CASCADE | `onDelete: Restrict, onUpdate: Restrict` |
| `PaymentRecord` | `order` | `onDelete: Restrict`，隐式更新 CASCADE | `onDelete: Restrict, onUpdate: Restrict` |
| `PaymentRecord` | `voidedByStaff` | `onDelete: Restrict`，隐式更新 CASCADE | `onDelete: Restrict, onUpdate: Restrict` |
| `RefundRecord` | `voidedByStaff` | `onDelete: Restrict`，隐式更新 CASCADE | `onDelete: Restrict, onUpdate: Restrict` |

其余 40 个关系的 `onUpdate: CASCADE` 保持不变。

### 4.2 Migration 调整位置

**禁止修改**：

`backend/prisma/migrations/20261114120000_initial_schema/migration.sql`

该 Migration 已在失败测试库中成功执行，文件与 checksum 必须保持不变。

允许修改：

`backend/prisma/migrations/20261114120100_domain_constraints/migration.sql`

该 Migration 尚未在任何数据库中成功完成。

在该文件最前面、22 个 CHECK 之前增加 6 组“先删除旧外键，再使用 RESTRICT 重建”的 DDL：

| 外键 | 源 | 目标 |
| --- | --- | --- |
| `dining_sessions_closed_by_staff_id_fkey` | `dining_sessions.closed_by_staff_id` | `staff.id` |
| `orders_session_id_fkey` | `orders.session_id` | `dining_sessions.id` |
| `payment_records_session_id_fkey` | `payment_records.session_id` | `dining_sessions.id` |
| `payment_records_order_id_fkey` | `payment_records.order_id` | `orders.id` |
| `payment_records_voided_by_staff_id_fkey` | `payment_records.voided_by_staff_id` | `staff.id` |
| `refund_records_voided_by_staff_id_fkey` | `refund_records.voided_by_staff_id` | `staff.id` |

每个外键改写必须：

```sql
ALTER TABLE `child_table`
  DROP FOREIGN KEY `fk_name`;

ALTER TABLE `child_table`
  ADD CONSTRAINT `fk_name`
  FOREIGN KEY (`fk_column`) REFERENCES `target_table`(`id`)
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;
```

约束名称、源列、目标表、目标列保持不变，只调整更新动作。

不得顺手修改其余 40 个外键。

### 4.3 检查脚本同步

#### `backend/scripts/check-schema.mjs`

当前只解析和比较 `onDelete`，没有验证 `onUpdate`。

需要增加：

- 解析每条关系的 `onUpdate`。
- 明确预期：6 个关系为 `Restrict`，其余 40 个为 `Cascade`。
- 缺少 `onUpdate` 时不得再默认为通过。
- 新增负向自测：
  - 受影响关系缺少 `onUpdate: Restrict`，必须失败。
  - 受影响关系写成 `Cascade`，必须失败。
  - 非受影响关系被误改成 `Restrict`，必须失败。

#### `backend/scripts/check-migration-sql.mjs`

当前脚本把初始 Migration 的 46 个外键全部要求为 `ON UPDATE CASCADE`，并禁止整个约束迁移出现 `DROP`。

需要调整为两阶段验证：

1. 初始 Migration 仍校验 46 个外键全部为：
   - `ON DELETE RESTRICT`
   - `ON UPDATE CASCADE`
2. 领域约束 Migration 最前面必须恰好有 6 组目标外键改写：
   - 正确 `DROP FOREIGN KEY`
   - 以相同名称、列和目标重建
   - `ON DELETE RESTRICT`
   - `ON UPDATE RESTRICT`
3. 计算“初始 46 外键 + 6 次覆盖”后的最终状态：
   - 6 个 `RESTRICT`
   - 其余 40 个 `CASCADE`
4. 继续核对最终 22 个 CHECK 名称、表和表达式。
5. 禁止第 7 个外键被改写。
6. 新增负向自测：
   - 缺少一个外键改写。
   - 外键改写错误目标列。
   - 外键仍写成 `ON UPDATE CASCADE`。
   - 多了第 7 个改写。
   - `ON DELETE` 被改成 `CASCADE`。

不能在脚本中简单把所有 46 个外键都改成 RESTRICT，这会掩盖无授权修改。

#### 文档契约

`p1-02-a-field-contract.md` 的 FK 表目前只列 `onDelete`。修复实施时应增加兼容性说明或 `onUpdate` 列，明确：

- 6 个外键更新策略为 `Restrict`。
- 其余 40 个仍为 `Cascade`。

## 5. 初始 Migration 校验和保持不变

`20261114120000_initial_schema/migration.sql` 不得修改。

当前文件指纹：

```text
Bytes: 23909
SHA-256: AD2274E7A964EA753661B8C037C486F4B4A1855C0DFE74ECB9613CF0190CE19B
```

修复期间必须：

1. 修改前后计算文件 SHA-256，必须相同。
2. 查询失败测试库 `_prisma_migrations`，初始 Migration 的 checksum 必须不变。
3. 不删除初始 Migration 记录。
4. 不重新执行初始 Migration。
5. 6 个外键的兼容性调整全部由尚未成功的领域约束 Migration 承担。

这样保留“初始结构 Migration 已成功”的历史事实，同时把 MySQL 8.4 兼容修正作为后续 Migration 步骤。

## 6. 当前失败测试库恢复流程

目标库：

```text
sanweichawu_b4_main_20261114t152855z
```

当前实际状态：

- 初始 Migration 成功。
- 领域约束 Migration 失败。
- 21 张业务表存在。
- 46 个外键存在且仍为 `ON UPDATE CASCADE`。
- 10 个 CHECK 已创建。
- 第 11 个 CHECK 失败。
- `_prisma_migrations` 中领域约束记录为 failed。

### 6.1 保留现场

先保留现有失败证据，不删除失败记录：

- P3018/3823 原始输出。
- `_prisma_migrations` 记录和 logs。
- 21 张表结构。
- 46 个外键及策略。
- 10 个 CHECK 的名称与表达式。

### 6.2 清理本次失败产生的 10 个 CHECK

只删除以下已成功创建、属于失败迁移的 CHECK：

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

不删除：

- 任何表。
- 任何外键。
- 初始 Migration 记录。
- 失败 Migration 记录及其 logs。

清理后必须验证：

```text
business_tables = 21
foreign_keys = 46
checks = 0
```

### 6.3 处理失败状态

确认 CHECK 清理完成后，使用 Prisma 官方失败迁移处理方式：

```powershell
npx prisma migrate resolve `
  --rolled-back "20261114120100_domain_constraints" `
  --schema backend/prisma/schema.prisma
```

该命令只把失败尝试标记为已回滚，不伪造成功。

禁止：

- 删除 `_prisma_migrations` 行。
- 手工修改 `finished_at`。
- 使用 `--applied`。
- 使用 `db push`。

### 6.4 应用兼容性修复

修改准备工作完成后：

- 6 个 Prisma 关系增加 `onUpdate: Restrict`。
- 尚未成功的领域约束 Migration 在 CHECK 前执行 6 组外键改写。
- 初始 Migration 不动。

### 6.5 重新部署

```powershell
npx prisma migrate deploy --schema backend/prisma/schema.prisma
```

预期：

- 领域约束 Migration 重新执行。
- 6 个外键先调整为 `ON UPDATE RESTRICT`。
- 22 个 CHECK 全部创建成功。
- 新成功记录的 `finished_at` 非空。
- 原失败记录保留，`rolled_back_at` 非空。

最终必须核对：

```text
21 business tables
202 physical columns
46 foreign keys
22 checks
6 FK ON UPDATE RESTRICT
40 FK ON UPDATE CASCADE
46 FK ON DELETE RESTRICT
```

## 7. 全新空库完整验证流程

成功后，失败库恢复结果只作为修复验证，不作为最终唯一证据。

### 7.1 创建全新库

使用新的唯一运行 ID，创建：

- `sanweichawu_b4_fresh_main_<runId>`
- `sanweichawu_b4_fresh_failure_<runId>`
- `sanweichawu_b4_fresh_recovery_<runId>`

确认所有库为空。

### 7.2 首次部署

记录：

- 开始/结束时间。
- `prisma migrate deploy` 原始输出。
- 两份 Migration 顺序。
- `_prisma_migrations` checksum 和 finished_at。
- 22 个 CHECK、46 个外键、21 张表、202 列。

### 7.3 重复部署

第二次执行 `prisma migrate deploy`：

- 不得再次执行已应用 Migration。
- `_prisma_migrations` 不得重复增加成功记录。
- 前后结构快照 SHA-256 必须一致。

不直接重复执行原始 Migration SQL。

### 7.4 约束验证

执行：

- 22 个 CHECK 的合法/非法用例。
- 46 个外键的插入拒绝和删除 RESTRICT 用例。
- 21 个唯一索引的重复值拒绝用例。
- 四个关键跨字段场景。
- 全部 `information_schema` 回读。

### 7.5 失败注入与恢复

在独立失败库中预置冲突对象，使迁移中途失败：

- 保留 Prisma failed 记录和 logs。
- 记录残留表和外键。
- 不删除失败记录。
- 另建全新恢复库重新部署。
- 恢复库结构与 fresh main 一致。

### 7.6 最终通过条件

- MySQL 版本为 8.4.x。
- 首次部署成功。
- 重复部署 no-op。
- 22 个 CHECK 表达式和拒绝行为全部通过。
- 46 个外键策略与行为全部通过。
- 6 个兼容外键为 `ON UPDATE RESTRICT`。
- 其余 40 个保持 `ON UPDATE CASCADE`。
- 初始 Migration SHA-256 未变化。
- 所有失败记录真实保留，没有伪造状态。
- 证据中没有密码或完整连接串。

## 8. 六个外键的最终验证矩阵

| ID | 外键 | MySQL 8.4 复现 | 修复后行为验证 |
| --- | --- | --- | --- |
| FK-U01 | `dining_sessions.closed_by_staff_id` | CASCADE 触发 3823，RESTRICT 可建 CHECK | 更新员工 ID 且有关联 session 时必须被拒绝；OPEN 状态关闭人仍必须为空 |
| FK-U02 | `orders.session_id` | CASCADE 触发 3823，RESTRICT 可建 CHECK | 更新 session ID 且有关联 order 时必须被拒绝；DINE/TAKEAWAY 与 session 组合仍由 CHECK 拒绝 |
| FK-U03 | `payment_records.session_id` | CASCADE 触发 3823，RESTRICT 可建 CHECK | 更新 session ID 且有关联 payment 时必须被拒绝；session/order XOR 仍生效 |
| FK-U04 | `payment_records.order_id` | CASCADE 触发 3823，RESTRICT 可建 CHECK | 更新 order ID 且有关联 payment 时必须被拒绝；session/order XOR 仍生效 |
| FK-U05 | `payment_records.voided_by_staff_id` | CASCADE 触发 3823，RESTRICT 可建 CHECK | 更新员工 ID 且有关联作废收款时必须被拒绝；ACTIVE/VOIDED 审计字段仍一致 |
| FK-U06 | `refund_records.voided_by_staff_id` | CASCADE 触发 3823，RESTRICT 可建 CHECK | 更新员工 ID 且有关联作废退款时必须被拒绝；ACTIVE/VOIDED 审计字段仍一致 |

每个最终行为用例必须：

1. 创建合法父记录和子记录。
2. 尝试修改父主键。
3. 断言更新失败。
4. 回滚事务。
5. 断言父/子数据未改变。
6. 再执行对应非法 CHECK 数据，确认 CHECK 仍拒绝。

## 9. 风险评估

### 9.1 主键更新被禁止

`ON UPDATE RESTRICT` 会阻止修改被引用的主键。

判断：可接受。全系统主键是 BigInt 自增内部标识，没有业务需要修改已存在记录的 ID。禁止级联修改比静默传播主键变更更安全。

### 9.2 初始 Migration 和最终 Schema 暂时不同

初始 Migration 仍生成 6 个 CASCADE，领域约束 Migration 再改为 RESTRICT。

判断：可接受。Migration 是历史顺序，最终状态由两步共同决定。不得为了“文件看起来一致”而修改已成功执行的初始 Migration。

### 9.3 已失败 Migration 的 checksum

修复后的领域约束 Migration checksum 会改变。

处理要求：

- 失败 attempt 保留原 checksum 和 logs。
- 使用 `migrate resolve --rolled-back`。
- 新 attempt 记录新 checksum 和成功状态。
- 不手工修改历史行。

### 9.4 静态检查误放行

如果只把检查器改成“所有 FK 都允许 RESTRICT”，会掩盖无授权扩展。

必须明确固定：

- 6 个 Restrict。
- 40 个 Cascade。
- 第 7 个改写必须失败。

## 10. 本批边界

本批只输出影响分析，没有：

- 修改 `schema.prisma`。
- 修改初始 Migration。
- 修改领域约束 Migration。
- 修改检查脚本。
- 执行失败库恢复。
- 执行修复后的 Migration。
- 提交 Git。

## 11. 审核决策点

需要审核确认：

1. 接受 6 个关系使用 `onUpdate: Restrict`。
2. 接受通过尚未成功的领域约束 Migration 改写 6 个外键，而不修改初始 Migration。
3. 接受其余 40 个外键保持 `ON UPDATE CASCADE`。
4. 接受失败库使用 `migrate resolve --rolled-back`，不删除历史。
5. 接受修复后必须从全新空库重新完成 B4 全量验收。
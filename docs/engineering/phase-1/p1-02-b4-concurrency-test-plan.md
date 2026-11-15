# P1-02-B4 事务并发验证测试设计

文档状态：设计完成，尚未执行

编制日期：2026-11-15

当前基线：`add2a5adf4c044c478a9129388115ce1241f2a4a`

目标数据库（执行阶段建议）：`sanweichawu_b4_main_20261114t152855z`

目标 MySQL：`8.4.13`

结论：**Schema 已具备执行数据库级事务、行锁和回滚实验的条件，但尚不具备“服务层并发正确性”。本文件只定义测试设计，本轮未连接数据库、未执行 SQL、未生成测试数据。**

## 1. 目标与非目标

### 1.1 本测试要回答的问题

必须把数据库能力和未来业务服务能力分开：

| 层次 | 本测试能证明 | 本测试不能证明 |
| --- | --- | --- |
| MySQL / InnoDB 数据库层 | InnoDB 事务回滚、行锁、锁等待超时、死锁检测、CHECK/UNIQUE 拒绝非法最终状态 | 未实现的服务是否一定使用这些能力 |
| 测试事务协议层 | 在测试 SQL 明确使用 `FOR UPDATE` 或版本 CAS 时，是否能避免超卖和丢失更新 | 未来代码是否采用相同协议 |
| 应用服务层 | 只能通过测试脚本中的参考实现进行验证 | 订单、库存、收款尚未实现，不能宣称业务并发已经验收 |
| API / 前端层 | 不在本批范围 | 冲突提示、重试提示、幂等处理与用户体验 |

本批执行阶段应明确输出：

- 哪些结论由真实 MySQL 行为直接证明。
- 哪些结论只是“参考事务协议可行”。
- 哪些能力必须等未来服务层和 API 实现后才能验证。

### 1.2 当前不存在的实现

不得假设已经存在以下内容：

- 库存服务或库存 API。
- 自动版本递增组件。
- 自动重试或死锁恢复组件。
- Prisma 事务封装。
- 订单状态机服务。
- 前端冲突处理。
- 定时任务或消息队列。

当前 `backend/package.json` 只安装 `prisma` CLI，没有 `@prisma/client` 或 `mysql2`。因此执行阶段不应依赖未安装的 Node 数据库驱动，也不应通过安装新依赖来搭建测试。

## 2. 当前 Schema 与 Migration 分析

### 2.1 库存余额与预占

库存数量位于 `materials`：

| 字段 | 类型 | 默认值 | 含义 |
| --- | --- | --- | --- |
| `on_hand` | `DECIMAL(18,3)` | 0 | 当前在手库存 |
| `reserved` | `DECIMAL(18,3)` | 0 | 当前已预占库存 |
| `average_cost_per_unit` | `DECIMAL(18,6)` | 0 | 移动加权平均成本 |
| `version` | `INT` | 1 | 应用层乐观锁版本 |

每次库存动作的审计事实位于 `stock_movements`：

| 字段 | 含义 |
| --- | --- |
| `movement_type` | `OPENING_BALANCE / STOCK_IN / RESERVE / RELEASE / CONSUME / ADJUST` |
| `quantity_delta` | 在手库存变化量，允许负数 |
| `reserved_delta` | 预占变化量，允许负数 |
| `on_hand_after` | 本次动作后的在手库存 |
| `reserved_after` | 本次动作后的预占库存 |
| `unit_cost_snapshot` | 动作单位成本快照 |
| `total_cost_snapshot` | 动作总成本快照 |
| `dedupe_key` | 唯一幂等键 |

当前只存 `on_hand` 和 `reserved` 两个余额，不存在独立 `available = on_hand - reserved` 列。未来服务读取可用量时必须显式计算 `on_hand - reserved`，不能假设数据库自动维护。

### 2.2 相关 CHECK 约束

与库存并发直接相关的约束：

| CHECK | 作用 |
| --- | --- |
| `chk_materials_nonnegative_balances` | `on_hand >= 0`、`reserved >= 0`、`reserved <= on_hand` |
| `chk_materials_version_positive` | `version > 0` |
| `chk_stock_movements_balance` | `on_hand_after >= 0`、`reserved_after >= 0`、`reserved_after <= on_hand_after` |
| `chk_stock_movements_direction` | 每种流水类型的数量方向必须符合冻结规则 |
| `chk_stock_movements_cost_nonnegative` | 成本快照不得为负 |
| `chk_orders_version_positive` | 订单版本必须大于 0 |
| `chk_dining_sessions_version_positive` | 桌单版本必须大于 0 |

CHECK 只约束写入后的单行或单表字段关系。它不会自动完成以下工作：

- 自动读取旧版本并拒绝覆盖。
- 自动递增 `version`。
- 自动要求同一事务必须同时写 `materials` 和 `stock_movements`。
- 自动保证 `stock_movements.on_hand_after/reserved_after` 与 `materials` 当前余额一致。
- 自动拒绝重复的业务预占意图。

### 2.3 唯一约束与幂等键

并发下的重要唯一性：

- `stock_movements.dedupe_key` 唯一。
- `loss_records.dedupe_key` 唯一。
- `loss_records.stock_movement_id` 唯一。
- `orders.order_no` 唯一。
- `orders.idempotency_key` 唯一。
- `payment_records.payment_no` / `idempotency_key` 唯一。
- `refund_records.refund_no` / `idempotency_key` 唯一。

并发重复操作可以利用唯一键实现“最多一次插入”。但唯一键只能阻止同一个幂等键重复落库；如果两个请求使用不同幂等键表达同一个库存动作，数据库仍无法判断它们是同一业务意图。

### 2.4 外键与删除策略

库存测试涉及的主要外键：

- `stock_movements.store_id -> stores.id`
- `stock_movements.material_id -> materials.id`
- `stock_movements.order_id -> orders.id`
- `stock_movements.order_item_id -> order_items.id`
- `stock_movements.operator_staff_id -> staff.id`

全部 `ON DELETE RESTRICT`。这能防止删除仍有流水引用的数据，但与库存并发正确性无关。

### 2.5 版本字段现状

`Material.version`、`DiningSession.version`、`Order.version` 都是普通 `INT`，默认 1。

当前没有：

- 数据库触发器。
- 自动版本列。
- `UPDATE ... RETURNING` 式数据库自动冲突检测。
- Prisma 中间件或服务层实现。

因此：

- 数据库可以锁住同一行。
- 数据库可以执行带 `WHERE version = ?` 的条件更新。
- 数据库不会自动为业务更新生成“读取版本、比较版本、拒绝旧写入”的完整流程。

版本校验属于未来服务层实现，只有使用正确的条件更新或显式比较才算服务并发通过。

### 2.6 当前测试条件结论

已具备：

- InnoDB 事务。
- `READ COMMITTED` 或默认 `REPEATABLE-READ` 事务。
- `SELECT ... FOR UPDATE`。
- 条件 `UPDATE ... WHERE version = ?`。
- 行锁等待超时。
- 死锁检测。
- CHECK、UNIQUE、FK。
- 通过 Docker 容器内现有 `mysql` 客户端启动两个独立连接。

尚不具备：

- 库存服务实现。
- 自动版本管理。
- 跨表库存一致性验证服务。
- Prisma 客户端驱动。
- 业务冲突映射和重试策略。

## 3. 执行环境与安全边界

执行阶段仍使用：

- Docker 容器：`sanweichawu-b4-mysql`
- 数据库：`sanweichawu_b4_main_20261114t152855z`
- MySQL：8.4.13
- 现有冻结 Schema 和 Migration

执行阶段禁止：

- 修改 Schema 或 Migration。
- `prisma db push`。
- 修改业务代码。
- 新增依赖。
- 操作生产库或其他开发库。
- 使用自动清理脚本删除来源不明的数据。

如果执行前发现目标库业务表已有真实数据，应立即停止，不能使用无条件 `DELETE` 清理。当前已验收状态下业务表为空，可以安全使用固定负数 ID。

## 4. 测试连接方案（不新增依赖）

宿主没有 MySQL 客户端，`@prisma/client` 和 `mysql2` 也未安装。执行阶段使用两个独立的 `docker exec -i` 子进程，每个进程在 MySQL 容器内运行一个独立 `mysql` 客户端：

```powershell
$c1 = Start-Process docker -ArgumentList @(
  'exec','-i','-e','MYSQL_PWD=********',
  'sanweichawu-b4-mysql',
  'mysql','-uroot','--batch','--raw','--skip-column-names',
  '--unbuffered','--force','-D','sanweichawu_b4_main_20261114t152855z'
) -PassThru -RedirectStandardInput ... -RedirectStandardOutput ... -RedirectStandardError ...

$c2 = Start-Process docker -ArgumentList @(
  'exec','-i','-e','MYSQL_PWD=********',
  'sanweichawu-b4-mysql',
  'mysql','-uroot','--batch','--raw','--skip-column-names',
  '--unbuffered','--force','-D','sanweichawu_b4_main_20261114t152855z'
) -PassThru -RedirectStandardInput ... -RedirectStandardOutput ... -RedirectStandardError ...
```

密码只从容器环境读取到进程环境，不写入命令行日志、报告或证据。

每个连接执行：

```sql
SELECT CONNECTION_ID() AS connection_id;
SELECT @@transaction_isolation AS isolation_level;
SELECT @@innodb_lock_wait_timeout AS lock_wait_timeout;
```

必须确认两个 `CONNECTION_ID()` 不同。

### 4.1 步进同步

为避免依赖 `SLEEP()` 猜测并发时序，测试编排器采用“命令 + 哨兵”：

```sql
-- 发给连接 C1
SELECT '__C1_STEP_01_READY__';

-- 发给连接 C2
SELECT '__C2_STEP_01_READY__';
```

执行器发送 SQL 后等待对应哨兵行返回，再进行下一步。对预期阻塞的语句，执行器：

1. 记录开始时间。
2. 不等待哨兵。
3. 等待 300–500 ms。
4. 断言该连接仍在运行且尚未收到目标哨兵。
5. 释放另一个连接上的锁。
6. 再读取被阻塞连接的输出和耗时。

这样不需要修改 Schema，也不需要引入 MySQL 新依赖。

### 4.2 测试事务模式

除种子数据和清理外，所有被测操作使用显式事务：

```sql
START TRANSACTION;
-- test statements
COMMIT;   -- 或 ROLLBACK
```

测试结束后必须在 `finally` 中：

- 对两个连接发送 `ROLLBACK;`。
- 关闭 stdin。
- 等待进程退出。
- 如果仍存活，再执行显式进程终止。
- 只删除本轮固定前缀和固定负数 ID 的测试数据。

## 5. 测试数据命名与清理

测试 ID 使用专用负数区间，避免推进 `AUTO_INCREMENT`：

- 测试 Store：`-800001`
- Material A：`-810001`
- Material B：`-810002`
- 其余测试记录继续使用 `-81xxxx`
- `dedupe_key` 前缀：`b4-concurrency:<runId>:`

执行前检查：

```sql
SELECT COUNT(*) FROM stores WHERE id = -800001;
SELECT COUNT(*) FROM materials WHERE id BETWEEN -819999 AND -810001;
SELECT COUNT(*) FROM stock_movements
WHERE dedupe_key LIKE 'b4-concurrency:<runId>:%';
```

任一结果不为 0，立即停止。

清理顺序：

1. `stock_movements`
2. `loss_records`（如本批未来扩展到损耗场景）
3. `materials`
4. `stores`

清理后再次检查固定 ID 和前缀均为 0，并比较未触碰表的精确行数。

## 6. 场景 A：库存竞争

### A1. 推荐协议一：占用时锁行

目的：验证 InnoDB 行锁能够串行化同一 Material 的预占。

前置数据：

- `materials(-810001)`：
  - `on_hand = 1.000`
  - `reserved = 0.000`
  - `version = 1`
- 创建一条合法 `OPENING_BALANCE` 或 `STOCK_IN` 流水作为审计起点。

连接 C1：

```sql
START TRANSACTION;
SELECT id, on_hand, reserved, version
FROM materials
WHERE id = -810001
FOR UPDATE;

-- 期望：on_hand=1, reserved=0, version=1
INSERT INTO stock_movements (
  dedupe_key, store_id, material_id, movement_type,
  quantity_delta, reserved_delta, on_hand_after, reserved_after,
  unit_cost_snapshot, total_cost_snapshot, reason
) VALUES (
  'b4-concurrency:<runId>:A1:C1', -800001, -810001, 'RESERVE',
  0, 1, 1, 1, 10, 10, 'A1 reservation'
);

UPDATE materials
SET reserved = reserved + 1,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = -810001;

SELECT '__C1_LOCK_HELD__';
```

在 `__C1_LOCK_HELD__` 后，连接 C1 保持事务未提交。

连接 C2：

```sql
SET SESSION innodb_lock_wait_timeout = 5;
START TRANSACTION;

SELECT id, on_hand, reserved, version
FROM materials
WHERE id = -810001
FOR UPDATE;

-- C2 在 C1 提交前应阻塞
```

执行器确认 C2 阻塞，然后 C1：

```sql
COMMIT;
```

C2 解锁后继续，读到：

```text
on_hand=1, reserved=1, version=2
```

C2 无可用量，执行：

```sql
ROLLBACK;
```

预期：

- C1 成功，`reserved=1`、`version=2`。
- C2 未写入 `StockMovement`。
- `reserved <= on_hand`。
- `stock_movements` 只增加 1 条预占记录。
- C2 没有部分写入。

数据库层结论：InnoDB 对同一主键行执行了锁等待和串行化。

服务层结论：未来库存服务若采用 `FOR UPDATE`，必须把读取、余额更新和流水插入放在同一事务内。

### A2. 推荐协议二：版本 CAS

目的：验证条件更新能阻止两个基于同一旧版本的库存写入。

前置数据：

- `materials(-810002)`：`on_hand=1`、`reserved=0`、`version=1`。

两个连接先读取同一快照：

```sql
SELECT id, on_hand, reserved, version
FROM materials
WHERE id = -810002;
-- 两者均读到 version=1
```

执行器在两者都返回后同时发送更新。

连接 C1：

```sql
START TRANSACTION;

UPDATE materials
SET reserved = reserved + 1,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = -810002
  AND version = 1
  AND reserved + 1 <= on_hand;

-- affected rows 应为 1
COMMIT;
```

连接 C2：

```sql
START TRANSACTION;

UPDATE materials
SET reserved = reserved + 1,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = -810002
  AND version = 1
  AND reserved + 1 <= on_hand;

-- affected rows 应为 0
ROLLBACK;
```

预期：

- 恰好一个 `UPDATE` 返回 1 行受影响。
- 另一个 `UPDATE` 返回 0 行受影响。
- 最终 `version=2`、`reserved=1`。
- 只有成功事务可以插入对应 `StockMovement`。
- 不出现两份预占流水对应一份库存。

数据库层结论：数据库能原子执行带旧版本条件的比较更新。

服务层结论：服务必须检查 affected rows，并在 0 行时回滚、返回冲突或执行受控重试；仅存在 `version` 字段不足以自动提供这个语义。

### A3. 反例诊断：无条件自增

目的：证明数据库 CHECK 可以兜底部分非法余额，但它不是完整业务协议。

两条连接都读到 `reserved=0` 后，错用：

```sql
UPDATE materials
SET reserved = reserved + 1,
    version = version + 1
WHERE id = -810001;
```

第一事务成功后，第二事务可能得到：

```text
ERROR 3819: Check constraint 'chk_materials_nonnegative_balances' is violated.
```

预期：

- 第二事务必须回滚。
- 不得插入第二份成功预占流水。
- 最终 `reserved <= on_hand`。

该反例通过只能说明 CHECK 拒绝了一个非法余额，不能证明未来库存服务已经正确。

### A4. 反例诊断：盲赋值丢失更新

以下模式不能作为验收通过项，只用于说明数据库不会猜测业务意图：

```sql
-- 两个连接都读到 reserved=0
UPDATE materials SET reserved = 1, version = version + 1 WHERE id = ...;
```

如果两个事务都按该方式盲写，数据库可能允许两个业务请求都“成功”，但只能留下一个预占余额。是否执行本反例由后继审查决定；不能把它的结果解释为库存正确。

## 7. 场景 B：同一记录并发更新

### B1. Material 乐观锁

前置数据：

- `materials(-810011)`：`version=1`。

两个连接先读取 `version=1`。

两个连接都执行：

```sql
UPDATE materials
SET version = version + 1,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = -810011
  AND version = 1;
```

预期：

- 第一条 `affected rows = 1`。
- 第二条 `affected rows = 0`。
- 最终 `version=2`。
- 只有成功事务的后续业务写入必须提交；冲突事务必须回滚。

### B2. DiningSession 版本校验

前置数据：

- Store、DiningTable、Staff。
- `dining_sessions(-810021)`：
  - `status='OPEN'`
  - `version=1`
  - `closed_at=NULL`
  - `closed_by_staff_id=NULL`

两个连接均基于 `version=1` 尝试关闭桌单：

```sql
UPDATE dining_sessions
SET status = 'CLOSED',
    closed_at = CURRENT_TIMESTAMP(3),
    closed_by_staff_id = -810021,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = -810021
  AND version = 1
  AND status = 'OPEN';
```

预期：

- 一个 affected rows 为 1。
- 另一个 affected rows 为 0。
- 最终只有一次关闭和一次版本递增。
- `chk_dining_sessions_closed_fields` 通过。

### B3. Order 版本校验

前置数据：

- Store、User、`orders(-810031)`：
  - `channel='TAKEAWAY'`
  - `status='PENDING_ACCEPTANCE'`
  - `version=1`
  - `session_id=NULL`
  - `subtotal_fen = total_amount_fen`

两个连接基于 `version=1` 尝试接单：

```sql
UPDATE orders
SET status = 'ACCEPTED',
    accepted_at = CURRENT_TIMESTAMP(3),
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = -810031
  AND version = 1
  AND status = 'PENDING_ACCEPTANCE';
```

预期：

- 一个成功，一个 affected rows 为 0。
- 最终只有一次 `accepted_at` 和一次版本递增。

### B4. 行锁与版本校验的区别

B1–B3 的条件版本更新属于应用层乐观锁协议：

- SQL 中有 `version = oldVersion`。
- SQL 必须检查 affected rows。
- 代码必须决定冲突后是回滚还是重试。

`SELECT ... FOR UPDATE` 属于数据库锁协议：

- 能让第二个事务等待第一个事务结束。
- 不会自动判断“调用方携带的旧版本是否过期”。
- 如果应用在拿到锁后错误地接受旧版本值，仍可能产生业务冲突。

验收报告必须把这两种事实分别记录，不能把“无数据库错误”写成“服务版本校验通过”。

## 8. 场景 C：事务中途失败与整体回滚

### C1. 部分库存写入后主动触发失败

前置数据：

- `materials(-810041)`：`on_hand=10`、`reserved=0`、`version=1`。
- 预先提交一条 `stock_movements`：
  - `dedupe_key='b4-concurrency:<runId>:C1:EXISTING'`

测试连接：

```sql
START TRANSACTION;

INSERT INTO stock_movements (
  dedupe_key, store_id, material_id, movement_type,
  quantity_delta, reserved_delta, on_hand_after, reserved_after,
  reason
) VALUES (
  'b4-concurrency:<runId>:C1:FIRST', -800001, -810041, 'RESERVE',
  0, 1, 10, 1, 'C1 first write'
);

UPDATE materials
SET reserved = reserved + 1,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = -810041;

-- 制造确定性唯一键失败
INSERT INTO stock_movements (
  id, dedupe_key, store_id, material_id, movement_type,
  quantity_delta, reserved_delta, on_hand_after, reserved_after, reason
) VALUES (
  -810042,
  'b4-concurrency:<runId>:C1:EXISTING',
  -800001, -810041, 'RESERVE',
  0, 1, 10, 2, 'C1 deliberate duplicate'
);
```

预期：

- 第二个流水插入返回 `1062`。
- 测试连接捕获错误后执行 `ROLLBACK`。
- 事务前的 `materials` 行完全恢复：
  - `reserved=0`
  - `version=1`
- 第一条 `C1:FIRST` 流水不落库。
- 不存在部分更新。

验收查询：

```sql
SELECT id, on_hand, reserved, version
FROM materials WHERE id = -810041;

SELECT COUNT(*) FROM stock_movements
WHERE dedupe_key LIKE 'b4-concurrency:<runId>:C1:%';
```

预期结果：

```text
materials: 10.000, 0.000, 1
stock_movements count: 1
```

这里的 1 是预置的 `EXISTING` 记录；事务内 `FIRST` 记录必须不存在。

数据库层结论：数据库事务回滚有效。

服务层结论：未来服务必须把库存余额更新、流水插入和状态变更放入同一事务，不能在每个步骤后独立提交。

## 9. 场景 D：锁等待与冲突

### D1. 锁等待超时

前置数据：

- `materials(-810051)`：`on_hand=10`、`reserved=0`、`version=1`。

连接 C1：

```sql
SET SESSION innodb_lock_wait_timeout = 5;
START TRANSACTION;
UPDATE materials
SET reserved = 1,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = -810051;
SELECT '__C1_LOCK_HELD_D1__';
```

连接 C2：

```sql
SET SESSION innodb_lock_wait_timeout = 1;
START TRANSACTION;
UPDATE materials
SET reserved = 2,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP(3)
WHERE id = -810051;
```

预期：

- C2 在约 1 秒后返回 `ERROR 1205` 锁等待超时。
- C2 必须视为失败并回滚。
- C1 可以继续提交。
- 最终只有 C1 的变更存在。

可接受结果：

- C2 在超时前被 C1 释放锁而继续执行，但必须通过版本条件或 affected rows 判断冲突，不能无条件覆盖。
- 无论哪种路径，最终 `reserved <= on_hand`，不存在部分写入。

### D2. 死锁检测

前置数据：

- `materials(-810061)` 和 `materials(-810062)`，都 `reserved=0`、`version=1`。

连接 C1：

```sql
SET SESSION innodb_lock_wait_timeout = 5;
START TRANSACTION;
UPDATE materials SET reserved = reserved + 1, version = version + 1 WHERE id = -810061;
SELECT '__C1_LOCK_61__';
```

连接 C2：

```sql
SET SESSION innodb_lock_wait_timeout = 5;
START TRANSACTION;
UPDATE materials SET reserved = reserved + 1, version = version + 1 WHERE id = -810062;
SELECT '__C2_LOCK_62__';
```

然后同时发送交叉更新：

```sql
-- C1
UPDATE materials SET reserved = reserved + 1, version = version + 1 WHERE id = -810062;

-- C2
UPDATE materials SET reserved = reserved + 1, version = version + 1 WHERE id = -810061;
```

预期：

- InnoDB 检测到死锁。
- 一个事务收到 `ERROR 1213`。
- 另一个事务可以继续并提交。
- 被选为牺牲者的事务必须完整回滚。
- 不要求指定 C1 或 C2 一定成为牺牲者。

验收：

- 最终只有其中一个事务的业务变更落库。
- 两行余额和版本保持一致。
- 不存在半条流水或半次余额更新。
- 保存 `SHOW ENGINE INNODB STATUS` 的最新死锁段落作为诊断证据，但不以自然语言解析结果作为唯一断言。

### D3. 锁结论边界

本测试只证明：

- MySQL 8.4 InnoDB 的锁等待、超时和死锁检测在该表结构上真实生效。

本测试不证明：

- 未来服务是否会正确捕获 `1205/1213`。
- 未来服务是否会安全重试。
- 重试是否幂等。
- 用户是否会看到正确冲突提示。

## 10. 建议测试脚本结构

执行阶段建议新增（本轮不创建）：

```text
docs/engineering/phase-1/evidence/p1-02-b4/concurrency-<runId>/
  run-concurrency-tests.ps1
  precheck.sql
  fixture-setup.sql
  fixture-cleanup.sql
  cases/
    a1-row-lock.sql
    a2-version-cas.sql
    a3-unconditional-increment.sql
    b1-material-version.sql
    b2-dining-session-version.sql
    b3-order-version.sql
    c1-mid-transaction-failure.sql
    d1-lock-wait-timeout.sql
    d2-deadlock.sql
  logs/
    c1.log
    c2.log
    orchestrator.log
  snapshots/
    before.json
    after.json
  results.json
  run-manifest.json
```

脚本结构：

1. `Preflight`
   - 确认分支、HEAD、数据库名、MySQL 版本。
   - 确认 `prisma migrate status`。
   - 确认两个独立连接。
   - 确认测试 ID 和 dedupe prefix 不存在。
   - 记录隔离级别和锁等待超时。

2. `Seed`
   - 使用固定负数 ID 提交最小合法测试图。
   - 不修改冻结 Schema。

3. `Run`
   - 每个场景独立启动两个连接。
   - 发送 SQL 和哨兵。
   - 捕获 stdout、stderr、退出状态、开始/结束时间和等待时长。
   - 对预期 `1205/1213` 做显式错误码断言。

4. `Verify`
   - 查询业务余额和流水。
   - 对比场景前/后快照。
   - 验证 `reserved <= on_hand`。
   - 验证成功流水数量。
   - 验证失败事务没有残留记录。
   - 对无关表做精确行数回归。

5. `Cleanup`
   - `finally` 先 rollback 所有活动事务。
   - 关闭两个 mysql 子进程。
   - 按依赖顺序删除固定 ID 数据。
   - 验证无前缀残留。
   - 重新比较 Schema dump、约束数量、Migration 状态。

## 11. 每个场景的验收矩阵

| 场景 | 成功事务数 | 失败/冲突 | 余额约束 | 流水约束 | 回滚证明 |
| --- | ---: | --- | --- | --- | --- |
| A1 行锁预占 | 1 | 另一连接等待后无容量并回滚 | `reserved <= on_hand` | 只有 1 条成功 RESERVE | 失败连接无新增流水 |
| A2 版本 CAS | 1 | 另一连接 affected rows=0 | 最终 version 只加 1 | 只有成功事务可写流水 | 失败事务 rollback |
| A3 无条件自增 | 1 | 第二事务可能 3819 | 最终不超预占 | 不得有第二成功流水 | 失败事务 rollback |
| B1 Material 版本 | 1 | 另一连接 affected rows=0 | version 只加 1 | 无 | 失败事务 rollback |
| B2 DiningSession 版本 | 1 | 另一连接 affected rows=0 | 状态只关闭一次 | 无 | 失败事务 rollback |
| B3 Order 版本 | 1 | 另一连接 affected rows=0 | 版本只加 1 | 无 | 失败事务 rollback |
| C1 中途失败 | 0 | 1062 | 恢复到起始余额 | `FIRST` 不落库 | 整个事务 rollback |
| D1 锁等待 | 1 或 2（取决于是否释放锁） | 1205 或受控等待 | 最终不超预占 | 只有已提交动作 | 超时事务 rollback |
| D2 死锁 | 1 | 1213 | 两行均一致 | 牺牲者无部分流水 | 死锁牺牲者 rollback |

## 12. 必须记录的证据

每个用例至少保存：

- 用例 ID、开始/结束 UTC 时间。
- 两个连接的 `CONNECTION_ID()`。
- 完整 SQL。
- 实际 stdout/stderr。
- MySQL 错误码和错误信息。
- affected rows。
- 锁等待时长。
- 事务最终 `COMMIT` 或 `ROLLBACK` 状态。
- 测试前后 `materials`、`stock_movements` 的关键字段快照。
- 21 张业务表精确行数。
- Schema dump SHA-256。
- Migration 状态。
- 测试清理后的残留检查。

禁止记录：

- 数据库密码。
- 完整连接串。
- 容器 root 密码。
- 机器用户名或本机绝对路径。

## 13. 未覆盖与后续边界

本设计不授权执行，也不覆盖：

- 已实现库存服务的事务协议。
- 订单服务状态机并发。
- 支付服务幂等和退款并发。
- 库存消耗和损耗的跨表事务。
- API 层冲突响应。
- 重试策略、退避和幂等键生命周期。
- 长时间锁竞争和容量压力测试。
- 多门店、多进程、多容器的压力场景。

这些必须在业务模块实现后，使用服务层接口和真实事务边界再验证。

## 14. 执行前评审门槛

获得执行授权前必须确认：

- 本文档审查通过。
- 执行发生在专用 B4 测试库。
- 当前业务表为空，或测试使用独立新测试库。
- 两连接均由现有容器内 MySQL 客户端建立。
- 不使用 `@prisma/client` 或 `mysql2` 猜测并不存在的依赖。
- 所有场景使用显式事务、哨兵和超时。
- 失败路径保留证据，不自动“修复”数据库。
- 执行结束后清理测试数据并复核数据库结构。

## 15. 设计结论

- 当前 Schema 已具备数据库级并发实验条件。
- 当前 `version` 字段是应用层乐观锁的基础，不提供自动保护。
- 当前 CHECK 能拒绝非法余额，但不能替代行锁、CAS 或跨表事务。
- 当前唯一键能支持部分幂等，但不能判断不同幂等键下的重复业务意图。
- 未来库存服务必须明确选择 `FOR UPDATE` 行锁或版本 CAS，并把余额、流水和业务状态写入同一事务。
- 本轮不执行测试；等待审查和明确执行授权。

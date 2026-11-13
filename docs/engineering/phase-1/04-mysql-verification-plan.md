# 任务 4：MySQL 8 验证方案

## 1. 当前环境状态

本设计阶段检查结果：

- `mysql/mysqld/mysqlsh/mariadb/mariadbd` 均未安装。
- 本机没有 MySQL 服务。
- Docker 客户端存在，但 Docker daemon 当前不可用。
- 因此本阶段**没有执行任何 MySQL 8 数据库验证**。

本轮不得把以下结果写成数据库通过：

- Prisma validate。
- SQL 文本或结构扫描。
- PowerShell 脚本语法检查。
- 原型浏览器测试。

## 2. 目标数据库版本

建议使用 MySQL 8.4 LTS 的官方镜像，并在 Compose 中固定到不可变 digest。

执行阶段必须记录：

```sql
SELECT VERSION();
SELECT @@version_comment;
SELECT @@transaction_isolation;
SELECT @@sql_mode;
```

验收报告必须保存真实输出。

如果已有生产环境固定使用 MySQL 8.0.x，应在编码前确认小版本，改用对应官方镜像并重新确定验证基线；不得混用不同版本证据。

## 3. Docker Compose 设计

建议服务：

| 服务 | 用途 | 持久化 |
| --- | --- | --- |
| `mysql` | 开发数据库 | named volume |
| `mysql-test` | 独立测试数据库 | 临时 volume 或每次重建 |
| `backend` | NestJS API | 无状态 |
| `web` | web-admin 静态资源/反向代理 | 无状态 |

建议网络：

- 仅 backend 可访问数据库端口。
- 开发环境可映射 MySQL 端口到 localhost，生产 compose 不对外暴露。
- 测试数据库禁止使用开发库名或生产库名。

## 4. 初始化与权限

数据库初始化必须创建：

- 独立应用数据库。
- 独立测试数据库。
- 迁移账号：拥有 DDL 权限，仅本地/CI 使用。
- 运行账号：仅业务表 DML 权限，不使用 root。
- 字符集：`utf8mb4`。
- 时区：数据库保存 UTC，业务时区由 Store 配置。

禁止：

- 应用使用 root。
- 在启动时自动执行 `db push`。
- 用清空开发库代替测试库隔离。

## 5. 迁移策略

### 5.1 Schema 与迁移来源

- `backend/prisma/schema.prisma` 是模型结构声明源。
- `backend/prisma/migrations` 是数据库变更可执行源。
- 现有 `docs/architecture/v1.2/constraints.sql` 只作为设计输入。
- 进入工程实现时，补充约束必须纳入 Prisma migration SQL。
- CI 只执行 `prisma migrate deploy`，禁止执行 `prisma db push`。

### 5.2 首版迁移拆分

建议拆为：

1. `0001_initial_schema/migration.sql`
   - Prisma 从空库生成全部表、外键、普通索引和 Prisma 可表达唯一约束。
2. `0002_domain_constraints/migration.sql`
   - 生成列。
   - CHECK 约束。
   - 触发器。
   - Prisma 无法表达的唯一约束。
   - 单店 seed 前置约束相关表不需要额外 SQL。

提交前必须验证：

- 空库执行 `migrate deploy` 成功。
- 第二次执行是 no-op。
- 重复创建数据库后结果一致。
- MySQL DDL 会隐式提交；迁移失败后必须删除并重建测试库，不能继续使用半初始化 Schema 作为验收环境。

### 5.3 约束 SQL 一致性

从 `constraints.sql` 迁移到正式 migration 时：

- 修复所有非法 `END$$$`。
- 保留 `END$$` 作为多语句触发器结束符。
- 执行前做 DELIMITER 结构检查。
- 执行后查询 `information_schema`，核对约束、触发器和生成列数量。
- migration 是唯一执行源，文档不是。

## 6. 约束验证矩阵

| 编号 | 验证项 | 预期 |
| --- | --- | --- |
| C01 | 同桌第二个 OPEN session | 唯一约束拒绝 |
| C02 | activeSessionId 指向其他桌/已关闭 session | 触发器拒绝 |
| C03 | 不存在的 Product/Category/Material 外键 | FK 拒绝 |
| C04 | Product 引用其他 Store 的 Category | 触发器拒绝 |
| C05 | Variant 引用其他 Product | 归属不可变约束/服务校验拒绝 |
| C06 | RecipeVersion 属于其他 Variant | 触发器拒绝 |
| C07 | OrderItem 引用其他 Variant 的 RecipeVersion | 触发器拒绝 |
| C08 | 金额为负 | CHECK 拒绝 |
| C09 | Payment 同时关联 Session 和 Order，或两者都空 | CHECK 拒绝 |
| C10 | Refund 超过原 Payment 可退余额 | 触发器/服务事务拒绝 |
| C11 | ACTIVE/ARCHIVED 配方新增明细 | 触发器拒绝 |
| C12 | ACTIVE 回退 DRAFT、ARCHIVED 重新激活 | 触发器拒绝 |
| C13 | 同一 Variant 两个 ACTIVE 配方 | 生成列唯一拒绝 |
| C14 | 更新/删除 StockMovement、LossRecord、Payment、Refund、AuditLog | append-only 触发器拒绝 |
| C15 | 跨店 Material/StockMovement/Loss/Payment | 触发器拒绝 |

每条测试必须同时断言：

- 操作失败。
- 错误类型/消息符合目标约束。
- 失败后数据库没有部分写入。
- 源表数据与预期一致。

不能只断言“请求返回 500”。

## 7. 事务与并发验证矩阵

使用至少 20 个独立连接。推荐每个测试连接使用独立 PrismaClient 或 mysql2 connection，连接池上限设为 1，以消除连接复用造成的假并发。

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| T01 | 两位顾客同时为首单创建 T01 session | 只创建一个 OPEN session |
| T02 | 同一 session 同时加两单 | 两单进入同一 session，无重复 session |
| T03 | 最后一单位原料被两单同时预占 | 一单成功，一单库存不足，整体回滚 |
| T04 | 多材料预占中途一个失败 | 前面材料的 reserved/流水全部回滚 |
| T05 | 同一订单重复开始制作 | 只产生一次 CONSUME |
| T06 | 同一幂等 Key 同时创建订单 | 只创建一单，返回一致响应 |
| T07 | 同一收款请求并发重复 | 只产生一条 PaymentRecord |
| T08 | 同一 Payment 并发退款 | 累计退款不超过可退额 |
| T09 | 桌单关闭与新订单提交并发 | 关闭后不能再新增订单 |
| T10 | 制作前取消两次并发 | 只释放一次预占 |
| T11 | 制作后取消记录损耗 | LossRecord 只一条，库存不二次扣减 |
| T12 | 两个不同幂等 Key 同时登记同额收款 | 不能超过应收 |

## 8. 测试数据与清理

- 每个测试文件使用固定 seed fixture 和独立 schema/database。
- 固定 ID 仅用于测试，生产 ID 使用自增 BigInt。
- 失败后保留数据库快照/查询结果作为证据，不自动清理现场。
- 成功后清理测试库或 schema。
- 清理脚本必须验证库名以 `_test` 结尾，禁止对开发库/生产库执行。

## 9. 数据库证据格式

`docs/database-verification.md` 后续必须包含：

1. MySQL 实际版本和隔离级别。
2. Docker 镜像 digest。
3. 空库初始化命令和输出。
4. `prisma migrate deploy` 输出。
5. 约束清单查询结果。
6. C01-C15 执行结果。
7. T01-T12 并发执行结果。
8. 失败命令、错误码和修复记录。
9. 仍未验证的事项。
10. 执行时的 commit SHA。

状态只能使用：

- 已执行且通过
- 已执行但失败
- 仅完成静态检查
- 尚未执行
- 环境原因无法执行

## 10. 本阶段验收门槛

必须同时满足：

- Docker daemon 可用。
- MySQL 8 实际启动并记录版本。
- 正式迁移在空库成功。
- 补充约束在迁移中成功创建。
- 数据库约束测试全部通过。
- T01-T12 并发测试至少有可复现执行证据。
- 所有失败项有结论，不允许静默通过。

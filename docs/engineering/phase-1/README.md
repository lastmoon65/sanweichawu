# 三味茶屋第一阶段工程设计

状态：第一阶段设计已通过 Gate 0；当前实现进度见下方
修订日期：2026-11-13
修订起点：`8ec84a8`

本目录包含第一阶段设计，以及 P1-01、P1-02-A、P1-02-B 的实现与验证记录。当前字段和迁移的权威依据是 P1-02-A 冻结字段契约与 P1-02-B3 Migration 报告。

## 当前进度

- P1-01 Node.js 22 工具链与 npm workspace：已通过验收，保持冻结。
- P1-02-A 字段决策与 21 模型字段契约：已通过验收。
- P1-02-B1 Prisma Schema：已通过验收。
- P1-02-B2 Schema 静态契约检查：已通过验收。
- P1-02-B3 Migration 生成与 SQL 静态审查：已完成，等待独立审查；真实 MySQL 8.4 尚未执行。
- P1-02-B4 真实 MySQL 迁移、约束与数据库行为验证：未开始。

## 评审顺序

1. [仓库现状检查](./01-repository-assessment.md)
2. [工程结构设计](./02-engineering-structure.md)
3. [核心数据模型设计](./03-domain-model.md)
4. [MySQL 8 验证方案](./04-mysql-verification-plan.md)
5. [第一阶段实施计划](./05-implementation-plan.md)
6. [P1-01 验证记录](./p1-01-verification.md)
7. [P1-02-A Prisma Schema 交付报告](./p1-02-a-schema-report.md)
8. [P1-02-A 冻结字段契约](./p1-02-a-field-contract.md)
9. [P1-02-B3 Migration 生成与静态审查报告](./p1-02-b3-migration-report.md)

## 设计期评审记录

> 以下内容是设计期历史记录，其中部分口径已被后续冻结决策替代。例如最终 21 模型不再包含 Merchant，`Order.discountFen` / `DiningSession.discountFen` 已删除，首版也不引入触发器或生成列。当前实现以 P1-02-A 字段契约和 P1-02-B 系列报告为准。

1. **优惠进一步收缩**
   - 保留 `Order.discountFen`、`DiningSession.discountFen`，默认值为 0，并以 CHECK 约束拒绝非零写入。
   - 首版迁移不创建 `DiscountAllocation` 表。
   - 首版不创建优惠相关触发器。
   - 不实现优惠 API、分摊和审核。
   - 未来通过独立数据库迁移增加优惠功能。

2. **P1-05 缩小为测试专用事务验证工具**
   - 不提前实现一套与后续正式业务服务重复的业务内核。
   - 只实现最小数据库事务验证代码。
   - 正式业务服务在后续对应阶段实现。

3. **并发测试方式**
   - 普通竞态使用 2～5 个独立数据库连接和同步屏障。
   - 库存预占单独执行 100 请求并发压力测试。
   - 所有并发测试必须真实连接 MySQL。
   - 保留关键场景最终数据库状态断言。

4. **桌单关闭规则**
   - 所有订单必须完成。
   - 桌单净未结金额必须为 0。
   - 关闭后释放桌位。
   - 增加未完成、未结清、正常关闭及与新订单并发测试。

5. **Gate 0 调整**
   - Node.js 22 工具链和 workspace 不等待 Docker daemon。
   - MySQL 迁移、约束和并发测试必须等待真实 MySQL 8 环境。
   - 未执行测试不得标记为通过。

6. **技术决策**
   - 项目名称暂统一为“三味茶屋”。
   - 保留 `Merchant → Store` 数据归属模型，但每次部署只初始化一个 Store。
   - MySQL 采用 8.4 LTS，并固定镜像 digest。
   - 商家端采用 React + Vite + TypeScript。

## 待确认事项

1. 员工认证方式：用户名密码、PIN、企业微信或其他。
2. 员工认证确定前不冻结 `StaffCredential` 字段。
3. 微信小程序正式 AppID/AppSecret 和部署环境的提供时间。
4. MySQL 8.4 具体不可变镜像 digest 在工程实施时确定并记录。

## 新的 Gate 0 条件

Gate 0 只负责设计授权，不再要求 Docker daemon 或 MySQL 可用。

通过条件：

- 五份设计文档已反映本轮全部评审意见。
- 项目名称、单店 Store 归属根、MySQL 8.4、React/Vite 决策已确认。
- 优惠首版范围和不创建项已确认。
- P1-05 仅限测试专用验证工具，不是正式业务服务。
- 员工认证仍可待确认，但必须在 P1-04 开工前解决。

Gate 0 通过后允许建设：

- Node.js 22 工具链。
- npm workspace。
- 基础目录。
- 不依赖 MySQL 的纯单元工具和静态配置。

MySQL 相关任务统一后移到真实 MySQL 8 环境门禁，不以未执行结果作为通过。

## 本轮非目标

本轮不创建 NestJS 业务实现，不创建正式数据库迁移，不开发商品、点单、库存和经营分析业务，不进入第二阶段。

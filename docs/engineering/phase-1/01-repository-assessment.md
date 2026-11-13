# 任务 1：仓库现状检查

> 历史说明：第 1、2 节记录起始提交 8ec84a8 的初始评审快照，不代表当前仓库状态或当前环境。P1-01 后的状态见第 5 节。

## 1. 初始评审仓库快照（8ec84a8）

- 当前分支：`main`
- 评审基线提交：`8ec84a8 docs: add phase one engineering design`
- 工作区状态：干净
- 当前工程名称：三味茶屋（原型和 V1.2 旧文档中的“山隐茶事”保留为历史名称）
- 命名决策：待确认阶段结束，工程文档统一使用“三味茶屋”
- 当前代码性质：纯前端经营原型 + V1.2 数据模型设计材料
- 正式后端：不存在
- 正式数据库迁移工程：不存在
- Docker Compose：不存在
- 微信小程序工程：不存在
- 商家端正式 Web 工程：不存在

## 2. 初始环境检查快照（`8ec84a8`）

| 项目 | 当前值 | 与目标差异 | 处理建议 |
| --- | --- | --- | --- |
| Node.js | `v24.21.0` | 任务书要求 Node.js 22 | 开工前通过 `.nvmrc` / `engines` 固定到 Node 22 LTS，并在 Node 22 下重跑全部工程命令 |
| npm | `11.19.0` | 可使用 | 采用 npm workspaces，避免额外包管理器基线 |
| Git | `2.47.1` | 可使用 | 保持 main + feature branch 工作流 |
| Python | `3.13.0` | 原型验收可用 | 正式工程测试不依赖 Python |
| Docker CLI | `29.4.0` | 客户端存在 | 需要启动 Docker daemon |
| Docker daemon | 当前不可用 | 阻塞 MySQL Compose 和真实数据库测试 | 第一阶段数据库任务开始前必须修复 |
| MySQL/MariaDB | 未安装 | 无法执行 DDL、约束和并发测试 | 不安装本机 MySQL，使用固定 digest 的 MySQL 8.4 LTS 容器 |

## 3. 可复用资产

### 3.1 可继续复用

| 资产 | 复用方式 | 边界 |
| --- | --- | --- |
| `docs/architecture/v1.2/schema.prisma` | 作为正式 Schema 候选基线 | 需补身份凭据模型、调整命名说明并重新生成迁移 |
| `docs/architecture/v1.2/er-diagram.md` | 作为核心关系和评审输入 | 需改成工程版实体命名映射 |
| `docs/architecture/v1.2/transactions.md` | 作为事务、锁顺序和异常路径设计输入 | 必须落为真实服务测试后才算实现 |
| `docs/architecture/v1.2/constraints.sql` | 作为数据库约束来源 | 尚未在 MySQL 8 执行，不能视为已通过 |
| `docs/architecture/v1.2/store-integrity.md` | 作为跨店/归属校验规则 | 单店仍保留 store scope |
| `docs/architecture/v1.2/consistency-checks.md` | 作为对账 SQL 和不变量清单 | 第一阶段需转成可执行数据库测试 |
| `tests/analytics_completion_day.py` | 保留 completedAt 统计业务期望 | 属于原型验收，不是正式后端测试 |
| `tests/refund_flow.py` 等 Playwright 脚本 | 作为交互需求与回归样例 | 不能替代 API、数据库和并发测试 |
| 原型 UI 与截图 | 作为商家端平板优先的信息架构参考 | 不直接沿用 localStorage 数据层 |

### 3.2 只能参考，不能直接上线

- 根目录 `app.js`、`store.js`、`data.js`、`bundle.js`：浏览器 localStorage 原型。
- `server.js`：静态文件服务器，不是业务后端。
- `generated-mysql-ddl.sql`：生成参考物，不是正式迁移源。
- 原型中的内存并发模拟：不能替代 MySQL 行锁与事务测试。
- 原型中的简化堂饮收款/退款：不是正式资金闭环。

## 4. 需要调整的现有设计

### 4.1 命名差异

任务书使用：

- `Recipe`
- `RecipeItem`
- `TableSession`
- `InventoryTransaction`

现有 Schema 使用：

- `RecipeVersion` / `VariantRecipe`
- `DiningSession`
- `StockMovement` / `LossRecord`

建议保留现有表名，避免为了名称一致而重写已审查模型。工程文档建立领域名映射：

| 任务书领域名 | 当前实现模型 |
| --- | --- |
| Recipe（逻辑配方） | 一个 `ProductVariant` 下的 `RecipeVersion` 历史 |
| RecipeItem | `VariantRecipe` |
| TableSession | `DiningSession` |
| InventoryTransaction（数量流水） | `StockMovement` |
| InventoryLoss（成本损耗事实） | `LossRecord` |

`StockMovement` 和 `LossRecord` 分开是已确认设计：库存数量变化与损耗成本归因不能混为一条事实。

### 4.2 单店与 Store 模型

当前 Schema 有 `Merchant → Store`。任务书要求单店、非多租户 SaaS。

建议：

- 保留 `Store` 作为所有业务数据的归属边界，继续支持现有跨店完整性约束。
- 每次部署只允许一个活动 Store。
- 不提供门店创建、门店切换、Merchant 管理 API。
- 不把 `storeId` 当作可编辑业务字段；由服务端认证上下文注入。
- 通过部署种子脚本创建唯一 Store。

这是“单店系统使用单条 Store 记录”，不是多租户产品。该模型已经评审确认。

### 4.3 优惠范围（已确认收缩）

首版正式工程只保留：

- `Order.discountFen`，默认值 0。
- `DiningSession.discountFen`，默认值 0。
- 两个字段首版均以 CHECK 约束强制等于 0；INSERT/UPDATE 非零值必须失败。

首版迁移明确不创建：

- `DiscountAllocation` 表。
- 优惠分摊相关生成列、索引、CHECK 和触发器。

首版不实现：

- 优惠 API。
- 优惠分摊。
- 优惠审核。
- 任何写入非零优惠的业务路径。

未来增加优惠时，必须通过独立数据库迁移和独立业务评审。现有 V1.2 Schema 中的 `DiscountAllocation` 只作为后续设计参考，不进入首版迁移。

### 4.4 身份模型缺口

现有 `User.openid` 支持顾客微信身份，但 `Staff` 没有正式登录凭据。

第一阶段需补：

- 店主初始账号的创建方式。
- 店员登录方式：用户名密码、PIN、企业微信或其他。
- 密码或 PIN 的哈希算法与失败锁定策略。
- 顾客 JWT 与员工 JWT 的 claim 结构。
- 员工角色以数据库为准，不能信任前端音 role。

该项会决定是否新增 `StaffCredential` 等模型。

### 4.5 当前 SQL验证状态

- 静态结构：已检查。
- Prisma validate：已通过。
- MySQL 8 实机：未执行。
- Docker daemon：当前不可用。
- 因此不能把现有 `constraints.sql` 作为“已验证迁移”。

## 5. P1-01 后的工程状态

P1-01 已完成：

- 根目录 npm workspace 和锁文件。
- Node.js 22 工具链。
- NestJS backend 最小骨架。
- web-admin React/Vite/TypeScript 骨架。
- mini-program 微信原生 TypeScript 骨架。
- ESLint、Prettier、Vitest。
- `.env.example` 和根级 `npm run verify`。
- backend、web-admin、mini-program 构建。

仍未开始：

1. Prisma Schema 接入和数据库迁移。
2. MySQL/Docker 数据库环境与真实数据库测试。
3. NestJS 全局配置、异常、响应、日志和健康检查。
4. 身份认证、授权 Guard 和请求上下文。
5. 正式业务模块、API 和集成测试。
6. CI/CD 和部署编排。

P1-01 不依赖 Docker、MySQL 或员工认证方案；这些不会阻塞已完成的工具链建设。

## 6. 仍需确认与后续门禁

仍需确认：

1. 员工认证方式：用户名密码、PIN、企业微信或其他。
2. 员工认证确定前，不冻结 `StaffCredential` 字段。
3. 微信小程序正式 AppID/AppSecret 和部署环境提供时间。
4. MySQL 8.4 具体不可变镜像 digest 在 P1-02 实施时确定。

已确认：

- 项目名称暂统一为三味茶屋。
- 保留单实例 `Merchant → Store` 归属模型。
- MySQL 采用 8.4 LTS。
- 商家端采用 React + Vite + TypeScript。
- 优惠首版范围按 4.3 收缩。

后续门禁：

- MySQL 8 真实验证必须在 Gate 2 前完成。
- 员工认证方案必须在 P1-04 实施前确认。
- P1-01 已完成，不以 Docker 或员工认证未决为理由阻止工具链验收。
- P1-02 及以后不因本轮文档修订自动启动。

## 7. 现状结论

可以复用 V1.2 的业务规则、数据模型草案和原型验收场景；当前 workspace 和三个最小工程骨架已经建立，但仍不能把 P1-01 骨架视为正式业务实现。

下一步是人工验收 P1-01。验收通过后，才按计划评估 P1-02；MySQL 实机验证仍属于 Gate 2 门禁。

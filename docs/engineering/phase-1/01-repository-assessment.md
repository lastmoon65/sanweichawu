# 任务 1：仓库现状检查

## 1. 仓库快照

- 当前分支：`main`
- 最新提交：`3451e14 docs: record V1.2 SQL and analytics verification`
- 工作区状态：干净
- 现有产品名称：原型和 V1.2 文档主要使用“山隐茶事”
- 任务书名称：三味茶屋
- 当前代码性质：纯前端经营原型 + V1.2 数据模型设计材料
- 正式后端：不存在
- 正式数据库迁移工程：不存在
- Docker Compose：不存在
- 微信小程序工程：不存在
- 商家端正式 Web 工程：不存在

## 2. 环境检查

| 项目 | 当前值 | 与目标差异 | 处理建议 |
| --- | --- | --- | --- |
| Node.js | `v24.21.0` | 任务书要求 Node.js 22 | 开工前通过 `.nvmrc` / `engines` 固定到 Node 22 LTS，并在 Node 22 下重跑全部工程命令 |
| npm | `11.19.0` | 可使用 | 采用 npm workspaces，避免额外包管理器基线 |
| Git | `2.47.1` | 可使用 | 保持 main + feature branch 工作流 |
| Python | `3.13.0` | 原型验收可用 | 正式工程测试不依赖 Python |
| Docker CLI | `29.4.0` | 客户端存在 | 需要启动 Docker daemon |
| Docker daemon | 当前不可用 | 阻塞 MySQL Compose 和真实数据库测试 | 第一阶段数据库任务开始前必须修复 |
| MySQL/MariaDB | 未安装 | 无法执行 DDL、约束和并发测试 | 不安装本机 MySQL，优先使用固定 MySQL 8 容器 |

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

这是“单店系统使用单条 Store 记录”，不是多租户产品。需要评审确认。

### 4.3 优惠范围冲突

任务书暂缓优惠，现有 Schema 已包含：

- `Order.discountFen`
- `DiningSession.discountFen`
- `DiscountAllocation`
- 相关触发器

建议第一阶段：

- 保留金额字段，强制默认值 0。
- 不实现优惠 API、优惠分摊和优惠审核。
- `DiscountAllocation` 是否保留在首版迁移需要评审：
  - 方案 A：保留表但禁用，后续不需要大迁移。
  - 方案 B：首版不建表，后续增加迁移。
- 推荐方案 A，保持 V1.2 结构连续，但业务代码必须拒绝非零优惠。

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

## 5. 当前工程缺口

1. 根目录无 `package.json` 和 workspace 配置。
2. 无 NestJS 应用和设备/API 分层。
3. 无 `backend/prisma/migrations`。
4. 无数据库容器和健康检查。
5. 无身份认证、授权 Guard、请求上下文。
6. 无统一异常、响应、日志和 BigInt 序列化。
7. 无正式 API 测试、真实数据库测试和并发测试。
8. 无 `web-admin`、`mini-program` 工程。
9. 无环境变量示例、秘密管理说明。
10. 无 CI 或本地一键验证脚本。

## 6. 需要人工确认的事项

1. 项目名称最终采用“三味茶屋”还是“山隐茶事”；当前代码与任务书名称不一致。
2. 是否接受保留单实例 `Merchant/Store` 作为数据归属根。
3. 员工登录采用账号密码、PIN，还是企业微信等外部身份。
4. 首版是否保留 `DiscountAllocation` 表但全部禁用。
5. MySQL 使用 8.4 LTS，还是指定已有生产环境的 8.0.x 小版本。
6. 商家端 Web 是否接受 React + Vite + TypeScript 作为实现栈。

## 7. 现状结论

可以复用 V1.2 的业务规则、数据模型草案和原型验收场景；不能把当前纯前端原型当作正式工程底座。

正式开工前必须先完成：

- Node 22 工具链固定。
- Docker daemon/MySQL 8 可用。
- 身份方案确认。
- Schema 与首版迁移边界确认。

在上述事项完成前，不创建业务模块和大规模工程代码。

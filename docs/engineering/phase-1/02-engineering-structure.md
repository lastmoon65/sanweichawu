# 任务 2：工程结构设计

## 1. 总体结构

采用 npm workspaces 管理的模块化单体仓库。

设计原则：

- `backend` 是唯一业务权威。
- `web-admin` 与 `mini-program` 只负责交互，不实现业务裁决。
- Prisma Schema 与迁移文件纳入版本控制。
- 补充 SQL 必须进入可执行迁移，不能只停留在文档。
- 数据库测试与前端测试分离，证据独立。
- 第一阶段不创建空业务模块；模块在对应阶段真正开始时创建。

## 2. 目标目录

```text
sanweichawu/
├─ package.json                         # workspace 根脚本
├─ package-lock.json
├─ .nvmrc                               # Node 22
├─ .env.example
├─ docker-compose.yml                   # backend + mysql + web
├─ README.md                            # 正式工程启动说明
│
├─ backend/
│  ├─ package.json
│  ├─ nest-cli.json
│  ├─ tsconfig.json
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  ├─ migrations/
│  │  │  ├─ 0001_initial_schema/migration.sql
│  │  │  └─ 0002_domain_constraints/migration.sql
│  │  └─ seed.ts
│  ├─ src/
│  │  ├─ main.ts
│  │  ├─ app.module.ts
│  │  ├─ common/
│  │  │  ├─ filters/
│  │  │  ├─ interceptors/
│  │  │  ├─ pipes/
│  │  │  ├─ serializers/
│  │  │  └─ errors/
│  │  ├─ config/
│  │  ├─ infrastructure/
│  │  │  ├─ prisma/
│  │  │  ├─ logging/
│  │  │  └─ health/
│  │  ├─ modules/
│  │  │  ├─ auth/
│  │  │  ├─ authorization/
│  │  │  ├─ audit/
│  │  │  └─ idempotency/
│  └─ test/
│     ├─ unit/
│     └─ integration/
│
├─ web-admin/
│  ├─ package.json
│  ├─ vite.config.ts
│  ├─ src/
│  │  ├─ app/
│  │  ├─ api/
│  │  ├─ auth/
│  │  ├─ components/
│  │  ├─ pages/
│  │  └─ styles/
│  └─ tests/
│
├─ mini-program/
│  ├─ project.config.json
│  ├─ tsconfig.json
│  ├─ miniprogram/
│  │  ├─ app.ts
│  │  ├─ app.json
│  │  ├─ api/
│  │  ├─ auth/
│  │  ├─ pages/
│  │  └─ utils/
│  └─ typings/
│
├─ database/
│  ├─ README.md
│  ├─ mysql/
│  │  ├─ init/
│  │  └─ verification/
│  └─ scripts/
│     ├─ wait-for-mysql.mjs
│     ├─ reset-test-db.mjs
│     └─ verify-version.mjs
│
├─ tests/
│  ├─ database/
│  │  ├─ constraints/
│  │  ├─ transaction-harness/
│  │  └─ concurrency/
│  ├─ integration/
│  └─ e2e/
│
└─ docs/
   ├─ architecture/v1.2/
   └─ engineering/phase-1/
```

## 3. 目录调整说明

### 3.1 Prisma 放在 `backend/prisma`

Prisma 官方工具链默认从应用目录读取 Schema 和迁移。将 Prisma 放在 `backend/prisma` 可以避免：

- `package.json` 与 Prisma CLI 分散。
- NestJS 构建路径跨目录。
- 两个独立 Node 工程重复安装 Prisma。

`database/` 保留数据库运维、初始化和验证能力，不复制 Prisma Schema。

### 3.2 不提前创建完整领域模块

第一阶段不创建空的 `orders`、`inventory`、`payments` 目录。只创建：

- 身份认证与授权。
- 审计。
- 幂等。
- 健康检查。
- 测试目录中的最小数据库事务验证工具；不进入生产运行模块。

第二阶段及以后每进入一个业务域，再创建对应模块和真实实现。

## 4. 技术职责

| 区域 | 技术 | 责任 |
| --- | --- | --- |
| 后端 | Node.js 22 + NestJS + TypeScript | REST API、认证、事务、业务权威 |
| ORM | Prisma 6.x | Schema、Client、迁移 |
| 数据库 | MySQL 8.4 LTS（固定镜像 digest） | 持久化、唯一索引、CHECK、触发器、行锁 |
| 商家端 | React + Vite + TypeScript | 平板优先 Web 管理界面 |
| 小程序 | 微信原生小程序 + TypeScript | 顾客身份、扫码、点单交互 |
| 实时 | WebSocket + REST 轮询兜底 | 订单状态通知；第一阶段仅预留架构 |
| 部署 | Docker Compose | backend、MySQL、web-admin / reverse proxy |

## 5. 后端模块职责

### `common`

- 统一成功响应。
- 统一错误响应和领域错误码。
- Request ID。
- BigInt/Decimal JSON 序列化。
- 全局 ValidationPipe。
- 全局异常过滤。
- 不允许控制器自行拼装不一致格式。

### `config`

- 环境变量解析和启动时校验。
- `DATABASE_URL`、JWT、微信 AppID/Secret 等必填项。
- 开发、测试、生产环境分离。
- 日志中禁止输出密钥、OpenID 和 token。

### `infrastructure/prisma`

- PrismaService 生命周期。
- 事务包装器。
- 测试数据库连接配置。
- 业务模块不得直接持有全局可写状态。

### `auth`

第一阶段实现真实可用的认证入口和测试身份，不创建假登录：

- 顾客微信登录入口：验证微信 code 后映射 `User.openid`。
- 员工登录入口：具体方式待业务确认。
- JWT 签发、校验和过期处理。
- 角色与 storeId 来自服务端认证上下文。

### `authorization`

- `@Roles()` 或等价装饰器。
- OWNER / MANAGER / STAFF 最小角色守卫。
- 资源归属 Guard：`customerUserId`、`storeId` 必须进入数据库查询条件。
- 不允许前端传入可信任的 `userId`、`role` 或 `storeId`。

### `audit`

- 统一写 AuditLog。
- 绑定 actor、动作、目标、前后数据和 requestId。
- 审计失败策略在第一阶段明确：关键财务操作审计失败必须回滚业务事务。

### `idempotency`

- 统一读取 `Idempotency-Key`。
- `(storeId, endpoint, idempotencyKey)` 唯一。
- 相同 key、不同 requestHash 返回冲突。
- 响应和业务记录同事务提交。

### 数据库事务验证工具（仅测试）

第一阶段不创建生产用 `transactional-kernel` 模块，避免与后续正式业务服务重复实现。

在 `tests/database/transaction-harness` 中提供测试专用事务夹具，仅用于：

- 同桌首单并发验证。
- 库存预占与整事务回滚。
- 幂等记录同事务验证。
- 收款金额上限验证。
- 退款额度竞争验证。
- 桌单关闭与新订单竞争验证。

这些工具：

- 不进入 `backend/src` 生产依赖。
- 不暴露业务 API。
- 不作为后续正式业务服务实现。
- 只负责按设计锁顺序执行测试事务并断言数据库事实。

正式订单、库存、收款和桌单服务在后续对应阶段实现，届时复用本阶段已验证的数据库约束、锁顺序和事务模式，而不是复制测试夹具。

## 6. 运行时边界

```text
mini-program ─┐
              ├─ HTTPS REST /api/v1 ─ NestJS ─ Prisma ─ MySQL 8
web-admin ────┘                         │
                                        ├─ Audit
                                        ├─ Idempotency
                                        └─ WebSocket（后续阶段）
```

- 只有 NestJS 访问数据库。
- 小程序和 Web 不连接 MySQL。
- WebSocket 不绕过 REST 事务。
- 店员操作必须记录 actorStaffId。
- 顾客请求必须通过 customerUserId 约束数据范围。

## 7. 统一 API 约定

- 版本前缀：`/api/v1`。
- 健康检查：`GET /api/v1/health/live`、`GET /api/v1/health/ready`。
- 成功响应：`{ "data": ..., "requestId": "..." }`。
- 错误响应：`{ "error": { "code", "message", "details" }, "requestId": "..." }`。
- 金额传输：整数分；不使用浮点数。
- ID 传输：数据库 BigInt 统一转 string。
- 写请求支持 `Idempotency-Key` 时必须在文档中明确。
- 时间统一 ISO 8601，数据库保存 UTC，营业日按 Store timezone/cutoff 计算。

## 8. 配置与秘密

环境变量至少包括：

```text
NODE_ENV
PORT
DATABASE_URL
TEST_DATABASE_URL
JWT_ACCESS_SECRET
JWT_ACCESS_TTL
WECHAT_APP_ID
WECHAT_APP_SECRET
LOG_LEVEL
```

要求：

- `.env` 不入库。
- `.env.example` 只放占位符。
- 测试环境使用独立数据库名，且名称必须以 `_test` 结尾。
- 启动时校验必需配置，缺失则拒绝启动。

## 9. 测试结构

- `backend/test/unit`：纯函数、Guard、错误映射、金额/时间工具。
- `backend/test/integration`：Nest + Prisma + 真实 MySQL 的 API 集成。
- `tests/database/constraints`：CHECK、唯一索引、触发器和外键。
- `tests/database/concurrency`：2～5 个独立连接同步屏障竞态，以及库存预占 100 请求压力测试。
- `tests/e2e`：跨端主链路，后续阶段启用。
- 前端可采用 Vitest + Testing Library；正式 E2E 后续使用 Playwright 对接真实 API。

任何数据库测试不得 mock Prisma 核心事务。

## 10. 工程结构验收标准

1. 所有子工程在 Node 22 下可安装、构建和测试。
2. 根目录一条命令可启动 MySQL 和 backend。
3. `/api/v1/health/live`、`/ready` 返回真实状态。
4. Prisma Schema 可通过正式迁移在空 MySQL 建库。
5. 测试脚本可创建、迁移、清理独立测试库。
6. 前端骨架可以访问健康检查，不包含内存业务数据。
7. 目录中不存在大量空 Controller、空 Service 或 TODO 占位。

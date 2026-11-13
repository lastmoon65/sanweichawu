# P1-01 验证记录

验证日期：2026-11-13（Asia/Shanghai）

P1-01 实现提交：`dcd9135`

## 1. 工作区检查

- 分支：`main`
- 起始工作区：干净
- 本轮只创建 Node.js 22 工具链和三个最小 workspace。
- 未创建业务模块、认证入口、数据库迁移或正式数据层。

## 2. Node.js 与 npm

实际执行：

```powershell
nvm install 22.22.3
nvm use 22.22.3
$env:PATH = 'C:\Users\zhy70\AppData\Local\nvm\v22.22.3;' + $env:PATH
node --version
npm --version
```

结果：

```text
v22.22.3
10.9.8
```

工程固定：

- `.nvmrc`：`22.22.3`
- `.node-version`：`22.22.3`
- `engines.node`：`>=22.22.3 <23`
- `engines.npm`：`>=10.9.8 <11`
- `packageManager`：`npm@10.9.8`
- `.npmrc`：`engine-strict=true`

## 3. 依赖安装

执行：

```powershell
npm ci
```

结果：

```text
added 346 packages, and audited 350 packages
found 0 vulnerabilities
```

`package-lock.json` 已生成并提交。

## 4. 完整验证

执行：

```powershell
npm run verify
```

该命令实际执行了：

```text
npm run lint
npm run format:check
npm run test --workspaces --if-present
npm run build --workspaces --if-present
npm audit --omit=dev
```

结果：

| 项目 | 结果 |
| --- | --- |
| ESLint | 通过，0 warning |
| Prettier check | 通过 |
| backend test | Vitest 5.1.0，1 文件 / 1 测试通过 |
| web-admin test | Vitest 5.1.0，1 文件 / 1 测试通过 |
| mini-program test | Vitest 5.1.0，1 文件 / 1 测试通过 |
| backend build | `tsc -p tsconfig.build.json` 通过 |
| web-admin build | `tsc --noEmit && vite build` 通过 |
| mini-program build | `tsc -p tsconfig.build.json` + 静态资源复制通过 |
| production audit | 0 vulnerabilities |
| full dependency audit | 0 vulnerabilities |

## 5. 构建产物

确认存在：

- `backend/dist/main.js`
- `mini-program/dist/app.js`
- `mini-program/dist/app.json`
- `mini-program/dist/app.wxss`
- `mini-program/dist/pages/index/index.js`
- `mini-program/dist/pages/index/index.wxml`
- `mini-program/dist/pages/index/index.wxss`
- `web-admin/dist/index.html`

微信开发者工具本轮未启动；小程序只验证 TypeScript 构建和静态资源复制。

## 6. 后端启动探测

执行：

```powershell
$env:PORT = 3187
node backend/dist/main.js
```

结果：

```text
backend process alive=True port3187=True
```

补充验证：

```powershell
node --env-file=.env.example -e "console.log(process.env.PORT)"
```

结果：`3000`。

创建临时 `.env` 写入 `PORT=3333` 后，直接启动 backend：

```text
default port3000=True
env-file port3333=False
```

说明当前应用不会自动加载 `.env`。删除临时文件后，显式设置 `$env:PORT=3187` 启动：

```text
explicit PORT=3187 listening=True
```

端口由 `process.env.PORT` 读取，未设置时默认 `3000`。测试进程均已停止。

## 7. 未执行项

- 未执行 MySQL 初始化、迁移、约束和并发测试。
- Docker daemon 未启动。
- 未执行微信开发者工具预览。
- 未实现任何业务、认证或数据库访问。

上述未执行项不属于 P1-01 的通过声明。

## 8. 工具链调整记录

本轮实际遇到并修正：

1. NestJS 12 的 peer 要求最低 Node 22.22.3，因此从已安装的 22.15 升级并固定到 22.22.3。
2. Nest CLI 12 与 `@nestjs/schematics` 会引入 TypeScript 7 peer，而 Nest CLI 当前要求 TypeScript 6 编译 API。为避免同一仓库出现两套不兼容编译器，P1-01 改用标准 `tsc` 构建、`tsx watch` 开发，不依赖 Nest CLI 代码生成器。
3. TypeScript 6 拒绝旧 `node10` 模块解析；后端迁移到 NodeNext，小程序迁移到 Node16。
4. 初次安装出现的开发工具链漏洞已通过升级 Vitest 5、ESLint 10 和最小版本 override 消除；最终 `npm audit` 为 0。

上述调整只影响 P1-01 工具链，不涉及业务架构或数据库设计。

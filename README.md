# 三味茶屋 · 单店现制茶饮经营管理系统 Web 原型

版本：V1.0  
阶段：产品原型验证  
形态：纯前端、无后端、无第三方依赖

## 1. 如何启动

Windows 下可以直接双击 `index.html`。也可以双击 `start.cmd`，它会启动本地服务器并自动打开浏览器。

也可以在当前目录打开终端，执行：

```powershell
node server.js
```

然后浏览器访问：

```text
http://127.0.0.1:8787
```

项目还提供 `server.js`。启动后监听 `127.0.0.1:8787`，可直接用于花生壳本地映射。`index.html` 默认加载无需服务器的 `bundle.js`；如果修改了 `data.js`、`store.js` 或 `app.js`，运行 `build.ps1` 重新生成兼容包。

项目文件：

- `index.html`：入口
- `styles.css`：界面与响应式样式
- `data.js`：演示商品、原料、配方和初始订单数据
- `store.js`：订单状态机、库存、桌单、结账和持久化逻辑
- `app.js`：五个角色视图、弹窗、图表和交互
- `bundle.js`：供直接双击 `index.html` 加载的兼容打包文件
- `build.ps1`：源码修改后重新生成 `bundle.js`
- `tests/`：Playwright 验收脚本与截图

## 花生壳映射

当前本地服务由 Windows 计划任务 `TeaHousePrototype` 常驻运行：

```text
本地地址：http://127.0.0.1:8787
健康检查：http://127.0.0.1:8787/health
```

花生壳新增 HTTP/HTTPS 映射时填写：

- 内网主机：`127.0.0.1`
- 内网端口：`8787`
- 访问路径：`/`
- 映射地址：使用花生壳生成的域名或 HTTPS 地址

常用管理：

- 双击 `start.cmd`：启动或重载服务，并打开本机页面
- 双击 `restart.cmd`：重启服务
- 双击 `stop.cmd`：停止服务
- 查看状态：`schtasks /Query /TN "TeaHousePrototype" /V /FO LIST`
- 健康检查：`http://127.0.0.1:8787/health`

锁屏和关闭显示器不会停止服务。当前接电状态下系统睡眠、休眠均为“从不”；注销或重启后，需要用户重新登录并自动恢复任务。网络、路由器或花生壳本身故障仍可能导致外网地址不可访问。

注意：这是纯前端演示，不包含登录和后端数据。每位访问者看到的数据独立保存在自己的浏览器中，互相之间不会同步。若花生壳支持访问密码，建议演示期间开启。

## 2. 五个视图

顶部导航可以切换五个角色：

1. **顾客点单**：模拟微信小程序，包含扫码选桌、商品详情、规格/浓淡/冲泡方式、备注、购物车、堂饮/打包提交和历史订单。
2. **店员工作台**：平板优先的订单处理界面，支持接单、开始制作、制作完成、取消和订单详情。
3. **桌位与结账**：T01–T08 桌位平面状态、同桌多订单汇总、优惠/实收/未结金额、结账关闭和历史桌单。
4. **商品与库存**：茶品、规格售价、上下架、原材料、入/出库调整、预警、规格级配方和库存流水。
5. **经营分析**：销售额、优惠、实收、未结、材料毛利、商品多维排行、桌位贡献、原料消耗和库存变化。

## 3. 如何模拟扫码

1. 进入“顾客点单”。
2. 点击 T01–T08 任一桌位卡片，模拟二维码扫描结果。
3. 此时选择堂饮商品，订单会关联当前桌号与桌单。
4. 页面顶部提供“重新扫码”，可以切换到其他桌位。
5. 点击“打包”可进入打包模式，不关联任何桌位。

## 4. 一次完整演示建议

1. 扫 T01 桌码，选择大红袍单人份，设置浓郁、盖碗冲泡，提交。
2. 点击“继续加单”，再提交一杯铁观音，确认两笔订单属于同一桌单。
3. 切到“店员工作台”，分别对两笔订单执行“接单 → 开始制作 → 制作完成”。
4. 切到“桌位与结账”，打开 T01，填写优惠和实收，确认未结金额，完成结账并释放桌位。
5. 回顾客端切换“打包”，提交一笔打包订单。
6. 在商品与库存页给大红袍原料入库，观察缺货状态恢复。
7. 在经营分析查看商品排行、桌位贡献、原料消耗和库存变化。

## 5. 订单与库存规则

- 订单状态只能向前流转：待接单 → 待制作 → 制作中 → 已完成。
- 提交订单时先校验可用库存，再增加“预占库存”。
- 开始制作时把预占转为实际消耗，并写入库存流水。
- 未制作订单取消时释放预占；制作后取消不恢复库存，而是记录损耗。
- 商品提交订单时保存售价、规格、配方、原材料单价和材料成本快照。
- 后续改商品价、配方或采购价，只影响新订单。
- 桌单有效金额只汇总未取消订单。
- 未结金额 = 应收 − 优惠 − 实收，不允许为负数。
- 存在待接单、待制作或制作中订单时不能关闭桌单。
- 打包订单不参与桌单金额。
- 销售毛利只计算商品材料成本，不含房租、人工和水电。

## 6. 数据持久化与重置

模拟数据保存在浏览器 `localStorage`：

```text
tea-house-prototype-v1
```

刷新页面后，订单、桌单、库存和商品修改仍然存在。

点击右上角圆形重置按钮，再确认“重置演示数据”，即可恢复初始状态。

初始数据包含：

- 8 个茶品、8 张桌位、10 种原料；
- 一张已关闭桌单；
- 一张待结账桌单；
- 一笔已完成打包订单；
- 24 小时内的示例经营数据。

## 7. 已完成与未完成边界

已完成的是前端可操作经营闭环，包括顾客下单、员工制作、桌单结账、原料库存、成本快照和实时经营分析。

本原型明确不包含：

- 真实微信小程序与扫码接口；
- 微信/支付宝支付；
- POS、打印机、叫号屏和 KDS 对接；
- 真实后端、数据库和账号登录；
- 多门店、加盟和连锁管理；
- 复杂会员、储值和财务总账；
- 采购审批和供应商结算。

## 8. 验收脚本

Playwright 已用于实际验收。脚本默认通过 `file://` 方式加载，因此不需要额外启动服务器：

```powershell
python tests/prototype_acceptance.py
python tests/extended_acceptance.py
python tests/edge_acceptance.py
python tests/interaction_checks.py
python tests/manual_payment.py
python tests/refund_flow.py
python tests/architecture_checks.py
```

截图输出在 `tests/screenshots/`。

## 9. 已知限制

- 并发是浏览器内 JavaScript 原子操作模拟，不能替代真实后端事务、数据库锁和分布式并发验证。
- 原型营业日暂按浏览器本地自然日计算，尚未实现可配置的 Store.businessDayCutoffMinute。
- 销售只统计 COMPLETED 订单并按 completedAt 归属；实收按有效收款/退款事件时间独立统计。
- 打包订单只有在店员手动登记后才计入实收；制作完成不会自动收款，且允许制作前先登记实际收款。
- 原型退款闭环目前覆盖打包订单的 PaymentRecord；堂饮桌单仍使用简化结算模型，不作为正式多收款/退款闭环的验收。
- 商品图片使用内置 SVG 插画与主题色模拟，未提供图片上传。
- 利润为材料毛利，不是净利润。
- 浏览器清理站点数据会清除原型数据。











## 10. 架构与数据模型

- [V1.2 架构数据模型入口](docs/architecture/v1.2/README.md)
- [Prisma Schema](docs/architecture/v1.2/schema.prisma)
- [ER 图](docs/architecture/v1.2/er-diagram.md)
- [关键事务伪代码](docs/architecture/v1.2/transactions.md)
- [一致性检查](docs/architecture/v1.2/consistency-checks.md)
- [审查报告](docs/architecture/v1.2/review-report.md)
- [跨门店一致性](docs/architecture/v1.2/store-integrity.md)
- [可执行归属校验参考实现](docs/architecture/v1.2/reference/store-ownership.mjs)




- [关键测试案例](docs/architecture/v1.2/test-cases-v1.2.md)
- [修订清单](docs/architecture/v1.2/change-log-v1.2.md)
- [验证证据](docs/architecture/v1.2/verification-evidence.md)

## 11. 正式工程第一阶段设计

- [仓库现状检查](docs/engineering/phase-1/01-repository-assessment.md)
- [工程结构设计](docs/engineering/phase-1/02-engineering-structure.md)
- [核心数据模型设计](docs/engineering/phase-1/03-domain-model.md)
- [MySQL 8 验证方案](docs/engineering/phase-1/04-mysql-verification-plan.md)
- [实施计划](docs/engineering/phase-1/05-implementation-plan.md)

当前停留在设计评审阶段，尚未创建 NestJS、正式数据库迁移或业务模块。
## 12. 第一阶段评审修订状态

已接受：

- 项目名称暂统一为“三味茶屋”。
- 保留 `Merchant → Store` 模型，每次部署只初始化一个 Store。
- MySQL 采用 8.4 LTS，并固定镜像 digest。
- 商家端采用 React + Vite + TypeScript。
- 首版保留 `Order.discountFen`、`DiningSession.discountFen`，默认 0；不创建 `DiscountAllocation` 表和优惠触发器。
- 事务验证代码仅用于数据库测试，不作为正式业务服务提前实现。

待确认：

- 员工认证方式。
- 微信小程序正式 AppID/AppSecret。
- MySQL 8.4 固定镜像 digest。

Gate 0 允许先建设 Node.js 22 工具链和 workspace，不等待 Docker daemon。MySQL 迁移、约束和并发测试必须等真实 MySQL 8 环境可用后执行，未执行不得标记为通过。

评审入口：[第一阶段工程设计](docs/engineering/phase-1/README.md)。

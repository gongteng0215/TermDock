# SQLite 迁移规划

[English](2026-07-15-sqlite-migration-plan.md)

Last updated: 2026-07-16

## 目标

把 TermDock 的持久化，从零散的 JSON 文件和渲染进程 `localStorage`，迁到由主进程拥有、带 schema 版本的 SQLite 数据库；迁移过程中不削弱凭据隔离，也不破坏现有会话/设置数据。

Phase 1–5 已落地（会话切流、耐久偏好端口、`.tdbackup` 凭据安全备份）。打包原生 smoke 已通过。P0-E4 崩溃恢复验证已落地（WAL + 自动 reopen / 损坏文件 / 回滚检查）。

## 当前持久化地图

### 主进程

| 存储 | 位置 | 归属 | 是否含机密 |
| --- | --- | --- | --- |
| 会话 | `userData/db/sessions.json`（`SessionStore`） | 主进程 | 否（仅主机/用户/元数据） |
| 凭据 | 系统密钥环 / `keytar` | 主进程 | 是（密码 / 私钥口令） |
| 日志 / 诊断 | 主进程文件日志 | 主进程 | 可能含连接元数据 |

当前会话 JSON schema 为 `{ sessions: SessionRecord[] }`，没有显式 schema 版本字段。

### 渲染进程 `localStorage`

偏好和 UI 状态分散在大量 `termdock.*.v1`（以及少量 `.v2` / `.v3`）键中。主要分组：

- 工作区 / UI：语言、强调色、密度、资源管理器视图、检查器标签、首次引导关闭状态
- 连接 / 终端：连接偏好、编辑器焦点偏好、快捷键
- SFTP / 传输：传输偏好、冲突策略、历史、待恢复队列、策略包
- 会话 / 模板：分组、排序、快捷配置、模板、工作区配置
- 端口转发 / 断线 / 重试：预设、事件历史、视图偏好、断线报告
- 安全 / 服务器健康：危险命令守卫与策略包、告警偏好
- 命令历史 / 片段：终端命令历史、片段分组、作用域记忆值

机密必须继续远离 SQLite 和渲染进程存储。现有加密迁移包（`.tdmigration`）已经说明：口令 + 凭据打包是独立路径，不能和普通偏好导出混在一起。

## 为什么要上 SQLite

- 会话与派生索引（收藏、最近连接、分组）可以原子写入。
- 有明确的 schema 版本和向前迁移路径。
- 对增长型历史表（传输历史、断线报告、端口转发事件）比原地覆盖 JSON 更适合崩坏恢复。
- 为“可备份/可恢复的非机密应用状态”提供清晰边界，而不必抓取几十个 `localStorage` 键。

## 非目标（本规划阶段）

- 暂不引入 `better-sqlite3`、`sql.js` 或其他 SQLite 绑定。
- 暂不实现双写 / 切流量代码。
- 暂不自动把渲染进程偏好改写为主进程存储。
- 不改变 keytar 对凭据的所有权。

## 目标架构建议

1. 主进程拥有单一 SQLite 文件：`userData/db/termdock.sqlite`。
2. schema 版本化（`PRAGMA user_version` 或 `schema_migrations` 表）。
3. 凭据继续留在 keytar；SQLite 只存 `credentialRef` / 会话 id 关联。
4. 渲染进程继续走现有 IPC；存储细节封装在主进程 repository 之后。
5. 偏好迁移晚于会话迁移，按 `termdock.*.vN` 命名空间逐步迁移。

## 迁移阶段

### 阶段 0 — 清单冻结（本文档已完成）

记录当前归属、文件与机密边界。在阶段 2 完成前，继续以 JSON + localStorage 为事实源。

### 阶段 1 — Schema 设计

先设计：

- `sessions`（当前 `SessionRecord` 核心主机元数据）
- `session_groups` / 成员关系（今天部分由渲染进程管理）
- 可选的早期 `app_meta`（版本戳与迁移标记）

大型历史表优先放在会话切流之后，除非它们直接挡住崩溃恢复（`P0-E4`）。

### 阶段 2 — 会话双写 / 影子读

1. 在 `SessionStore` 后引入 SQLite，对外方法不变。
2. 首次启动导入现有 `sessions.json`。
3. 浸泡期双写；诊断里比对 list/get 结果。
4. 阶段 3 证据达标前，保留 `sessions.json` 作为回滚快照。

### 阶段 3 — 切流 + 回滚

1. 让 SQLite 成为会话权威存储。
2. 切流版本保留一次性 `sessions.json` 导出备份。
3. 文档化回滚：恢复 JSON 快照，必要时关闭 SQLite 特性开关。
4. 然后再扩展到选定的偏好 / 历史表。

### 阶段 3 切流（已落地）

运行时行为（2026-07-15）：

- `DualWriteSessionStore` 以 SQLite 为读写权威；JSON 作为尽力同步的实况镜像。
- 首次切流启动时复制 `sessions.json` → `sessions.json.pre-sqlite-cutover`（一次性）。
- 写入 `app_meta.sessions_authority=sqlite` 与 `sessions_cutover_at`。
- 若 SQLite 为空，仍会先从 `sessions.json` 导入再标记切流。
- 回滚步骤：
  1. 退出 TermDock。
  2. 用 `sessions.json.pre-sqlite-cutover`（或可信的实况 JSON 镜像）恢复 `sessions.json`。
  3. 可选删除/重命名 `termdock.sqlite`。
  4. 用 `TERMDOCK_SESSION_STORE=json` 强制仅用 JSON，或在原生模块加载失败时自动回退。
- 打包：`better-sqlite3` / `keytar` 已列入 `asarUnpack`；原生模块加载失败时仍回退 JSON。
- 测试：`pnpm run test:session-sqlite-cutover`。

### 阶段 4 — 偏好与历史迁移

优先“可恢复的耐久数据”，后处理纯 UI 外观：

1. 传输待恢复队列 + 传输历史
2. 断线报告历史
3. 端口转发事件历史
4. 会话模板 / 快捷配置 / 片段分组
5. 其余偏好键

强调色、密度、检查器折叠等 UI 外观可以更久留在 `localStorage`，不挡持久化硬化主线。

### 阶段 4 切片 1（已落地）— 传输历史 + 待恢复队列

运行时行为（2026-07-15）：

- Schema 升到 **2**，新增 `transfer_history` / `transfer_pending_restore`（`IF NOT EXISTS` 正向迁移）。
- 主进程 `SqliteTransferStore` + IPC：`storage:get/replaceTransferHistory`、`storage:get/replacePendingTransferRestore`。
- 渲染进程双写浸泡：SQLite 非空则 hydrate，否则从 localStorage 导入；之后 localStorage 与 SQLite 同步写。
- Retry Center 仍只是 `transferHistory` 视图。
- 修复重复打开时的 schema 初始化（基表 `CREATE TABLE IF NOT EXISTS`）。
- 测试：`pnpm run test:session-sqlite-transfer-persistence`。

阶段 4 仍待：断线报告、端口转发事件历史、模板/快捷配置/片段、其余偏好键。

### 阶段 4 切片 2（已落地）— 断线报告历史

运行时行为（2026-07-15）：

- Schema 升到 **3**，新增 `disconnect_reports`（`payload_json` 整行快照）。
- 主进程 `SqliteDisconnectReportStore` + IPC：`storage:get/replaceDisconnectReports`。
- 渲染进程双写浸泡（与传输历史相同）；视图/捕获偏好仍留 localStorage。
- 测试：`pnpm run test:session-sqlite-disconnect-reports`。

阶段 4 仍待：端口转发事件历史、模板/快捷配置/片段、其余偏好键。

### 阶段 4 切片 3（已落地）— 端口转发事件历史

运行时行为（2026-07-15）：

- Schema 升到 **4**，新增 `port_forward_events`（`payload_json` 快照行）。
- 主进程 `SqlitePortForwardEventStore` + IPC：`storage:get/replacePortForwardEventHistory`。
- 渲染进程双写浸泡；事件视图偏好仍留 localStorage。
- 主进程内存事件环与 list IPC 不变；跨会话耐久历史迁入 SQLite。
- 测试：`pnpm run test:session-sqlite-port-forward-events`。

阶段 4 仍待：模板/快捷配置/片段、其余偏好键。

### 阶段 4 切片 4（已落地）— 会话模板 / 快捷配置 / 命令片段

运行时行为（2026-07-15）：

- 模式版本升至 **5**：`session_quick_profiles`、`session_templates`（`has_secret` 标志，明文密码不入 `payload_json`）、`command_snippet_groups`、`command_snippet_scoped_values`。
- 主进程 `SqliteWorkbenchStore` + IPC：`storage:get/replaceSessionQuickProfiles`、`storage:get/replaceSessionTemplates`、`storage:get/replaceCommandSnippetGroups`、`storage:get/replaceCommandSnippetScopedValues`。
- 渲染进程双写浸泡；模板密码浸泡期仍留 localStorage（SQLite 仅存 `hasSecret`）。
- 测试：`pnpm run test:session-sqlite-workbench-data`。

阶段 4 仍待：其余偏好键。

### 阶段 4 切片 5（已落地）— 耐久应用偏好迁移

运行时行为（2026-07-15）：

- 模式版本升至 **6**：通用 `app_preferences`（`pref_key` / `payload_json` / `updated_at`）。
- 主进程 `SqlitePreferenceStore` + IPC：`storage:getAppPreferences`、`storage:setAppPreference`、`storage:replaceAppPreferences`。
- 18 个耐久键双写浸泡（连接、终端焦点、热键、文件打开、SFTP 偏好/策略包/冲突策略、端口转发预设、会话分组/排序、工作区配置、健康告警、危险命令防护/策略包、断线捕获偏好、终端命令历史）。
- 非允许名单键被拒绝（强调色/密度/视图过滤等 UI chrome 仍留 localStorage）。
- 测试：`pnpm run test:session-sqlite-app-preferences`。

阶段 4 耐久偏好端口完成；UI chrome 可继续留在 localStorage。

### 阶段 5（已落地）— 凭据安全的备份 / 恢复

运行时行为（2026-07-15）：

- 新 `.tdbackup` 格式（`termdock-app-backup` v1）导出非机密 SQLite 耐久状态：会话（仅 `hasSecret`）、传输历史/待恢复、断线报告、端口转发事件、工作台数据、允许名单应用偏好。
- 可选口令保护的 **凭据附件** 复用现有 `.tdmigration` 封装（`exportEncryptedSessionMigration` / keytar）。
- 导出/导入 UX 对齐会话迁移：预览计数、会话 skip/overwrite/rename（`host:port:username`）、可选凭据恢复。
- IPC：`storage:exportAppBackup`、`storage:previewAppBackup`、`storage:importAppBackup`。
- 明文 dump 拒绝 `"secret"` 字段；模板密码不进入 SQLite payload。
- 测试：`pnpm run test:session-sqlite-app-backup`。

### P0-E4（已落地）— 崩溃恢复验证

运行时行为（2026-07-16）：

- 新建 SQLite 连接走 `configureSqliteConnection()`：`journal_mode=WAL`、`synchronous=NORMAL`、`busy_timeout=5000`、`foreign_keys=ON`。
- `pnpm run test:session-sqlite-crash-recovery` 覆盖：
  - 关闭/重开后的会话 + 传输历史持久性
  - 损坏 `.sqlite` 打开失败（主进程回退 JSON）
  - 损坏 JSON 镜像不阻断 SQLite 权威读取
  - 用 `sessions.json.pre-sqlite-cutover` 做 JSON-only 回滚
- `DualWriteSessionStore.flushJsonMirror()` 用于等待 best-effort JSON 镜像写完。

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 原生模块打包 / Electron ABI 不匹配 | 选定单一成熟绑定；默认切流前必须有打包 smoke |
| 迁移丢数据 | 双写、切流前 JSON 快照、回滚文档 |
| 偏好半迁移导致双脑 | 按存储键分组迁移，并标记“归主进程所有” |
| 备份把机密泄进 SQLite | 永不落盘密码/口令；诊断脱敏；复用加密迁移打包 |
| 启动回归 | 迁移前后对比 session list 载入与 `bench:startup` |

## 退出标准

`P0-A3` / `F9` 从 PARTIAL 继续推进到 DONE 的条件：

1. 会话读写以 SQLite 为准，且有验证过的回滚路径。
2. schema 版本与迁移脚本有文档与测试。
3. 凭据安全备份/恢复覆盖会话 + 非机密耐久状态，且不把机密写成明文文件。
4. 其余偏好/历史迁移有明确排队顺序，而不是无限开放重写。

## 落地时的验证计划

- 导入 / 双写 / 回滚专用脚本测试（对齐 `test:session-migration`）。
- 默认启用 SQLite 后的 Windows 打包 smoke。
- 人工确认 keytar 凭据在迁移后仍可用，且不出现在 SQLite dump 中。
- 在 `artifacts/benchmark/` 留下启动 / 会话列表载入基准记录。

## Phase 1 Schema (landed)

事实源：`src/main/storage/sqlite/schema.ts`（`SQLITE_SCHEMA_VERSION = 1`）。

机密继续留在 keytar；SQLite 只存 `has_secret`。分组成员关系仍写在 `sessions.group_id`（分组名字符串），Phase 1 不设关联表。

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT NOT NULL,
  auth_type TEXT NOT NULL,
  private_key_path TEXT NULL,
  group_id TEXT NULL,
  remark TEXT NULL,
  favorite INTEGER NOT NULL,
  has_secret INTEGER NOT NULL,
  last_connected_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE session_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

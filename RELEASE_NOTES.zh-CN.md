# TermDock 更新记录

[English](RELEASE_NOTES.md)

## Unreleased (master)

发布类型：开发中

### 主要变化

- 还没有记录新的未发布变更。

### 验证

- 下一个候选版本发布时再补充验证结果。

## v0.1.30 (2026-06-03)

发布类型：稳定热修复

### 主要变化

- 修复打包应用在自动更新模块启动时崩溃的问题。
- `electron-updater` 现在通过兼容 CommonJS 的默认导入读取 `autoUpdater`，匹配 Electron 打包后的 ESM loader 行为。
- 自动更新专项检查现在会拒绝不兼容的 named import 写法，避免该启动崩溃路径再次发布。

### 验证

- `pnpm run test:main-auto-update` 已通过。
- `pnpm run build:main` 已通过。

## v0.1.29 (2026-06-02)

发布类型：稳定版

### 主要变化

- 自动更新支持：
  - 打包后的 TermDock 启动后会检查 GitHub Releases 上的新版本。
  - 发现新版本后会在后台下载，下载完成后提示用户是否立即重启安装。
  - 开发模式、smoke 运行和显式禁用自动更新的运行不会触发更新检查。
- 发布流程现在会把 `latest.yml` 等 electron-updater 元数据文件和安装包、blockmap 一起上传。

### 验证

- `pnpm run test:main-auto-update` 已通过。
- `pnpm run test:main-single-instance` 已通过。
- `pnpm run typecheck` 已通过。
- `pnpm run build` 已通过。
- `pnpm exec electron-builder --win nsis zip --publish never --config.win.signAndEditExecutable=false` 已通过，并生成了 `latest.yml`。

## v0.1.28 (2026-06-02)

鍙戝竷绫诲瀷锛氱ǔ瀹氱増

### 涓昏鍙樺寲

- 鍗曞疄渚嬪簲鐢ㄤ繚鎶わ細
  - 閲嶅鍚姩 TermDock 鏃讹紝鐜板湪浼氭仮澶嶅苟聚焦宸叉湁绐楀彛锛屼笉鍐嶆墦寮€绗簩涓簲鐢ㄥ疄渚?
  - 鏃犳硶鑾峰彇鍗曞疄渚嬮攣鐨勮繘绋嬩細鍦ㄥ垱寤虹獥鍙ｅ墠閫€鍑?
- Smoke 鑷姩鍖栨敹灏惧姞鍥猴細
  - Electron smoke 鍦ㄤ紭闆呭叧闂秴鏃跺悗浼氬己鍒剁粨鏉熸祴璇曞惎鍔ㄧ殑 Electron 杩涚▼
  - 鏂板 main process 鍗曞疄渚嬩繚鎶ょ殑閽堝鎬у洖褰掓鏌?

### 楠岃瘉

- `pnpm run test:main-single-instance` 閫氳繃銆?
- `pnpm run typecheck` 閫氳繃銆?
- `pnpm run build` 閫氳繃銆?
- `pnpm run smoke:ui` 閫氳繃锛岀粨鏋滀负 `PASS 50 / FAIL 0 / SKIP 0`锛岃 `artifacts/smoke/2026-06-02T08-48-20-888Z/summary.json`銆?

## v0.1.27 (2026-05-20)

发布类型：稳定版

### 主要变化

- 新增加密会话迁移：
  - 新增 `Export Encrypted Migration...` 和 `Import Encrypted Migration...`
  - 支持带口令保护的 `.tdmigration`，可包含已保存密码、私钥口令，以及可选的私钥文件内容
  - 嵌入的私钥文件会恢复到 TermDock 自己的 app data 目录，不会覆盖源机器路径
  - 导入预览可以先解密、先检查内容，再决定是否真正写入恢复后的密钥文件
- 刷新 editor-workbench UI：
  - topbar、侧栏、terminal stage、transfer dock、modal chrome 统一成更扁平的代码编辑器工作台语言
  - SFTP explorer 现在支持持久化的 `Compact` / `Details` 双视图
  - 右侧 inspector 支持可折叠 command history，以及窄宽度下的 `Sessions` / `Health` / `History` tabs
  - 英文 / 简体中文覆盖继续扩展到了 settings、dialogs、context menus、command history、retry center、operation center 和 diagnostics
- 强化 renderer 可维护性和启动结构：
  - 大块 renderer 区域被拆成更清晰的 hooks、props builders、modal hosts 和 workbench shell 分层
  - renderer bundle 现在拆成 workbench / settings / terminal 等独立 chunk，不再由一个超大的主包承担
  - `App.tsx` 现在更接近总装层，负责组装 workbench、dialogs、overlays、settings 和 transfer UI
- 提升发版信心：
  - encrypted migration 已有针对性测试覆盖
  - smoke 自动化现在覆盖 encrypted migration 可见性、workbench UI、live SSH/SFTP、remote-open-file 冲突流程、retry/operation center 和 diagnostics capture

### 验证

- `pnpm run typecheck` 通过。
- `pnpm run build` 通过。
- `pnpm run smoke:ui` 通过，结果为 `PASS 50 / FAIL 0 / SKIP 0`，见 `artifacts/smoke/2026-05-20T02-46-53-664Z/summary.json`。

## v0.1.26 (2026-05-14)

发布类型：稳定候选版

### 主要变化

- SSH config 导入打磨：
  - 导入预览现在会在写入前显示新增会话数、重复目标数、私钥会话数、目标分组和重复处理策略。
  - 选择重复处理策略时会展示完整导入计划，用户能更清楚地选择跳过、覆盖或创建重命名副本。
  - SSH config 和会话 JSON 导入成功后，现在可以立即打开第一个导入的会话。
  - `IdentityFile` 解析现在会展开常见 OpenSSH token，例如 `%d`、`%u`、`%r`、`%h`、`%n`、`%p` 和 `%%`。
  - 导入预览现在会提示展开后的 `IdentityFile` 路径在当前机器上不存在或不是普通文件。
  - 导入预览现在会对常见暂不支持的 OpenSSH 指令给出 warning，例如 `ProxyJump`、`ProxyCommand`、`LocalForward`、`RemoteForward`、`DynamicForward`、`CertificateFile` 或 `IdentitiesOnly`，提醒导入后手动处理。
- 首次连接诊断：
  - SSH 连接和测试连接失败时，现在会针对常见认证、私钥文件、DNS、端口、超时、网络、host key、握手和远端关闭错误显示更清晰的原因、下一步建议和原始错误。
- 文档：
  - 新增英文 / 简体中文配套 SSH 配置导入指南，并从 README 和文档索引链接。
  - 新增英文 / 简体中文 SSH 连接故障排查指南，覆盖首次连接失败场景。

### 验证

- Type check 通过：`pnpm run typecheck`
- Build 通过：`pnpm run build`
- 最新 workspace smoke 通过：`PASS 48 / FAIL 0 / SKIP 0`
- 最新 workspace smoke artifact：`artifacts/smoke/2026-05-14T06-14-31-419Z/summary.json`

## v0.1.25 (2026-05-13)

发布类型：稳定候选版

### 主要变化

- 首次启动会话引导：
  - 空工作区现在会在 Sessions Inspector 中显示紧凑的新用户引导卡片。
  - 引导动作可直接进入 `Import SSH Config`、`New Session` 和 `Security Notes`。
  - 关闭状态会保存在本地，避免引导卡片反复出现。
- 简体中文打磨：
  - 补充首次启动引导卡片和安全说明弹窗的中文翻译。

### 验证

- Type check 通过：`pnpm run typecheck`
- Build 通过：`pnpm run build`
- 最新 workspace smoke 通过：`PASS 47 / FAIL 0 / SKIP 0`
- 最新 workspace smoke artifact：`artifacts/smoke/2026-05-12T14-10-00-910Z/summary.json`

## v0.1.24 (2026-05-11)

发布类型：稳定版

### 主要变化

- 右侧 Inspector 密度优化：
  - 移除右栏中的选中会话详情，让面板聚焦当前活动会话、服务器健康和最近命令历史。
  - Inspector 中命令历史默认显示最近 5 条，完整管理器仍可打开。
  - 服务器健康在右栏保持紧凑，并通过独立详情弹窗展示完整信息。
- 服务器健康详情升级：
  - 详情弹窗增加 `Overview`、`Disk`、`Network`、`Processes`、`Services` tabs。
  - Overview 增加 OS/kernel/architecture、CPU cores、load per core、free/cache/buffer memory、Swap 和采集时间。
  - Disk 展示挂载文件系统、类型、已用/可用/总量、使用率和 inode 使用率。
  - Network 展示接口 RX/TX、错误数和 dropped packets。
  - Processes 展示 CPU 和内存占用较高的进程。
  - Failed services 增加 load/active/sub 状态和服务描述。
- SFTP Explorer 紧凑布局修复：
  - Compact 模式优先显示文件和文件夹名称，只保留类型点、大小和文件夹标记。
  - permission、owner、group、link 等元信息保留在 Details 模式。
- 简体中文打磨：
  - 补充新的服务器健康 tabs、表格标签、状态标签和 SFTP 文件夹标记翻译。

### 验证

- Type check 通过：`pnpm run typecheck`
- Build 通过：`pnpm run build`
- 最新 workspace smoke 通过：`PASS 47 / FAIL 0 / SKIP 0`
- 最新 workspace smoke artifact：`artifacts/smoke/2026-05-11T13-10-47-081Z/summary.json`
- 最新 packaged smoke 通过：`PASS 47 / FAIL 0 / SKIP 0`
- 最新 packaged smoke artifact：`artifacts/smoke/2026-05-11T03-40-28-692Z/summary.json`
- 手动服务器健康 tabs 截图：`artifacts/manual-server-health-tabs/2026-05-11T02-16-53-783Z/disk-tab.png`
- 手动简体中文服务器健康截图：`artifacts/manual-zh-server-health-tabs/2026-05-11T03-37-24-976Z/zh-disk-tab.png`
- 手动 SFTP compact 截图：`artifacts/manual-sftp-compact/2026-05-11T01-43-53-116Z/sftp-compact.png`
- 本地 `dist:mac:x64` 产出了 ZIP，但当前 macOS 12 主机上的 DMG 创建失败，因为 electron-builder 下载的 `dmgbuild` runtime 需要 `_mkfifoat`；带 tag 的 GitHub Actions release build 在 macOS 14 上运行。

## v0.1.23 (2026-05-10)

发布类型：稳定版

### 主要变化

- Editor workbench UI 刷新：
  - 主界面更接近深色代码编辑器工作台，而不是堆叠式运维 dashboard。
  - SFTP 视觉上进入 Explorer rail；sessions、server health、command history 组成 Inspector rail。
  - terminal tabs/stage 和 transfer dock 重新设计，让终端保持主视觉，传输区成为底部工作台面板。
  - settings 和 manager modal chrome 与紧凑工作台语言保持一致。
- 简体中文界面基线：
  - `Settings > Workspace` 增加持久化语言选择器，支持 English 和 Simplified Chinese。
  - 简体中文覆盖 settings、workbench chrome、dialogs、context menus、terminal errors、port forwarding、diagnostics、hotkeys、snippets、Operation Center、Retry Center、Command History Manager 和 Safety settings。
  - DOM localization 通过 `MutationObserver` / `requestAnimationFrame` 批处理，避免每次 render 后全量扫描。
- Renderer 模块拆分：
  - settings modal shell/sections、command snippet manager、workbench modals、persisted workbench UI preferences 从 `App.tsx` 拆出。
  - workbench shell 和 terminal CSS 从 root stylesheet 拆出。
- 侧栏可用性打磨：
  - SFTP Explorer view mode 持久化为 `Compact` 或 `Details`。
  - command history 可在右侧 Inspector 中折叠。
  - 窄宽度下右侧 Inspector 提供 `Sessions` / `Health` / `History` tabs。
- 命令历史和细节修复：
  - 长命令历史捕获会回看更多换行 terminal rows。
  - 存储的命令历史保留更长命令后再截断。
  - 移除右侧 Inspector 选中详情，提高有效信息密度。
  - 应用图标从更紧凑源裁切重新生成。
  - Settings 滚动更顺，因为 settings modal 不再使用实时全屏 backdrop blur。

### 验证

- Post-refactor type check 通过：`pnpm run typecheck`
- Post-refactor build 通过：`pnpm run build`
- Post-refactor workspace smoke 通过：`PASS 45 / FAIL 0 / SKIP 0`
- Post-refactor packaged smoke 通过：`PASS 45 / FAIL 0 / SKIP 0`
- 最新多语言 workspace smoke 通过：`PASS 47 / FAIL 0 / SKIP 0`
- 最新多语言 workspace smoke artifact：`artifacts/smoke/2026-05-10T14-23-35-255Z/summary.json`
- 最新 packaged smoke artifact：`artifacts/smoke/2026-05-09T13-44-46-628Z/summary.json`

## 历史版本索引

英文版 `RELEASE_NOTES.md` 保留了 v0.1.22 及更早版本的完整逐条历史。中文维护版从当前公开推广版本开始同步记录详细内容，后续 release 会保持中英文同时更新。

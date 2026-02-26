# TermDock

TermDock is a cross-platform desktop SSH + SFTP client for developers and operators.
It combines session management, multi-tab terminal, and file transfer in one workspace.

---

## English

### Current Status (2026-02-26)

### Available Features

- Session management: create / edit / delete / test connection
- Authentication: password and private key (with file picker)
- Session UX: search, favorite filter, recent connection sorting
- Terminal: xterm-based multi-tab, same session multi-open
- Terminal interactions: right-click menu (`Clear`, `Reconnect`), double-click session to open, middle-click tab to close
- Hotkeys: platform-aware defaults + configurable bindings in `Settings` (Windows terminal copy defaults to `Alt+C`; macOS behavior unchanged)
- Connection resilience: KeepAlive + configurable auto reconnect
- Server health monitor: active-tab metrics (CPU / memory / disk / network / load / uptime), auto refresh, manual refresh, detail toggle for trend view
- Server health alerts: configurable CPU / memory / disk thresholds (Settings) with monitor panel alert badge/highlight
- Server monitor drill-down: top CPU processes + failed services (loaded only when detail is expanded)
- Settings entry:
  - macOS: app menu `Settings...` (`Command+,`)
  - Windows: `File > Settings...` (`Ctrl+,`) and top-right `Settings` button
- Settings UX: left-side menu + right-side content panel (reduced accidental misclicks, clearer grouping)
- SFTP: browse, enter/back, refresh, path jump, create directory, rename, delete (non-recursive)
- Transfers: file upload/download, drag-and-drop upload (files/folders), queue + progress + cancel
- SFTP context actions: right-click menu, file double-click to open
- File opening behavior: configurable default open program in `Settings`
- Packaging: supports macOS `arm64/x64` and Windows release artifacts
- Icon config: explicit `build.mac.icon` / `build.win.icon` + dev icon fallback

### Release Readiness

- Latest official release: `v0.1.1` (GitHub Release)
- Release quality today: usable for early production/power users, but not fully hardened GA
- Still recommended before broad rollout:
  - Cross-platform smoke tests (`P0-F3`)
  - Installer signing/notarization and install verification (`P0-F4`)
  - Better global error recovery UX (`P0-E3`)

### Product Roadmap (Planned)

- SSH config import (`~/.ssh/config`)
- Port forwarding UI (local/remote)
- Remote file quick edit (download-edit-upload)
- Recursive directory download in SFTP
- Snippets + command palette (`Cmd/Ctrl+K`)
- Connection quality panel (RTT/reconnect/failure rate)
- Server monitor enhancements (time windows, custom checks, export, multi-host overview)
- Host key trust + fingerprint change alerts (TOFU)
- Multi-host command broadcast

### Additional Ideas (Backlog)

- Session templates with environment variables
- Jump host / multi-hop connection (`ProxyJump`)
- Transfer history and retry center
- Local/remote directory sync
- Runbook workflows (multi-step tasks)
- Sensitive command guard (dangerous command confirmation)
- Audit mode (command/transfer logs export)
- Scheduled runbooks (time-based execution)
- Workspace snapshot restore (tabs/path/layout)
- Transfer integrity verification (`sha256` after upload/download)
- Resumable transfer for large files
- Transfer bandwidth limit (global/per-task)
- SFTP recycle bin (recover deleted files)
- Production safeguard mode (extra confirmation)
- Log observability panel (subscribe/highlight/auto-scroll)
- In-app update channel (stable/beta)
- Metrics export (`csv/json`) for ops reports
- Alert threshold notifications (desktop/system notifications)
- Per-mount disk breakdown and inode usage

### Quick Start

```bash
pnpm install
pnpm dev
```

### Build

```bash
pnpm build
```

### Publish Release to GitHub (macOS + Windows)

Workflow file: `.github/workflows/release.yml`

1. Commit and push your code.
2. Create and push a version tag:

Stable release:

```bash
git tag v0.1.1
git push origin v0.1.1
```

Prerelease (test/rc):

```bash
git tag v0.1.1-test.1
git push origin v0.1.1-test.1
```

3. GitHub Actions `Release` workflow will build:
- macOS: `arm64 dmg/zip` + `x64 dmg/zip`
- Windows: `nsis(.exe)` + `zip`
4. Release type is automatic:
- Tag without `-` (for example `v0.1.1`) => official release
- Tag with `-` (for example `v0.1.1-test.1`, `v0.1.1-rc.1`) => prerelease
5. Intel + macOS 12 users should download the `x64` mac package.

You can also trigger it manually in Actions (`workflow_dispatch`) with an existing tag.

### Icon Assets

- Source image: `build/icon-source.png` (recommended `1024x1024`)
- macOS icon: `build/icon.icns`
- Windows icon: `build/icon.ico`

### Troubleshooting

1. Electron reports `failed to install correctly`

```bash
pnpm install
pnpm rebuild electron
```

2. `Terminal bridge is not ready`

- Fully restart dev processes: `Ctrl+C`, then run `pnpm dev` again

3. Vite reports `Port 5273 is in use`

```bash
lsof -nP -iTCP:5273 -sTCP:LISTEN
kill <PID>
```

4. GPU/driver issue (for example EGL)

```bash
TERMDOCK_DISABLE_GPU=1 pnpm dev
```

5. Open DevTools only when debugging

```bash
TERMDOCK_OPEN_DEVTOOLS=1 pnpm dev
```

### Known Limitations

- Data storage is still JSON (SQLite migration not finished)
- Session group tree / batch editing not finished
- SFTP delete is currently non-recursive
- Directory download is not supported yet
- Opened remote files are downloaded to local temp path before launching
- Server health currently targets Linux `/proc` data and single-root disk view (`/`)
- In-app auto update is not implemented yet (manual replacement/installer upgrade is supported)

### Project Structure

```txt
src/main      # Electron main process, IPC, local storage
src/renderer  # React UI
src/shared    # Shared type contracts
```

### Documents

- `TASKS.md`: task breakdown and statuses
- `PROGRESS.md`: milestone progress and release assessment
- `PRD.md`: product requirement document

### License

MIT (`LICENSE`)

---

## 中文

### 当前状态（2026-02-26）

### 已可用功能

- 会话管理：创建 / 编辑 / 删除 / 测试连接
- 认证方式：密码、私钥（支持文件选择）
- 会话体验：搜索、收藏筛选、最近连接时间排序
- 终端：基于 xterm 的多标签、同会话多开
- 终端交互：右键菜单（`Clear`、`Reconnect`）、双击会话直接打开、标签中键关闭
- 快捷键：平台默认值 + 可配置键位（在 `Settings` 中配置；Windows 终端复制默认 `Alt+C`，macOS 保持原行为）
- 稳定性：KeepAlive + 自动重连（可配置）
- 服务器监控：按当前激活标签采集 CPU/内存/磁盘/网络/负载/运行时长，支持自动刷新、手动刷新与详情趋势
- 服务器监控告警：支持在 `Settings` 配置 CPU/内存/磁盘阈值，并在监控面板显示告警角标与高亮
- 服务器监控下钻：详情展开后可查看高 CPU 进程列表与失败服务（按需加载）
- 设置入口：
  - macOS：应用菜单 `Settings...`（`Command+,`）
  - Windows：`File > Settings...`（`Ctrl+,`）与右上角 `Settings`
- 设置体验：左侧菜单 + 右侧内容布局，按功能分组配置
- SFTP：目录浏览、进入/返回、刷新、路径跳转、新建目录、重命名、删除（非递归）
- 传输：文件上传/下载、文件夹/文件拖拽上传、队列、进度、取消
- SFTP 操作：右键菜单、文件双击直接打开
- 文件打开：可在 `Settings` 配置默认打开程序
- 打包：支持 macOS `arm64/x64` 和 Windows 发布产物
- 图标：已配置 `build.mac.icon` / `build.win.icon`，并支持开发态图标回退

### 当前发版判断

- 最新正式版：`v0.1.1`（已发布到 GitHub Release）
- 当前质量判断：可供早期生产/重度用户使用，但仍未达到完全打磨的 GA 水平
- 大规模推广前建议补齐：
  - `P0-F3` 跨平台冒烟测试
  - `P0-F4` 安装包签名/公证与安装验证
  - `P0-E3` 全局错误恢复体验

### 产品路线图（待排期）

- SSH config 导入（`~/.ssh/config`）
- 端口转发 UI（本地/远程）
- 远程文件快速编辑（下载-编辑-回传）
- SFTP 目录递归下载
- Snippets + 命令面板（`Cmd/Ctrl+K`）
- 连接质量面板（RTT/重连次数/失败率）
- 服务器监控增强（趋势时间窗、自定义检查、导出、多会话概览）
- 主机指纹信任与变更告警（TOFU）
- 多主机命令广播

### 更多可选方向（Backlog）

- 会话模板与环境变量
- 跳板机/多跳连接（`ProxyJump`）
- 传输历史与重试中心
- 本地与远程目录同步
- Runbook 任务流（多步骤）
- 敏感命令保护（高危命令二次确认）
- 审计模式（命令/传输日志导出）
- 任务调度（定时执行 Runbook）
- 工作区快照恢复（标签/路径/布局）
- 传输完整性校验（上传/下载后 `sha256`）
- 传输断点续传（大文件失败续传）
- 传输限速（全局/单任务）
- SFTP 回收站（删除可恢复）
- 生产环境保护模式（高危操作双确认）
- 日志观察台（订阅/高亮/自动滚动）
- 应用内更新通道（stable/beta）
- 监控数据导出（`csv/json` 运维报表）
- 监控告警桌面通知（系统通知）
- 分区级磁盘监控与 inode 使用率

### 快速启动

```bash
pnpm install
pnpm dev
```

### 构建

```bash
pnpm build
```

### 发布到 GitHub Release（macOS + Windows）

工作流：`.github/workflows/release.yml`

1. 提交并推送代码。
2. 打 tag 并推送：

正式版：

```bash
git tag v0.1.1
git push origin v0.1.1
```

测试/预发布版：

```bash
git tag v0.1.1-test.1
git push origin v0.1.1-test.1
```

3. GitHub Actions 会自动执行 `Release`，构建：
- macOS：`arm64 dmg/zip` + `x64 dmg/zip`
- Windows：`nsis(.exe)` + `zip`
4. 发布类型自动判断：
- 不带 `-` 的 tag（例如 `v0.1.1`）=> 正式版 Release
- 带 `-` 的 tag（例如 `v0.1.1-test.1`、`v0.1.1-rc.1`）=> Prerelease
5. Intel + macOS 12 用户请下载带 `x64` 的 mac 包。

也可在 Actions 页面手动触发（`workflow_dispatch`），输入已存在的 tag。

### 图标资源

- 源图：`build/icon-source.png`（建议 `1024x1024`）
- macOS：`build/icon.icns`
- Windows：`build/icon.ico`

### 常见问题

1. Electron 报 `failed to install correctly`

```bash
pnpm install
pnpm rebuild electron
```

2. `Terminal bridge is not ready`

- 完全重启开发进程：`Ctrl+C` 后重新执行 `pnpm dev`

3. Vite 报 `Port 5273 is in use`

```bash
lsof -nP -iTCP:5273 -sTCP:LISTEN
kill <PID>
```

4. 图形驱动报错（如 EGL）

```bash
TERMDOCK_DISABLE_GPU=1 pnpm dev
```

5. 需要调试时再开 DevTools

```bash
TERMDOCK_OPEN_DEVTOOLS=1 pnpm dev
```

### 已知限制

- 数据仍为 JSON 存储（SQLite 迁移未完成）
- 会话分组树 / 批量编辑未完成
- SFTP 删除当前是非递归
- 暂不支持目录下载
- 打开远程文件时会先下载到本地临时目录再拉起程序
- 服务器监控当前基于 Linux `/proc` 与单根分区（`/`）采样
- 暂未实现应用内自动更新（当前支持手动覆盖安装/升级）

### 项目结构

```txt
src/main      # Electron main process, IPC, local storage
src/renderer  # React UI
src/shared    # Shared type contracts
```

### 相关文档

- `TASKS.md`：任务拆解与状态
- `PROGRESS.md`：里程碑进度与发版判断
- `PRD.md`：产品需求文档

### 许可证

MIT（见 `LICENSE`）

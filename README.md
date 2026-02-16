# TermDock

TermDock is a cross-platform desktop SSH + SFTP client for developers and operators.
It combines session management, multi-tab terminal, and file transfer in one workspace.

---

## English

### Current Status (2026-02-15)

### Available Features

- Session management: create / edit / delete / test connection
- Authentication: password and private key (with file picker)
- Session UX: search, favorite filter, recent connection sorting
- Terminal: xterm-based multi-tab, same session multi-open
- Terminal interactions: right-click menu (`Clear`, `Reconnect`), double-click session to open, middle-click tab to close
- Hotkeys: `Cmd` on macOS, `Ctrl` on Windows (toggleable)
- Connection resilience: KeepAlive + configurable auto reconnect
- Settings entry:
  - macOS: app menu `Settings...` (`Command+,`)
  - Windows: `File > Settings...` (`Ctrl+,`) and top-right `Settings` button
- SFTP: browse, enter/back, refresh, path jump, create directory, rename, delete (non-recursive)
- Transfers: file upload/download, drag-and-drop upload (files/folders), queue + progress + cancel
- SFTP context actions: right-click menu, file double-click to open
- File opening behavior: configurable default open program in `Settings`
- Packaging: supports macOS `arm64/x64` and Windows release artifacts
- Icon config: explicit `build.mac.icon` / `build.win.icon` + dev icon fallback

### Release Readiness

- Recommended now: `v0.1.0-preview` (internal/beta testing)
- Not recommended yet: public GA
- Still recommended before wider release:
  - Cross-platform smoke tests (`P0-F3`)
  - Installer signing/notarization and install verification (`P0-F4`)
  - Better global error recovery UX (`P0-E3`)

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
git tag v0.1.0
git push origin v0.1.0
```

Prerelease (test/rc):

```bash
git tag v0.1.0-test.1
git push origin v0.1.0-test.1
```

3. GitHub Actions `Release` workflow will build:
- macOS: `arm64 dmg/zip` + `x64 dmg/zip`
- Windows: `nsis(.exe)` + `zip`
4. Release type is automatic:
- Tag without `-` (for example `v0.1.0`) => official release
- Tag with `-` (for example `v0.1.0-test.1`, `v0.1.0-rc.1`) => prerelease
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

### 当前状态（2026-02-15）

### 已可用功能

- 会话管理：创建 / 编辑 / 删除 / 测试连接
- 认证方式：密码、私钥（支持文件选择）
- 会话体验：搜索、收藏筛选、最近连接时间排序
- 终端：基于 xterm 的多标签、同会话多开
- 终端交互：右键菜单（`Clear`、`Reconnect`）、双击会话直接打开、标签中键关闭
- 快捷键：macOS 使用 `Cmd`，Windows 使用 `Ctrl`（支持开关）
- 稳定性：KeepAlive + 自动重连（可配置）
- 设置入口：
  - macOS：应用菜单 `Settings...`（`Command+,`）
  - Windows：`File > Settings...`（`Ctrl+,`）与右上角 `Settings`
- SFTP：目录浏览、进入/返回、刷新、路径跳转、新建目录、重命名、删除（非递归）
- 传输：文件上传/下载、文件夹/文件拖拽上传、队列、进度、取消
- SFTP 操作：右键菜单、文件双击直接打开
- 文件打开：可在 `Settings` 配置默认打开程序
- 打包：支持 macOS `arm64/x64` 和 Windows 发布产物
- 图标：已配置 `build.mac.icon` / `build.win.icon`，并支持开发态图标回退

### 当前发版判断

- 建议可发：`v0.1.0-preview`（内测 / 小范围试用）
- 暂不建议：公开 GA
- 发布前建议补齐：
  - `P0-F3` 跨平台冒烟测试
  - `P0-F4` 安装包签名/公证与安装验证
  - `P0-E3` 全局错误恢复体验

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
git tag v0.1.0
git push origin v0.1.0
```

测试/预发布版：

```bash
git tag v0.1.0-test.1
git push origin v0.1.0-test.1
```

3. GitHub Actions 会自动执行 `Release`，构建：
- macOS：`arm64 dmg/zip` + `x64 dmg/zip`
- Windows：`nsis(.exe)` + `zip`
4. 发布类型自动判断：
- 不带 `-` 的 tag（例如 `v0.1.0`）=> 正式版 Release
- 带 `-` 的 tag（例如 `v0.1.0-test.1`、`v0.1.0-rc.1`）=> Prerelease
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

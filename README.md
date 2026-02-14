# TermDock

TermDock 是一款跨平台桌面 SSH + SFTP 客户端，当前以 macOS 体验优先，并兼容 Windows 11。

## 当前状态（2026-02-14）

### 已可用功能

- 会话管理：创建 / 编辑 / 删除 / 测试连接
- 认证方式：密码、私钥（支持选择私钥文件）
- 会话体验：搜索过滤、收藏与仅收藏筛选、最近连接时间展示与排序
- 终端：基于 xterm 的多标签连接、同会话多开
- 终端交互：右键菜单（含 Clear）、双击会话直接打开、标签中键关闭
- 快捷键：macOS 使用 `Cmd`，Windows 使用 `Ctrl`（支持开关）
- 重连能力：KeepAlive + 自动重连（可配置开关与延迟）
- 设置入口：
  - macOS：左上角应用菜单 `Settings...`（`Command+,`）
  - Windows：`File > Settings...`（`Ctrl+,`）与右上角 `Settings` 按钮
- SFTP：目录浏览、进入/返回、新建目录、重命名、删除（非递归）
- 传输：单文件上传/下载、进度事件、拖拽文件上传、传输状态列表
- SFTP 视图优化：Loading/统计/上传信息放在内容框外下方，减少列表跳动

### 目前可发布判断

- 可以先发：`v0.1.0-preview`（内测 / 小范围试用）
- 暂不建议：公开 GA（正式版）
- 发布前仍建议补齐：
  - `P0-F3` 跨平台冒烟测试
  - `P0-F4` 打包与安装流程（DMG/EXE）
  - `P0-E3` 全局错误恢复提示

## 快速启动

```bash
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build
```

## 发布测试版到 GitHub Release（macOS + Windows）

已内置工作流：`.github/workflows/release.yml`。

1. 提交并推送代码到远端分支。
2. 打测试标签并推送：

```bash
git tag v0.1.0-test.1
git push origin v0.1.0-test.1
```

3. GitHub Actions 会自动执行 `Release` 工作流，构建：
- macOS：`arm64 dmg/zip`（Apple Silicon） + `x64 dmg/zip`（Intel）
- Windows：`nsis(.exe)` + `zip`
4. 工作流会自动创建可见的 `Prerelease`，并上传安装包附件。

也可在 Actions 里手动运行 `Release`（`workflow_dispatch`），输入已存在的 tag。

## 常见问题

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

## 已知限制（当前版本）

- 数据持久化仍为 JSON，尚未迁移 SQLite（`P0-A3`）
- 会话分组树、批量编辑尚未完成（`P0-B1/B2`）
- 断线后缺少显式“手动重连”按钮（自动重连已可用）
- SFTP 暂不支持目录拖拽上传、递归删除、并发队列策略
- Windows 与 macOS 打包依赖 GitHub Actions 环境，建议以 CI 构建产物为准

## 项目结构

```txt
src/main      # Electron main process, IPC, local storage
src/renderer  # React UI
src/shared    # Shared type contracts
```

## 相关文档

- `TASKS.md`：任务拆解与状态
- `PROGRESS.md`：里程碑进度与发版判断
- `PRD.md`：产品需求文档

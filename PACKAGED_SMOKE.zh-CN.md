# TermDock 打包 Smoke

[English](PACKAGED_SMOKE.md)

Last updated: 2026-05-12

## 目标

使用一套可重复的 smoke 流程验证：

- 本地 workspace 自动化。
- 已打包 Windows/macOS 可执行文件。
- 可复现的 release 验证报告导出。

基础入口：

- `pnpm run smoke:ui`
- `pnpm run smoke:ui:packaged`

## 输出

每次运行会在 `artifacts/smoke/<timestamp>` 下写入：

- `summary.json`
- `full-test-matrix.md`
- PNG 截图

退出码：

- `0`：所有 smoke 步骤通过。
- `2`：一个或多个 smoke 步骤失败。
- `1`：脚本或应用启动发生致命错误。

## 本地 Workspace 运行

用于验证当前源码和本地构建输出：

```powershell
pnpm run typecheck
pnpm run build
pnpm run smoke:ui
```

默认模式会启动当前 workspace 下的 Electron，并自动写入报告 artifacts。

## 打包运行

手动生成 packaged directory build：

```powershell
pnpm run build
pnpm run pack
```

快速本地 packaged wrapper：

```powershell
pnpm run smoke:ui:packaged
```

该 wrapper 会先运行 `pnpm run pack`，再从 `release/*` 启动打包后的可执行文件，避免误用旧的 packaged output。

Windows PowerShell 示例：

```powershell
$env:TERMDOCK_SMOKE_EXECUTABLE = (Resolve-Path "release\\win-unpacked\\TermDock.exe")
$env:TERMDOCK_SMOKE_LABEL = "Packaged App (Windows)"
$env:TERMDOCK_SMOKE_PLATFORM = "windows"
pnpm run smoke:ui
```

macOS 示例：

```bash
export TERMDOCK_SMOKE_EXECUTABLE="$(find release -path '*TermDock.app/Contents/MacOS/TermDock' | head -n 1)"
export TERMDOCK_SMOKE_LABEL="Packaged App (macOS)"
export TERMDOCK_SMOKE_PLATFORM="macos"
pnpm run smoke:ui
```

注意：

- macOS 要指向 `.app` bundle 内部的真实 executable，而不是 `.app` 目录。
- 想使用 workspace/dev-mode 启动时，不要设置 `TERMDOCK_SMOKE_EXECUTABLE`。

## Embedded Fixture Baseline

Smoke runner 会在启动 Electron 前启动本地 embedded SSH/SFTP fixture：`scripts/smoke-ssh-fixture.mjs`。

覆盖范围包括：

- SSH auth/connect 和 shell open。
- alternate-screen editor focus mode 进入 / 退出。
- dangerous-command approval。
- SFTP list/upload/download/delete。
- SFTP batch upload recovery。
- Settings > SFTP 保存 / 应用验证。
- port-forward 创建基线和 Operation Center 可见性。
- remote-open-file 保存回传冲突警告和临时文件清理。
- fixture 意外关闭后的 Diagnostics disconnect-report 捕获。

默认 workspace 或 packaged smoke 不需要外部主机。

## 当前自动化覆盖

- Editor workbench shell 渲染。
- Embedded live SSH auth/connect lifecycle。
- Embedded live SFTP list/upload/download/delete。
- Embedded live port-forward creation。
- Operation Center summary。
- Remote-open-file conflict warning。
- Unexpected fixture shutdown -> Diagnostics disconnect-report。
- Dangerous-command approval bar。
- Sessions explorer context menus。
- Retry Center、Settings、Diagnostics、Hotkeys 等关键路径。

## 何时运行

- 改动 SSH/SFTP/设置/诊断/Operation Center/Retry Center/Guardrails/布局时运行。
- 发布前运行。
- 打包产物需要验证时运行 `pnpm run smoke:ui:packaged`。

英文版 `PACKAGED_SMOKE.md` 保留完整历史覆盖列表和外部主机 annotation 示例。

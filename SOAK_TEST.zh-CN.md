# 传输 Soak Test

[English](SOAK_TEST.md)

这份文档说明如何针对真实 SSH/SFTP 服务器运行长时间传输压力测试。

Last updated: 2026-05-12

## 目标

- 复现并衡量大量上传负载下的随机断连问题。
- 验证当前分支基线上的 monitor polling 和 terminal stability 加固。
- 如果怀疑 transfer 回归，再运行这套 soak。

## 脚本

- 脚本路径：`scripts/soak-transfer.mjs`
- 运行时：Node.js 22+
- 传输库：`ssh2`，与应用后端核心库一致。

## 必需环境变量

- `TD_SSH_HOST`：服务器 host/IP。
- `TD_SSH_USER`：用户名。
- 认证方式二选一：
  - `TD_SSH_PASSWORD`
  - `TD_SSH_KEY_PATH`，可选 `TD_SSH_PASSPHRASE`

## 可选环境变量

- `TD_SSH_PORT`，默认 `22`
- `TD_DURATION_MINUTES`，默认 `30`
- `TD_UPLOAD_CONCURRENCY`，默认 `4`
- `TD_FIXTURE_FILES`，默认 `24`
- `TD_FILE_SIZE_KB`，默认 `128`
- `TD_MAX_UPLOADS`，默认 `4000`
- `TD_REMOTE_BASE_DIR`，默认 `/tmp/termdock-soak`
- `TD_MONITOR_INTERVAL_MS`，默认 `5000`
- `TD_MONITOR_TIMEOUT_MS`，默认 `10000`
- `TD_MONITOR_ALLOW_OVERLAP`，默认 `false`
- `TD_KEEP_REMOTE`，默认 `false`
- `TD_PROGRESS_EVERY`，默认 `50`

## 运行示例 (PowerShell)

```powershell
$env:TD_SSH_HOST="10.0.0.12"
$env:TD_SSH_USER="root"
$env:TD_SSH_PASSWORD="your-password"
$env:TD_DURATION_MINUTES="60"
$env:TD_UPLOAD_CONCURRENCY="5"
$env:TD_FILE_SIZE_KB="256"
$env:TD_MAX_UPLOADS="10000"
node scripts/soak-transfer.mjs
```

## 结果解释

脚本结束时会打印 JSON summary，优先看：

- `disconnectedUnexpectedly`
  - `true` 表示测试窗口内 SSH session 意外关闭。
- `uploadsFailed`
  - 非 0 表示文件传输失败。
- `monitorErrors`
  - 非 0 表示监控命令失败或超时。
- `sampleErrors`
  - 首批错误样本，方便快速分级。

退出码：

- `0`：未检测到断连或失败。
- `2`：检测到断连、传输失败或 monitor 失败。
- `1`：setup/runtime 致命错误。

## Bug 分级日志收集

当 soak run 出现断连或失败时，请一起收集应用诊断日志和 soak summary：

1. 打开应用 `Settings > Diagnostics`。
2. 点击 `Export Bug Report` 并保存 zip。
3. 点击 `Export Disconnect Reports` 或 `Export CSV` 导出断连时间线证据。
4. 可选：点击 `Copy Latest Report` 方便在聊天 / 工单中交接。
5. 可选：点击 `Open Folder` 查看原始日志。
6. 将 bug-report zip、disconnect export 和 soak summary JSON 附到 bug report。

如果问题涉及 SSH tunnel / port forwarding，也收集 forwarding diagnostics：

1. 打开受影响标签页的 `Settings > Port Fwd`。
2. 点击 `Export Snapshot`。
3. 在 `Recent Events` 下点击 `Export Analytics JSON` 或 `Export Analytics CSV`。
4. 将导出文件和 bug-report zip、soak summary JSON 一起附上。

如果还涉及 session/group 完整性，也导出会话元数据：

1. 打开 Sessions 面板上下文菜单。
2. 执行 `Export All Sessions...` 和 `Export All Groups...`。
3. 将两个 JSON 导出和 soak summary 一起附上。

## 推荐测试矩阵

1. Baseline：
   - `30 min`，concurrency `2`，file size `128 KB`
2. Medium：
   - `60 min`，concurrency `4`，file size `256 KB`
3. High pressure：
   - `90 min`，concurrency `6`，file size `512 KB`

## 打包应用手动 UI 验证

脚本运行后验证 packaged UI：

1. 打开小窗口，不最大化，在 `nano` / `vim` 中编辑大文件。
2. 连续滚动 `2-3` 分钟。
3. 确认没有 viewport corruption 或异常 wheel 文本。
4. 最大化 / 还原窗口后重复验证。
5. 运行大批量上传 / 下载，确认正常成功只在 dock inline notice 中展示，不弹阻塞 modal。
6. 触发一个可恢复错误路径，确认全局错误栏动作可用。
7. 检查 `Settings > Hotkeys` 冲突工具行为。
8. 重复打开同一 session，确认聚焦已有标签和双击打开新标签行为符合预期。
9. 如果传输过程中重启应用，确认 transfer dock 显示 `Restore Pending` 和 `Discard Pending`。
10. 从外部编辑器打开并编辑远程文件，验证 save-back 和冲突保护。
11. 打开 `Settings > Safety`，验证危险命令审批栏的 `Run Once` 和 `Cancel` 行为。

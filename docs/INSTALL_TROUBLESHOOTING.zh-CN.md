# 安装和启动故障排查

[English](INSTALL_TROUBLESHOOTING.md)

当 TermDock 无法安装、打开或启动时，请使用这份指南。

## 下载正确的安装包

请只从官方 GitHub Releases 页面下载 TermDock：

```text
https://github.com/gongteng0215/TermDock/releases
```

推荐文件：

| 平台 | 推荐文件 | 适用场景 |
| --- | --- | --- |
| Windows | `TermDock.Setup.*.exe` | 普通安装包。 |
| Windows | Windows `.zip` | 免安装便携版。 |
| macOS Apple Silicon | macOS `arm64` `.dmg` 或 `.zip` | M1/M2/M3/M4 等 Apple Silicon 机型。 |
| macOS Intel | macOS `x64` `.dmg` 或 `.zip` | Intel 处理器机型。 |
| Source | 源码 | 本地运行或参与开发。 |

如果不确定，Windows 优先使用 `.exe` 安装包，macOS 优先使用 `.dmg`。如果不确定自己的 Mac 芯片类型，可以打开 Apple 菜单 -> 关于本机查看。

## Windows

### Windows 显示安全提示

Windows 可能会对新的或未签名的应用显示 SmartScreen 或发布者提示。

继续前请确认：

- 文件来自官方 GitHub Releases 页面。
- 文件名符合预期的 TermDock release asset。
- 不要安装来自镜像站或未知链接的文件。

如果 Windows 阻止安装，请记录完整提示文字，并提交 install issue。

### 便携 ZIP 无法启动

请检查：

1. 先解压 `.zip`，不要直接在压缩包里运行。
2. 将解压目录移动到普通用户目录，例如 `Downloads` 或 `Documents`。
3. 避免从网络共享目录或受保护系统目录运行。
4. 如果杀毒软件隔离了文件，请在 issue 里提供完整检测名称。

## macOS

### macOS 提示应用无法打开

当应用尚未完全 notarized 或未被 Gatekeeper 信任时，macOS 可能会阻止打开。

继续前请确认：

- 文件来自官方 GitHub Releases 页面。
- 有 `.dmg` 时优先使用 `.dmg`。
- 不要运行未知镜像来源的副本。

如果 macOS 阻止打开，请记录完整弹窗文字和 macOS 版本。

### 应用打开后是空白窗口

如果应用能启动但显示空白窗口：

1. 退出 TermDock。
2. 重新打开一次。
3. 如果仍然空白，请提交 install issue，并附上：
   - TermDock 版本
   - macOS 版本
   - 下载的安装包
   - 空白窗口截图

## 源码构建

本地开发：

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm build
```

如果源码启动失败，请提供：

- Node.js 版本
- pnpm 版本
- OS 版本
- 完整终端输出

提交日志前请移除私有路径、token、主机名、用户名和凭据。

## 日志和诊断

TermDock 内置诊断和 bug report 导出工具。如果应用可以打开：

1. 打开 Settings。
2. 进入 Diagnostics。
3. 使用日志或 bug report 导出功能。
4. 分享前先检查导出的文件。

Bug report 导出可能包含运行时元数据、日志、设置快照或断连报告。公开上传前请移除敏感信息。

如果应用完全无法打开，请附上：

- 完整安装 / 启动错误文字
- 错误弹窗截图
- OS 版本
- 下载的 release asset 文件名

## 提 Issue 前

请包含：

- TermDock 版本
- 平台和系统版本
- 下载的 asset 文件名
- 问题类型：安装失败、启动失败、空白窗口或系统安全提示
- 完整警告 / 错误文字
- 尽可能提供截图
- 确认文件是否来自官方 GitHub Releases 页面

请不要包含：

- 密码
- 私钥
- token
- 生产主机名
- 真实用户名
- 敏感服务器路径

在这里提交 install issue：

```text
https://github.com/gongteng0215/TermDock/issues/new/choose
```

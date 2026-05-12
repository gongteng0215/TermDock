# TermDock PRD

[English](PRD.md)

Version: v1.23 中文维护版
Last updated: 2026-05-12

## 1. 产品定位

TermDock 是面向开发者和运维人员的桌面 SSH + SFTP 工作台。产品目标是在一个窗口内完成会话管理、终端操作、文件传输、服务器状态查看和故障恢复，降低上下文切换。

目标平台：

- macOS：优先体验。
- Windows 11：完整兼容。

## 2. 产品目标

### MVP (P0)

- 快速可靠的远程登录。
- 稳定的多标签终端工作流。
- 可用的 SFTP 浏览和传输工作流。
- 安全高效的日常服务器操作。

### MVP 非目标

- 企业堡垒机 / 治理套件。
- 云账号身份平台。
- 移动端客户端。

## 3. 目标用户

- 后端 / 前端工程师。
- SRE / 运维工程师。
- 高频使用 SSH + 文件传输的个人开发者和小团队。

## 4. UX 原则

- 紧凑优先。
- 信息密度优先于装饰性留白。
- editor-workbench 层级：终端作为中心舞台，SFTP 作为 Explorer，sessions/health/history 作为 Inspector，传输作为底部面板。
- 列表 / 树操作优先使用上下文菜单。
- 对破坏性操作提供强保护。
- 保持平台原生键盘习惯。

## 5. 功能范围

### 5.1 会话管理

- 创建 / 编辑 / 删除 / 测试连接。
- 搜索、收藏过滤、最近使用排序。
- 文件夹式分组导航。
- 分组 / 会话上下文菜单。
- 从 `~/.ssh/config` 导入，并支持预览和重复项处理。
- 会话模板和本地环境变量预设。
- 会话 / 分组 JSON 导入导出。

### 5.2 终端

- 基于 xterm 的终端渲染。
- 多标签终端。
- 同一会话重复打开时聚焦已有标签。
- alternate-screen 编辑器聚焦模式。
- 可配置热键和冲突检测。
- 命令历史、快捷命令 profiles、命令片段和 playbooks。
- 危险命令保护：
  - 键盘 Enter、粘贴、命令历史、snippets、quick profiles、startup commands 等来源写入前审批。
  - 支持策略包、环境模板、来源开关、会话组覆盖、临时授权和持久策略。
- Operation Center：
  - 汇总传输、删除、端口转发、诊断任务和重连操作。
- 端口转发：
  - Local / Remote / Dynamic SOCKS5。
  - 预设保存、自动恢复、状态和事件导出。

### 5.3 SFTP

- 浏览 / 打开 / 刷新 / 路径跳转。
- SFTP Explorer rail。
- Compact / Details 视图模式持久化。
- 创建文件夹、重命名、删除。
- 上传 / 下载队列和进度。
- 单任务取消和全部取消。
- 上传 / 下载方向分别限速。
- 可选的星期 / 时间窗口。
- 冲突策略：overwrite / skip / rename。
- 失败传输重试和 Retry Center。
- 断连时暂停，重连后恢复待处理传输。
- 应用重启后恢复 / 丢弃 pending queue。
- 文件夹下载和拖拽上传。

### 5.4 远程文件打开 / 编辑

- 将远程文件打开到本地临时文件。
- 避免同一远程文件重复打开。
- 支持关闭后重新打开。
- 本地草稿未同步时提示复用或重新加载。
- 保存后回传远程路径。
- 通过远程元数据基线避免静默覆盖。
- 标签页关闭或应用释放会话时清理临时文件。

### 5.5 服务器健康

- CPU、内存、磁盘、网络、负载、运行时间。
- 进程和失败服务。
- tab-scoped monitor 状态，避免跨标签串扰。
- 健康详情弹窗提供 Overview / Disk / Network / Processes / Services。

### 5.6 诊断

- 主进程和 renderer 日志。
- 断连报告。
- bug report `.zip` 导出。
- 日志路径动作和公开分享前检查。

## 6. 发布和信任

- 支持 Windows installer / portable zip。
- 支持 macOS dmg / zip。
- 当前公开可信签名 / notarization 证据仍在推进。
- 暂无应用内自动更新。
- TermDock 是本地优先桌面应用，不需要云账号。

## 7. 当前已知限制

- 持久化仍基于 JSON，SQLite 迁移待做。
- 运行中的端口转发目前按标签页管理。
- Dynamic forwarding 当前支持 SOCKS5 no-auth `CONNECT` 基线。
- 公开分发信任链仍需继续完善。

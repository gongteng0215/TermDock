# 会话迁移

[English](SESSION_MIGRATION.md)

TermDock 现在有三种导出路径，它们的安全边界不同。

## 普通会话 JSON

`Export All Sessions...` / `导出所有会话...` 会生成可读 JSON 备份，包含会话元数据：

- 名称、主机、端口、用户名、认证类型、分组、备注、收藏状态
- 私钥会话的 private-key path
- `hasSecret`，用于标记这个会话是否曾保存密码或私钥 passphrase

普通 JSON 导出不会包含解密后的密码、私钥 passphrase 或私钥文件内容。它适合本地备份、审计，以及迁移会话列表后再手动修复凭据。

## 加密迁移包

`Export Encrypted Migration...` / `导出加密迁移包...` 会创建一个 `.tdmigration` 文件，并使用你设置的 passphrase 加密。

加密迁移包可以包含：

- 密码会话里保存的密码
- 私钥会话里保存的 passphrase
- 如果你选择 `Include Keys`，也会包含私钥文件内容
- 会话元数据和分组信息

`Import Encrypted Migration...` / `导入加密迁移包...` 会要求输入同一个 passphrase，解密后显示预览，再按和 JSON 导入一致的分组策略、重复项策略导入会话。

## 应用备份（SQLite 耐久状态）

`Export App Backup...` / `导出应用备份...` 会创建 `.tdbackup` 文件，包含非机密耐久 SQLite 状态：

- 会话元数据（仅 `hasSecret`，不含密码）
- 传输历史 / 待恢复、断线报告、端口转发事件
- 快捷配置、会话模板（无明文密码）、片段分组 / 作用域值
- 允许名单耐久应用偏好

可选附加口令保护的会话凭据，复用与 `.tdmigration` 相同的加密封装。

`Import App Backup...` / `导入应用备份...` 会显示预览，询问会话重复策略（`skip` / `overwrite` / `rename`），可选恢复凭据，替换耐久 SQLite 表，并刷新渲染进程状态。

## 私钥处理

如果导出时包含私钥文件内容，导入时 TermDock 不会覆盖来源机器上的原始路径。嵌入的私钥会恢复到 TermDock 本机应用数据目录中，导入后的会话会指向这些恢复出来的私钥文件。

如果导出时选择 `Paths Only`，私钥会话只保留原始路径。只有导入机器上也存在这个路径时，会话才可能直接可用。

## 安全提示

- `.tdmigration` 文件和 passphrase 要分开保存。
- 任何同时拿到文件和 passphrase 的人，都可能连接你的服务器。
- 使用足够长、唯一的 passphrase。
- 迁移完成后删除旧迁移包。
- 如果只需要无敏感信息的会话列表，优先使用普通 JSON 导出。


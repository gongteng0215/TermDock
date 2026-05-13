# SSH 配置导入

[English](SSH_CONFIG_IMPORT.md)

TermDock 可以从本地 OpenSSH 配置中导入常见 `Host` 条目，把你已有的命令行 SSH 快捷配置转换成 TermDock 会话。

## 快速流程

1. 打开 TermDock。
2. 如果是空工作区，在 Sessions 引导卡片里点击 `Import SSH Config`。
3. 如果已有会话，在 Sessions 面板菜单里选择 `Import SSH Config...` / `导入 SSH 配置...`。
4. 选择你的 SSH config 文件：
   - macOS / Linux：`~/.ssh/config`
   - Windows：`C:\Users\<你的用户名>\.ssh\config`
5. 输入目标分组名称；也可以留空，导入到未分组。
6. 点击 `Review Import` 查看预览。
7. 确认预览无误后点击 `Import`。
8. 导入完成后，如果想马上连接，选择 `Open First Imported`。

## 支持的字段

TermDock 当前会导入这些 OpenSSH 指令：

| OpenSSH 指令 | TermDock 会话字段 |
| --- | --- |
| `Host` | 会话名称和别名 |
| `HostName` | 主机 |
| `User` | 用户名 |
| `Port` | 端口 |
| `IdentityFile` | 私钥路径 |
| `Include` | 额外配置文件 |

如果没有 `HostName`，TermDock 会使用 `Host` 别名作为主机。如果没有 `User`，TermDock 会使用当前系统用户名。如果没有 `Port`，TermDock 会使用 `22`。

`IdentityFile` 路径支持 `~`，也支持这些 OpenSSH token：`%d`、`%u`、`%r`、`%h`、`%n`、`%p` 和 `%%`。

## 示例

```sshconfig
Host production-api
  HostName 203.0.113.10
  User deploy
  Port 22
  IdentityFile ~/.ssh/production_api

Host staging-*
  User ubuntu
  Port 2222
```

第一段会导入成一个名为 `production-api` 的私钥会话。像 `Host staging-web` 这样的具体别名会导入成会话；只有通配符的 `Host staging-*` 会用于匹配选项，但不会单独创建会话。

## 重复项处理

TermDock 会按主机、端口和用户名判断重复。

发现重复项时，可以选择：

| 策略 | 结果 |
| --- | --- |
| `Skip Duplicates` | 保留已有会话，跳过重复导入项。 |
| `Overwrite Existing` | 用导入值更新已有匹配会话。 |
| `Create Renamed Copies` | 创建重命名的新会话。 |

## 当前限制

导入器目前不会导入所有 OpenSSH 选项。下面这些配置会暂时忽略：

- `ProxyJump`、`ProxyCommand` 和跳板机链路
- `LocalForward`、`RemoteForward` 和 `DynamicForward`
- `CertificateFile`、`IdentitiesOnly`、`HostKeyAlias` 和 known-host 相关设置
- 只有通配符的 `Host` 模式作为独立会话
- 密码或私钥 passphrase

导入后的会话会引用你的私钥路径。TermDock 不会把私钥文件内容复制进应用。

## 排查

如果预览里没有会话：

- 确认文件里有具体 `Host` 别名，例如 `Host my-server`
- 不要只使用 `Host *` 或 `Host prod-*` 这样的通配模式
- 检查 `Include` 指向的文件是否存在且可读

如果导入后的私钥会话连接失败：

- 确认 `IdentityFile` 路径在当前机器上存在
- 检查当前系统用户是否有权限读取私钥文件
- 编辑导入后的会话，确认认证方式是 `Private Key`
- 如果私钥有 passphrase，在连接前到会话表单里填写

如果导入了错误的用户名或主机：

- 检查是否有更宽泛的 `Host *` 块在设置默认值
- 检查包含进来的配置文件是否覆盖了选项
- 如果命令行配置依赖 TermDock 暂未导入的高级 OpenSSH 行为，可以先手动编辑导入后的会话

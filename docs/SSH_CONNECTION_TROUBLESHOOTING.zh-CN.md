# SSH 连接故障排查

[English](SSH_CONNECTION_TROUBLESHOOTING.md)

当 TermDock 会话创建或导入后无法连接时，可以使用这份指南排查。

TermDock 会尝试把常见 SSH 错误转换成简短原因和 `Next:` 建议。原始 SSH 错误仍会保留，方便你搜索服务器日志或提交 issue。

## 常见错误

| 摘要 | 检查方向 |
| --- | --- |
| `SSH authentication failed.` | 用户名、密码、私钥、私钥 passphrase 和服务器认证策略。 |
| `Private key file was not found.` | 会话里的私钥路径或导入的 `IdentityFile` 值。 |
| `Private key file cannot be read.` | 文件权限，以及当前系统用户是否能读取私钥。 |
| `Private key could not be used.` | 私钥格式、加密私钥 passphrase 或不支持的 key 类型。 |
| `Host name could not be resolved.` | 主机、`HostName`、DNS、VPN，以及 SSH config alias 是否正确导入。 |
| `Connection was refused by the server.` | SSH 端口、`sshd` 是否运行、防火墙和云安全组。 |
| `Connection timed out.` | 主机、端口、VPN、防火墙、云安全组和服务器可达性。 |
| `Server network is unreachable.` | 本地网络、VPN 路由、私网 IP 路由和服务器防火墙。 |
| `SSH host key verification failed.` | 服务器身份，以及是否存在过期的 `known_hosts` 记录。 |
| `SSH handshake failed.` | 服务器 SSH 兼容性、算法、跳板机 / 代理要求，或远端过早关闭连接。 |
| `Remote host closed the connection.` | 服务器 SSH 日志、allowlist、连接数量限制和跳板机 / 代理要求。 |

## 从 SSH Config 导入后

如果会话来自 `~/.ssh/config`，先检查：

- `HostName` 是否导入为真实主机。缺少时，TermDock 会用 `Host` 别名作为主机。
- `User` 是否正确导入。缺少时，TermDock 会使用当前系统用户名。
- `Port` 是否正确导入。缺少时，TermDock 会使用 `22`。
- `IdentityFile` 是否指向当前机器上真实存在的私钥文件。
- 该配置是否依赖 TermDock 暂未支持的选项，例如 `ProxyJump`、`ProxyCommand` 或 `LocalForward`。

导入能力细节见 [SSH 配置导入](SSH_CONFIG_IMPORT.zh-CN.md)。

## 快速手动检查

可以先用系统终端尝试同一个目标：

```bash
ssh -vvv -p 22 user@example.com
```

如果使用私钥：

```bash
ssh -vvv -i ~/.ssh/id_rsa -p 22 user@example.com
```

如果命令行 SSH 可以连接，但 TermDock 不行，请对比：

- 主机
- 端口
- 用户名
- 私钥路径
- 私钥 passphrase
- 命令行 SSH 是否使用了 `ProxyJump`、`ProxyCommand`、证书文件或 TermDock 暂未导入的其他选项

## 提 Issue 时请提供

请包含：

- TermDock 版本
- OS 版本
- 会话是手动创建还是从 SSH config 导入
- 脱敏后的主机类型，例如 `public IPv4`、`private IPv4`、`DNS name` 或 `SSH config alias`
- 认证方式：密码或私钥
- 完整 TermDock 错误文字，包括 raw error
- 同一台机器上命令行 `ssh -vvv` 是否可以连接

请不要包含密码、私钥、私钥 passphrase、真实生产主机名、真实用户名、token 或敏感服务器路径。

# SSH Connection Troubleshooting

[中文](SSH_CONNECTION_TROUBLESHOOTING.zh-CN.md)

Use this guide when a TermDock session does not connect after you create or import it.

TermDock tries to translate common SSH failures into a short summary plus a `Next:` suggestion. The raw SSH error is still shown so you can search server logs or include it in an issue.

## Common Errors

| Summary | What To Check |
| --- | --- |
| `SSH authentication failed.` | Username, password, private key, key passphrase, and server auth policy. |
| `Private key file was not found.` | The session private-key path or imported `IdentityFile` value. |
| `Private key file cannot be read.` | File permissions and whether your OS user can read the key. |
| `Private key could not be used.` | Key format, encrypted key passphrase, or unsupported key type. |
| `Host name could not be resolved.` | Host, `HostName`, DNS, VPN, and whether an SSH config alias imported correctly. |
| `Connection was refused by the server.` | SSH port, whether `sshd` is running, firewall, and cloud security groups. |
| `Connection timed out.` | Host, port, VPN, firewall, cloud security groups, and server reachability. |
| `Server network is unreachable.` | Local network, VPN route, private IP routing, and server firewall. |
| `SSH host key verification failed.` | Server identity and stale `known_hosts` entries. |
| `SSH handshake failed.` | Server SSH compatibility, algorithms, bastion/proxy requirements, or early remote close. |
| `Remote host closed the connection.` | Server-side SSH logs, allowlists, connection limits, and bastion/proxy requirements. |

## After Importing SSH Config

If the session came from `~/.ssh/config`, first check:

- `HostName` was imported as the real host. If missing, TermDock uses the `Host` alias as the host.
- `User` was imported correctly. If missing, TermDock uses your local OS username.
- `Port` was imported correctly. If missing, TermDock uses `22`.
- `IdentityFile` points to a key file that exists on this computer.
- The config did not depend on unsupported options such as `ProxyJump`, `ProxyCommand`, or `LocalForward`.

For the importer details, see [SSH Config Import](SSH_CONFIG_IMPORT.md).

## Quick Manual Checks

Try the same target from a terminal:

```bash
ssh -vvv -p 22 user@example.com
```

For private keys:

```bash
ssh -vvv -i ~/.ssh/id_rsa -p 22 user@example.com
```

If command-line SSH works but TermDock does not, compare:

- host
- port
- username
- private key path
- key passphrase
- whether command-line SSH uses `ProxyJump`, `ProxyCommand`, certificate files, or other options TermDock does not import yet

## What To Include In An Issue

Please include:

- TermDock version
- OS version
- whether the session was created manually or imported from SSH config
- sanitized host shape, such as `public IPv4`, `private IPv4`, `DNS name`, or `SSH config alias`
- auth type: password or private key
- the full TermDock error text, including the raw error
- whether command-line `ssh -vvv` works from the same machine

Do not include passwords, private keys, key passphrases, real production hostnames, real usernames, tokens, or sensitive server paths.

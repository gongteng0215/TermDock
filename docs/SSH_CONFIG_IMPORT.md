# SSH Config Import

[中文](SSH_CONFIG_IMPORT.zh-CN.md)

TermDock can import common OpenSSH `Host` entries from your local SSH config so you can turn existing command-line SSH shortcuts into TermDock sessions.

## Quick Path

1. Open TermDock.
2. In an empty workspace, click `Import SSH Config` in the Sessions onboarding card.
3. In an existing workspace, open the Sessions menu and choose `Import SSH Config...`.
4. Select your SSH config file:
   - macOS / Linux: `~/.ssh/config`
   - Windows: `C:\Users\<you>\.ssh\config`
5. Enter a target group name, or leave it empty for ungrouped sessions.
6. Click `Review Import`.
7. Check the preview, then click `Import`.
8. After import, choose `Open First Imported` if you want to connect immediately.

The preview can include warnings for OpenSSH options that TermDock recognizes but does not import yet. Treat those warnings as a checklist for manual follow-up after import.

## Supported Fields

TermDock currently imports these OpenSSH directives:

| OpenSSH directive | TermDock session field |
| --- | --- |
| `Host` | Session name and alias |
| `HostName` | Host |
| `User` | Username |
| `Port` | Port |
| `IdentityFile` | Private key path |
| `Include` | Additional config files |

If `HostName` is missing, TermDock uses the `Host` alias as the host. If `User` is missing, TermDock uses the current local OS username. If `Port` is missing, TermDock uses `22`.

`IdentityFile` paths support `~` plus these OpenSSH tokens: `%d`, `%u`, `%r`, `%h`, `%n`, `%p`, and `%%`.

## Example

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

The first entry imports as a private-key session named `production-api`. A concrete alias such as `Host staging-web` imports as a session; wildcard-only aliases such as `Host staging-*` are used for matching options but are not created as sessions by themselves.

## Duplicate Handling

TermDock checks duplicates by host, port, and username.

When duplicates are found, choose one of these strategies:

| Strategy | Result |
| --- | --- |
| `Skip Duplicates` | Keep existing sessions and ignore matching imported entries. |
| `Overwrite Existing` | Update the existing matching sessions with the imported values. |
| `Create Renamed Copies` | Create new sessions with renamed names. |

## Current Limitations

The importer does not yet import every OpenSSH option. These are intentionally ignored for now:

- `ProxyJump`, `ProxyCommand`, and bastion chains
- `LocalForward`, `RemoteForward`, and `DynamicForward`
- `CertificateFile`, `IdentitiesOnly`, `HostKeyAlias`, and known-host settings
- wildcard-only `Host` patterns as standalone sessions
- passwords or private-key passphrases

The import preview warns about the most common unsupported OpenSSH options, including `ProxyJump`, `ProxyCommand`, `LocalForward`, `RemoteForward`, `DynamicForward`, `CertificateFile`, and `IdentitiesOnly`.

Imported sessions reference your private key path. TermDock does not copy private-key file contents into the app.

## Troubleshooting

If no sessions appear in the preview:

- make sure the file contains concrete `Host` aliases such as `Host my-server`
- avoid only using wildcard patterns such as `Host *` or `Host prod-*`
- check whether `Include` paths point to readable files

If a private-key session fails to connect after import:

- confirm the `IdentityFile` path exists on this machine
- check that the key file is readable by your OS user
- edit the imported session and confirm the auth type is `Private Key`
- if the key has a passphrase, enter it in the session form before connecting

If the wrong username or host is imported:

- check whether a broader `Host *` block is applying defaults
- check whether an included config file overrides the option
- edit the imported session directly if the command-line config uses advanced OpenSSH behavior TermDock does not import yet

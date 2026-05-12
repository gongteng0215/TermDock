# TermDock 发布签名

[English](RELEASE_SIGNING.md)

Last updated: 2026-05-12

## 目标

为以下场景提供确定性的 preflight / build / verify 流程：

- 已签名 Windows release artifacts。
- 已签名并 notarized 的 macOS release artifacts。
- 可复现的安装验证证据。

本地 / 私有 Windows 使用场景也提供自签名路径。

## CI Secrets

Windows 签名：

- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`

macOS 签名：

- `MAC_CSC_LINK`
- `MAC_CSC_KEY_PASSWORD`

macOS notarization 可选方法：

- `APPLE_API_KEY_B64` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`
- `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`
- `APPLE_KEYCHAIN` + `APPLE_KEYCHAIN_PROFILE`

说明：

- Release workflow 从 `WIN_CSC_*` 读取 Windows 签名，从 `MAC_CSC_*` 读取 macOS 签名。
- Apple API key 方法会将 `.p8` 内容保存为 `APPLE_API_KEY_B64`，再由 `scripts/prepare-release-secrets.mjs` 生成临时文件。
- macOS hardened runtime entitlements 位于 `build/entitlements.mac.plist` 和 `build/entitlements.mac.inherit.plist`。

## Repo Secret Bootstrap

如果凭据文件已在本机，可以用 `gh` 写入 repo secrets。

Windows code-signing cert：

```powershell
pnpm run release:set-secrets -- --repo=gongteng0215/TermDock --dry-run --win-csc-file=path\\to\\windows-cert.pfx --win-csc-key-password=your-password
```

macOS signing cert + API key notarization：

```powershell
pnpm run release:set-secrets -- --repo=gongteng0215/TermDock --dry-run --mac-csc-file=path\\to\\mac-cert.p12 --mac-csc-key-password=your-password --apple-api-key-file=path\\to\\AuthKey_ABC123.p8 --apple-api-key-id=ABC123 --apple-api-issuer=issuer-guid
```

确认名称和文件路径正确后移除 `--dry-run`。

## Windows 自用路径

只需要给自己或小范围可信环境使用 Windows 安装包时：

```powershell
pnpm run release:self-use:cert:win
pnpm run release:self-use:win
```

该流程会：

- 在 `%USERPROFILE%\\.termdock-secrets\\windows` 下创建或复用自签名代码签名证书。
- 构建 `win-unpacked`。
- 使用本地 `signtool.exe` 签名 `TermDock.exe`。
- 通过 `--prepackaged` 重新打包。
- 签名顶层 installer。
- 运行 `pnpm run release:verify -- --platform=win --expect-signature --install-smoke`。

限制：

- 仅适合自用 / 私有分发。
- 未信任该自签名证书的机器仍会认为签名不受信任。
- 不能替代公开发布所需的 CA 证书。

## Preflight

构建前检查签名 / notarization 输入是否存在。

Windows：

```powershell
pnpm run release:preflight -- --platform=win --require-signing
```

macOS：

```bash
pnpm run release:preflight -- --platform=mac --require-signing --require-notarization
```

脚本会打印缺失项，并在必需输入缺失时以非零退出。

## Artifact 验证

构建 release artifacts 后验证签名和安装行为。

Windows signed verification + installer smoke：

```powershell
pnpm run release:verify -- --platform=win --expect-signed --install-smoke
```

macOS signed/notarized verification + DMG mount check：

```bash
pnpm run release:verify -- --platform=mac --expect-signed --expect-notarized --install-smoke
```

每次运行会在 `artifacts/release-verify/<timestamp>/` 写入报告。

## 当前缺口

- GitHub Actions secrets provisioning 仍需完成。
- 首次公开可信 Windows 签名证据和首次 signed/notarized macOS 证据仍待完成。
- 本地 Windows 自用发布流程可用，但不能替代 CA-backed public release signing。

# Session Migration

[中文](SESSION_MIGRATION.zh-CN.md)

TermDock has three export paths with different security tradeoffs.

## Plain Session JSON

`Export All Sessions...` creates a readable JSON backup of session metadata:

- name, host, port, username, auth type, group, remark, favorite state
- private-key path for key-based sessions
- `hasSecret` so you can see whether a password or key passphrase existed

Plain JSON exports do not include decrypted passwords, private-key passphrases, or private-key file contents. They are useful for local backup, auditing, and moving session lists when you plan to repair credentials after import.

## Encrypted Migration File

`Export Encrypted Migration...` creates a `.tdmigration` file protected by a passphrase that you choose.

The encrypted migration file can include:

- saved passwords for password sessions
- saved passphrases for private-key sessions
- private-key file contents, if you choose `Include Keys`
- session metadata and groups

`Import Encrypted Migration...` asks for the same passphrase, decrypts the file, shows a preview, and then imports sessions with the same duplicate and group strategies used by JSON import.

## App Backup (SQLite durable state)

`Export App Backup...` creates a `.tdbackup` file with non-secret durable SQLite state:

- session metadata (`hasSecret` flags only — no passwords)
- transfer history / pending restore, disconnect reports, port-forward events
- quick profiles, session templates (no plaintext secrets), snippet groups / scoped values
- allowlisted durable app preferences

You can optionally attach passphrase-protected session credentials using the same encrypted envelope as `.tdmigration`.

`Import App Backup...` shows a preview, asks for session duplicate strategy (`skip` / `overwrite` / `rename`), optionally restores credentials, replaces durable SQLite tables, and refreshes renderer state.

## Private Key Handling

If you include private-key file contents, TermDock does not overwrite the original path from the source machine. During import, embedded key files are restored into TermDock's local app data directory and imported sessions are pointed at those restored files.

If you choose `Paths Only`, private-key sessions keep their original key path. They will work only if that path exists on the importing machine.

## Security Notes

- Keep the `.tdmigration` file and passphrase separate.
- Anyone with both the file and passphrase may be able to connect to your servers.
- Use a long, unique passphrase.
- Delete old migration files after you finish moving machines.
- Prefer plain JSON export when you only need a non-sensitive session list.


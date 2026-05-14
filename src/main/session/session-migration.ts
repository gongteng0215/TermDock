import { createCipheriv, createDecipheriv, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import { app } from "electron";

import type {
  SessionMigrationEncryptedFile,
  SessionMigrationExportInput,
  SessionMigrationExportResult,
  SessionMigrationImportInput,
  SessionMigrationImportResult,
  SessionMigrationSessionPayload,
  SessionMigrationPlainPayload
} from "../../shared/session-migration.js";
import type { CredentialStore } from "../security/credential-store.js";

const scrypt = promisify(scryptCallback);

const SESSION_MIGRATION_FORMAT = "termdock-session-migration";
const SESSION_MIGRATION_VERSION = 1;
const SESSION_MIGRATION_KEY_LENGTH = 32;
const SESSION_MIGRATION_SALT_LENGTH = 16;
const SESSION_MIGRATION_IV_LENGTH = 12;
const SESSION_MIGRATION_PRIVATE_KEY_DIR = "imported-private-keys";

export async function exportEncryptedSessionMigration(
  credentialStore: CredentialStore,
  input: SessionMigrationExportInput
): Promise<SessionMigrationExportResult> {
  const passphrase = normalizePassphrase(input.passphrase);
  const warnings: string[] = [];
  const exportedAtIso = new Date().toISOString();
  const payloadSessions = [];
  let passwordSecretCount = 0;
  let privateKeySecretCount = 0;
  let embeddedPrivateKeyFileCount = 0;

  for (const session of input.sessions) {
    const secret = (await credentialStore.getSessionSecret(session.id)) ?? "";
    if (secret) {
      if (session.authType === "password") {
        passwordSecretCount += 1;
      } else {
        privateKeySecretCount += 1;
      }
    }
    let privateKeyFile:
      | {
          originalPath: string;
          fileName: string;
          contentsBase64: string;
        }
      | undefined;
    if (input.includePrivateKeyFiles && session.authType === "privateKey" && session.privateKeyPath) {
      const expandedPrivateKeyPath = expandHomePath(session.privateKeyPath);
      try {
        const contents = await readFile(expandedPrivateKeyPath);
        privateKeyFile = {
          originalPath: session.privateKeyPath,
          fileName: basename(expandedPrivateKeyPath) || "id_key",
          contentsBase64: contents.toString("base64")
        };
        embeddedPrivateKeyFileCount += 1;
      } catch (caughtError) {
        warnings.push(
          `Could not embed private key for "${session.name}" at "${session.privateKeyPath}": ${toErrorMessage(caughtError)}`
        );
      }
    }
    payloadSessions.push({
      name: session.name,
      host: session.host,
      port: session.port,
      username: session.username,
      authType: session.authType,
      privateKeyPath: session.privateKeyPath ?? "",
      groupId: session.groupId ?? "",
      remark: session.remark ?? "",
      favorite: session.favorite,
      secret,
      privateKeyFile
    });
  }

  const plainPayload: SessionMigrationPlainPayload = {
    exportedAtIso,
    appVersion: input.appVersion,
    sessionCount: payloadSessions.length,
    includesPasswords: passwordSecretCount > 0,
    includesPrivateKeyFiles: embeddedPrivateKeyFileCount > 0,
    sessions: payloadSessions
  };
  const file = await encryptMigrationPayload(passphrase, plainPayload, {
    exportedAtIso,
    appVersion: input.appVersion,
    sessionCount: payloadSessions.length,
    passwordSecretCount,
    privateKeySecretCount,
    embeddedPrivateKeyFileCount
  });
  return {
    file,
    warnings
  };
}

export async function importEncryptedSessionMigration(
  input: SessionMigrationImportInput
): Promise<SessionMigrationImportResult> {
  const passphrase = normalizePassphrase(input.passphrase);
  const parsed = parseMigrationFile(input.fileText);
  const payload = await decryptMigrationPayload(passphrase, parsed);
  const warnings: string[] = [];
  const shouldRestorePrivateKeyFiles = input.restorePrivateKeyFiles === true;
  const importedKeyDirectory = join(app.getPath("userData"), SESSION_MIGRATION_PRIVATE_KEY_DIR);
  let keyIndex = 0;

  const sessions = [];
  for (const session of payload.sessions) {
    let privateKeyPath = session.privateKeyPath;
    if (
      shouldRestorePrivateKeyFiles &&
      session.authType === "privateKey" &&
      session.privateKeyFile?.contentsBase64
    ) {
      try {
        keyIndex += 1;
        await mkdir(importedKeyDirectory, { recursive: true, mode: 0o700 });
        const safeName = sanitizePrivateKeyFileName(session.privateKeyFile.fileName, keyIndex);
        const outputPath = join(importedKeyDirectory, safeName);
        await writeFile(outputPath, Buffer.from(session.privateKeyFile.contentsBase64, "base64"), {
          mode: 0o600
        });
        privateKeyPath = outputPath;
      } catch (caughtError) {
        warnings.push(
          `Could not restore embedded private key for "${session.name}": ${toErrorMessage(caughtError)}`
        );
      }
    }
    sessions.push({
      ...session,
      privateKeyPath
    });
  }

  return {
    payload: {
      ...payload,
      sessions: stripPrivateKeyFileContents(sessions)
    },
    warnings
  };
}

async function encryptMigrationPayload(
  passphrase: string,
  payload: SessionMigrationPlainPayload,
  summary: SessionMigrationEncryptedFile["summary"] & {
    exportedAtIso: string;
    appVersion: string;
  }
): Promise<SessionMigrationEncryptedFile> {
  const salt = randomBytes(SESSION_MIGRATION_SALT_LENGTH);
  const iv = randomBytes(SESSION_MIGRATION_IV_LENGTH);
  const key = (await scrypt(passphrase, salt, SESSION_MIGRATION_KEY_LENGTH)) as Buffer;
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf-8"),
    cipher.final()
  ]);
  return {
    format: SESSION_MIGRATION_FORMAT,
    version: SESSION_MIGRATION_VERSION,
    exportedAtIso: summary.exportedAtIso,
    appVersion: summary.appVersion,
    crypto: {
      kdf: "scrypt",
      cipher: "aes-256-gcm",
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64")
    },
    summary: {
      sessionCount: summary.sessionCount,
      passwordSecretCount: summary.passwordSecretCount,
      privateKeySecretCount: summary.privateKeySecretCount,
      embeddedPrivateKeyFileCount: summary.embeddedPrivateKeyFileCount
    },
    ciphertext: ciphertext.toString("base64")
  };
}

async function decryptMigrationPayload(
  passphrase: string,
  file: SessionMigrationEncryptedFile
): Promise<SessionMigrationPlainPayload> {
  const key = (await scrypt(
    passphrase,
    Buffer.from(file.crypto.salt, "base64"),
    SESSION_MIGRATION_KEY_LENGTH
  )) as Buffer;
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(file.crypto.iv, "base64"));
  decipher.setAuthTag(Buffer.from(file.crypto.authTag, "base64"));
  try {
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(file.ciphertext, "base64")),
      decipher.final()
    ]).toString("utf-8");
    return normalizeMigrationPayload(JSON.parse(plaintext));
  } catch {
    throw new Error("Could not decrypt migration file. Check the passphrase and file contents.");
  }
}

function normalizePassphrase(value: string): string {
  const passphrase = typeof value === "string" ? value : "";
  if (passphrase.length < 8) {
    throw new Error("Migration passphrase must be at least 8 characters.");
  }
  return passphrase;
}

function parseMigrationFile(fileText: string): SessionMigrationEncryptedFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new Error("Migration file is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Migration file is not an object.");
  }
  const candidate = parsed as Partial<SessionMigrationEncryptedFile>;
  if (
    candidate.format !== SESSION_MIGRATION_FORMAT ||
    candidate.version !== SESSION_MIGRATION_VERSION ||
    !candidate.crypto ||
    candidate.crypto.kdf !== "scrypt" ||
    candidate.crypto.cipher !== "aes-256-gcm" ||
    typeof candidate.crypto.salt !== "string" ||
    typeof candidate.crypto.iv !== "string" ||
    typeof candidate.crypto.authTag !== "string" ||
    typeof candidate.ciphertext !== "string"
  ) {
    throw new Error("Migration file format is not supported.");
  }
  return candidate as SessionMigrationEncryptedFile;
}

function normalizeMigrationPayload(payload: unknown): SessionMigrationPlainPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Decrypted migration payload is not an object.");
  }
  const candidate = payload as Partial<SessionMigrationPlainPayload>;
  if (!Array.isArray(candidate.sessions)) {
    throw new Error("Decrypted migration payload does not contain sessions.");
  }
  const sessions = candidate.sessions
    .filter((session) => session && typeof session === "object")
    .map((session): SessionMigrationSessionPayload => {
      const row = session as unknown as Record<string, unknown>;
      const authType = row.authType === "privateKey" ? "privateKey" : "password";
      return {
        name: normalizeString(row.name),
        host: normalizeString(row.host),
        port: normalizePort(row.port),
        username: normalizeString(row.username),
        authType,
        privateKeyPath: authType === "privateKey" ? normalizeString(row.privateKeyPath) : "",
        groupId: normalizeString(row.groupId),
        remark: normalizeString(row.remark),
        favorite: row.favorite === true,
        secret: normalizeString(row.secret),
        privateKeyFile: normalizePrivateKeyPayload(row.privateKeyFile)
      };
    })
    .filter((session) => session.name && session.host && session.username);
  return {
    exportedAtIso: normalizeString(candidate.exportedAtIso),
    appVersion: normalizeString(candidate.appVersion),
    sessionCount: sessions.length,
    includesPasswords: candidate.includesPasswords === true,
    includesPrivateKeyFiles: candidate.includesPrivateKeyFiles === true,
    sessions
  };
}

function normalizePrivateKeyPayload(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const contentsBase64 = normalizeString(candidate.contentsBase64);
  if (!contentsBase64) {
    return undefined;
  }
  return {
    originalPath: normalizeString(candidate.originalPath),
    fileName: normalizeString(candidate.fileName) || "id_key",
    contentsBase64
  };
}

function stripPrivateKeyFileContents(
  sessions: SessionMigrationSessionPayload[]
): SessionMigrationSessionPayload[] {
  return sessions.map((session) => ({
    ...session,
    privateKeyFile: undefined
  }));
}

function normalizePort(value: unknown): number {
  const parsed =
    typeof value === "number" ? Math.trunc(value) : typeof value === "string" ? Number.parseInt(value, 10) : 22;
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 65535 ? parsed : 22;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizePrivateKeyFileName(fileName: string, index: number): string {
  const normalized = fileName.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/g, "");
  const safeName = normalized || "id_key";
  return `${String(index).padStart(3, "0")}-${safeName}`;
}

function expandHomePath(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return join(homedir(), filePath.slice(2));
  }
  return filePath;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

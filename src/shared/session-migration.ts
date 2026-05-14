import type { SessionCreateInput, SessionRecord } from "./session.js";

export interface SessionMigrationPrivateKeyPayload {
  originalPath: string;
  fileName: string;
  contentsBase64: string;
}

export interface SessionMigrationSessionPayload {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: SessionCreateInput["authType"];
  privateKeyPath: string;
  groupId: string;
  remark: string;
  favorite: boolean;
  secret: string;
  privateKeyFile?: SessionMigrationPrivateKeyPayload;
}

export interface SessionMigrationPlainPayload {
  exportedAtIso: string;
  appVersion: string;
  sessionCount: number;
  includesPasswords: boolean;
  includesPrivateKeyFiles: boolean;
  sessions: SessionMigrationSessionPayload[];
}

export interface SessionMigrationEncryptedFile {
  format: "termdock-session-migration";
  version: 1;
  exportedAtIso: string;
  appVersion: string;
  crypto: {
    kdf: "scrypt";
    cipher: "aes-256-gcm";
    salt: string;
    iv: string;
    authTag: string;
  };
  summary: {
    sessionCount: number;
    passwordSecretCount: number;
    privateKeySecretCount: number;
    embeddedPrivateKeyFileCount: number;
  };
  ciphertext: string;
}

export interface SessionMigrationExportInput {
  passphrase: string;
  appVersion: string;
  sessions: SessionRecord[];
  includePrivateKeyFiles: boolean;
}

export interface SessionMigrationExportResult {
  file: SessionMigrationEncryptedFile;
  warnings: string[];
}

export interface SessionMigrationImportInput {
  passphrase: string;
  fileText: string;
  restorePrivateKeyFiles?: boolean;
  userDataDirectory?: string;
}

export interface SessionMigrationImportResult {
  payload: SessionMigrationPlainPayload;
  warnings: string[];
}

export interface SessionMigrationImportCandidate {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: SessionCreateInput["authType"];
  privateKeyPath: string;
  groupId: string;
  remark: string;
  favorite: boolean;
  secret: string;
}

export type SessionAuthType = "password" | "privateKey" | "agent" | "keyboardInteractive";

export type SessionEnvironment = "dev" | "staging" | "prod" | "custom";

export interface SessionCustomField {
  key: string;
  value: string;
}

export interface SessionRecord {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: SessionAuthType;
  privateKeyPath?: string;
  /** Optional saved session used as the one-hop SSH bastion. */
  jumpSessionId?: string;
  groupId?: string;
  remark?: string;
  environment?: SessionEnvironment;
  tags?: string[];
  owner?: string;
  customFields?: SessionCustomField[];
  favorite: boolean;
  hasSecret: boolean;
  lastConnectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionCreateInput {
  name: string;
  host: string;
  port?: number;
  username: string;
  authType: SessionAuthType;
  privateKeyPath?: string;
  jumpSessionId?: string;
  groupId?: string;
  remark?: string;
  environment?: SessionEnvironment;
  tags?: string[];
  owner?: string;
  customFields?: SessionCustomField[];
  favorite?: boolean;
  secret?: string;
}

export interface SessionUpdateInput {
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  authType?: SessionAuthType;
  privateKeyPath?: string;
  jumpSessionId?: string;
  groupId?: string;
  remark?: string;
  environment?: SessionEnvironment;
  tags?: string[];
  owner?: string;
  customFields?: SessionCustomField[];
  favorite?: boolean;
  secret?: string;
}

export interface SessionTestConnectionResult {
  ok: boolean;
  message: string;
}

export interface SshConfigImportCandidate {
  hostAlias: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: SessionAuthType;
  privateKeyPath?: string;
  /** One imported ProxyJump alias; resolved after all config sessions are created. */
  jumpHostAlias?: string;
  sourceLine: number;
}

export interface SshConfigParseResult {
  filePath: string;
  candidates: SshConfigImportCandidate[];
  warnings: string[];
}

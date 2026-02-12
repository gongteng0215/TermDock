export type SessionAuthType = "password" | "privateKey";

export interface SessionRecord {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: SessionAuthType;
  privateKeyPath?: string;
  groupId?: string;
  remark?: string;
  favorite: boolean;
  hasSecret: boolean;
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
  groupId?: string;
  remark?: string;
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
  groupId?: string;
  remark?: string;
  favorite?: boolean;
  secret?: string;
}

export interface SessionTestConnectionResult {
  ok: boolean;
  message: string;
}

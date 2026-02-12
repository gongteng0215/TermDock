import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { WebContents } from "electron";
import { Client } from "ssh2";
import type { ClientChannel, ConnectConfig } from "ssh2";

import type { SessionRecord } from "../../shared/session.js";
import type { TerminalEvent } from "../../shared/terminal.js";
import type { CredentialStore } from "../security/credential-store.js";
import { SessionStore } from "../storage/session-store.js";

interface TerminalConnection {
  tabId: string;
  sender: WebContents;
  client: Client;
  shell?: ClientChannel;
  closed: boolean;
}

export class TerminalService {
  private readonly connections = new Map<string, TerminalConnection>();

  constructor(
    private readonly sessionStore: SessionStore,
    private readonly credentialStore: CredentialStore
  ) {}

  async connect(tabId: string, sessionId: string, sender: WebContents): Promise<void> {
    await this.close(tabId);

    const session = await this.sessionStore.getById(sessionId);
    if (!session) {
      throw new Error("Session not found.");
    }

    this.emit(sender, {
      tabId,
      type: "status",
      status: "connecting"
    });

    const connectConfig = await this.buildConnectConfig(session);
    const client = new Client();
    const connection: TerminalConnection = { tabId, sender, client, closed: false };
    this.connections.set(tabId, connection);

    client.on("ready", () => {
      client.shell(
        {
          term: "xterm-256color",
          cols: 120,
          rows: 36
        },
        (error, shell) => {
          if (error) {
            this.emit(sender, {
              tabId,
              type: "error",
              message: error.message
            });
            void this.close(tabId);
            return;
          }

          connection.shell = shell;

          this.emit(sender, {
            tabId,
            type: "status",
            status: "connected"
          });

          shell.on("data", (chunk: Buffer) => {
            this.emit(sender, {
              tabId,
              type: "output",
              data: chunk.toString("utf-8")
            });
          });

          shell.stderr.on("data", (chunk: Buffer) => {
            this.emit(sender, {
              tabId,
              type: "output",
              data: chunk.toString("utf-8")
            });
          });

          shell.on("close", () => {
            void this.close(tabId);
          });
        }
      );
    });

    client.on("error", (error: Error) => {
      this.emit(sender, {
        tabId,
        type: "error",
        message: error.message
      });
    });

    client.on("close", () => {
      this.emitClosed(connection);
      this.connections.delete(tabId);
    });

    client.connect(connectConfig);
  }

  async write(tabId: string, data: string): Promise<void> {
    const shell = this.connections.get(tabId)?.shell;
    if (!shell) {
      return;
    }
    shell.write(data);
  }

  async resize(tabId: string, cols: number, rows: number): Promise<void> {
    const shell = this.connections.get(tabId)?.shell;
    if (!shell) {
      return;
    }
    shell.setWindow(rows, cols, 0, 0);
  }

  async close(tabId: string): Promise<void> {
    const connection = this.connections.get(tabId);
    if (!connection) {
      return;
    }

    this.connections.delete(tabId);
    connection.shell?.end();
    connection.client.end();

    this.emitClosed(connection);
  }

  private async buildConnectConfig(session: SessionRecord): Promise<ConnectConfig> {
    const config: ConnectConfig = {
      host: session.host,
      port: session.port,
      username: session.username,
      keepaliveInterval: 15_000,
      keepaliveCountMax: 3,
      readyTimeout: 15_000
    };

    if (session.authType === "password") {
      const password = await this.credentialStore.getSessionSecret(session.id);
      if (!password) {
        throw new Error("Session password not found in secure storage.");
      }
      config.password = password;
      return config;
    }

    if (!session.privateKeyPath) {
      throw new Error("Private key path is required for key-based authentication.");
    }

    const privateKeyPath = expandHomePath(session.privateKeyPath);
    config.privateKey = await readFile(privateKeyPath, "utf-8");
    const passphrase = await this.credentialStore.getSessionSecret(session.id);
    if (passphrase) {
      config.passphrase = passphrase;
    }

    return config;
  }

  private emit(sender: WebContents, payload: TerminalEvent): void {
    if (sender.isDestroyed()) {
      return;
    }
    sender.send("terminal:event", payload);
  }

  private emitClosed(connection: TerminalConnection): void {
    if (connection.closed) {
      return;
    }
    connection.closed = true;
    this.emit(connection.sender, {
      tabId: connection.tabId,
      type: "status",
      status: "closed"
    });
  }
}

function expandHomePath(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return join(homedir(), filePath.slice(2));
  }
  return filePath;
}

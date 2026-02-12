import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { Client } from "ssh2";
import type { ConnectConfig } from "ssh2";

import type {
  SessionCreateInput,
  SessionTestConnectionResult
} from "../../shared/session.js";

export async function testSshConnection(
  input: SessionCreateInput
): Promise<SessionTestConnectionResult> {
  try {
    const config = await buildConnectConfig(input);

    return await new Promise<SessionTestConnectionResult>((resolve) => {
      const client = new Client();
      let settled = false;
      const timeout = setTimeout(() => {
        finalize(false, "Connection timed out.");
      }, 12_000);

      const finalize = (ok: boolean, message: string) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        client.end();
        resolve({ ok, message });
      };

      client.on("ready", () => {
        finalize(true, "Connection successful.");
      });

      client.on("error", (error: Error) => {
        finalize(false, error.message || "Connection failed.");
      });

      client.on("close", () => {
        if (!settled) {
          finalize(false, "Connection closed by remote host.");
        }
      });

      client.connect(config);
    });
  } catch (error) {
    return {
      ok: false,
      message: (error as Error).message || "Connection failed."
    };
  }
}

async function buildConnectConfig(input: SessionCreateInput): Promise<ConnectConfig> {
  if (!input.host?.trim() || !input.username?.trim()) {
    throw new Error("Host and username are required.");
  }

  const config: ConnectConfig = {
    host: input.host.trim(),
    port: input.port ?? 22,
    username: input.username.trim(),
    readyTimeout: 10_000,
    keepaliveInterval: 15_000,
    keepaliveCountMax: 2
  };

  if (input.authType === "password") {
    if (!input.secret?.trim()) {
      throw new Error("Password is required.");
    }
    config.password = input.secret.trim();
    return config;
  }

  if (!input.privateKeyPath?.trim()) {
    throw new Error("Private key path is required.");
  }

  const privateKeyPath = expandHomePath(input.privateKeyPath.trim());
  config.privateKey = await readFile(privateKeyPath, "utf-8");

  if (input.secret?.trim()) {
    config.passphrase = input.secret.trim();
  }

  return config;
}

function expandHomePath(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return join(homedir(), filePath.slice(2));
  }
  return filePath;
}


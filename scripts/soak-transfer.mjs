#!/usr/bin/env node
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, posix as posixPath } from "node:path";

import { Client } from "ssh2";

function getEnv(name, fallback = "") {
  const value = process.env[name];
  if (typeof value !== "string") {
    return fallback;
  }
  return value.trim();
}

function requireEnv(name) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function parseIntegerEnv(name, fallback, min, max) {
  const raw = getEnv(name);
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer in [${min}, ${max}].`);
  }
  return value;
}

function parseBooleanEnv(name, fallback) {
  const raw = getEnv(name).toLowerCase();
  if (!raw) {
    return fallback;
  }
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") {
    return true;
  }
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
    return false;
  }
  throw new Error(`${name} must be boolean (true/false).`);
}

function quoteShell(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function nowIsoTag() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function connectClient(connectConfig) {
  const client = new Client();
  await new Promise((resolve, reject) => {
    client.once("ready", resolve);
    client.once("error", reject);
    client.connect(connectConfig);
  });
  return client;
}

async function openSftp(client) {
  return new Promise((resolve, reject) => {
    client.sftp((error, sftp) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(sftp);
    });
  });
}

async function execRemote(client, command, timeoutMs) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let channelRef = null;

    const finalize = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    };

    const timer = setTimeout(() => {
      try {
        channelRef?.close();
      } catch {
        // Best effort.
      }
      finalize(new Error(`Remote command timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    client.exec(command, (error, channel) => {
      if (error) {
        finalize(error);
        return;
      }
      channelRef = channel;
      channel.on("data", (chunk) => {
        stdout += chunk.toString("utf-8");
      });
      channel.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf-8");
      });
      channel.once("error", finalize);
      channel.once("close", (code) => {
        if (code && code !== 0) {
          finalize(new Error(stderr.trim() || `Remote command failed with code ${code}.`));
          return;
        }
        finalize();
      });
    });
  });
}

async function fastPut(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function buildFixtureFiles(baseDir, fileCount, fileSizeBytes) {
  const files = [];
  for (let index = 0; index < fileCount; index += 1) {
    const path = join(baseDir, `fixture-${String(index + 1).padStart(3, "0")}.bin`);
    const fillByte = (index * 29) % 251;
    await writeFile(path, Buffer.alloc(fileSizeBytes, fillByte));
    files.push(path);
  }
  return files;
}

async function main() {
  const startedAt = Date.now();
  const host = requireEnv("TD_SSH_HOST");
  const username = requireEnv("TD_SSH_USER");
  const port = parseIntegerEnv("TD_SSH_PORT", 22, 1, 65535);
  const password = getEnv("TD_SSH_PASSWORD");
  const privateKeyPath = getEnv("TD_SSH_KEY_PATH");
  const passphrase = getEnv("TD_SSH_PASSPHRASE");

  if (!password && !privateKeyPath) {
    throw new Error("Provide TD_SSH_PASSWORD or TD_SSH_KEY_PATH.");
  }

  const durationMinutes = parseIntegerEnv("TD_DURATION_MINUTES", 30, 1, 24 * 60);
  const uploadConcurrency = parseIntegerEnv("TD_UPLOAD_CONCURRENCY", 4, 1, 16);
  const fixtureFiles = parseIntegerEnv("TD_FIXTURE_FILES", 24, 1, 512);
  const fileSizeKb = parseIntegerEnv("TD_FILE_SIZE_KB", 128, 1, 1024 * 64);
  const maxUploads = parseIntegerEnv("TD_MAX_UPLOADS", 4000, 1, 2_000_000);
  const monitorIntervalMs = parseIntegerEnv("TD_MONITOR_INTERVAL_MS", 5000, 250, 120_000);
  const monitorTimeoutMs = parseIntegerEnv("TD_MONITOR_TIMEOUT_MS", 10_000, 1000, 120_000);
  const monitorAllowOverlap = parseBooleanEnv("TD_MONITOR_ALLOW_OVERLAP", false);
  const keepRemote = parseBooleanEnv("TD_KEEP_REMOTE", false);
  const remoteBaseDir = getEnv("TD_REMOTE_BASE_DIR", "/tmp/termdock-soak");
  const progressEvery = parseIntegerEnv("TD_PROGRESS_EVERY", 50, 1, 5000);

  const runId = nowIsoTag();
  const remoteRunDir = posixPath.join(remoteBaseDir, runId);
  const localFixtureRoot = await mkdtemp(join(tmpdir(), "termdock-soak-"));
  const fileSizeBytes = fileSizeKb * 1024;

  const summary = {
    runId,
    host,
    port,
    username,
    remoteRunDir,
    durationMinutes,
    uploadConcurrency,
    fixtureFiles,
    fileSizeKb,
    maxUploads,
    monitorIntervalMs,
    monitorAllowOverlap,
    startedAtIso: new Date(startedAt).toISOString(),
    endedAtIso: "",
    elapsedSeconds: 0,
    uploadsQueued: 0,
    uploadsSucceeded: 0,
    uploadsFailed: 0,
    monitorRuns: 0,
    monitorSkipped: 0,
    monitorErrors: 0,
    disconnectedUnexpectedly: false,
    connectionEvents: [],
    sampleErrors: []
  };

  let stopping = false;
  let expectedConnectionClose = false;
  let client = null;
  let sftp = null;
  let monitorTimer = null;
  let monitorInFlight = 0;

  const onSignal = () => {
    stopping = true;
    console.log("[soak] Stop requested by signal. Finishing in-flight uploads...");
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    console.log(`[soak] building ${fixtureFiles} local fixtures at ${localFixtureRoot} ...`);
    const localFixtures = await buildFixtureFiles(localFixtureRoot, fixtureFiles, fileSizeBytes);

    const connectConfig = {
      host,
      port,
      username,
      readyTimeout: 15_000,
      keepaliveInterval: 15_000,
      keepaliveCountMax: 3
    };
    if (privateKeyPath) {
      connectConfig.privateKey = await readFile(privateKeyPath, "utf-8");
      if (passphrase) {
        connectConfig.passphrase = passphrase;
      }
    } else {
      connectConfig.password = password;
    }

    console.log(`[soak] connecting ${username}@${host}:${port} ...`);
    client = await connectClient(connectConfig);
    client.on("close", (hadError) => {
      const eventText = `close(hadError=${String(hadError)})`;
      summary.connectionEvents.push(eventText);
      if (!stopping && !expectedConnectionClose) {
        summary.disconnectedUnexpectedly = true;
      }
    });
    client.on("end", () => {
      summary.connectionEvents.push("end");
      if (!stopping && !expectedConnectionClose) {
        summary.disconnectedUnexpectedly = true;
      }
    });
    client.on("error", (error) => {
      const eventText = `error(${error.message})`;
      summary.connectionEvents.push(eventText);
      if (summary.sampleErrors.length < 20) {
        summary.sampleErrors.push(eventText);
      }
    });

    sftp = await openSftp(client);
    await execRemote(client, `mkdir -p -- ${quoteShell(remoteRunDir)}`, 20_000);
    console.log(`[soak] remote run dir: ${remoteRunDir}`);

    monitorTimer = setInterval(() => {
      if (stopping || !client) {
        return;
      }
      if (!monitorAllowOverlap && monitorInFlight > 0) {
        summary.monitorSkipped += 1;
        return;
      }
      monitorInFlight += 1;
      summary.monitorRuns += 1;
      void execRemote(
        client,
        "echo __TD_MONITOR__ && date +%s && cat /proc/loadavg 2>/dev/null | awk '{print $1,$2,$3}'",
        monitorTimeoutMs
      )
        .catch((error) => {
          summary.monitorErrors += 1;
          if (summary.sampleErrors.length < 20) {
            summary.sampleErrors.push(`monitor(${error.message})`);
          }
        })
        .finally(() => {
          monitorInFlight = Math.max(0, monitorInFlight - 1);
        });
    }, monitorIntervalMs);

    const durationMs = durationMinutes * 60_000;
    const uploadStart = Date.now();
    const activeTasks = new Set();

    const queueUploadTask = (taskIndex) => {
      const localPath = localFixtures[taskIndex % localFixtures.length];
      const remotePath = posixPath.join(
        remoteRunDir,
        `upload-${String(taskIndex + 1).padStart(7, "0")}-${basename(localPath)}`
      );
      let task = null;
      task = (async () => {
        await fastPut(sftp, localPath, remotePath);
        summary.uploadsSucceeded += 1;
        if (summary.uploadsSucceeded % progressEvery === 0) {
          const elapsed = Math.floor((Date.now() - uploadStart) / 1000);
          console.log(
            `[soak] progress uploaded=${summary.uploadsSucceeded}/${summary.uploadsQueued} elapsed=${elapsed}s`
          );
        }
      })()
        .catch((error) => {
          summary.uploadsFailed += 1;
          if (summary.sampleErrors.length < 20) {
            summary.sampleErrors.push(`upload(${error.message})`);
          }
        })
        .finally(() => {
          activeTasks.delete(task);
        });
      activeTasks.add(task);
      summary.uploadsQueued += 1;
    };

    while (!stopping) {
      const elapsedMs = Date.now() - uploadStart;
      if (elapsedMs >= durationMs) {
        break;
      }
      if (summary.uploadsQueued >= maxUploads) {
        break;
      }

      while (
        !stopping &&
        activeTasks.size < uploadConcurrency &&
        summary.uploadsQueued < maxUploads &&
        Date.now() - uploadStart < durationMs
      ) {
        queueUploadTask(summary.uploadsQueued);
      }

      if (activeTasks.size === 0) {
        await delay(30);
        continue;
      }
      await Promise.race(activeTasks);
      if (summary.disconnectedUnexpectedly) {
        stopping = true;
      }
    }

    await Promise.allSettled([...activeTasks]);

    if (monitorTimer) {
      clearInterval(monitorTimer);
      monitorTimer = null;
    }

    await delay(100);
    const remoteCountText = await execRemote(
      client,
      `find ${quoteShell(remoteRunDir)} -type f 2>/dev/null | wc -l`,
      30_000
    ).catch(() => "");
    const remoteFileCount = Number.parseInt(remoteCountText, 10);
    if (Number.isFinite(remoteFileCount)) {
      summary.remoteFileCount = remoteFileCount;
    }

    if (!keepRemote) {
      await execRemote(client, `rm -rf -- ${quoteShell(remoteRunDir)}`, 120_000).catch(
        (error) => {
          if (summary.sampleErrors.length < 20) {
            summary.sampleErrors.push(`cleanup(${error.message})`);
          }
        }
      );
    }
  } finally {
    if (monitorTimer) {
      clearInterval(monitorTimer);
    }
    if (sftp) {
      try {
        sftp.end();
      } catch {
        // Best effort.
      }
    }
    if (client) {
      // From here, close events are expected and must not be counted as random disconnects.
      expectedConnectionClose = true;
      try {
        client.end();
      } catch {
        // Best effort.
      }
      try {
        await once(client, "close");
      } catch {
        // Best effort.
      }
    }
    await rm(localFixtureRoot, { recursive: true, force: true }).catch(() => {
      // Best effort.
    });
    summary.endedAtIso = new Date().toISOString();
    summary.elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }

  const unhealthy =
    summary.disconnectedUnexpectedly || summary.uploadsFailed > 0 || summary.monitorErrors > 0;
  console.log("[soak] summary:");
  console.log(JSON.stringify(summary, null, 2));
  if (unhealthy) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`[soak] fatal: ${error.message}`);
  process.exitCode = 1;
});

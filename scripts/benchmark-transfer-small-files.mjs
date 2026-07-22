#!/usr/bin/env node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "ssh2";

import { startSmokeSshFixture } from "./smoke-ssh-fixture.mjs";

function parseIntegerEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer in [${min}, ${max}].`);
  }
  return value;
}

function nowTag() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function connectClient(connectConfig) {
  const client = new Client();
  await new Promise((resolvePromise, rejectPromise) => {
    client.once("ready", resolvePromise);
    client.once("error", rejectPromise);
    client.connect(connectConfig);
  });
  return client;
}

async function openSftp(client) {
  return new Promise((resolvePromise, rejectPromise) => {
    client.sftp((error, sftp) => {
      if (error) {
        rejectPromise(error);
        return;
      }
      resolvePromise(sftp);
    });
  });
}

async function closeSftp(sftp) {
  if (!sftp) {
    return;
  }
  try {
    sftp.end();
  } catch {
    // Best effort.
  }
}

async function fastPut(sftp, localPath, remotePath) {
  return new Promise((resolvePromise, rejectPromise) => {
    sftp.fastPut(localPath, remotePath, (error) => {
      if (error) {
        rejectPromise(error);
        return;
      }
      resolvePromise();
    });
  });
}

async function mkdirRemote(sftp, targetPath) {
  if (await pathExistsAsDirectory(sftp, targetPath)) {
    return;
  }
  await new Promise((resolvePromise, rejectPromise) => {
    sftp.mkdir(targetPath, (error) => {
      if (!error) {
        resolvePromise();
        return;
      }
      pathExistsAsDirectory(sftp, targetPath)
        .then((exists) => {
          if (exists) {
            resolvePromise();
            return;
          }
          rejectPromise(error);
        })
        .catch(() => rejectPromise(error));
    });
  });
}

async function pathExistsAsDirectory(sftp, targetPath) {
  return new Promise((resolvePromise) => {
    sftp.stat(targetPath, (error, stats) => {
      if (error || !stats) {
        resolvePromise(false);
        return;
      }
      resolvePromise((stats.mode & 0o170000) === 0o040000);
    });
  });
}

async function runPool(items, concurrency, worker) {
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const fileCount = parseIntegerEnv("TD_BENCH_SMALL_FILE_COUNT", 500, 10, 20_000);
  const fileSizeBytes = parseIntegerEnv("TD_BENCH_SMALL_FILE_BYTES", 1024, 1, 64 * 1024);
  const uploadConcurrency = parseIntegerEnv("TD_BENCH_SMALL_UPLOAD_CONCURRENCY", 2, 1, 12);
  const reuseChannels = process.env.TD_BENCH_SMALL_REUSE_CHANNELS !== "0";

  const artifactRoot = join(process.cwd(), "artifacts", "benchmark");
  await mkdir(artifactRoot, { recursive: true });

  const fixture = await startSmokeSshFixture();
  const tempRoot = await mkdtemp(join(tmpdir(), "termdock-bench-small-"));
  const localRoot = join(tempRoot, "local");
  await mkdir(localRoot, { recursive: true });

  const localFiles = [];
  for (let index = 0; index < fileCount; index += 1) {
    const localPath = join(localRoot, `f-${String(index).padStart(5, "0")}.bin`);
    await writeFile(localPath, Buffer.alloc(fileSizeBytes, (index % 200) + 1));
    localFiles.push(localPath);
  }

  const connectConfig = {
    host: fixture.host,
    port: fixture.port,
    username: fixture.username,
    password: fixture.password,
    readyTimeout: 15_000,
    keepaliveInterval: 15_000,
    keepaliveCountMax: 3
  };

  const remoteDir = "/bench-small-files";
  let client;
  const startedAt = Date.now();
  try {
    client = await connectClient(connectConfig);
    const setupSftp = await openSftp(client);
    try {
      await mkdirRemote(setupSftp, remoteDir);
    } finally {
      await closeSftp(setupSftp);
    }

    const uploadStartedAt = Date.now();
    if (reuseChannels) {
      const pool = [];
      for (let index = 0; index < uploadConcurrency; index += 1) {
        pool.push(await openSftp(client));
      }
      try {
        let cursor = 0;
        await runPool(localFiles, uploadConcurrency, async (localPath) => {
          const sftp = pool[cursor % pool.length];
          cursor += 1;
          const name = localPath.split(/[/\\]/).at(-1);
          await fastPut(sftp, localPath, `${remoteDir}/${name}`);
        });
      } finally {
        await Promise.all(pool.map((sftp) => closeSftp(sftp)));
      }
    } else {
      await runPool(localFiles, uploadConcurrency, async (localPath) => {
        const sftp = await openSftp(client);
        try {
          const name = localPath.split(/[/\\]/).at(-1);
          await fastPut(sftp, localPath, `${remoteDir}/${name}`);
        } finally {
          await closeSftp(sftp);
        }
      });
    }
    const uploadElapsedMs = Date.now() - uploadStartedAt;
    const filesPerSecond = fileCount / Math.max(uploadElapsedMs / 1000, 0.001);

    const report = {
      createdAt: new Date().toISOString(),
      fileCount,
      fileSizeBytes,
      uploadConcurrency,
      reuseChannels,
      uploadElapsedMs,
      filesPerSecond: round(filesPerSecond, 2),
      totalBytes: fileCount * fileSizeBytes,
      wallClockMs: Date.now() - startedAt
    };

    const reportPath = join(artifactRoot, `transfer-small-files-${nowTag()}.json`);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`[bench:transfer:small-files] ${fileCount} x ${fileSizeBytes}B`);
    console.log(
      `[bench:transfer:small-files] concurrency=${uploadConcurrency} reuse=${reuseChannels} elapsed=${uploadElapsedMs}ms files/s=${report.filesPerSecond}`
    );
    console.log(`[bench:transfer:small-files] wrote ${reportPath}`);
  } finally {
    if (client) {
      client.end();
    }
    await fixture.close().catch(() => undefined);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[bench:transfer:small-files] fatal: ${error.message}`);
  process.exitCode = 1;
});

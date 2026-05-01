#!/usr/bin/env node
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { finished } from "node:stream/promises";

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

function toMiB(bytes) {
  return bytes / (1024 * 1024);
}

function formatRate(bytes, elapsedMs) {
  if (elapsedMs <= 0) {
    return "n/a";
  }
  return `${(toMiB(bytes) / (elapsedMs / 1000)).toFixed(2)} MiB/s`;
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

async function fastGet(sftp, remotePath, localPath) {
  return new Promise((resolvePromise, rejectPromise) => {
    sftp.fastGet(remotePath, localPath, (error) => {
      if (error) {
        rejectPromise(error);
        return;
      }
      resolvePromise();
    });
  });
}

async function streamDownload(sftp, remotePath, localPath) {
  const readStream = sftp.createReadStream(remotePath);
  const writeStream = createWriteStream(localPath);
  readStream.pipe(writeStream);
  await finished(writeStream);
}

async function runWorkers(workerCount, items, worker) {
  const normalizedWorkerCount = Math.max(1, Math.min(workerCount, items.length || 1));
  let cursor = 0;
  const tasks = Array.from({ length: normalizedWorkerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(tasks);
}

async function timeScenario(name, totalBytes, operation) {
  const startedAt = performance.now();
  await operation();
  const elapsedMs = performance.now() - startedAt;
  return {
    name,
    totalBytes,
    elapsedMs,
    throughput: formatRate(totalBytes, elapsedMs)
  };
}

function makeRemotePath(prefix, index, extension = ".bin") {
  return `/${prefix}/file-${String(index + 1).padStart(4, "0")}${extension}`;
}

function resolveFixturePath(rootDir, remotePath) {
  const relative = remotePath.replace(/^\/+/, "").split("/").filter(Boolean);
  return resolve(rootDir, ...relative);
}

async function buildLocalFixtures(rootDir, fileCount, fileSizeBytes) {
  const files = [];
  for (let index = 0; index < fileCount; index += 1) {
    const path = join(rootDir, `fixture-${String(index + 1).padStart(4, "0")}.bin`);
    await writeFile(path, Buffer.alloc(fileSizeBytes, (index * 17) % 251));
    files.push(path);
  }
  return files;
}

async function main() {
  const smallFileCount = parseIntegerEnv("TD_BENCH_SMALL_FILES", 120, 4, 5000);
  const smallFileSizeKb = parseIntegerEnv("TD_BENCH_SMALL_FILE_SIZE_KB", 64, 1, 1024);
  const largeFileSizeMb = parseIntegerEnv("TD_BENCH_LARGE_FILE_SIZE_MB", 32, 1, 1024);
  const uploadConcurrency = parseIntegerEnv("TD_BENCH_UPLOAD_CONCURRENCY", 4, 1, 16);

  const fixture = await startSmokeSshFixture({
    rootDir: join(process.cwd(), "artifacts", "bench-fixture", nowTag()),
    maxConcurrentSftpSessions: Math.max(16, uploadConcurrency * 4)
  });
  const tempRoot = await mkdtemp(join(tmpdir(), "termdock-bench-"));
  const localUploadRoot = join(tempRoot, "upload-source");
  const localDownloadRoot = join(tempRoot, "download-targets");
  const smallFileSizeBytes = smallFileSizeKb * 1024;
  const largeFileSizeBytes = largeFileSizeMb * 1024 * 1024;

  await mkdir(localUploadRoot, { recursive: true });
  await mkdir(localDownloadRoot, { recursive: true });

  const connectConfig = {
    host: fixture.host,
    port: fixture.port,
    username: fixture.username,
    password: fixture.password,
    readyTimeout: 15_000,
    keepaliveInterval: 15_000,
    keepaliveCountMax: 3
  };

  let client;
  try {
    const localSmallFiles = await buildLocalFixtures(
      localUploadRoot,
      smallFileCount,
      smallFileSizeBytes
    );
    const totalSmallUploadBytes = localSmallFiles.length * smallFileSizeBytes;

    const remoteLargePath = "/bench-large/source-large.bin";
    await mkdir(resolveFixturePath(fixture.rootDir, "/bench-large"), { recursive: true });
    await writeFile(resolveFixturePath(fixture.rootDir, remoteLargePath), Buffer.alloc(largeFileSizeBytes, 113));

    client = await connectClient(connectConfig);

    const uploadFreshScenario = await timeScenario(
      "upload-small:fresh-channel-per-file",
      totalSmallUploadBytes,
      async () => {
        await rm(resolveFixturePath(fixture.rootDir, "/bench-upload-fresh"), {
          recursive: true,
          force: true
        });
        await mkdir(resolveFixturePath(fixture.rootDir, "/bench-upload-fresh"), { recursive: true });
        await runWorkers(uploadConcurrency, localSmallFiles, async (localPath, index) => {
          const sftp = await openSftp(client);
          try {
            await fastPut(sftp, localPath, makeRemotePath("bench-upload-fresh", index));
          } finally {
            await closeSftp(sftp);
          }
        });
      }
    );

    const uploadReusedScenario = await timeScenario(
      "upload-small:reused-channel-workers",
      totalSmallUploadBytes,
      async () => {
        await rm(resolveFixturePath(fixture.rootDir, "/bench-upload-reused"), {
          recursive: true,
          force: true
        });
        await mkdir(resolveFixturePath(fixture.rootDir, "/bench-upload-reused"), {
          recursive: true
        });
        const workers = Array.from({ length: uploadConcurrency }, async () => {
          const sftp = await openSftp(client);
          try {
            while (uploadQueueCursor.value < localSmallFiles.length) {
              const index = uploadQueueCursor.value;
              uploadQueueCursor.value += 1;
              if (index >= localSmallFiles.length) {
                break;
              }
              await fastPut(sftp, localSmallFiles[index], makeRemotePath("bench-upload-reused", index));
            }
          } finally {
            await closeSftp(sftp);
          }
        });
        await Promise.all(workers);
      }
    );

    const sharedStreamDownloadTarget = join(localDownloadRoot, "stream-large.bin");
    const fastGetDownloadTarget = join(localDownloadRoot, "fastget-large.bin");
    const downloadStreamScenario = await timeScenario(
      "download-large:stream",
      largeFileSizeBytes,
      async () => {
        await rm(sharedStreamDownloadTarget, { force: true });
        const sftp = await openSftp(client);
        try {
          await streamDownload(sftp, remoteLargePath, sharedStreamDownloadTarget);
        } finally {
          await closeSftp(sftp);
        }
      }
    );

    const downloadFastGetScenario = await timeScenario(
      "download-large:fastGet",
      largeFileSizeBytes,
      async () => {
        await rm(fastGetDownloadTarget, { force: true });
        const sftp = await openSftp(client);
        try {
          await fastGet(sftp, remoteLargePath, fastGetDownloadTarget);
        } finally {
          await closeSftp(sftp);
        }
      }
    );

    const largeDownloadHash = await readFile(fastGetDownloadTarget);
    const streamDownloadHash = await readFile(sharedStreamDownloadTarget);
    if (!largeDownloadHash.equals(streamDownloadHash)) {
      throw new Error("Benchmark download outputs did not match.");
    }

    const results = [
      uploadFreshScenario,
      uploadReusedScenario,
      downloadStreamScenario,
      downloadFastGetScenario
    ].map((entry) => ({
      ...entry,
      totalMiB: toMiB(entry.totalBytes).toFixed(2),
      elapsedMs: Number(entry.elapsedMs.toFixed(1))
    }));

    console.log(JSON.stringify(
      {
        fixture: {
          host: fixture.host,
          port: fixture.port,
          rootDir: fixture.rootDir
        },
        config: {
          smallFileCount,
          smallFileSizeKb,
          largeFileSizeMb,
          uploadConcurrency
        },
        results
      },
      null,
      2
    ));
  } finally {
    if (client) {
      try {
        client.end();
        await once(client, "close");
      } catch {
        // Best effort.
      }
    }
    await fixture.close().catch(() => {
      // Best effort.
    });
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {
      // Best effort.
    });
  }
}

const uploadQueueCursor = { value: 0 };

main().catch((error) => {
  console.error(`[bench] fatal: ${error.message}`);
  process.exitCode = 1;
});

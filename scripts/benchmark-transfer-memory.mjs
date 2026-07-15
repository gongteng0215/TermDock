#!/usr/bin/env node
import { once } from "node:events";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sampleMemory() {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers ?? 0
  };
}

function summarizeMemoryDelta(baseline, peak, end) {
  return {
    baselineMiB: {
      rss: round(toMiB(baseline.rss), 3),
      heapUsed: round(toMiB(baseline.heapUsed), 3)
    },
    peakMiB: {
      rss: round(toMiB(peak.rss), 3),
      heapUsed: round(toMiB(peak.heapUsed), 3)
    },
    endMiB: {
      rss: round(toMiB(end.rss), 3),
      heapUsed: round(toMiB(end.heapUsed), 3)
    },
    deltaFromBaselineMiB: {
      peakRss: round(toMiB(peak.rss - baseline.rss), 3),
      peakHeapUsed: round(toMiB(peak.heapUsed - baseline.heapUsed), 3),
      endRss: round(toMiB(end.rss - baseline.rss), 3),
      endHeapUsed: round(toMiB(end.heapUsed - baseline.heapUsed), 3)
    }
  };
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

async function streamUpload(sftp, localPath, remotePath) {
  const readStream = createReadStream(localPath, { highWaterMark: 64 * 1024 });
  const writeStream = sftp.createWriteStream(remotePath, { highWaterMark: 64 * 1024 });
  readStream.pipe(writeStream);
  await finished(writeStream);
}

async function streamDownload(sftp, remotePath, localPath) {
  const readStream = sftp.createReadStream(remotePath, { highWaterMark: 64 * 1024 });
  const writeStream = createWriteStream(localPath, { highWaterMark: 64 * 1024 });
  readStream.pipe(writeStream);
  await finished(writeStream);
}

async function monitorMemoryDuring(name, totalBytes, operation, sampleIntervalMs = 100) {
  if (global.gc) {
    global.gc();
  }
  const baseline = sampleMemory();
  let peak = { ...baseline };
  const startedAt = performance.now();
  const timer = setInterval(() => {
    const current = sampleMemory();
    if (current.rss > peak.rss || current.heapUsed > peak.heapUsed) {
      peak = {
        rss: Math.max(peak.rss, current.rss),
        heapUsed: Math.max(peak.heapUsed, current.heapUsed),
        heapTotal: Math.max(peak.heapTotal, current.heapTotal),
        external: Math.max(peak.external, current.external),
        arrayBuffers: Math.max(peak.arrayBuffers, current.arrayBuffers)
      };
    }
  }, sampleIntervalMs);

  try {
    await operation();
  } finally {
    clearInterval(timer);
  }

  if (global.gc) {
    global.gc();
  }
  const end = sampleMemory();
  const elapsedMs = performance.now() - startedAt;

  return {
    name,
    totalBytes,
    totalMiB: round(toMiB(totalBytes), 2),
    elapsedMs: round(elapsedMs, 1),
    sampleIntervalMs,
    ...summarizeMemoryDelta(baseline, peak, end)
  };
}

function resolveFixturePath(rootDir, remotePath) {
  const relative = remotePath.replace(/^\/+/, "").split("/").filter(Boolean);
  return resolve(rootDir, ...relative);
}

async function main() {
  const fileSizeMb = parseIntegerEnv("TD_BENCH_MEM_FILE_SIZE_MB", 64, 8, 512);
  const uploadConcurrency = parseIntegerEnv("TD_BENCH_MEM_UPLOAD_CONCURRENCY", 4, 1, 8);
  const fileSizeBytes = fileSizeMb * 1024 * 1024;

  const fixture = await startSmokeSshFixture({
    rootDir: join(process.cwd(), "artifacts", "bench-fixture", nowTag()),
    maxConcurrentSftpSessions: Math.max(8, uploadConcurrency * 2)
  });
  const tempRoot = await mkdtemp(join(tmpdir(), "termdock-bench-mem-"));
  const localRoot = join(tempRoot, "local");
  await mkdir(localRoot, { recursive: true });

  const connectConfig = {
    host: fixture.host,
    port: fixture.port,
    username: fixture.username,
    password: fixture.password,
    readyTimeout: 15_000,
    keepaliveInterval: 15_000,
    keepaliveCountMax: 3
  };

  const remoteLargePath = "/bench-memory/source-large.bin";
  const localLargePath = join(localRoot, "source-large.bin");
  await mkdir(resolveFixturePath(fixture.rootDir, "/bench-memory"), { recursive: true });
  await writeFile(resolveFixturePath(fixture.rootDir, remoteLargePath), Buffer.alloc(fileSizeBytes, 41));
  await writeFile(localLargePath, Buffer.alloc(fileSizeBytes, 73));

  let client;
  try {
    client = await connectClient(connectConfig);

    const downloadStreamTarget = join(localRoot, "download-stream.bin");
    const downloadFastGetTarget = join(localRoot, "download-fastget.bin");
    const uploadStreamRemote = "/bench-memory/upload-stream.bin";
    const uploadFastPutRemote = "/bench-memory/upload-fastput.bin";

    const scenarios = [
      await monitorMemoryDuring(
        "download-large:stream-64kb",
        fileSizeBytes,
        async () => {
          await rm(downloadStreamTarget, { force: true });
          const sftp = await openSftp(client);
          try {
            await streamDownload(sftp, remoteLargePath, downloadStreamTarget);
          } finally {
            await closeSftp(sftp);
          }
        }
      ),
      await monitorMemoryDuring(
        "download-large:fastGet",
        fileSizeBytes,
        async () => {
          await rm(downloadFastGetTarget, { force: true });
          const sftp = await openSftp(client);
          try {
            await fastGet(sftp, remoteLargePath, downloadFastGetTarget);
          } finally {
            await closeSftp(sftp);
          }
        }
      ),
      await monitorMemoryDuring(
        "upload-large:stream-64kb",
        fileSizeBytes,
        async () => {
          const sftp = await openSftp(client);
          try {
            await streamUpload(sftp, localLargePath, uploadStreamRemote);
          } finally {
            await closeSftp(sftp);
          }
        }
      ),
      await monitorMemoryDuring(
        "upload-large:fastPut",
        fileSizeBytes,
        async () => {
          const sftp = await openSftp(client);
          try {
            await fastPut(sftp, localLargePath, uploadFastPutRemote);
          } finally {
            await closeSftp(sftp);
          }
        }
      ),
      await monitorMemoryDuring(
        `upload-large:stream-64kb-x${uploadConcurrency}`,
        fileSizeBytes * uploadConcurrency,
        async () => {
          const localPaths = [];
          for (let index = 0; index < uploadConcurrency; index += 1) {
            const path = join(localRoot, `concurrent-${index + 1}.bin`);
            await writeFile(path, Buffer.alloc(fileSizeBytes, index + 11));
            localPaths.push(path);
          }
          await Promise.all(
            localPaths.map(async (path, index) => {
              const sftp = await openSftp(client);
              try {
                await streamUpload(sftp, path, `/bench-memory/concurrent-${index + 1}.bin`);
              } finally {
                await closeSftp(sftp);
              }
            })
          );
        }
      )
    ];

    const streamDownloadHash = await readFile(downloadStreamTarget);
    const fastGetDownloadHash = await readFile(downloadFastGetTarget);
    if (!streamDownloadHash.equals(fastGetDownloadHash)) {
      throw new Error("Download outputs did not match between stream and fastGet.");
    }

    const report = {
      capturedAt: new Date().toISOString(),
      fixture: {
        host: fixture.host,
        port: fixture.port,
        rootDir: fixture.rootDir
      },
      config: {
        fileSizeMb,
        uploadConcurrency,
        sampleIntervalMs: 100,
        gcHintEnabled: typeof global.gc === "function"
      },
      scenarios,
      notes: [
        "Memory samples come from process.memoryUsage() in the benchmark runner process.",
        "Stream scenarios use 64 KiB highWaterMark pipes to mirror TermDock upload/download paths.",
        "Run with `node --expose-gc` for more stable baseline/peak comparisons across scenarios."
      ]
    };

    const outputDir = join(process.cwd(), "artifacts", "benchmark");
    await mkdir(outputDir, { recursive: true });
    const outputPath = join(outputDir, `transfer-memory-${nowTag()}.json`);
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    console.log(JSON.stringify({ outputPath, report }, null, 2));
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

main().catch((error) => {
  console.error(`[bench:transfer:memory] fatal: ${error.message}`);
  process.exitCode = 1;
});

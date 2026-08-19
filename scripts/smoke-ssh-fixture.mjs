import { generateKeyPairSync } from "node:crypto";
import { mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { posix as posixPath } from "node:path";

import ssh2 from "ssh2";

const {
  Server,
  utils: {
    sftp: { STATUS_CODE, flagsToString }
  }
} = ssh2;

const DEFAULT_USERNAME = "smoke";
const DEFAULT_PASSWORD = "smoke";
const FIXTURE_HOST = "127.0.0.1";
const FIXTURE_UID = 1000;
const FIXTURE_GID = 1000;
const FIXTURE_SEED_FILE_NAME = "fixture-remote.txt";
const FIXTURE_SEED_FILE_CONTENTS = [
  "TermDock smoke fixture remote file",
  "This file is used for live SFTP download verification."
].join("\n");

export async function startSmokeSshFixture(options = {}) {
  const rootDir = resolve(options.rootDir ?? join(process.cwd(), "artifacts", "smoke-fixture"));
  const username = normalizeCredentialValue(options.username, DEFAULT_USERNAME);
  const password = normalizeCredentialValue(options.password, DEFAULT_PASSWORD);
  const hostKey = createHostKey();
  const remoteRootPath = "/";
  const remoteSeedPath = posixPath.join(remoteRootPath, FIXTURE_SEED_FILE_NAME);
  const maxConcurrentSftpSessions = normalizePositiveInteger(options.maxConcurrentSftpSessions);
  const writeDelayMs = normalizePositiveInteger(options.writeDelayMs);
  const transientMissingWriteDirectories = new Map(
    normalizeRemoteDirectoryList(options.transientMissingWriteDirectories).map((remoteDirectory) => [
      remoteDirectory,
      1
    ])
  );

  await mkdir(rootDir, { recursive: true });
  await mkdir(resolve(rootDir, "nested"), { recursive: true });
  await writeFile(resolve(rootDir, FIXTURE_SEED_FILE_NAME), FIXTURE_SEED_FILE_CONTENTS, "utf8");
  await writeFile(resolve(rootDir, "nested", "fixture-nested.txt"), "nested fixture data\n", "utf8");

  const activeClients = new Set();
  let activeSftpSessions = 0;
  const server = new Server(
    {
      hostKeys: [hostKey],
      greeting: "TermDock smoke fixture"
    },
    (client) => {
      debugFixture("client connected");
      activeClients.add(client);

      client.on("authentication", (ctx) => {
        if (
          ctx.method === "password" &&
          ctx.username === username &&
          ctx.password === password
        ) {
          ctx.accept();
          return;
        }
        ctx.reject();
      });

      client.on("ready", () => {
        debugFixture("client authenticated");
        client.on("session", (acceptSession) => {
          debugFixture("session requested");
          const session = acceptSession();

          session.on("env", (accept) => {
            if (typeof accept === "function") {
              accept();
            }
          });

          session.on("pty", (accept) => {
            if (typeof accept === "function") {
              accept();
            }
          });

          session.on("window-change", (accept) => {
            if (typeof accept === "function") {
              accept();
            }
          });

          session.once("shell", (accept) => {
            debugFixture("shell requested");
            const stream = accept();
            attachShell(stream, rootDir);
          });

          session.once("exec", (accept, _reject, info) => {
            debugFixture("exec requested");
            const stream = accept();
            handleExec(stream, info.command);
          });

          session.on("sftp", (accept, reject) => {
            debugFixture("sftp requested");
            if (
              typeof maxConcurrentSftpSessions === "number" &&
              activeSftpSessions >= maxConcurrentSftpSessions
            ) {
              debugFixture("sftp rejected because max concurrent session limit was reached");
              if (typeof reject === "function") {
                reject();
              }
              return;
            }
            activeSftpSessions += 1;
            const sftp = accept();
            attachSftpHandlers(sftp, rootDir, {
              transientMissingWriteDirectories,
              writeDelayMs,
              onClose: () => {
                activeSftpSessions = Math.max(0, activeSftpSessions - 1);
              }
            });
          });

          session.on("close", () => {
            debugFixture("session closed");
          });
        });
      });

      client.on("close", () => {
        debugFixture("client closed");
        activeClients.delete(client);
      });

      client.on("error", (error) => {
        debugFixture("client error", error instanceof Error ? error.message : String(error));
        activeClients.delete(client);
      });
    }
  );

  await new Promise((resolvePromise, rejectPromise) => {
    const onError = (error) => {
      server.off("listening", onListening);
      rejectPromise(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolvePromise();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(0, FIXTURE_HOST);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Smoke SSH fixture failed to resolve listen address.");
  }

  return {
    host: FIXTURE_HOST,
    port: address.port,
    username,
    password,
    rootDir,
    remoteRootPath,
    remoteSeedPath,
    remoteSeedFileName: FIXTURE_SEED_FILE_NAME,
    remoteSeedContents: FIXTURE_SEED_FILE_CONTENTS,
    async close() {
      for (const client of activeClients) {
        try {
          client.end();
        } catch {
          // Ignore client shutdown errors during test teardown.
        }
      }
      await new Promise((resolvePromise) => {
        server.close(() => {
          resolvePromise();
        });
      });
    }
  };
}

function normalizeCredentialValue(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function createHostKey() {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: "pkcs1",
      format: "pem"
    },
    publicKeyEncoding: {
      type: "spki",
      format: "pem"
    }
  });
  return privateKey;
}

function debugFixture(...parts) {
  if (process.env.TERMDOCK_SMOKE_FIXTURE_DEBUG !== "1") {
    return;
  }
  console.log("[smoke-fixture]", ...parts);
}

function attachShell(stream, rootDir) {
  let pending = "";
  let currentDirectory = "/";
  const prompt = () => {
    stream.write(`\r\nsmoke@fixture:${currentDirectory}$ `);
  };

  stream.write("TermDock smoke fixture shell");
  prompt();

  stream.on("close", () => {
    debugFixture("shell stream closed");
  });

  stream.on("end", () => {
    debugFixture("shell stream ended");
  });

  stream.on("data", async (chunk) => {
    const text = chunk.toString("utf8");
    for (const character of text) {
      if (character === "\u0003") {
        pending = "";
        stream.write("^C");
        prompt();
        continue;
      }

      if (character === "\b" || character === "\u007f") {
        pending = pending.slice(0, -1);
        continue;
      }

      if (character === "\r" || character === "\n") {
        if (pending.length === 0) {
          prompt();
          continue;
        }
        const command = pending.trim();
        pending = "";
        try {
          const nextDirectory = await renderShellCommand(stream, command, currentDirectory, rootDir);
          currentDirectory = nextDirectory ?? currentDirectory;
        } catch (error) {
          stream.stderr.write(`${error instanceof Error ? error.message : String(error)}\r\n`);
        }
        if (command === "exit") {
          stream.exit(0);
          stream.end("logout\r\n");
          return;
        }
        prompt();
        continue;
      }

      pending += character;
      stream.write(character);
    }
  });
}

function decodeFixturePrintfArgument(argument) {
  if (typeof argument !== "string") {
    return null;
  }
  const trimmed = argument.trim();
  if (trimmed.length < 2) {
    return null;
  }
  const quote = trimmed[0];
  if ((quote !== "'" && quote !== '"') || trimmed.at(-1) !== quote) {
    return null;
  }
  const inner = trimmed.slice(1, -1);
  return inner
    .replace(/\\033/g, "\u001b")
    .replace(/\\e/g, "\u001b")
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"');
}

async function renderShellCommand(stream, command, currentDirectory, rootDir) {
  if (command === "pwd") {
    stream.write(`\r\n${currentDirectory}`);
    return currentDirectory;
  }

  if (command === "ls" || command === "ls -l" || command === "ls -la") {
    const localDirectory = resolveRemotePath(rootDir, currentDirectory);
    const names = await readdir(localDirectory);
    const output = names.length > 0 ? names.join("\r\n") : ".";
    stream.write(`\r\n${output}`);
    return currentDirectory;
  }

  if (command === "hostname" || command === "uname -n") {
    stream.write("\r\ntermdock-smoke-fixture");
    return currentDirectory;
  }

  if (command === "uptime") {
    stream.write("\r\n 10:15:00 up 2 days,  1 user,  load average: 0.01, 0.02, 0.03");
    return currentDirectory;
  }

  if (command.startsWith("cd ")) {
    const requested = command.slice(3).trim();
    const nextDirectory = normalizeRemotePath(
      requested.startsWith("/") ? requested : posixPath.join(currentDirectory, requested)
    );
    const localDirectory = resolveRemotePath(rootDir, nextDirectory);
    const stats = await stat(localDirectory);
    if (!stats.isDirectory()) {
      throw new Error(`Not a directory: ${requested}`);
    }
    return nextDirectory;
  }

  if (command === "exit") {
    stream.write("\r\n");
    return currentDirectory;
  }

  if (command.startsWith("printf ")) {
    const output = decodeFixturePrintfArgument(command.slice(7));
    if (output !== null) {
      stream.write("\r\n");
      stream.write(output);
      return currentDirectory;
    }
  }

  if (/^rm\s+-rf\s+/.test(command)) {
    stream.write("\r\nfixture: destructive command received");
    return currentDirectory;
  }

  stream.write(`\r\nfixture executed: ${command}`);
  return currentDirectory;
}

function handleExec(stream, command) {
  debugFixture("exec", command);
  const trimmed = typeof command === "string" ? command.trim() : "";
  if (trimmed.includes("__TD_HOST__")) {
    stream.end(
      [
        "__TD_HOST__",
        "termdock-smoke-fixture",
        "__TD_OS__",
        "Ubuntu 24.04 LTS",
        "Linux",
        "6.8.0-fixture",
        "x86_64",
        "__TD_UPTIME__",
        "172800.00 0.00",
        "__TD_LOAD__",
        "0.01 0.02 0.03 1/123 4567",
        "__TD_MEM__",
        "MemTotal:       1048576 kB",
        "MemFree:         262144 kB",
        "MemAvailable:    786432 kB",
        "Buffers:          16384 kB",
        "Cached:          131072 kB",
        "SwapTotal:       2097152 kB",
        "SwapFree:        1572864 kB",
        "__TD_CPUINFO__",
        "4",
        "__TD_DISK__",
        "Filesystem Type 1B-blocks Used Available Use% Mounted on",
        "fixturefs ext4 1000000000 400000000 600000000 40% /",
        "fixturedata xfs 2000000000 500000000 1500000000 25% /data",
        "__TD_INODE__",
        "Filesystem Inodes IUsed IFree IUse% Mounted on",
        "fixturefs 100000 12000 88000 12% /",
        "fixturedata 200000 18000 182000 9% /data",
        "__TD_CPU__",
        "cpu  100 0 100 1000 0 0 0 0 0 0",
        "__TD_NET__",
        "Inter-|   Receive                                                |  Transmit",
        " face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed",
        "  eth0: 2048 20 0 0 0 0 0 0 4096 40 0 0 0 0 0 0",
        "__TD_END__",
        ""
      ].join("\n")
    );
    return;
  }

  if (trimmed.includes("__TD_PROC__")) {
    stream.end(
      [
        "__TD_PROC__",
        "101 smoke 0.5 0.3 fixture-shell",
        "202 smoke 0.2 0.1 fixture-sftp",
        "__TD_MEMPROC__",
        "303 smoke 0.1 7.4 fixture-cache-worker",
        "101 smoke 0.5 0.3 fixture-shell",
        "__TD_FAILED__",
        "fixture-smoke.service loaded failed failed smoke failure",
        "__TD_END__",
        ""
      ].join("\n")
    );
    return;
  }

  if (/rm\s+-rf\s+/.test(trimmed)) {
    stream.stderr.write("fixture exec rejected destructive command\n");
    stream.exit(1);
    stream.end();
    return;
  }

  stream.end(`fixture exec: ${trimmed || "ok"}\n`);
}

function attachSftpHandlers(sftp, rootDir, options = {}) {
  debugFixture("sftp session opened");
  const openResources = new Map();
  const transientMissingWriteDirectories =
    options.transientMissingWriteDirectories instanceof Map
      ? options.transientMissingWriteDirectories
      : new Map();
  const onClose = typeof options.onClose === "function" ? options.onClose : null;
  const writeDelayMs = normalizePositiveInteger(options.writeDelayMs);
  let nextHandleId = 1;
  let sessionClosed = false;

  const createHandle = (resource) => {
    const id = nextHandleId;
    nextHandleId += 1;
    const handle = Buffer.alloc(4);
    handle.writeUInt32BE(id, 0);
    openResources.set(id, resource);
    return handle;
  };

  const readHandle = (handle) => {
    if (!Buffer.isBuffer(handle) || handle.length !== 4) {
      return null;
    }
    const id = handle.readUInt32BE(0);
    return openResources.get(id) ?? null;
  };

  const closeResource = async (handle) => {
    if (!Buffer.isBuffer(handle) || handle.length !== 4) {
      return;
    }
    const id = handle.readUInt32BE(0);
    const resource = openResources.get(id);
    openResources.delete(id);
    if (resource?.type === "file") {
      await resource.fileHandle.close();
    }
  };

  const finalizeSession = () => {
    if (sessionClosed) {
      return;
    }
    sessionClosed = true;
    if (onClose) {
      onClose();
    }
  };

  sftp.on("REALPATH", async (reqid, targetPath) => {
    try {
      const normalizedPath = normalizeRemotePath(targetPath);
      const localPath = resolveRemotePath(rootDir, normalizedPath);
      await stat(localPath);
      sftp.name(reqid, [{ filename: normalizedPath, longname: normalizedPath, attrs: {} }]);
    } catch (error) {
      respondWithStatus(sftp, reqid, error);
    }
  });

  sftp.on("STAT", async (reqid, targetPath) => {
    try {
      const localPath = resolveRemotePath(rootDir, targetPath);
      const stats = await stat(localPath);
      sftp.attrs(reqid, toSftpAttrs(stats));
    } catch (error) {
      respondWithStatus(sftp, reqid, error);
    }
  });

  sftp.on("LSTAT", async (reqid, targetPath) => {
    try {
      const localPath = resolveRemotePath(rootDir, targetPath);
      const stats = await stat(localPath);
      sftp.attrs(reqid, toSftpAttrs(stats));
    } catch (error) {
      respondWithStatus(sftp, reqid, error);
    }
  });

  sftp.on("FSTAT", async (reqid, handle) => {
    try {
      const resource = readHandle(handle);
      if (!resource || resource.type !== "file") {
        throw createStatusError(STATUS_CODE.FAILURE, "Invalid handle.");
      }
      const stats = await resource.fileHandle.stat();
      sftp.attrs(reqid, toSftpAttrs(stats));
    } catch (error) {
      respondWithStatus(sftp, reqid, error);
    }
  });

  sftp.on("OPENDIR", async (reqid, targetPath) => {
    try {
      const remotePath = normalizeRemotePath(targetPath);
      const localPath = resolveRemotePath(rootDir, remotePath);
      const stats = await stat(localPath);
      if (!stats.isDirectory()) {
        throw createStatusError(STATUS_CODE.FAILURE, "Not a directory.");
      }
      const entryNames = await readdir(localPath);
      const entries = await Promise.all(
        entryNames.map(async (name) => {
          const entryRemotePath = posixPath.join(remotePath, name);
          const entryLocalPath = resolveRemotePath(rootDir, entryRemotePath);
          const entryStats = await stat(entryLocalPath);
          return {
            filename: name,
            longname: toLongname(name, entryStats),
            attrs: toSftpAttrs(entryStats)
          };
        })
      );
      const handle = createHandle({
        type: "directory",
        entries,
        sent: false
      });
      sftp.handle(reqid, handle);
    } catch (error) {
      respondWithStatus(sftp, reqid, error);
    }
  });

  sftp.on("READDIR", (reqid, handle) => {
    try {
      const resource = readHandle(handle);
      if (!resource || resource.type !== "directory") {
        throw createStatusError(STATUS_CODE.FAILURE, "Invalid directory handle.");
      }
      if (resource.sent) {
        sftp.status(reqid, STATUS_CODE.EOF);
        return;
      }
      resource.sent = true;
      sftp.name(reqid, resource.entries);
    } catch (error) {
      respondWithStatus(sftp, reqid, error);
    }
  });

  sftp.on("OPEN", async (reqid, filename, flags) => {
    try {
      const remotePath = normalizeRemotePath(filename);
      const localPath = resolveRemotePath(rootDir, remotePath);
      const mode = flagsToString(flags);
      if (!mode) {
        throw createStatusError(STATUS_CODE.FAILURE, "Unsupported open flags.");
      }
      if (/[wa+]/.test(mode)) {
        const remoteDirectory = normalizeRemotePath(posixPath.dirname(remotePath));
        const remainingTransientFailures = transientMissingWriteDirectories.get(remoteDirectory) ?? 0;
        if (remainingTransientFailures > 0) {
          if (remainingTransientFailures <= 1) {
            transientMissingWriteDirectories.delete(remoteDirectory);
          } else {
            transientMissingWriteDirectories.set(remoteDirectory, remainingTransientFailures - 1);
          }
          throw createNodeStyleError(
            "ENOENT",
            `ENOENT: no such file or directory, open '${remotePath}'`
          );
        }
        await mkdir(dirname(localPath), { recursive: true });
      }
      const fileHandle = await open(localPath, mode);
      const handle = createHandle({
        type: "file",
        fileHandle,
        localPath
      });
      sftp.handle(reqid, handle);
    } catch (error) {
      respondWithStatus(sftp, reqid, error);
    }
  });

  sftp.on("READ", async (reqid, handle, offset, length) => {
    try {
      const resource = readHandle(handle);
      if (!resource || resource.type !== "file") {
        throw createStatusError(STATUS_CODE.FAILURE, "Invalid file handle.");
      }
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await resource.fileHandle.read(buffer, 0, length, Number(offset));
      if (bytesRead <= 0) {
        sftp.status(reqid, STATUS_CODE.EOF);
        return;
      }
      sftp.data(reqid, buffer.subarray(0, bytesRead));
    } catch (error) {
      respondWithStatus(sftp, reqid, error);
    }
  });

  sftp.on("WRITE", async (reqid, handle, offset, data) => {
    try {
      const resource = readHandle(handle);
      if (!resource || resource.type !== "file") {
        throw createStatusError(STATUS_CODE.FAILURE, "Invalid file handle.");
      }
      if (writeDelayMs) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, writeDelayMs));
      }
      await resource.fileHandle.write(data, 0, data.length, Number(offset));
      sftp.status(reqid, STATUS_CODE.OK);
    } catch (error) {
      respondWithStatus(sftp, reqid, error);
    }
  });

  sftp.on("CLOSE", async (reqid, handle) => {
    try {
      await closeResource(handle);
      sftp.status(reqid, STATUS_CODE.OK);
    } catch (error) {
      respondWithStatus(sftp, reqid, error);
    }
  });

  sftp.on("REMOVE", async (reqid, targetPath) => {
    try {
      const localPath = resolveRemotePath(rootDir, targetPath);
      await rm(localPath, { force: false });
      sftp.status(reqid, STATUS_CODE.OK);
    } catch (error) {
      respondWithStatus(sftp, reqid, error);
    }
  });

  sftp.on("MKDIR", async (reqid, targetPath) => {
    try {
      const localPath = resolveRemotePath(rootDir, targetPath);
      await mkdir(localPath, { recursive: false });
      sftp.status(reqid, STATUS_CODE.OK);
    } catch (error) {
      respondWithStatus(sftp, reqid, error);
    }
  });

  sftp.on("RENAME", async (reqid, sourcePath, targetPath) => {
    try {
      const localSourcePath = resolveRemotePath(rootDir, sourcePath);
      const localTargetPath = resolveRemotePath(rootDir, targetPath);
      await mkdir(dirname(localTargetPath), { recursive: true });
      await rename(localSourcePath, localTargetPath);
      sftp.status(reqid, STATUS_CODE.OK);
    } catch (error) {
      respondWithStatus(sftp, reqid, error);
    }
  });

  sftp.on("SETSTAT", (reqid) => {
    sftp.status(reqid, STATUS_CODE.OK);
  });

  sftp.on("FSETSTAT", (reqid) => {
    sftp.status(reqid, STATUS_CODE.OK);
  });

  sftp.on("RMDIR", async (reqid, targetPath) => {
    try {
      const localPath = resolveRemotePath(rootDir, targetPath);
      await rm(localPath, { recursive: false, force: false });
      sftp.status(reqid, STATUS_CODE.OK);
    } catch (error) {
      respondWithStatus(sftp, reqid, error);
    }
  });

  sftp.on("close", () => {
    debugFixture("sftp session closed");
    finalizeSession();
  });

  sftp.on("end", () => {
    debugFixture("sftp session ended");
    finalizeSession();
  });
}

function normalizeRemotePath(input) {
  const rawValue = typeof input === "string" ? input.trim() : "";
  if (!rawValue || rawValue === ".") {
    return "/";
  }
  const withRoot = rawValue.startsWith("/") ? rawValue : `/${rawValue}`;
  const normalized = posixPath.normalize(withRoot);
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function normalizeRemoteDirectoryList(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return Array.from(
    new Set(
      input
        .map((value) => normalizeRemotePath(value))
        .filter((value) => value.length > 0)
    )
  );
}

function normalizePositiveInteger(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : null;
}

function resolveRemotePath(rootDir, remotePath) {
  const normalizedRemotePath = normalizeRemotePath(remotePath);
  const relativeSegments = normalizedRemotePath.split("/").filter(Boolean);
  const resolvedPath = resolve(rootDir, ...relativeSegments);
  const normalizedRoot = resolve(rootDir);
  const escaped =
    resolvedPath !== normalizedRoot &&
    !resolvedPath.startsWith(`${normalizedRoot}\\`) &&
    !resolvedPath.startsWith(`${normalizedRoot}/`);
  if (escaped) {
    throw createStatusError(STATUS_CODE.PERMISSION_DENIED, "Path escapes fixture root.");
  }
  return resolvedPath;
}

function toSftpAttrs(stats) {
  return {
    mode: stats.mode,
    uid: FIXTURE_UID,
    gid: FIXTURE_GID,
    size: stats.size,
    atime: Math.max(0, Math.trunc(stats.atimeMs / 1000)),
    mtime: Math.max(0, Math.trunc(stats.mtimeMs / 1000))
  };
}

function toLongname(name, stats) {
  const entryType = stats.isDirectory() ? "d" : "-";
  const permissions = [
    stats.mode & 0o400 ? "r" : "-",
    stats.mode & 0o200 ? "w" : "-",
    stats.mode & 0o100 ? "x" : "-",
    stats.mode & 0o040 ? "r" : "-",
    stats.mode & 0o020 ? "w" : "-",
    stats.mode & 0o010 ? "x" : "-",
    stats.mode & 0o004 ? "r" : "-",
    stats.mode & 0o002 ? "w" : "-",
    stats.mode & 0o001 ? "x" : "-"
  ].join("");
  const timestamp = formatLongnameTime(stats.mtime);
  return `${entryType}${permissions} 1 ${FIXTURE_UID} ${FIXTURE_GID} ${stats.size} ${timestamp} ${name}`;
}

function formatLongnameTime(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    date.getMonth()
  ];
  const day = String(date.getDate()).padStart(2, " ");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month} ${day} ${hours}:${minutes}`;
}

function respondWithStatus(sftp, reqid, error) {
  const statusCode =
    typeof error?.statusCode === "number" && Number.isFinite(error.statusCode)
      ? error.statusCode
      : mapNodeErrorToStatus(error);
  const message = error instanceof Error ? error.message : String(error ?? "Unknown SFTP error.");
  sftp.status(reqid, statusCode, message);
}

function createNodeStyleError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function mapNodeErrorToStatus(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  if (code === "ENOENT") {
    return STATUS_CODE.NO_SUCH_FILE;
  }
  if (code === "EACCES" || code === "EPERM") {
    return STATUS_CODE.PERMISSION_DENIED;
  }
  return STATUS_CODE.FAILURE;
}

function createStatusError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

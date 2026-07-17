import { readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json");
const appVersion = typeof packageJson.version === "string" ? packageJson.version : "";
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function parseArgs(argv) {
  const homeDir = os.homedir();
  const args = {
    certPath: path.join(homeDir, ".termdock-secrets", "windows", "TermDock-dev-code-signing.pfx"),
    passwordPath: path.join(homeDir, ".termdock-secrets", "windows", "TermDock-dev-code-signing.password.txt"),
    skipBuild: false
  };

  for (const token of argv) {
    if (token === "--") {
      continue;
    }
    if (token === "--skip-build") {
      args.skipBuild = true;
      continue;
    }
    if (token.startsWith("--cert-path=")) {
      args.certPath = token.slice("--cert-path=".length);
      continue;
    }
    if (token.startsWith("--password-path=")) {
      args.passwordPath = token.slice("--password-path=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32" && command.toLowerCase().endsWith(".cmd"),
      ...options
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function assertFileExists(filePath, description) {
  const resolved = path.resolve(filePath);
  const fileStat = await stat(resolved).catch(() => null);
  if (!fileStat?.isFile()) {
    throw new Error(`Missing ${description}: ${resolved}`);
  }
  return resolved;
}

async function findCachedSigntool() {
  const cacheRoot = path.join(process.env.LOCALAPPDATA || "", "electron-builder", "Cache", "winCodeSign");
  const cacheRootStat = await stat(cacheRoot).catch(() => null);
  if (!cacheRootStat?.isDirectory()) {
    throw new Error(`Missing electron-builder winCodeSign cache: ${cacheRoot}`);
  }

  const candidates = [];
  const firstLevel = await readdir(cacheRoot, { withFileTypes: true });
  for (const entry of firstLevel) {
    if (!entry.isDirectory()) {
      continue;
    }
    const candidate = path.join(cacheRoot, entry.name, "windows-10", "x64", "signtool.exe");
    const candidateStat = await stat(candidate).catch(() => null);
    if (candidateStat?.isFile()) {
      candidates.push(candidate);
    }
  }

  candidates.sort();
  const picked = candidates.at(-1);
  if (!picked) {
    throw new Error(`Unable to locate signtool.exe under ${cacheRoot}`);
  }
  return picked;
}

async function signFile(signtoolPath, certPath, password, targetPath) {
  await run(
    signtoolPath,
    ["sign", "/fd", "SHA256", "/f", certPath, "/p", password, targetPath],
    { shell: false }
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const certPath = await assertFileExists(args.certPath, "self-use Windows certificate (.pfx)");
  const passwordPath = await assertFileExists(args.passwordPath, "self-use Windows certificate password file");
  const password = (await readFile(passwordPath, "utf8")).trim();
  if (!password) {
    throw new Error(`Certificate password file is empty: ${passwordPath}`);
  }

  const env = {
    ...process.env,
    ELECTRON_BUILDER_BINARIES_MIRROR:
      process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
      "https://github.com/electron-userland/electron-builder-binaries/releases/download/",
    CSC_IDENTITY_AUTO_DISCOVERY: "false",
    WIN_CSC_LINK: certPath,
    WIN_CSC_KEY_PASSWORD: password,
    CSC_LINK: certPath,
    CSC_KEY_PASSWORD: password
  };

  if (!args.skipBuild) {
    await run(pnpmCommand, ["run", "build"], { env });
  }

  await rm(path.join("release", "win-unpacked"), { recursive: true, force: true });
  await run(
    pnpmCommand,
    [
      "exec",
      "electron-builder",
      "--dir",
      "--win",
      "--config.win.signAndEditExecutable=false"
    ],
    { env }
  );

  const signtoolPath = await findCachedSigntool();
  const unpackedExePath = await assertFileExists(path.join("release", "win-unpacked", "TermDock.exe"), "unpacked TermDock.exe");
  await signFile(signtoolPath, certPath, password, unpackedExePath);

  await run(
    pnpmCommand,
    [
      "exec",
      "electron-builder",
      "--prepackaged",
      path.join("release", "win-unpacked"),
      "--win",
      "nsis",
      "zip",
      "--publish",
      "never",
      "--config.win.signAndEditExecutable=false"
    ],
    {
      env: {
        ...env,
        CSC_LINK: "",
        CSC_KEY_PASSWORD: "",
        WIN_CSC_LINK: "",
        WIN_CSC_KEY_PASSWORD: ""
      }
    }
  );

  const releaseFiles = await readdir("release", { withFileTypes: true });
  const installerCandidates = releaseFiles
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".exe") &&
        !entry.name.includes("__uninstaller") &&
        (!appVersion || entry.name.includes(appVersion))
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const installerEntry = installerCandidates.at(-1);
  if (!installerEntry) {
    throw new Error(
      `Unable to locate built Windows installer after self-use packaging${
        appVersion ? ` for version ${appVersion}` : ""
      }.`
    );
  }
  const installerPath = path.join("release", installerEntry.name);
  await signFile(signtoolPath, certPath, password, installerPath);

  await run(
    pnpmCommand,
    [
      "run",
      "release:verify",
      "--",
      "--platform=win",
      "--expect-signature",
      "--install-smoke",
      ...(appVersion ? [`--version=${appVersion}`] : [])
    ],
    {
      env
    }
  );
}

await main();

import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { accessSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const packageJson = require("../package.json");
  const args = {
    platform: "",
    releaseDir: "release",
    version: typeof packageJson.version === "string" ? packageJson.version : "",
    expectSigned: false,
    expectSignature: false,
    expectNotarized: false,
    installSmoke: false
  };

  for (const token of argv) {
    if (token === "--") {
      continue;
    }
    if (token === "--expect-signed") {
      args.expectSigned = true;
      continue;
    }
    if (token === "--expect-signature") {
      args.expectSignature = true;
      continue;
    }
    if (token === "--expect-notarized") {
      args.expectNotarized = true;
      continue;
    }
    if (token === "--install-smoke") {
      args.installSmoke = true;
      continue;
    }
    if (token.startsWith("--platform=")) {
      args.platform = token.slice("--platform=".length);
      continue;
    }
    if (token.startsWith("--release-dir=")) {
      args.releaseDir = token.slice("--release-dir=".length);
      continue;
    }
    if (token.startsWith("--version=")) {
      args.version = token.slice("--version=".length).trim();
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!["win", "mac"].includes(args.platform)) {
    throw new Error("`--platform=win|mac` is required");
  }

  return args;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      ...options
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
        return;
      }
      const error = new Error(`${command} ${args.join(" ")} failed with exit code ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function pathExists(targetPath) {
  try {
    accessSync(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function waitForPath(targetPath, timeoutMs, shouldExist) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const exists = await pathExists(targetPath);
    if (exists === shouldExist) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${shouldExist ? "Expected" : "Expected missing"} path: ${targetPath}`);
}

async function listReleaseArtifacts(releaseDir) {
  const topLevelEntries = await readdir(releaseDir, { withFileTypes: true });
  const topLevelFiles = topLevelEntries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(releaseDir, entry.name));

  const dmgs = topLevelFiles.filter((filePath) => filePath.toLowerCase().endsWith(".dmg"));
  const zips = topLevelFiles.filter((filePath) => filePath.toLowerCase().endsWith(".zip"));
  const exes = topLevelFiles.filter(
    (filePath) =>
      filePath.toLowerCase().endsWith(".exe") && !path.basename(filePath).includes("__uninstaller")
  );

  const appBundles = [];
  for (const entry of topLevelEntries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const childDir = path.join(releaseDir, entry.name);
    const childEntries = await readdir(childDir, { withFileTypes: true });
    for (const childEntry of childEntries) {
      if (childEntry.isDirectory() && childEntry.name.endsWith(".app")) {
        appBundles.push(path.join(childDir, childEntry.name));
      }
    }
  }

  return { dmgs, zips, exes, appBundles };
}

function matchesReleaseVersion(filePath, version) {
  if (!version) {
    return true;
  }
  const baseName = path.basename(filePath);
  return baseName.includes(version);
}

function filterArtifactsForVersion(artifacts, version) {
  if (!version) {
    return artifacts;
  }
  const dmgs = artifacts.dmgs.filter((filePath) => matchesReleaseVersion(filePath, version));
  const zips = artifacts.zips.filter((filePath) => matchesReleaseVersion(filePath, version));
  const exes = artifacts.exes.filter((filePath) => matchesReleaseVersion(filePath, version));
  // .app bundles stay as TermDock.app (no version in the basename); keep all under release/.
  return { dmgs, zips, exes, appBundles: artifacts.appBundles };
}

function pickPreferredWindowsInstaller(exes) {
  const setupExes = exes.filter((filePath) => {
    const name = path.basename(filePath).toLowerCase();
    return name.includes("setup") || name.includes("termdock setup");
  });
  const candidates = (setupExes.length > 0 ? setupExes : exes).slice().sort((left, right) =>
    path.basename(left).localeCompare(path.basename(right))
  );
  return candidates.at(-1) ?? null;
}

async function getWindowsSignature(targetPath) {
  const escaped = targetPath.replace(/'/g, "''");
  const command = [
    "$sig = Get-AuthenticodeSignature -FilePath '",
    escaped,
    "';",
    "$sig | Select-Object ",
    "@{Name='Status';Expression={$_.Status.ToString()}},",
    "StatusMessage,",
    "@{Name='SignerCertificateSubject';Expression={if ($_.SignerCertificate) { $_.SignerCertificate.Subject } else { $null }}} ",
    "| ConvertTo-Json -Compress"
  ].join("");

  const { stdout } = await run("powershell", ["-NoProfile", "-Command", command]);
  const parsed = JSON.parse(stdout.trim());
  return {
    status: parsed.Status,
    statusMessage: parsed.StatusMessage,
    hasSignerCertificate: Boolean(parsed.SignerCertificateSubject)
  };
}

async function mountDmg(dmgPath) {
  const { stdout } = await run("hdiutil", ["attach", "-nobrowse", "-readonly", dmgPath]);
  const mountLine = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.includes("/Volumes/"));
  if (!mountLine) {
    throw new Error(`Unable to determine mount point for ${dmgPath}`);
  }
  const match = mountLine.match(/(\/Volumes\/.+)$/);
  if (!match) {
    throw new Error(`Unable to parse mount point from: ${mountLine}`);
  }
  return match[1];
}

async function detachDmg(mountPoint) {
  await run("hdiutil", ["detach", mountPoint]);
}

async function withCheck(report, name, runCheck) {
  try {
    const details = await runCheck();
    report.checks.push({ name, status: "pass", details });
    console.log(`[PASS] ${name}${details ? ` - ${details}` : ""}`);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    report.checks.push({ name, status: "fail", details });
    console.error(`[FAIL] ${name} - ${details}`);
    throw error;
  }
}

async function verifyMacArtifacts(args, artifacts, report) {
  if (artifacts.dmgs.length === 0) {
    throw new Error("No DMG artifacts found in release directory");
  }
  if (artifacts.zips.length === 0) {
    throw new Error("No ZIP artifacts found in release directory");
  }
  if (artifacts.appBundles.length === 0) {
    throw new Error("No .app bundle found under release directory");
  }

  await withCheck(report, "mac artifact presence", async () => {
    return `dmg=${artifacts.dmgs.length}, zip=${artifacts.zips.length}, app=${artifacts.appBundles.length}`;
  });

  if (args.expectSigned) {
    for (const appPath of artifacts.appBundles) {
      await withCheck(report, `mac codesign verify ${path.basename(appPath)}`, async () => {
        await run("codesign", ["--verify", "--deep", "--strict", appPath]);
        await run("spctl", ["--assess", "--type", "exec", "--verbose=4", appPath]);
        return appPath;
      });
    }
  }

  if (args.expectNotarized) {
    for (const appPath of artifacts.appBundles) {
      await withCheck(report, `mac stapler validate app ${path.basename(appPath)}`, async () => {
        await run("xcrun", ["stapler", "validate", appPath]);
        return appPath;
      });
    }
    for (const dmgPath of artifacts.dmgs) {
      await withCheck(report, `mac stapler validate dmg ${path.basename(dmgPath)}`, async () => {
        await run("xcrun", ["stapler", "validate", dmgPath]);
        return dmgPath;
      });
    }
  }

  if (args.installSmoke) {
    for (const dmgPath of artifacts.dmgs) {
      let mountPoint = "";
      await withCheck(report, `mac dmg mount ${path.basename(dmgPath)}`, async () => {
        mountPoint = await mountDmg(dmgPath);
        const appPath = path.join(mountPoint, "TermDock.app");
        if (!(await pathExists(appPath))) {
          throw new Error(`Mounted DMG missing TermDock.app: ${appPath}`);
        }
        const applicationsAlias = path.join(mountPoint, "Applications");
        if (!(await pathExists(applicationsAlias))) {
          throw new Error(`Mounted DMG missing Applications shortcut: ${applicationsAlias}`);
        }
        return mountPoint;
      });
      if (mountPoint) {
        await withCheck(report, `mac dmg detach ${path.basename(dmgPath)}`, async () => {
          await detachDmg(mountPoint);
          return mountPoint;
        });
      }
    }
  }
}

async function verifyWindowsArtifacts(args, artifacts, report) {
  if (artifacts.exes.length === 0) {
    throw new Error("No Windows installer executable found in release directory");
  }
  if (artifacts.zips.length === 0) {
    throw new Error("No Windows ZIP artifact found in release directory");
  }

  const unpackedExe = path.join(args.releaseDir, "win-unpacked", "TermDock.exe");

  await withCheck(report, "windows artifact presence", async () => {
    if (!(await pathExists(unpackedExe))) {
      throw new Error(`Missing unpacked app executable: ${unpackedExe}`);
    }
    return `installer=${artifacts.exes.length}, zip=${artifacts.zips.length}, unpacked=${unpackedExe}`;
  });

  if (args.expectSigned || args.expectSignature) {
    const signTargets = [...artifacts.exes, unpackedExe];
    for (const signTarget of signTargets) {
      await withCheck(report, `windows signature ${path.basename(signTarget)}`, async () => {
        const signature = await getWindowsSignature(signTarget);
        if (args.expectSigned) {
          if (signature.status !== "Valid") {
            throw new Error(`${signTarget} signature status: ${signature.status}`);
          }
        } else if (signature.status === "NotSigned" || !signature.hasSignerCertificate) {
          throw new Error(`${signTarget} does not contain a usable Authenticode signature`);
        }
        return `${signTarget} (${signature.status})`;
      });
    }
  }

  if (args.installSmoke) {
    const installerPath = pickPreferredWindowsInstaller(artifacts.exes);
    if (!installerPath) {
      throw new Error("Unable to locate a Windows installer executable for install smoke");
    }
    const installDir = path.join(os.tmpdir(), `termdock-install-smoke-${Date.now()}`);
    const installedExe = path.join(installDir, "TermDock.exe");
    await rm(installDir, { recursive: true, force: true });

    await withCheck(report, `windows installer silent install ${path.basename(installerPath)}`, async () => {
      await run(installerPath, ["/S", `/D=${installDir}`], { windowsHide: true });
      await waitForPath(installedExe, 30_000, true);
      return installDir;
    });

    const uninstallCandidates = [
      path.join(installDir, "Uninstall TermDock.exe"),
      path.join(installDir, "Uninstall.exe")
    ];
    const uninstallPath = uninstallCandidates.find((candidate) => existsSync(candidate));
    if (!uninstallPath) {
      throw new Error(`Unable to locate uninstaller under ${installDir}`);
    }

    await withCheck(report, `windows installer silent uninstall ${path.basename(installerPath)}`, async () => {
      await run(uninstallPath, ["/S"], { windowsHide: true });
      await waitForPath(installedExe, 30_000, false);
      await rm(installDir, { recursive: true, force: true });
      return uninstallPath;
    });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const reportDir = path.join("artifacts", "release-verify", timestamp);
  await mkdir(reportDir, { recursive: true });

  const report = {
    platform: args.platform,
    releaseDir: path.resolve(args.releaseDir),
    version: args.version || null,
    expectSigned: args.expectSigned,
    expectSignature: args.expectSignature,
    expectNotarized: args.expectNotarized,
    installSmoke: args.installSmoke,
    checks: []
  };

  let failed = false;

  try {
    const releaseStats = await stat(args.releaseDir);
    if (!releaseStats.isDirectory()) {
      throw new Error(`Release path is not a directory: ${args.releaseDir}`);
    }

    const allArtifacts = await listReleaseArtifacts(args.releaseDir);
    const artifacts = filterArtifactsForVersion(allArtifacts, args.version);
    if (args.version) {
      console.log(`[info] filtering release artifacts for version ${args.version}`);
    }
    if (args.platform === "mac") {
      await verifyMacArtifacts(args, artifacts, report);
    } else {
      await verifyWindowsArtifacts(args, artifacts, report);
    }
  } catch (error) {
    failed = true;
    report.error = error instanceof Error ? error.message : String(error);
  }

  const summaryPath = path.join(reportDir, `${args.platform}-summary.json`);
  await writeFile(summaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Report written: ${summaryPath}`);

  if (failed || report.checks.some((check) => check.status === "fail")) {
    process.exitCode = 2;
  }
}

await main();

import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const candidateDefinitions = [
  {
    platform: "windows",
    label: "Packaged App (Windows)",
    path: "release/win-unpacked/TermDock.exe"
  },
  {
    platform: "macos",
    label: "Packaged App (macOS x64)",
    path: "release/mac/TermDock.app/Contents/MacOS/TermDock"
  },
  {
    platform: "macos",
    label: "Packaged App (macOS arm64)",
    path: "release/mac-arm64/TermDock.app/Contents/MacOS/TermDock"
  },
  {
    platform: "macos",
    label: "Packaged App (macOS)",
    path: "release/mac-x64/TermDock.app/Contents/MacOS/TermDock"
  }
];

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveExecutablePath() {
  const override = process.env.TERMDOCK_SMOKE_EXECUTABLE?.trim();
  if (override) {
    const absoluteOverride = resolve(override);
    if (!(await exists(absoluteOverride))) {
      throw new Error(`Configured TERMDOCK_SMOKE_EXECUTABLE does not exist: ${absoluteOverride}`);
    }
    return {
      executablePath: absoluteOverride,
      platform: process.env.TERMDOCK_SMOKE_PLATFORM?.trim() || process.platform,
      label: process.env.TERMDOCK_SMOKE_LABEL?.trim() || "Packaged App"
    };
  }

  for (const candidate of candidateDefinitions) {
    const absolutePath = resolve(candidate.path);
    if (await exists(absolutePath)) {
      return {
        executablePath: absolutePath,
        platform: candidate.platform,
        label: candidate.label
      };
    }
  }

  const listed = candidateDefinitions.map((candidate) => `- ${candidate.path}`).join("\n");
  throw new Error(
    `No packaged executable found.\nBuild one first, then rerun.\nChecked:\n${listed}`
  );
}

async function main() {
  const resolved = await resolveExecutablePath();
  const env = {
    ...process.env,
    TERMDOCK_SMOKE_EXECUTABLE: resolved.executablePath,
    TERMDOCK_SMOKE_PLATFORM: process.env.TERMDOCK_SMOKE_PLATFORM?.trim() || resolved.platform,
    TERMDOCK_SMOKE_LABEL: process.env.TERMDOCK_SMOKE_LABEL?.trim() || resolved.label
  };

  const child = spawn(process.execPath, [resolve("scripts/smoke-capture-all.mjs")], {
    stdio: "inherit",
    env
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(1);
      return;
    }
    process.exit(code ?? 0);
  });
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

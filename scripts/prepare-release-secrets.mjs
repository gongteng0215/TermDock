import { appendFile, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function parseArgs(argv) {
  const args = { platform: "all" };
  for (const token of argv) {
    if (token === "--") {
      continue;
    }
    if (token.startsWith("--platform=")) {
      args.platform = token.slice("--platform=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!["all", "mac", "win"].includes(args.platform)) {
    throw new Error(`Unsupported platform: ${args.platform}`);
  }
  return args;
}

async function exportGithubEnv(name, value) {
  const githubEnvPath = process.env.GITHUB_ENV;
  if (!githubEnvPath) {
    return false;
  }
  await appendFile(githubEnvPath, `${name}=${value}\n`, "utf8");
  return true;
}

async function materializeAppleApiKey() {
  const appleApiKeyB64 = process.env.APPLE_API_KEY_B64;
  if (!appleApiKeyB64 || process.env.APPLE_API_KEY) {
    return null;
  }

  const tempRoot = process.env.RUNNER_TEMP || os.tmpdir();
  const targetDir = path.join(tempRoot, "termdock-release-secrets");
  await mkdir(targetDir, { recursive: true });

  const keyId = process.env.APPLE_API_KEY_ID || "termdock";
  const targetPath = path.join(targetDir, `AuthKey_${keyId}.p8`);
  const keyBuffer = Buffer.from(appleApiKeyB64, "base64");
  await writeFile(targetPath, keyBuffer);
  await exportGithubEnv("APPLE_API_KEY", targetPath);
  return targetPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prepared = [];

  if (args.platform === "all" || args.platform === "mac") {
    const appleApiKeyPath = await materializeAppleApiKey();
    if (appleApiKeyPath) {
      prepared.push(`APPLE_API_KEY=${appleApiKeyPath}`);
    }
  }

  if (prepared.length === 0) {
    console.log("No release secrets needed materialization.");
    return;
  }

  for (const item of prepared) {
    console.log(`Prepared ${item}`);
  }
}

await main();

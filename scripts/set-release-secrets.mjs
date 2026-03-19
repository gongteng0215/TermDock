import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

function parseArgs(argv) {
  const args = {
    repo: "",
    dryRun: false,
    values: {}
  };

  for (const token of argv) {
    if (token === "--") {
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token.startsWith("--repo=")) {
      args.repo = token.slice("--repo=".length);
      continue;
    }
    const equalsIndex = token.indexOf("=");
    if (token.startsWith("--") && equalsIndex > 0) {
      const key = token.slice(2, equalsIndex);
      const value = token.slice(equalsIndex + 1);
      args.values[key] = value;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!args.repo) {
    throw new Error("`--repo=<owner/name>` is required");
  }

  return args;
}

function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      shell: false
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
        resolve({ stdout, stderr });
        return;
      }
      const error = new Error(`${command} ${args.join(" ")} failed with exit code ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
    child.stdin.end(input, "utf8");
  });
}

async function loadSecretValue(directValue, filePath, binaryMode = false) {
  if (directValue) {
    return directValue;
  }
  if (!filePath) {
    return null;
  }
  const buffer = await readFile(path.resolve(filePath));
  return binaryMode ? buffer.toString("base64") : buffer.toString("utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const values = args.values;

  const secretMap = new Map();
  const register = (name, value) => {
    if (typeof value === "string" && value.length > 0) {
      secretMap.set(name, value);
    }
  };

  const winCscLink = await loadSecretValue(values["win-csc-link"], values["win-csc-file"], true);
  const winCscPassword = values["win-csc-key-password"] || process.env.WIN_CSC_KEY_PASSWORD || "";
  if (winCscLink || winCscPassword) {
    if (!winCscLink || !winCscPassword) {
      throw new Error("Windows signing secrets require both `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`.");
    }
    register("WIN_CSC_LINK", winCscLink);
    register("WIN_CSC_KEY_PASSWORD", winCscPassword);
  }

  const macCscLink = await loadSecretValue(values["mac-csc-link"], values["mac-csc-file"], true);
  const macCscPassword = values["mac-csc-key-password"] || process.env.MAC_CSC_KEY_PASSWORD || "";
  if (macCscLink || macCscPassword) {
    if (!macCscLink || !macCscPassword) {
      throw new Error("macOS signing secrets require both `MAC_CSC_LINK` and `MAC_CSC_KEY_PASSWORD`.");
    }
    register("MAC_CSC_LINK", macCscLink);
    register("MAC_CSC_KEY_PASSWORD", macCscPassword);
  }

  const appleApiKeyB64 =
    (await loadSecretValue(values["apple-api-key-b64"], values["apple-api-key-file"], true)) ||
    process.env.APPLE_API_KEY_B64 ||
    "";
  const appleApiKeyId = values["apple-api-key-id"] || process.env.APPLE_API_KEY_ID || "";
  const appleApiIssuer = values["apple-api-issuer"] || process.env.APPLE_API_ISSUER || "";
  if (appleApiKeyB64 || appleApiKeyId || appleApiIssuer) {
    if (!appleApiKeyB64 || !appleApiKeyId || !appleApiIssuer) {
      throw new Error("Apple API key notarization secrets require `APPLE_API_KEY_B64`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`.");
    }
    register("APPLE_API_KEY_B64", appleApiKeyB64);
    register("APPLE_API_KEY_ID", appleApiKeyId);
    register("APPLE_API_ISSUER", appleApiIssuer);
  }

  const appleId = values["apple-id"] || process.env.APPLE_ID || "";
  const appleAppSpecificPassword =
    values["apple-app-specific-password"] || process.env.APPLE_APP_SPECIFIC_PASSWORD || "";
  const appleTeamId = values["apple-team-id"] || process.env.APPLE_TEAM_ID || "";
  if (appleId || appleAppSpecificPassword || appleTeamId) {
    if (!appleId || !appleAppSpecificPassword || !appleTeamId) {
      throw new Error("Apple ID notarization secrets require `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`.");
    }
    register("APPLE_ID", appleId);
    register("APPLE_APP_SPECIFIC_PASSWORD", appleAppSpecificPassword);
    register("APPLE_TEAM_ID", appleTeamId);
  }

  const appleKeychain = values["apple-keychain"] || process.env.APPLE_KEYCHAIN || "";
  const appleKeychainProfile = values["apple-keychain-profile"] || process.env.APPLE_KEYCHAIN_PROFILE || "";
  if (appleKeychain || appleKeychainProfile) {
    if (!appleKeychain || !appleKeychainProfile) {
      throw new Error("Keychain notarization secrets require `APPLE_KEYCHAIN` and `APPLE_KEYCHAIN_PROFILE`.");
    }
    register("APPLE_KEYCHAIN", appleKeychain);
    register("APPLE_KEYCHAIN_PROFILE", appleKeychainProfile);
  }

  if (secretMap.size === 0) {
    throw new Error("No secret values were provided.");
  }

  for (const [name, value] of secretMap) {
    if (args.dryRun) {
      console.log(`[dry-run] would set ${name} (${value.length} chars)`);
      continue;
    }
    await run("gh", ["secret", "set", name, "--repo", args.repo], value);
    console.log(`set ${name}`);
  }
}

await main();

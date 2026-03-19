import { existsSync } from "node:fs";

function parseArgs(argv) {
  const args = {
    platform: "all",
    requireSigning: false,
    requireNotarization: false,
    json: false
  };

  for (const token of argv) {
    if (token === "--") {
      continue;
    }
    if (token === "--require-signing") {
      args.requireSigning = true;
      continue;
    }
    if (token === "--require-notarization") {
      args.requireNotarization = true;
      continue;
    }
    if (token === "--json") {
      args.json = true;
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

function hasAllEnv(names) {
  return names.every((name) => {
    const value = process.env[name];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function makeMacSummary() {
  const signingModes = [];
  if (hasAllEnv(["CSC_LINK", "CSC_KEY_PASSWORD"])) {
    signingModes.push("csc-link");
  }
  if (hasAllEnv(["CSC_NAME"])) {
    signingModes.push("csc-name");
  }
  if (hasAllEnv(["CSC_KEYCHAIN"])) {
    signingModes.push("csc-keychain");
  }

  const notarizationModes = [];
  if (hasAllEnv(["APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"])) {
    notarizationModes.push("api-key");
  }
  if (hasAllEnv(["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"])) {
    notarizationModes.push("apple-id");
  }
  if (hasAllEnv(["APPLE_KEYCHAIN", "APPLE_KEYCHAIN_PROFILE"])) {
    notarizationModes.push("keychain-profile");
  }

  const entitlements = {
    app: existsSync("build/entitlements.mac.plist"),
    inherit: existsSync("build/entitlements.mac.inherit.plist")
  };

  const missing = [];
  if (signingModes.length === 0) {
    missing.push("mac signing credentials (`CSC_LINK` + `CSC_KEY_PASSWORD`, `CSC_NAME`, or `CSC_KEYCHAIN`)");
  }
  if (!entitlements.app || !entitlements.inherit) {
    missing.push("mac entitlements files (`build/entitlements.mac.plist`, `build/entitlements.mac.inherit.plist`)");
  }
  if (notarizationModes.length === 0) {
    missing.push(
      "mac notarization credentials (`APPLE_API_KEY*`, `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`, or `APPLE_KEYCHAIN` + `APPLE_KEYCHAIN_PROFILE`)"
    );
  }

  return {
    platform: "mac",
    signingReady: signingModes.length > 0 && entitlements.app && entitlements.inherit,
    notarizationReady: notarizationModes.length > 0,
    signingModes,
    notarizationModes,
    entitlements,
    missing
  };
}

function makeWindowsSummary() {
  const signingModes = [];
  if (hasAllEnv(["WIN_CSC_LINK", "WIN_CSC_KEY_PASSWORD"])) {
    signingModes.push("win-csc-link");
  }
  if (hasAllEnv(["CSC_LINK", "CSC_KEY_PASSWORD"])) {
    signingModes.push("shared-csc-link");
  }

  const missing = [];
  if (signingModes.length === 0) {
    missing.push("windows signing credentials (`WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD` or shared `CSC_LINK` + `CSC_KEY_PASSWORD`)");
  }

  return {
    platform: "win",
    signingReady: signingModes.length > 0,
    signingModes,
    missing
  };
}

function printText(results, args) {
  for (const result of results) {
    console.log(`[${result.platform}] signingReady=${result.signingReady}`);
    if ("notarizationReady" in result) {
      console.log(`[${result.platform}] notarizationReady=${result.notarizationReady}`);
      console.log(`[${result.platform}] entitlements=${JSON.stringify(result.entitlements)}`);
      console.log(
        `[${result.platform}] notarizationModes=${result.notarizationModes.length > 0 ? result.notarizationModes.join(", ") : "none"}`
      );
    }
    console.log(
      `[${result.platform}] signingModes=${result.signingModes.length > 0 ? result.signingModes.join(", ") : "none"}`
    );
    if (result.missing.length > 0) {
      for (const item of result.missing) {
        console.log(`[${result.platform}] missing: ${item}`);
      }
    }
  }

  if (args.requireSigning || args.requireNotarization) {
    console.log(
      `requirements: signing=${args.requireSigning ? "required" : "optional"}, notarization=${args.requireNotarization ? "required" : "optional"}`
    );
  }
}

function validateRequirements(results, args) {
  const errors = [];
  for (const result of results) {
    if (args.requireSigning && !result.signingReady) {
      errors.push(`[${result.platform}] signing is required but not ready`);
    }
    if (args.requireNotarization && "notarizationReady" in result && !result.notarizationReady) {
      errors.push(`[${result.platform}] notarization is required but not ready`);
    }
  }
  return errors;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = [];
  if (args.platform === "all" || args.platform === "mac") {
    results.push(makeMacSummary());
  }
  if (args.platform === "all" || args.platform === "win") {
    results.push(makeWindowsSummary());
  }

  if (args.json) {
    console.log(JSON.stringify({ args, results }, null, 2));
  } else {
    printText(results, args);
  }

  const errors = validateRequirements(results, args);
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }
    process.exitCode = 1;
  }
}

main();

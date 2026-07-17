import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const electronPackagePath = require.resolve("electron/package.json");
const electronVersion = require(electronPackagePath).version;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const env = {
  ...process.env,
  npm_config_target: String(electronVersion),
  npm_config_arch: process.arch,
  npm_config_disturl: "https://electronjs.org/headers",
  npm_config_runtime: "electron",
  npm_config_build_from_source: "true"
};

console.log(`[rebuild-native] rebuilding better-sqlite3 + keytar for Electron ${electronVersion} (${process.arch})`);

const result = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["rebuild", "better-sqlite3", "keytar"],
  {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32"
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("[rebuild-native] done");

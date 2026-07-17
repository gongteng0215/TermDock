import { spawnSync } from "node:child_process";
import electronPath from "electron";

const scriptPath = process.argv[2];
if (!scriptPath) {
  console.error("Usage: node scripts/run-with-electron-node.mjs <script> [args...]");
  process.exit(1);
}

const result = spawnSync(electronPath, [scriptPath, ...process.argv.slice(3)], {
  stdio: "inherit",
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1"
  }
});

process.exit(result.status ?? 1);

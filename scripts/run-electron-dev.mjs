import { spawn } from "node:child_process";

import electronPath from "electron";

const env = { ...process.env };

// Some shells keep this var globally; Electron treats "set but empty" as enabled.
delete env.ELECTRON_RUN_AS_NODE;

if (!env.TERMDOCK_DISABLE_GPU) {
  env.TERMDOCK_DISABLE_GPU = "1";
}
if (!env.VITE_DEV_SERVER_URL) {
  env.VITE_DEV_SERVER_URL = "http://localhost:5273";
}

const child = spawn(electronPath, ["."], {
  stdio: "inherit",
  env
});

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
    return;
  }
  process.exit(code ?? 0);
});


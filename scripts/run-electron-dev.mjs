import { spawn } from "node:child_process";
import { watch } from "node:fs";

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

const watchTargets = [
  "dist-electron/main/main.js",
  "dist-electron/main/preload.cjs"
];

let child = null;
let stopping = false;
let restarting = false;
let restartQueued = false;
let restartTimer = null;

const spawnElectron = () => {
  child = spawn(electronPath, ["."], {
    stdio: "inherit",
    env
  });

  child.on("exit", (code, signal) => {
    child = null;

    if (stopping) {
      process.exit(0);
      return;
    }

    if (restarting) {
      restarting = false;
      spawnElectron();
      if (restartQueued) {
        restartQueued = false;
        scheduleRestart();
      }
      return;
    }

    if (signal) {
      process.exit(1);
      return;
    }
    process.exit(code ?? 0);
  });
};

const scheduleRestart = () => {
  if (stopping) {
    return;
  }
  if (restartTimer) {
    clearTimeout(restartTimer);
  }
  restartTimer = setTimeout(() => {
    restartTimer = null;
    restartElectron();
  }, 180);
};

const restartElectron = () => {
  if (!child) {
    spawnElectron();
    return;
  }
  if (restarting) {
    restartQueued = true;
    return;
  }

  restarting = true;
  child.kill("SIGTERM");
  setTimeout(() => {
    if (child && restarting) {
      child.kill("SIGKILL");
    }
  }, 3000);
};

const forwardSignal = (signal) => {
  stopping = true;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  if (!child) {
    process.exit(0);
    return;
  }
  if (!child.killed) {
    child.kill(signal);
  }
};

for (const target of watchTargets) {
  watch(target, () => {
    console.log(`[TermDock] Change detected in ${target}, restarting Electron...`);
    scheduleRestart();
  });
}

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

spawnElectron();

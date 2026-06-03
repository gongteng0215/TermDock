import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8"));
const mainSource = await readFile(resolve("src/main/main.ts"), "utf8");
const workflowSource = await readFile(resolve(".github/workflows/release.yml"), "utf8");

let autoUpdateSource = "";
try {
  autoUpdateSource = await readFile(resolve("src/main/auto-update.ts"), "utf8");
} catch {
  autoUpdateSource = "";
}

const buildConfig = packageJson.build ?? {};
const winTargets = buildConfig.win?.target ?? [];
const macTargets = buildConfig.mac?.target ?? [];
const publishConfig = Array.isArray(buildConfig.publish) ? buildConfig.publish : [];

const checks = [
  {
    name: "declares electron-updater as a runtime dependency",
    pass: typeof packageJson.dependencies?.["electron-updater"] === "string"
  },
  {
    name: "keeps GitHub as the electron-builder publish provider",
    pass: publishConfig.some((entry) => entry?.provider === "github")
  },
  {
    name: "builds NSIS and ZIP Windows artifacts for differential updates and manual fallback",
    pass: winTargets.includes("nsis") && winTargets.includes("zip")
  },
  {
    name: "builds macOS DMG and ZIP artifacts for updater compatibility",
    pass: macTargets.includes("dmg") && macTargets.includes("zip")
  },
  {
    name: "uploads electron-updater metadata files in the release workflow",
    pass:
      /release\/\*\.yml/.test(workflowSource) &&
      /release\/\*\.yaml/.test(workflowSource) &&
      /release-assets\/\*\.yml/.test(workflowSource) &&
      /release-assets\/\*\.yaml/.test(workflowSource)
  },
  {
    name: "provides a focused main-process auto-update module",
    pass:
      /from\s+["']electron-updater["']/.test(autoUpdateSource) &&
      /function\s+initializeAutoUpdate|const\s+initializeAutoUpdate/.test(autoUpdateSource) &&
      /checkForUpdates/.test(autoUpdateSource) &&
      /TERMDOCK_DISABLE_AUTO_UPDATE/.test(autoUpdateSource) &&
      /TERMDOCK_SMOKE_USER_DATA_DIR/.test(autoUpdateSource) &&
      /app\.isPackaged/.test(autoUpdateSource) &&
      /download-progress/.test(autoUpdateSource) &&
      /update-downloaded/.test(autoUpdateSource) &&
      /quitAndInstall/.test(autoUpdateSource)
  },
  {
    name: "uses a default electron-updater import for packaged ESM/CommonJS compatibility",
    pass:
      !/import\s+\{\s*autoUpdater\s*\}\s+from\s+["']electron-updater["']/.test(autoUpdateSource) &&
      /import\s+\w+\s+from\s+["']electron-updater["']/.test(autoUpdateSource) &&
      /const\s+\{\s*autoUpdater\s*\}\s*=/.test(autoUpdateSource)
  },
  {
    name: "wires auto-update initialization into packaged app bootstrap",
    pass:
      /initializeAutoUpdate/.test(mainSource) &&
      /from\s+["']\.\/auto-update\.js["']/.test(mainSource) &&
      /createWindow\(\)[\s\S]*initializeAutoUpdate/.test(mainSource)
  }
];

const failures = checks.filter((check) => !check.pass);

if (failures.length > 0) {
  console.error("Main-process auto-update integration is incomplete:");
  for (const failure of failures) {
    console.error(`- ${failure.name}`);
  }
  process.exit(1);
}

console.log("Main-process auto-update integration is present.");

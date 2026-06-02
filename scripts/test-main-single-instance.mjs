import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const mainSourcePath = resolve("src/main/main.ts");
const source = await readFile(mainSourcePath, "utf8");

const requiredPatterns = [
  {
    name: "requests Electron single-instance lock",
    pattern: /app\.requestSingleInstanceLock\(\)/
  },
  {
    name: "quits secondary app instance when lock is unavailable",
    pattern: /if\s*\(\s*!hasSingleInstanceLock\s*\)[\s\S]*app\.quit\(\)/
  },
  {
    name: "handles second-instance event",
    pattern: /app\.on\(\s*["']second-instance["']/
  },
  {
    name: "restores minimized existing window",
    pattern: /\.isMinimized\(\)[\s\S]*\.restore\(\)/
  },
  {
    name: "focuses existing window",
    pattern: /\.focus\(\)/
  },
  {
    name: "only bootstraps the process that owns the single-instance lock",
    pattern: /if\s*\(\s*hasSingleInstanceLock\s*\)[\s\S]*bootstrap\(\)/
  }
];

const failures = requiredPatterns.filter(({ pattern }) => !pattern.test(source));

if (failures.length > 0) {
  console.error("Single-instance main-process guard is incomplete:");
  for (const failure of failures) {
    console.error(`- ${failure.name}`);
  }
  process.exit(1);
}

console.log("Single-instance main-process guard is present.");

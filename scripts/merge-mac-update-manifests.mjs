import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [outputPath, ...inputPaths] = process.argv.slice(2);
if (!outputPath || inputPaths.length < 2) {
  throw new Error("Usage: node scripts/merge-mac-update-manifests.mjs <output> <x64-manifest> <arm64-manifest>");
}

function field(text, key) {
  const line = text.split(/\r?\n/).find((value) => value.trimStart().startsWith(`${key}:`));
  const value = line?.trim().slice(key.length + 1).trim();
  if (!value) throw new Error(`Missing update metadata field: ${key}`);
  return value.replace(/^['"]|['"]$/g, "");
}

let version;
const files = new Map();
const dates = [];
for (const inputPath of inputPaths) {
  const text = await readFile(inputPath, "utf8");
  const inputVersion = field(text, "version");
  if (version && version !== inputVersion) throw new Error("Cannot merge different release versions");
  version = inputVersion;
  dates.push(field(text, "releaseDate"));
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === "files:");
  if (start < 0) throw new Error(`Missing files list: ${inputPath}`);
  const blocks = [];
  for (const line of lines.slice(start + 1)) {
    if (line && !/^\s/.test(line)) break;
    if (/^\s*-\s+url:/.test(line)) blocks.push([]);
    if (blocks.length) blocks.at(-1).push(line);
  }
  for (const blockLines of blocks) {
    const block = blockLines.join("\n");
    const url = field(block.replace(/^\s*-\s+url:/m, "url:"), "url");
    const sha512 = field(block, "sha512");
    const size = Number(field(block, "size"));
    if (path.basename(url) !== url || !url.startsWith(`TermDock-${version}`) || !/\.(zip|dmg)$/.test(url)) {
      throw new Error(`Unexpected macOS update asset: ${url}`);
    }
    if (!Number.isSafeInteger(size) || size <= 0 || Buffer.from(sha512, "base64").length !== 64) {
      throw new Error(`Invalid update metadata for ${url}`);
    }
    const entry = { url, sha512, size };
    if (files.has(url) && JSON.stringify(files.get(url)) !== JSON.stringify(entry)) {
      throw new Error(`Conflicting update metadata for ${url}`);
    }
    files.set(url, entry);
  }
}
const legacy = [...files.values()].find((entry) => entry.url === `TermDock-${version}-mac.zip`);
if (!legacy || !files.has(`TermDock-${version}-arm64-mac.zip`)) {
  throw new Error("Both Intel and Apple Silicon update ZIPs are required");
}
const metadata = [
  `version: ${JSON.stringify(version)}`,
  "files:",
  ...[...files.values()].map((entry) => `  - url: ${JSON.stringify(entry.url)}\n    sha512: ${entry.sha512}\n    size: ${entry.size}`),
  `path: ${JSON.stringify(legacy.url)}`,
  `sha512: ${legacy.sha512}`,
  `releaseDate: ${JSON.stringify(dates.sort().at(-1))}`,
  ""
].join("\n");
await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await writeFile(outputPath, metadata, "utf8");
console.log(`Merged ${version} macOS updater metadata: ${[...files.keys()].join(", ")}`);

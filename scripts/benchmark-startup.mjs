#!/usr/bin/env node
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

function nowTag() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function toKiB(bytes) {
  return bytes / 1024;
}

function toMiB(bytes) {
  return bytes / (1024 * 1024);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function classifyAsset(name) {
  if (name.includes("modal")) {
    return "lazy-modal";
  }
  if (name.startsWith("vendor-")) {
    return "vendor";
  }
  if (name.startsWith("renderer-")) {
    return "renderer-chunk";
  }
  if (name.startsWith("index-")) {
    return "entry";
  }
  return "other";
}

async function measureFile(path) {
  const buffer = await readFile(path);
  const gzipBytes = gzipSync(buffer).length;
  return {
    path,
    fileName: path.split(/[/\\]/).pop(),
    bytes: buffer.length,
    gzipBytes,
    kiB: round(toKiB(buffer.length)),
    gzipKiB: round(toKiB(gzipBytes))
  };
}

function extractAssetNames(html, pattern) {
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

function summarizeAssets(entries) {
  const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  const totalGzipBytes = entries.reduce((sum, entry) => sum + entry.gzipBytes, 0);
  return {
    count: entries.length,
    totalBytes,
    totalGzipBytes,
    totalKiB: round(toKiB(totalBytes)),
    totalGzipKiB: round(toKiB(totalGzipBytes)),
    totalMiB: round(toMiB(totalBytes), 3),
    totalGzipMiB: round(toMiB(totalGzipBytes), 3)
  };
}

async function main() {
  const distDir = join(process.cwd(), "dist");
  const assetsDir = join(distDir, "assets");
  const indexHtmlPath = join(distDir, "index.html");
  const mainBundlePath = join(process.cwd(), "dist-electron", "main", "main.js");
  const preloadBundlePath = join(process.cwd(), "dist-electron", "main", "preload.cjs");

  const html = await readFile(indexHtmlPath, "utf8");
  const entryScripts = extractAssetNames(html, /<script[^>]+src="\.\/assets\/([^"]+)"/g);
  const preloadedScripts = extractAssetNames(html, /modulepreload[^>]+href="\.\/assets\/([^"]+)"/g);
  const stylesheets = extractAssetNames(html, /<link rel="stylesheet"[^>]+href="\.\/assets\/([^"]+)"/g);

  const allAssetNames = await readdir(assetsDir);
  const startupAssetNames = new Set([...entryScripts, ...preloadedScripts, ...stylesheets]);
  const deferredAssetNames = allAssetNames.filter((name) => !startupAssetNames.has(name));

  const startupAssets = [];
  for (const name of startupAssetNames) {
    startupAssets.push(await measureFile(join(assetsDir, name)));
  }
  startupAssets.sort((left, right) => right.bytes - left.bytes);

  const deferredAssets = [];
  for (const name of deferredAssetNames) {
    deferredAssets.push({
      ...(await measureFile(join(assetsDir, name))),
      category: classifyAsset(name)
    });
  }
  deferredAssets.sort((left, right) => right.bytes - left.bytes);

  const indexHtmlMetrics = await measureFile(indexHtmlPath);
  const mainBundleMetrics = await measureFile(mainBundlePath);
  const preloadBundleMetrics = await measureFile(preloadBundlePath);

  const startupJs = startupAssets.filter((entry) => entry.fileName.endsWith(".js"));
  const startupCss = startupAssets.filter((entry) => entry.fileName.endsWith(".css"));
  const deferredJs = deferredAssets.filter((entry) => entry.fileName.endsWith(".js"));

  const report = {
    capturedAt: new Date().toISOString(),
    version: process.env.npm_package_version ?? null,
    distDir,
    startup: {
      indexHtml: indexHtmlMetrics,
      scripts: summarizeAssets(startupJs),
      stylesheets: summarizeAssets(startupCss),
      total: summarizeAssets(startupAssets),
      assets: startupAssets
    },
    deferred: {
      scripts: summarizeAssets(deferredJs),
      total: summarizeAssets(deferredAssets),
      assets: deferredAssets
    },
    mainProcess: {
      main: mainBundleMetrics,
      preload: preloadBundleMetrics,
      total: summarizeAssets([mainBundleMetrics, preloadBundleMetrics])
    },
    notes: [
      "Startup payload is derived from dist/index.html entry script, modulepreload, and stylesheet references.",
      "Deferred assets are dist/assets files not referenced by index.html and are expected to load on demand.",
      "Gzip sizes are computed locally for regression tracking; packaged transfer sizes may differ slightly."
    ]
  };

  const outputDir = join(process.cwd(), "artifacts", "benchmark");
  await mkdir(outputDir, { recursive: true });
  const outputPath = join(outputDir, `startup-${nowTag()}.json`);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({ outputPath, report }, null, 2));
}

main().catch((error) => {
  console.error(`[bench:startup] fatal: ${error.message}`);
  process.exitCode = 1;
});

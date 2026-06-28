import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

import { _electron as electron } from "playwright";
import electronPath from "electron";

const outputPath = resolve("docs/assets/social-preview.png");
const screenshotPath = resolve("docs/assets/screenshots/terminal-workspace.png");
const outputWidth = 1280;
const outputHeight = 640;

function cssUrl(filePath) {
  return pathToFileURL(filePath).href.replace(/'/g, "%27");
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=${outputWidth}, initial-scale=1" />
    <style>
      :root {
        color-scheme: dark;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        width: ${outputWidth}px;
        height: ${outputHeight}px;
        overflow: hidden;
        background: #071018;
      }

      .frame {
        position: relative;
        width: ${outputWidth}px;
        height: ${outputHeight}px;
        isolation: isolate;
        background:
          radial-gradient(circle at 78% 16%, rgba(70, 219, 170, 0.2), transparent 26%),
          radial-gradient(circle at 22% 4%, rgba(73, 117, 255, 0.24), transparent 34%),
          linear-gradient(135deg, #071018 0%, #0b1420 54%, #111924 100%);
      }

      .screenshot-bg,
      .screenshot-card {
        background-image: url('${cssUrl(screenshotPath)}');
        background-size: cover;
        background-position: center;
      }

      .screenshot-bg {
        position: absolute;
        inset: -36px;
        z-index: -2;
        filter: blur(5px) saturate(1.08);
        opacity: 0.42;
        transform: scale(1.04);
      }

      .vignette {
        position: absolute;
        inset: 0;
        z-index: -1;
        background:
          linear-gradient(90deg, rgba(5, 11, 17, 0.94) 0%, rgba(5, 11, 17, 0.82) 38%, rgba(5, 11, 17, 0.2) 100%),
          linear-gradient(180deg, rgba(5, 11, 17, 0.2) 0%, rgba(5, 11, 17, 0.86) 100%);
      }

      .content {
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-columns: 472px 1fr;
        gap: 40px;
        padding: 62px 64px 56px;
      }

      .copy {
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-width: 0;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 34px;
        color: #c9f8e5;
        font-size: 24px;
        font-weight: 800;
        letter-spacing: 0.02em;
      }

      .brand-mark {
        display: grid;
        width: 42px;
        height: 42px;
        place-items: center;
        border: 1px solid rgba(107, 255, 204, 0.4);
        border-radius: 12px;
        background:
          linear-gradient(135deg, rgba(74, 222, 128, 0.22), rgba(34, 211, 238, 0.12)),
          rgba(11, 19, 28, 0.92);
        color: #6bffcc;
        box-shadow: 0 12px 34px rgba(17, 185, 129, 0.22);
        font-family: "Cascadia Mono", "SFMono-Regular", Consolas, monospace;
        font-size: 21px;
        font-weight: 900;
      }

      h1 {
        margin: 0;
        color: #f5fbff;
        font-size: 62px;
        line-height: 0.98;
        letter-spacing: -0.055em;
      }

      .subtitle {
        margin: 26px 0 0;
        color: #b7c7d6;
        font-size: 25px;
        line-height: 1.32;
        letter-spacing: -0.015em;
      }

      .features {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 34px;
      }

      .pill {
        border: 1px solid rgba(147, 197, 253, 0.26);
        border-radius: 999px;
        padding: 10px 14px;
        background: rgba(12, 24, 36, 0.72);
        color: #dcecff;
        font-size: 16px;
        font-weight: 700;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
      }

      .screenshot-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
      }

      .screenshot-card {
        width: 704px;
        height: 440px;
        border: 1px solid rgba(148, 163, 184, 0.34);
        border-radius: 24px;
        background-size: cover;
        background-position: center;
        box-shadow:
          0 32px 80px rgba(0, 0, 0, 0.56),
          0 0 0 1px rgba(255, 255, 255, 0.04),
          inset 0 1px 0 rgba(255, 255, 255, 0.08);
        transform: perspective(1200px) rotateY(-6deg) rotateX(2deg);
      }

      .glow-line {
        position: absolute;
        right: 90px;
        bottom: 54px;
        width: 420px;
        height: 2px;
        border-radius: 999px;
        background: linear-gradient(90deg, transparent, rgba(94, 234, 212, 0.8), transparent);
        opacity: 0.9;
      }
    </style>
  </head>
  <body>
    <main class="frame">
      <div class="screenshot-bg"></div>
      <div class="vignette"></div>
      <section class="content">
        <div class="copy">
          <div class="brand">
            <span class="brand-mark">&gt;_</span>
            <span>TermDock</span>
          </div>
          <h1>SSH + SFTP Workspace</h1>
          <p class="subtitle">A local-first server workbench for terminal sessions, file transfer, health checks, and safer operations.</p>
          <div class="features" aria-label="Features">
            <span class="pill">Multi-tab SSH</span>
            <span class="pill">SFTP Transfers</span>
            <span class="pill">Server Health</span>
            <span class="pill">Command Guardrails</span>
          </div>
        </div>
        <div class="screenshot-wrap">
          <div class="screenshot-card" aria-hidden="true"></div>
        </div>
      </section>
      <div class="glow-line"></div>
    </main>
  </body>
</html>`;

await mkdir(dirname(outputPath), { recursive: true });

const launchEnv = { ...process.env };
delete launchEnv.ELECTRON_RUN_AS_NODE;

const app = await electron.launch({
  executablePath: electronPath,
  args: ["."],
  env: {
    ...launchEnv,
    TERMDOCK_DISABLE_GPU: "1",
    TERMDOCK_OPEN_DEVTOOLS: "0"
  }
});
try {
  const page = await app.firstWindow();
  await page.setViewportSize({
    width: outputWidth,
    height: outputHeight
  });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`Generated ${outputPath}`);
} finally {
  await app.close();
}

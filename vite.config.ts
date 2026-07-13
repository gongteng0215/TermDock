import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function resolveManualChunk(id: string): string | undefined {
  const normalized = id.replace(/\\/g, "/");

  if (normalized.includes("/node_modules/react/") || normalized.includes("/node_modules/react-dom/")) {
    return "vendor-react";
  }
  if (normalized.includes("/node_modules/@xterm/")) {
    return "vendor-xterm";
  }
  if (normalized.includes("/node_modules/lucide-react/")) {
    return "vendor-icons";
  }
  if (normalized.includes("/node_modules/jszip/")) {
    return "vendor-jszip";
  }

  // Shared leaf modules pulled by both terminal and workbench chunks. Keeping
  // them in dedicated chunks avoids a renderer-terminal <-> renderer-workbench
  // circular chunk dependency.
  if (normalized.endsWith("/src/renderer/components/ui-icon.tsx")) {
    return "renderer-shared";
  }
  if (normalized.endsWith("/src/renderer/components/modal-shell.tsx")) {
    return "renderer-shared";
  }
  if (normalized.endsWith("/src/renderer/use-dismissable-layer.ts")) {
    return "renderer-shared";
  }
  if (normalized.endsWith("/src/renderer/dangerous-command-guard.ts")) {
    return "renderer-guard";
  }

  if (normalized.endsWith("/src/renderer/components/terminal-workspace.tsx")) {
    return "renderer-terminal";
  }

  if (
    normalized.endsWith("/src/renderer/components/settings-modal-shell.tsx") ||
    normalized.endsWith("/src/renderer/components/settings-modal-content.tsx") ||
    normalized.endsWith("/src/renderer/components/settings-sections.tsx") ||
    normalized.endsWith("/src/renderer/settings-section-props.ts") ||
    normalized.endsWith("/src/renderer/use-dangerous-command-settings-view-models.ts")
  ) {
    return "renderer-settings";
  }

  if (
    normalized.endsWith("/src/renderer/components/workbench-shell.tsx") ||
    normalized.endsWith("/src/renderer/components/workbench-panels.tsx") ||
    normalized.endsWith("/src/renderer/components/workbench-sidebars.tsx") ||
    normalized.endsWith("/src/renderer/components/workbench-context-menus.tsx") ||
    normalized.endsWith("/src/renderer/use-command-history-view-models.ts") ||
    normalized.endsWith("/src/renderer/use-dangerous-command-approval-flow.ts") ||
    normalized.endsWith("/src/renderer/use-port-forwarding-view-models.ts") ||
    normalized.endsWith("/src/renderer/use-server-health-monitor.ts") ||
    normalized.endsWith("/src/renderer/use-session-grouping-view-models.ts") ||
    normalized.endsWith("/src/renderer/use-sftp-transfer-runtime.ts")
  ) {
    return "renderer-workbench";
  }

  return undefined;
}

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5273,
    strictPort: true
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          return resolveManualChunk(id);
        }
      }
    }
  }
});

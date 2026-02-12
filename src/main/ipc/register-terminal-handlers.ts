import { ipcMain } from "electron";

import { TerminalService } from "../terminal/terminal-service.js";

export function registerTerminalHandlers(terminalService: TerminalService): void {
  ipcMain.handle(
    "terminal:connect",
    async (event, tabId: string, sessionId: string) =>
      terminalService.connect(tabId, sessionId, event.sender)
  );
  ipcMain.handle("terminal:write", async (_event, tabId: string, data: string) =>
    terminalService.write(tabId, data)
  );
  ipcMain.handle(
    "terminal:resize",
    async (_event, tabId: string, cols: number, rows: number) =>
      terminalService.resize(tabId, cols, rows)
  );
  ipcMain.handle("terminal:close", async (_event, tabId: string) =>
    terminalService.close(tabId)
  );
}


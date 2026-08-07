import { ipcMain } from "electron";

import type { CreatePortForwardInput } from "../../shared/terminal.js";
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
    "terminal:respondHostKeyPrompt",
    async (_event, tabId: string, promptId: string, decision: "trust" | "replace" | "reject") =>
      terminalService.respondHostKeyPrompt(tabId, promptId, decision)
  );
  ipcMain.handle(
    "terminal:respondKeyboardInteractivePrompt",
    async (_event, tabId: string, promptId: string, responses: string[]) =>
      terminalService.respondKeyboardInteractivePrompt(tabId, promptId, responses)
  );
  ipcMain.handle(
    "terminal:resize",
    async (_event, tabId: string, cols: number, rows: number) =>
      terminalService.resize(tabId, cols, rows)
  );
  ipcMain.handle("terminal:getServerHealth", async (_event, tabId: string) =>
    terminalService.getServerHealth(tabId)
  );
  ipcMain.handle("terminal:getServerProcesses", async (_event, tabId: string) =>
    terminalService.getServerProcesses(tabId)
  );
  ipcMain.handle("terminal:listPortForwards", async (_event, tabId: string) =>
    terminalService.listPortForwards(tabId)
  );
  ipcMain.handle(
    "terminal:listPortForwardEvents",
    async (_event, tabId: string, limit?: number) =>
      terminalService.listPortForwardEvents(tabId, limit)
  );
  ipcMain.handle(
    "terminal:createPortForward",
    async (_event, tabId: string, input: CreatePortForwardInput) =>
      terminalService.createPortForward(tabId, input)
  );
  ipcMain.handle("terminal:removePortForward", async (_event, tabId: string, forwardId: string) =>
    terminalService.removePortForward(tabId, forwardId)
  );
  ipcMain.handle("terminal:close", async (_event, tabId: string) =>
    terminalService.close(tabId)
  );
}

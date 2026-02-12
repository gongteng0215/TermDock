import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";

import type {
  SessionCreateInput,
  SessionRecord,
  SessionTestConnectionResult,
  SessionUpdateInput
} from "../shared/session.js";
import type { TerminalEvent } from "../shared/terminal.js";

const api = {
  sessions: {
    list: () => ipcRenderer.invoke("sessions:list") as Promise<SessionRecord[]>,
    create: (input: SessionCreateInput) =>
      ipcRenderer.invoke("sessions:create", input) as Promise<SessionRecord>,
    testConnection: (input: SessionCreateInput) =>
      ipcRenderer.invoke("sessions:testConnection", input) as Promise<SessionTestConnectionResult>,
    update: (id: string, patch: SessionUpdateInput) =>
      ipcRenderer.invoke("sessions:update", id, patch) as Promise<SessionRecord>,
    remove: (id: string) => ipcRenderer.invoke("sessions:delete", id) as Promise<void>
  },
  system: {
    pickPrivateKey: () =>
      ipcRenderer.invoke("system:pickPrivateKey") as Promise<string | null>
  },
  terminal: {
    connect: (tabId: string, sessionId: string) =>
      ipcRenderer.invoke("terminal:connect", tabId, sessionId) as Promise<void>,
    write: (tabId: string, data: string) =>
      ipcRenderer.invoke("terminal:write", tabId, data) as Promise<void>,
    resize: (tabId: string, cols: number, rows: number) =>
      ipcRenderer.invoke("terminal:resize", tabId, cols, rows) as Promise<void>,
    close: (tabId: string) =>
      ipcRenderer.invoke("terminal:close", tabId) as Promise<void>,
    onEvent: (listener: (event: TerminalEvent) => void) => {
      const wrapped = (
        _event: IpcRendererEvent,
        payload: TerminalEvent
      ) => {
        listener(payload);
      };
      ipcRenderer.on("terminal:event", wrapped);
      return () => {
        ipcRenderer.removeListener("terminal:event", wrapped);
      };
    }
  }
};

contextBridge.exposeInMainWorld("termdock", api);

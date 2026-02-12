import type {
  SessionCreateInput,
  SessionRecord,
  SessionTestConnectionResult,
  SessionUpdateInput
} from "../shared/session";
import type { TerminalEvent } from "../shared/terminal";

interface TermDockApi {
  sessions: {
    list: () => Promise<SessionRecord[]>;
    create: (input: SessionCreateInput) => Promise<SessionRecord>;
    testConnection: (input: SessionCreateInput) => Promise<SessionTestConnectionResult>;
    update: (id: string, patch: SessionUpdateInput) => Promise<SessionRecord>;
    remove: (id: string) => Promise<void>;
  };
  system: {
    pickPrivateKey: () => Promise<string | null>;
  };
  terminal: {
    connect: (tabId: string, sessionId: string) => Promise<void>;
    write: (tabId: string, data: string) => Promise<void>;
    resize: (tabId: string, cols: number, rows: number) => Promise<void>;
    close: (tabId: string) => Promise<void>;
    onEvent: (listener: (event: TerminalEvent) => void) => () => void;
  };
}

declare global {
  interface Window {
    termdock: TermDockApi;
  }
}

export {};

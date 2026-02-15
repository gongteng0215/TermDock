import type {
  SessionCreateInput,
  SessionRecord,
  SessionTestConnectionResult,
  SessionUpdateInput
} from "../shared/session";
import type {
  SftpDirectoryListResult,
  SftpEntryKind,
  SftpTransferEvent
} from "../shared/sftp";
import type { TerminalEvent } from "../shared/terminal";

interface TermDockApi {
  app: {
    onOpenSettings: (listener: () => void) => () => void;
  };
  sessions: {
    list: () => Promise<SessionRecord[]>;
    create: (input: SessionCreateInput) => Promise<SessionRecord>;
    testConnection: (input: SessionCreateInput) => Promise<SessionTestConnectionResult>;
    update: (id: string, patch: SessionUpdateInput) => Promise<SessionRecord>;
    remove: (id: string) => Promise<void>;
  };
  system: {
    pickPrivateKey: () => Promise<string | null>;
    pickUploadFile: () => Promise<string | null>;
    pickDownloadTarget: (defaultName: string) => Promise<string | null>;
    pickOpenProgram: () => Promise<string | null>;
    createTempOpenFilePath: (defaultName: string) => Promise<string>;
    openLocalPath: (localPath: string, preferredProgramPath?: string | null) => Promise<void>;
    expandUploadPaths: (
      inputPaths: string[]
    ) => Promise<
      Array<{
        localPath: string;
        relativeDirectory: string;
      }>
    >;
    getPathForDroppedFile: (file: File) => Promise<string | null>;
  };
  terminal: {
    connect: (tabId: string, sessionId: string) => Promise<void>;
    write: (tabId: string, data: string) => Promise<void>;
    resize: (tabId: string, cols: number, rows: number) => Promise<void>;
    close: (tabId: string) => Promise<void>;
    onEvent: (listener: (event: TerminalEvent) => void) => () => void;
  };
  sftp: {
    listDirectory: (tabId: string, path?: string) => Promise<SftpDirectoryListResult>;
    createDirectory: (tabId: string, parentPath: string, name: string) => Promise<void>;
    renamePath: (tabId: string, sourcePath: string, nextName: string) => Promise<void>;
    deletePath: (tabId: string, targetPath: string, kind: SftpEntryKind) => Promise<void>;
    uploadFile: (
      tabId: string,
      transferId: string,
      localPath: string,
      remoteDirectory: string
    ) => Promise<void>;
    cancelUpload: (tabId: string, transferId: string) => Promise<boolean>;
    cancelDownload: (tabId: string, transferId: string) => Promise<boolean>;
    downloadFile: (
      tabId: string,
      transferId: string,
      remotePath: string,
      localPath: string
    ) => Promise<void>;
    onTransferEvent: (listener: (event: SftpTransferEvent) => void) => () => void;
  };
}

declare global {
  interface Window {
    termdock: TermDockApi;
  }
}

export {};

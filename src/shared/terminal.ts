export type TerminalConnectionStatus = "connecting" | "connected" | "closed";

export type TerminalEvent =
  | {
      tabId: string;
      type: "output";
      data: string;
    }
  | {
      tabId: string;
      type: "status";
      status: TerminalConnectionStatus;
    }
  | {
      tabId: string;
      type: "error";
      message: string;
    };


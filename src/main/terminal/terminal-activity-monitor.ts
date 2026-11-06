import type { Client, ClientChannel } from "ssh2";
import { StringDecoder } from "node:string_decoder";

import type { TerminalActivity } from "../../shared/terminal.js";

const POLL_INTERVAL_MS = 2_000;
const RETRY_INTERVAL_MS = 10_000;
const QUERY_TIMEOUT_MS = 2_500;
const MAX_OUTPUT_BYTES = 512 * 1024;

// A separate, non-PTY channel observes the processes belonging to this SSH
// connection. Nothing is written into the user's shell or startup files.
// Wrapping in sh also works when the login shell uses a different syntax.
const ACTIVITY_COMMAND = `sh -c 'printf "__TD_ACTIVITY_PROBE__ %s\\n" "$$"; LC_ALL=C ps -eo pid=,ppid=,pgid=,tpgid=,tty=,stat=,comm='`;

interface ProcessEntry {
  pid: number;
  parentPid: number;
  groupId: number;
  foregroundGroupId: number;
  tty: string;
  state: string;
  command: string;
}

const SHELL_NAMES = new Set([
  "sh", "bash", "dash", "ash", "zsh", "ksh", "mksh", "yash", "fish",
  "csh", "tcsh", "nu", "xonsh", "pwsh"
]);

function hasTerminal(process: ProcessEntry): boolean {
  return process.tty !== "?" && process.tty !== "??" && process.tty !== "-";
}

function isLive(process: ProcessEntry): boolean {
  return !process.state.startsWith("Z") && !process.state.startsWith("X");
}

function readActivity(output: string): TerminalActivity {
  const probeMatch = /^__TD_ACTIVITY_PROBE__ (\d+)\s*$/m.exec(output);
  if (!probeMatch) return { status: "unknown" };

  const processes = new Map<number, ProcessEntry>();
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s*(\d+)\s+(\d+)\s+(-?\d+)\s+(-?\d+)\s+(\S+)\s+(\S+)\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const [, pid, parentPid, groupId, foregroundGroupId, tty, state, command] = match;
    processes.set(Number(pid), {
      pid: Number(pid), parentPid: Number(parentPid), groupId: Number(groupId),
      foregroundGroupId: Number(foregroundGroupId), tty, state, command
    });
  }

  let branch = processes.get(Number(probeMatch[1]));
  let terminalRoot: ProcessEntry | undefined;
  const visited = new Set<number>();
  while (branch && !visited.has(branch.pid)) {
    visited.add(branch.pid);
    const parent: ProcessEntry | undefined = processes.get(branch.parentPid);
    if (!parent) break;
    // Only a sibling PTY under the probe's own SSH server process is trusted.
    // Never guess from another login's prompt text or a machine-wide busy CPU.
    if (/^(?:sshd(?:-[\w]+)?|dropbear)(?:[:\s]|$)/.test(parent.command)) {
      const candidates = [...processes.values()].filter((entry) =>
        entry.parentPid === parent.pid && entry.pid !== branch?.pid && hasTerminal(entry) && isLive(entry)
      );
      if (candidates.length > 1) return { status: "unknown" };
      if (candidates.length === 1) {
        terminalRoot = candidates[0];
        break;
      }
      // Going above this connection could select a different user's session.
      return { status: "unknown" };
    }
    branch = parent;
  }
  if (!terminalRoot || terminalRoot.groupId <= 0 || terminalRoot.foregroundGroupId <= 0) {
    return { status: "unknown" };
  }

  const root = terminalRoot;
  const attached = [...processes.values()].filter((entry) =>
    entry.pid !== root.pid && entry.tty === root.tty && isLive(entry)
  );
  const foreground = attached.find((entry) => entry.groupId === root.foregroundGroupId);
  if (root.groupId !== root.foregroundGroupId || attached.length > 0) {
    return { status: "busy", command: foreground?.command ?? attached[0]?.command };
  }
  // `exec python ...` replaces the original shell but is still a running job.
  const rootName = root.command.replace(/^-/, "");
  if (/^[RDTt]/.test(root.state)) return { status: "busy", command: root.command };
  return SHELL_NAMES.has(rootName)
    ? { status: "idle" }
    : { status: "busy", command: root.command };
}

export class TerminalActivityMonitor {
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private cancelQuery: (() => void) | null = null;
  private lastActivity: TerminalActivity | null = null;

  constructor(
    private readonly client: Client,
    private readonly isCurrent: () => boolean,
    private readonly onActivity: (activity: TerminalActivity) => void
  ) {}

  start(): void {
    if (!this.stopped && !this.timer && !this.cancelQuery) void this.poll();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.cancelQuery?.();
  }

  private async poll(): Promise<void> {
    if (this.stopped || !this.isCurrent()) return;
    let activity: TerminalActivity;
    try {
      activity = readActivity(await this.query());
    } catch {
      activity = { status: "unknown" };
    }
    if (this.stopped || !this.isCurrent()) return;
    if (this.lastActivity?.status !== activity.status || this.lastActivity?.command !== activity.command) {
      this.lastActivity = activity;
      this.onActivity(activity);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.poll();
    }, activity.status === "unknown" ? RETRY_INTERVAL_MS : POLL_INTERVAL_MS);
  }

  private query(): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let channel: ClientChannel | null = null;
      let output = "";
      let outputBytes = 0;
      const decoder = new StringDecoder("utf8");
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.cancelQuery = null;
        if (error) {
          channel?.close();
          reject(error);
        } else resolve(output);
      };
      const timeout = setTimeout(() => finish(new Error("Activity query timed out.")), QUERY_TIMEOUT_MS);
      this.cancelQuery = () => finish(new Error("Activity monitor stopped."));
      const onChannel = (error: Error | undefined, stream: ClientChannel) => {
        if (settled || this.stopped || !this.isCurrent()) {
          stream?.close();
          finish(new Error("Activity monitor stopped."));
          return;
        }
        if (error) { finish(error); return; }
        channel = stream;
        stream.on("data", (chunk: Buffer) => {
          if (settled) return;
          outputBytes += chunk.length;
          if (outputBytes > MAX_OUTPUT_BYTES) {
            finish(new Error("Activity query output limit exceeded."));
            return;
          }
          output += decoder.write(chunk);
        });
        stream.stderr.resume();
        stream.once("error", finish);
        stream.once("close", (code: number | null) => {
          output += decoder.end();
          finish(code === 0 ? undefined : new Error("Activity query unavailable."));
        });
      };
      try {
        this.client.exec(ACTIVITY_COMMAND, onChannel);
      } catch (error) {
        finish(error instanceof Error ? error : new Error("Activity query unavailable."));
      }
    });
  }
}

import {
  Activity,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  ChevronLeft,
  Download,
  FileText,
  FolderOpen,
  History,
  Keyboard,
  Menu,
  Minus,
  Palette,
  Plug,
  Plus,
  RefreshCw,
  Server,
  Settings,
  Share2,
  ShieldCheck,
  Stethoscope,
  TerminalSquare,
  Upload,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type UiIconName =
  | "settings"
  | "refresh"
  | "details"
  | "chevronLeft"
  | "arrowUp"
  | "upload"
  | "download"
  | "history"
  | "menu"
  | "close"
  | "plus"
  | "minus"
  | "sessions"
  | "health"
  | "sftp"
  | "transfers"
  | "terminal"
  | "connection"
  | "workspace"
  | "safety"
  | "hotkeys"
  | "fileOpening"
  | "portForwarding"
  | "diagnostics";

const UI_ICONS: Record<UiIconName, LucideIcon> = {
  settings: Settings,
  refresh: RefreshCw,
  details: BarChart3,
  chevronLeft: ChevronLeft,
  arrowUp: ArrowUp,
  upload: Upload,
  download: Download,
  history: History,
  menu: Menu,
  close: X,
  plus: Plus,
  minus: Minus,
  sessions: Server,
  health: Activity,
  sftp: FolderOpen,
  transfers: ArrowUpDown,
  terminal: TerminalSquare,
  connection: Plug,
  workspace: Palette,
  safety: ShieldCheck,
  hotkeys: Keyboard,
  fileOpening: FileText,
  portForwarding: Share2,
  diagnostics: Stethoscope
};

export function UiIcon({ name }: { name: UiIconName }) {
  const Icon = UI_ICONS[name];
  return <Icon aria-hidden="true" className="ui-icon" strokeWidth={1.9} />;
}

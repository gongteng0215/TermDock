import {
  ArrowUp,
  BarChart3,
  ChevronLeft,
  Download,
  History,
  Menu,
  Minus,
  Plus,
  RefreshCw,
  Settings,
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
  | "minus";

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
  minus: Minus
};

export function UiIcon({ name }: { name: UiIconName }) {
  const Icon = UI_ICONS[name];
  return <Icon aria-hidden="true" className="ui-icon" strokeWidth={1.9} />;
}

import {
  ArrowUp,
  ChevronLeft,
  Download,
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
  | "chevronLeft"
  | "arrowUp"
  | "upload"
  | "download"
  | "menu"
  | "close"
  | "plus"
  | "minus";

const UI_ICONS: Record<UiIconName, LucideIcon> = {
  settings: Settings,
  refresh: RefreshCw,
  chevronLeft: ChevronLeft,
  arrowUp: ArrowUp,
  upload: Upload,
  download: Download,
  menu: Menu,
  close: X,
  plus: Plus,
  minus: Minus
};

export function UiIcon({ name }: { name: UiIconName }) {
  const Icon = UI_ICONS[name];
  return <Icon aria-hidden="true" className="ui-icon" strokeWidth={1.9} />;
}

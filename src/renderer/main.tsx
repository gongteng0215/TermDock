import React from "react";
import { createRoot } from "react-dom/client";
import "@xterm/xterm/css/xterm.css";
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/600.css";
import "@fontsource/rajdhani/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";

import { App } from "./App";
import { applyUiAccentToDocument } from "./ui-accent";
import { applyUiDensityToDocument } from "./ui-density";
import { applyUiThemeToDocument } from "./ui-theme";
import {
  readUiAccentId,
  readUiDensityId,
  readUiThemeId
} from "./workbench-ui-preferences";
import "./styles/themes.css";
import "./styles.css";
import "./styles/workbench-shell.css";
import "./styles/cockpit-shell.css";
import "./styles/terminal.css";
import "./styles/cockpit-industrial.css";

applyUiThemeToDocument(readUiThemeId());
applyUiAccentToDocument(readUiAccentId());
applyUiDensityToDocument(readUiDensityId());

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

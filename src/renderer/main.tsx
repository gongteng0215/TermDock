import React from "react";
import { createRoot } from "react-dom/client";
import "@xterm/xterm/css/xterm.css";

import { App } from "./App";
import { applyUiAccentToDocument } from "./ui-accent";
import { applyUiDensityToDocument } from "./ui-density";
import { readUiAccentId, readUiDensityId } from "./workbench-ui-preferences";
import "./styles.css";
import "./styles/workbench-shell.css";
import "./styles/terminal.css";

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

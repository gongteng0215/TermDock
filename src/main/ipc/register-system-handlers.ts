import { dialog, ipcMain } from "electron";

export function registerSystemHandlers(): void {
  ipcMain.handle("system:pickPrivateKey", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select SSH Private Key",
      buttonLabel: "Select",
      properties: ["openFile"],
      filters: [
        {
          name: "SSH Private Key",
          extensions: ["pem", "ppk", "key", "rsa", "ed25519"]
        },
        {
          name: "All Files",
          extensions: ["*"]
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });
}


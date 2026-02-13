import { dialog, ipcMain } from "electron";

export function registerSystemHandlers(): void {
  ipcMain.handle("system:pickPrivateKey", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select SSH Private Key",
      buttonLabel: "Select",
      properties: ["openFile", "showHiddenFiles"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("system:pickUploadFile", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select File to Upload",
      buttonLabel: "Upload",
      properties: ["openFile"],
      filters: [
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

  ipcMain.handle("system:pickDownloadTarget", async (_event, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      title: "Save Downloaded File",
      buttonLabel: "Save",
      defaultPath: defaultName
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  });
}

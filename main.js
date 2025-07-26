const { app, BrowserWindow } = require("electron");
const path = require("path");
const { ipcMain } = require("electron");
ipcMain.on("pcLockUpdate", (_evt, locked) => {
  BrowserWindow.getAllWindows()[0].webContents.send("lockStatus", locked);
});


function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    kiosk: true,
    fullscreen: true,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadFile("index.html");
  win.on("blur", () => win.focus()); // prevent losing focus
}

app.whenReady().then(createWindow);

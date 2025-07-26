const { contextBridge, ipcRenderer } = require("electron");

const Store = require("electron-store");
const store = new Store();
const io = require("socket.io-client")("REACT_APP_BACKEND_URL");
io.on("pcLockUpdate", ({ pc_id, locked }) => {
  ipcRenderer.send("pcLockUpdate", locked);
});


contextBridge.exposeInMainWorld("pcLock", {
  get: () => {
    return localStorage.getItem("locked") === "true";
  },
  set: (val) => {
    localStorage.setItem("locked", String(val));
    ipcRenderer.send("lockStatusChanged", val);
  },
  subscribe: (callback) => {
    ipcRenderer.on("lockStatus", (_event, val) => {
      callback(val);
    });
  }
});

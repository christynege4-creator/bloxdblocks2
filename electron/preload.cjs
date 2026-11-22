const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("BloxdDesktop", Object.freeze({
    saveWorkspace(contents, suggestedName) {
        return ipcRenderer.invoke("workspace:save", contents, suggestedName);
    }
}));

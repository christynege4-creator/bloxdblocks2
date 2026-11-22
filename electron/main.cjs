const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { readFile } = require("node:fs/promises");
const { app, BrowserWindow, dialog, shell } = require("electron");

const MAX_WORKSPACE_BYTES = 10 * 1024 * 1024;
let mainWindow;
let queuedWorkspacePath;

function findWorkspacePath(args) {
    const filePath = [...args].reverse().find(argument =>
        typeof argument === "string" &&
        path.extname(argument).toLowerCase() === ".bb"
    );
    return filePath ? path.resolve(filePath) : undefined;
}

async function openWorkspaceFile(filePath) {
    if (!filePath || path.extname(filePath).toLowerCase() !== ".bb") return;
    if (!mainWindow) {
        queuedWorkspacePath = filePath;
        createWindow();
        return;
    }
    if (mainWindow.webContents.isLoading()) {
        queuedWorkspacePath = filePath;
        return;
    }

    mainWindow.show();
    mainWindow.focus();
    try {
        const contents = await readFile(filePath);
        if (contents.length > MAX_WORKSPACE_BYTES) {
            throw new Error("The workspace file is larger than 10 MB.");
        }
        const fileName = path.basename(filePath);
        await mainWindow.webContents.executeJavaScript(
            `window.loadWorkspaceContents(${JSON.stringify(contents.toString("utf8"))}, ${JSON.stringify(fileName)})`
        );
    } catch (error) {
        dialog.showErrorBox(
            "Could not open BloxdBlocks Block File",
            `${path.basename(filePath)}: ${error.message}`
        );
    }
}

function createWindow() {
    const appRoot = path.resolve(__dirname, "..");
    const appRootUrl = pathToFileURL(`${appRoot}${path.sep}`).href;
    const window = new BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 900,
        minHeight: 640,
        show: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    mainWindow = window;
    window.once("ready-to-show", () => window.show());
    window.on("closed", () => {
        if (mainWindow === window) mainWindow = null;
    });
    window.webContents.on("did-finish-load", () => {
        if (queuedWorkspacePath) {
            const filePath = queuedWorkspacePath;
            queuedWorkspacePath = undefined;
            void openWorkspaceFile(filePath);
        }
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith(appRootUrl)) return { action: "allow" };
        if (url.startsWith("https://") || url.startsWith("http://")) {
            shell.openExternal(url);
        }
        return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
        if (url.startsWith(appRootUrl)) return;
        event.preventDefault();
        if (url.startsWith("https://") || url.startsWith("http://")) {
            shell.openExternal(url);
        }
    });

    window.loadFile(path.join(__dirname, "..", "bloxdcodetool.html"));
}

const initialWorkspacePath = findWorkspacePath(process.argv.slice(1));
if (initialWorkspacePath) queuedWorkspacePath = initialWorkspacePath;

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on("second-instance", (_event, argv) => {
        const filePath = findWorkspacePath(argv);
        if (filePath) {
            void openWorkspaceFile(filePath);
        } else if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        createWindow();
        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") app.quit();
    });
}

const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

let apiProcess = null;
let mainWindow = null;

app.setName("PowerBoard");

const legacyAppName = "Aufgabenboard";

function isPackagedApp() {
  return app.isPackaged;
}

function getResourcePath(...parts) {
  return isPackagedApp() ? path.join(process.resourcesPath, ...parts) : path.join(app.getAppPath(), ...parts);
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
          return;
        }

        reject(new Error("No free port found."));
      });
    });
  });
}

function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    function ping() {
      const req = http.get(url, response => {
        response.resume();
        resolve();
      });

      req.on("error", error => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(error);
          return;
        }

        setTimeout(ping, 150);
      });

      req.setTimeout(1000, () => {
        req.destroy(new Error("Server start timed out."));
      });
    }

    ping();
  });
}

async function startApiServer() {
  const port = await findFreePort();
  const appDataDir = path.join(app.getPath("userData"), "data");
  const legacyDataDir = path.join(app.getPath("appData"), legacyAppName, "data");
  const distDir = getResourcePath("dist");
  const serverBinary = getResourcePath("server", process.platform === "win32" ? "todo-api.exe" : "todo-api");
  const env = {
    ...process.env,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: String(port),
    TODO_APP_DATA_DIR: appDataDir,
    TODO_APP_DIST_DIR: distDir,
  };

  if (!fs.existsSync(appDataDir) && fs.existsSync(legacyDataDir)) {
    fs.cpSync(legacyDataDir, appDataDir, { recursive: true });
  }

  fs.mkdirSync(appDataDir, { recursive: true });

  if (isPackagedApp()) {
    apiProcess = spawn(serverBinary, [], {
      env,
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    apiProcess = spawn("bun", ["src/index.ts"], {
      cwd: app.getAppPath(),
      env,
      stdio: "ignore",
      windowsHide: true,
    });
  }

  apiProcess.on("exit", () => {
    apiProcess = null;
  });

  await waitForServer(`http://127.0.0.1:${port}/api/lists`);

  return `http://127.0.0.1:${port}`;
}

function stopApiServer() {
  if (apiProcess && !apiProcess.killed) {
    apiProcess.kill();
  }
}

async function createWindow() {
  const appUrl = await startApiServer();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    title: "PowerBoard",
    backgroundColor: "#f8fafc",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(appUrl);
}

app.whenReady().then(createWindow).catch(error => {
  console.error(error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

app.on("before-quit", stopApiServer);

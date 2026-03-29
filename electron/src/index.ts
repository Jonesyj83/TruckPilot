import type { MenuItemConstructorOptions } from "electron";
import {
    app,
    BrowserWindow,
    dialog,
    Menu,
    MenuItem,
    ipcMain,
    shell,
} from "electron";
import unhandled from "electron-unhandled";
import { spawn, type ChildProcess } from "child_process";
import * as dgram from "dgram";
import { existsSync } from "fs";
import http from "http";
import net from "net";
import path from "path";

unhandled();
const devServerUrl = process.env.ELECTRON_RENDERER_URL?.trim() || null;
const DEFAULT_APP_PORT = 8628;

const appMenuBarMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [
    { role: process.platform === "darwin" ? "appMenu" : "fileMenu" },
    { role: "viewMenu" },
];

let mainWindow: BrowserWindow | null = null;
let nuxtServerProcess: ChildProcess | null = null;
let currentPort = 0;
let isQuitting = false;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    });

    app.whenReady().then(bootstrap).catch((error) => {
        const message =
            error instanceof Error ? error.stack ?? error.message : String(error);
        dialog.showErrorBox("TruckPilot startup failed", message);
        app.quit();
    });
}

async function bootstrap() {
    Menu.setApplicationMenu(Menu.buildFromTemplate(appMenuBarMenuTemplate));

    if (devServerUrl) {
        currentPort = getPortFromUrl(devServerUrl) ?? 3000;
    } else {
        currentPort = await getAvailablePort(DEFAULT_APP_PORT);
        await startNuxtServer(currentPort);
        await waitForHttpServer(`http://127.0.0.1:${currentPort}`);
    }

    await createMainWindow();
}

app.on("before-quit", () => {
    isQuitting = true;
    stopNuxtServer();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        return;
    }
    await bootstrap();
});

async function createMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) return;

    const iconPath = path.join(
        app.getAppPath(),
        "assets",
        process.platform === "win32"
            ? "TruckPilotIcon.ico"
            : "TruckPilotIcon.png",
    );
    const preloadPath = path.join(app.getAppPath(), "build", "src", "preload.js");

    mainWindow = new BrowserWindow({
        title: "TruckPilot",
        width: 1000,
        height: 800,
        show: false,
        icon: existsSync(iconPath) ? iconPath : undefined,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: preloadPath,
        },
    });

    mainWindow.once("ready-to-show", () => {
        mainWindow?.show();
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });

    const appUrl = devServerUrl ?? `http://127.0.0.1:${currentPort}`;
    await mainWindow.loadURL(appUrl);

    if (devServerUrl) {
        mainWindow.webContents.openDevTools({ mode: "detach" });
    }
}

function getNuxtServerEntry() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, "app-output", "server", "index.mjs");
    }

    const bundledEntry = path.join(app.getAppPath(), ".output", "server", "index.mjs");
    if (existsSync(bundledEntry)) return bundledEntry;

    return path.join(app.getAppPath(), "..", ".output", "server", "index.mjs");
}

async function startNuxtServer(port: number) {
    if (nuxtServerProcess) return;

    const serverEntry = getNuxtServerEntry();
    if (!existsSync(serverEntry)) {
        throw new Error(`Nuxt server entry not found: ${serverEntry}`);
    }

    nuxtServerProcess = spawn(process.execPath, [serverEntry], {
        cwd: path.dirname(serverEntry),
        env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: "1",
            HOST: "0.0.0.0",
            NITRO_HOST: "0.0.0.0",
            PORT: String(port),
            NITRO_PORT: String(port),
            NODE_ENV: "production",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
    });

    nuxtServerProcess.stdout?.on("data", (data) => {
        console.log(`[Nuxt] ${String(data).trimEnd()}`);
    });

    nuxtServerProcess.stderr?.on("data", (data) => {
        console.error(`[Nuxt] ${String(data).trimEnd()}`);
    });

    nuxtServerProcess.once("exit", (code, signal) => {
        nuxtServerProcess = null;
        if (!isQuitting) {
            console.error(
                `Nuxt server exited unexpectedly (code=${code}, signal=${signal})`,
            );
        }
    });
}

function stopNuxtServer() {
    if (!nuxtServerProcess || nuxtServerProcess.killed) return;
    nuxtServerProcess.kill();
    nuxtServerProcess = null;
}

function waitForHttpServer(url: string, timeoutMs = 30000) {
    return new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;

        const attempt = () => {
            const request = http.get(url, (response) => {
                response.resume();
                resolve();
            });

            request.on("error", () => {
                if (Date.now() >= deadline) {
                    reject(new Error(`Timed out waiting for ${url}`));
                    return;
                }
                setTimeout(attempt, 250);
            });

            request.setTimeout(2000, () => {
                request.destroy();
            });
        };

        attempt();
    });
}

function getPortFromUrl(url: string) {
    try {
        const parsed = new URL(url);
        if (parsed.port) return Number(parsed.port);
        return parsed.protocol === "https:" ? 443 : 80;
    } catch {
        return null;
    }
}

async function getAvailablePort(startingPort: number): Promise<number> {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.once("error", (err: any) => {
            if (err.code === "EADDRINUSE") {
                resolve(getAvailablePort(startingPort + 1));
            } else {
                console.error("Unexpected server error:", err);
            }
        });

        server.listen(startingPort, "0.0.0.0", () => {
            const address = server.address();
            if (address && typeof address !== "string") {
                const port = address.port;

                server.close();

                console.log(`Port ${port} confirmed available.`);
                resolve(port);
            }
        });
    });
}

function resolveTelemetryUrl(target: string | "localhost") {
    if (/^https?:\/\//i.test(target)) {
        return target;
    }

    return `http://${target}:31377/api/ets2/telemetry`;
}

async function fetchTelemetry(target: string | "localhost") {
    try {
        const response = await fetch(resolveTelemetryUrl(target));
        if (!response.ok) {
            console.warn(
                `Telemetry fetch failed with status ${response.status}: ${response.statusText}`,
            );

            return null;
        }

        return await response.json();
    } catch {
        return null;
    }
}

/**
 * Ipc Handlers
 */
ipcMain.handle("get-local-port", () => {
    return currentPort;
});

ipcMain.handle("get-local-ip", async () => {
    return new Promise((resolve) => {
        const socket = dgram.createSocket("udp4");

        socket.connect(53, "8.8.8.8", () => {
            try {
                const address = socket.address().address;
                socket.close();
                resolve(address);
            } catch (err) {
                socket.close();
                resolve("127.0.0.1");
            }
        });

        socket.on("error", () => {
            socket.close();
            resolve("127.0.0.1");
        });
    });
});

ipcMain.handle("fetch-telemetry", async (_event, target) => {
    return await fetchTelemetry(target);
});

ipcMain.on("open-external", (_event, url) => {
    shell.openExternal(url);
});

ipcMain.on(
    "set-window-size",
    (_event, { width, height, resizable, maximize }) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const win = mainWindow;

        if (!maximize) {
            win.unmaximize();
            win.setResizable(true);
            win.setSize(width, height);
            win.setResizable(resizable);
            win.center();
        } else {
            win.setResizable(true);
            win.maximize();
        }
    },
);

ipcMain.handle("check-server-status", () => {
    return fetchTelemetry("localhost").then((result) => result !== null);
});

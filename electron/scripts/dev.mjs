import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..", "..");
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

let nuxtProcess = null;
let electronProcess = null;
let shuttingDown = false;

function runNpm(args, extraEnv = {}) {
    return spawn(npmCmd, args, {
        cwd: rootDir,
        stdio: "inherit",
        env: {
            ...process.env,
            ...extraEnv,
        },
    });
}

function killProcess(child) {
    if (!child || child.killed) return;
    child.kill();
}

function waitForHttpServer(url, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;

        const attempt = () => {
            const req = http.get(url, (res) => {
                res.resume();
                resolve();
            });

            req.on("error", () => {
                if (Date.now() >= deadline) {
                    reject(new Error(`Timed out waiting for ${url}`));
                    return;
                }
                setTimeout(attempt, 300);
            });

            req.setTimeout(2000, () => {
                req.destroy();
            });
        };

        attempt();
    });
}

function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    killProcess(electronProcess);
    killProcess(nuxtProcess);
    process.exit(code);
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

nuxtProcess = runNpm(["run", "dev"]);

await waitForHttpServer("http://127.0.0.1:3000");

electronProcess = runNpm(["run", "electron:run:devurl"], {
    ELECTRON_RENDERER_URL: "http://127.0.0.1:3000",
});

electronProcess.on("exit", (code) => {
    shutdown(code ?? 0);
});

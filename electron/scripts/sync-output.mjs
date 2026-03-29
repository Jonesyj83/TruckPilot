import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..", "..");
const sourceDir = path.join(rootDir, ".output");
const targetDir = path.join(rootDir, "electron", ".output");

if (!existsSync(sourceDir)) {
    throw new Error("Missing .output directory. Run `npm run build` first.");
}

rmSync(targetDir, { recursive: true, force: true });
cpSync(sourceDir, targetDir, { recursive: true });

console.log(`Synced Nuxt output from ${sourceDir} to ${targetDir}`);

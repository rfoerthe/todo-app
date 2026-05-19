import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(rootDir, "build");
const serverDir = path.join(buildDir, "server");
const iconsDir = path.join(buildDir, "icons");
const iconsetDir = path.join(iconsDir, "Aufgabenboard.iconset");
const iconSvg = path.join(rootDir, "assets", "app-icon.svg");
const iconIcns = path.join(iconsDir, "icon.icns");
const apiBinary = path.join(serverDir, "todo-api");

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, {
      cwd: rootDir,
      maxBuffer: 1024 * 1024 * 20,
      ...options,
    });

    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
    child.on("error", reject);
    child.on("exit", code => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function createMacIcon() {
  await rm(iconsetDir, { recursive: true, force: true });
  await mkdir(iconsetDir, { recursive: true });
  await mkdir(iconsDir, { recursive: true });

  const iconSizes = [
    [16, "icon_16x16.png"],
    [32, "icon_16x16@2x.png"],
    [32, "icon_32x32.png"],
    [64, "icon_32x32@2x.png"],
    [128, "icon_128x128.png"],
    [256, "icon_128x128@2x.png"],
    [256, "icon_256x256.png"],
    [512, "icon_256x256@2x.png"],
    [512, "icon_512x512.png"],
    [1024, "icon_512x512@2x.png"],
  ];

  await Promise.all(
    iconSizes.map(([size, fileName]) =>
      sharp(iconSvg)
        .resize(size, size)
        .png()
        .toFile(path.join(iconsetDir, fileName)),
    ),
  );

  await run("iconutil", ["-c", "icns", iconsetDir, "-o", iconIcns]);
}

async function main() {
  const electronArch = process.arch === "arm64" ? "--arm64" : "--x64";

  await mkdir(serverDir, { recursive: true });
  await run("bun", ["run", "build"]);
  await run("bun", ["build", "src/index.ts", "--compile", "--outfile", apiBinary], {
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
  });
  await run("chmod", ["755", apiBinary]);
  await createMacIcon();
  await run("bunx", ["electron-builder", "--mac", "dmg", electronArch]);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

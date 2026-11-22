const fs = require("node:fs");
const path = require("node:path");

const platform = process.argv[2];
const targets = {
    win: { extension: ".exe", buildFolder: "nsis-web" },
    mac: { extension: ".dmg", buildFolder: "." },
    linux: { extension: ".deb", buildFolder: "." }
};
const target = targets[platform];
if (!target) {
    throw new Error("Specify a supported release target: win, mac, or linux.");
}

const root = path.resolve(__dirname, "..");
const buildDirectory = path.join(root, "release-artifacts");
const outputDirectory = path.join(root, "assets", "downloads");
const releaseAssetsDirectory = path.join(buildDirectory, "release-assets");
const expectedName = `BloxdBlocks-v3-Setup${target.extension}`;
const source = path.join(buildDirectory, target.buildFolder, expectedName);

if (!fs.existsSync(source) || fs.statSync(source).size === 0) {
    throw new Error(`The ${platform} package was not built: ${source}`);
}

fs.mkdirSync(outputDirectory, { recursive: true });
fs.mkdirSync(releaseAssetsDirectory, { recursive: true });
const downloadPath = path.join(outputDirectory, expectedName);
fs.copyFileSync(source, downloadPath);
fs.copyFileSync(source, path.join(releaseAssetsDirectory, expectedName));
process.stdout.write(`Prepared ${downloadPath} and GitHub Release asset.\n`);

if (platform === "win") {
    const packageName = `bloxdblocks-${require("../package.json").version}-x64.nsis.7z`;
    const packagePath = path.join(buildDirectory, "nsis-web", packageName);
    if (!fs.existsSync(packagePath) || fs.statSync(packagePath).size === 0) {
        throw new Error(`The Windows web-installer package was not built: ${packagePath}`);
    }

    const releasePackagePath = path.join(buildDirectory, "BloxdBlocks-v3-Setup-x64.nsis.7z");
    fs.copyFileSync(packagePath, releasePackagePath);
    fs.copyFileSync(packagePath, path.join(releaseAssetsDirectory, path.basename(releasePackagePath)));
    process.stdout.write(`Staged GitHub Release package ${releasePackagePath}\n`);
}

const generatedIntermediates = [
    "deb-staging",
    "linux-unpacked",
    "mac",
    "mac-arm64",
    "mac-universal",
    "mac-x64",
    "nsis-web",
    "win-unpacked",
    "BloxdBlocks-Setup-v2.exe",
    "BloxdBlocks-v3-Setup-x64.nsis.7z",
    "BloxdBlocks-v3-Setup.exe",
    "BloxdBlocks-v3-Setup.deb",
    "BloxdBlocks-v3-Setup.dmg",
    "builder-debug.yml"
];
for (const name of generatedIntermediates) {
    fs.rmSync(path.join(buildDirectory, name), { recursive: true, force: true });
}
process.stdout.write("Removed temporary build outputs; final release files are in release-artifacts/release-assets.\n");

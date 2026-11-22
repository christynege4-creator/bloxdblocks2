const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const tar = require("tar");
const root = path.resolve(__dirname, "..");
const buildDirectory = path.join(root, "release-artifacts");
const appDirectory = path.join(buildDirectory, "linux-unpacked");
const stagingDirectory = path.join(buildDirectory, "deb-staging");
const outputPath = path.join(buildDirectory, "BloxdBlocks-v3-Setup-linux-x64.deb");
const webInstallerPath = path.join(buildDirectory, "BloxdBlocks-v3-Setup.deb");
const packageInfo = require("../package.json");
const architecture = "amd64";
const maxWebInstallerBytes = 25_000_000;

function assertFile(filePath, description) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        throw new Error(`${description} is missing: ${filePath}`);
    }
}

function makeArMember(name, content) {
    const header = Buffer.alloc(60, 0x20);
    const fields = [
        [`${name}/`, 16],
        [String(Math.floor(Date.now() / 1000)), 12],
        ["0", 6],
        ["0", 6],
        ["100644", 8],
        [String(content.length), 10]
    ];
    let offset = 0;
    for (const [value, width] of fields) {
        const text = Buffer.from(value, "ascii");
        if (text.length > width) throw new Error(`Invalid ar header field: ${value}`);
        text.copy(header, offset);
        offset += width;
    }
    header[58] = 0x60;
    header[59] = 0x0a;
    return content.length % 2 === 0
        ? Buffer.concat([header, content])
        : Buffer.concat([header, content, Buffer.from("\n")]);
}

function writeDebianArchive(packagePath, controlTar, dataTar) {
    const globalHeader = Buffer.from("!<arch>\n", "ascii");
    const debianVersion = Buffer.from("2.0\n", "ascii");
    fs.writeFileSync(packagePath, Buffer.concat([
        globalHeader,
        makeArMember("debian-binary", debianVersion),
        makeArMember("control.tar.gz", controlTar),
        makeArMember("data.tar.gz", dataTar)
    ]));
}

function readArMembers(buffer) {
    if (buffer.subarray(0, 8).toString("ascii") !== "!<arch>\n") {
        throw new Error("The generated package is not a Debian ar archive.");
    }
    const members = new Map();
    for (let offset = 8; offset < buffer.length;) {
        if (offset + 60 > buffer.length) throw new Error("The Debian archive has a truncated header.");
        const header = buffer.subarray(offset, offset + 60);
        if (header[58] !== 0x60 || header[59] !== 0x0a) throw new Error("The Debian archive has an invalid member.");
        const name = header.toString("ascii", 0, 16).trim().replace(/\/$/, "");
        const size = Number(header.toString("ascii", 48, 58).trim());
        const start = offset + 60;
        const end = start + size;
        if (!Number.isSafeInteger(size) || end > buffer.length) throw new Error("The Debian archive member size is invalid.");
        members.set(name, buffer.subarray(start, end));
        offset = end + (size % 2);
    }
    return members;
}

async function main() {
    assertFile(path.join(appDirectory, "bloxdblocks"), "Linux app executable");
    assertFile(path.join(appDirectory, "resources", "app.asar"), "Packaged BloxdBlocks app");
    assertFile(path.join(root, "assets", "bloxdblocks-icon.png"), "BloxdBlocks application icon");
    fs.rmSync(stagingDirectory, { recursive: true, force: true });

    const controlDirectory = path.join(stagingDirectory, "control");
    const dataDirectory = path.join(stagingDirectory, "data");
    const verificationDirectory = path.join(stagingDirectory, "verify-control");
    const controlTarPath = path.join(stagingDirectory, "control.tar.gz");
    const dataTarPath = path.join(stagingDirectory, "data.tar.gz");
    const installDirectory = path.join(dataDirectory, "opt", "bloxdblocks");
    const desktopDirectory = path.join(dataDirectory, "usr", "share", "applications");
    const iconDirectory = path.join(dataDirectory, "usr", "share", "icons", "hicolor", "512x512", "apps");
    const mimeIconDirectory = path.join(dataDirectory, "usr", "share", "icons", "hicolor", "512x512", "mimetypes");
    const mimeDirectory = path.join(dataDirectory, "usr", "share", "mime", "packages");

    for (const directory of [controlDirectory, installDirectory, desktopDirectory, iconDirectory, mimeIconDirectory, mimeDirectory]) {
        fs.mkdirSync(directory, { recursive: true });
    }
    fs.cpSync(appDirectory, installDirectory, { recursive: true, preserveTimestamps: true });
    for (const executable of ["bloxdblocks", "chrome_crashpad_handler", "chrome-sandbox"]) {
        const executablePath = path.join(installDirectory, executable);
        assertFile(executablePath, `Linux executable ${executable}`);
        fs.chmodSync(executablePath, 0o4755 & (executable === "chrome-sandbox" ? 0o4755 : 0o755));
    }

    fs.copyFileSync(path.join(root, "assets", "bloxdblocks-icon.png"), path.join(iconDirectory, "bloxdblocks.png"));
    fs.copyFileSync(path.join(root, "assets", "file-logo.png"), path.join(mimeIconDirectory, "application-x-bloxdblocks.png"));
    fs.writeFileSync(path.join(desktopDirectory, "bloxdblocks.desktop"), [
        "[Desktop Entry]",
        "Name=BloxdBlocks",
        "Comment=Visual editor for Bloxd.io world code",
        "Exec=/opt/bloxdblocks/bloxdblocks %U",
        "TryExec=/opt/bloxdblocks/bloxdblocks",
        "Icon=bloxdblocks",
        "Terminal=false",
        "Type=Application",
        "Categories=Development;",
        "MimeType=application/x-bloxdblocks;",
        ""
    ].join("\n"));
    fs.writeFileSync(path.join(mimeDirectory, "bloxdblocks.xml"), [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<mime-info xmlns=\"http://www.freedesktop.org/standards/shared-mime-info\">",
        "  <mime-type type=\"application/x-bloxdblocks\">",
        "    <comment>BloxdBlocks Block File</comment>",
        "    <generic-icon name=\"application-x-bloxdblocks\"/>",
        "    <glob pattern=\"*.bb\"/>",
        "  </mime-type>",
        "</mime-info>",
        ""
    ].join("\n"));

    const control = [
        `Package: bloxdblocks`,
        `Version: ${packageInfo.version}`,
        `Section: devel`,
        `Priority: optional`,
        `Architecture: ${architecture}`,
        `Maintainer: BloxdBlocks Contributors`,
        `Homepage: https://github.com/CHRISTYNEGE4-CREATOR/BLOXDBLOCKS`,
        `Description: Visual editor for Bloxd.io world code`,
        ` Build, save, and reopen BloxdBlocks visual workspaces.`,
        ""
    ].join("\n");
    fs.writeFileSync(path.join(controlDirectory, "control"), control);

    await tar.c({
        cwd: controlDirectory,
        portable: true,
        noMtime: true,
        gzip: true,
        file: controlTarPath
    }, ["control"]);
    await tar.c({
        cwd: dataDirectory,
        portable: true,
        noMtime: true,
        gzip: true,
        file: dataTarPath,
        onWriteEntry(entry) {
            const entryPath = entry.path.replace(/\\/g, "/").replace(/^\.\//, "");
            if (entryPath === "opt/bloxdblocks/chrome-sandbox") entry.stat.mode = 0o104755;
            else if ([
                "opt/bloxdblocks/bloxdblocks",
                "opt/bloxdblocks/chrome_crashpad_handler"
            ].includes(entryPath)) entry.stat.mode = 0o100755;
        }
    }, ["."]);
    writeDebianArchive(outputPath, fs.readFileSync(controlTarPath), fs.readFileSync(dataTarPath));

    const members = readArMembers(fs.readFileSync(outputPath));
    if (members.get("debian-binary")?.toString("ascii") !== "2.0\n" ||
        !members.has("control.tar.gz") || !members.has("data.tar.gz")) {
        throw new Error("The generated Debian package is missing required archive members.");
    }
    fs.mkdirSync(verificationDirectory, { recursive: true });
    const verifyControlPath = path.join(verificationDirectory, "control.tar.gz");
    fs.writeFileSync(verifyControlPath, members.get("control.tar.gz"));
    await tar.x({ file: verifyControlPath, cwd: verificationDirectory });
    const embeddedControl = fs.readFileSync(path.join(verificationDirectory, "control"), "utf8");
    if (!embeddedControl.includes(`Version: ${packageInfo.version}`) ||
        !embeddedControl.includes(`Architecture: ${architecture}`)) {
        throw new Error("The generated Debian package version is incorrect.");
    }
    const dataEntries = [];
    await tar.t({
        file: dataTarPath,
        onentry(entry) { dataEntries.push(entry.path.replace(/^\.\//, "")); }
    });
    if (!dataEntries.includes("opt/bloxdblocks/bloxdblocks") ||
        !dataEntries.includes("usr/share/applications/bloxdblocks.desktop")) {
        throw new Error("The Debian payload is missing the app or its launcher.");
    }
    await tar.t({
        file: dataTarPath,
        onentry(entry) {
            const entryPath = entry.path.replace(/^\.\//, "");
            if (entryPath === "opt/bloxdblocks/bloxdblocks" &&
                (entry.mode & 0o111) !== 0o111) {
                throw new Error("The Debian application executable is missing execute permissions.");
            }
        }
    });

    const webControlDirectory = path.join(stagingDirectory, "web-control");
    const webControlTarPath = path.join(stagingDirectory, "web-control.tar.gz");
    const webDataTarPath = path.join(stagingDirectory, "web-data.tar.gz");
    fs.mkdirSync(webControlDirectory, { recursive: true });
    fs.writeFileSync(path.join(webControlDirectory, "control"), [
        "Package: bloxdblocks-web-installer",
        `Version: ${packageInfo.version}`,
        "Section: devel",
        "Priority: optional",
        `Architecture: ${architecture}`,
        "Depends: ca-certificates, curl | wget",
        "Maintainer: BloxdBlocks Contributors",
        "Homepage: https://github.com/CHRISTYNEGE4-CREATOR/BLOXDBLOCKS",
        "Description: Web installer for BloxdBlocks",
        " Downloads the full BloxdBlocks desktop app from the latest GitHub Release.",
        ""
    ].join("\n"));
    fs.writeFileSync(path.join(webControlDirectory, "postinst"), [
        "#!/bin/sh",
        "set -eu",
        "package_url=https://github.com/CHRISTYNEGE4-CREATOR/BLOXDBLOCKS/releases/latest/download/BloxdBlocks-v3-Setup-linux-x64.deb",
        "tmp_deb=\"$(mktemp)\"",
        "trap 'rm -f \"$tmp_deb\"' 0 HUP INT TERM",
        "if command -v curl >/dev/null 2>&1; then",
        "    curl --fail --location --show-error \"$package_url\" --output \"$tmp_deb\"",
        "elif command -v wget >/dev/null 2>&1; then",
        "    wget --output-document=\"$tmp_deb\" \"$package_url\"",
        "else",
        "    echo 'BloxdBlocks requires curl or wget to download its app package.' >&2",
        "    exit 1",
        "fi",
        "dpkg-deb --extract \"$tmp_deb\" /",
        "if command -v update-mime-database >/dev/null 2>&1; then",
        "    update-mime-database /usr/share/mime",
        "fi",
        "if command -v update-desktop-database >/dev/null 2>&1; then",
        "    update-desktop-database /usr/share/applications",
        "fi",
        ""
    ].join("\n"));
    fs.chmodSync(path.join(webControlDirectory, "postinst"), 0o755);
    await tar.c({
        cwd: webControlDirectory,
        portable: true,
        noMtime: true,
        gzip: true,
        file: webControlTarPath,
        onWriteEntry(entry) {
            if (entry.path === "postinst") entry.stat.mode = 0o100755;
        }
    }, ["control", "postinst"]);
    fs.writeFileSync(webDataTarPath, zlib.gzipSync(Buffer.alloc(1024)));
    writeDebianArchive(webInstallerPath, fs.readFileSync(webControlTarPath), fs.readFileSync(webDataTarPath));

    const webMembers = readArMembers(fs.readFileSync(webInstallerPath));
    if (!webMembers.has("control.tar.gz") || !webMembers.has("data.tar.gz")) {
        throw new Error("The generated web installer is missing required Debian archive members.");
    }
    const webControlVerifyDirectory = path.join(stagingDirectory, "verify-web-control");
    fs.mkdirSync(webControlVerifyDirectory, { recursive: true });
    const verifyWebControlPath = path.join(webControlVerifyDirectory, "control.tar.gz");
    fs.writeFileSync(verifyWebControlPath, webMembers.get("control.tar.gz"));
    await tar.x({ file: verifyWebControlPath, cwd: webControlVerifyDirectory });
    const webControl = fs.readFileSync(path.join(webControlVerifyDirectory, "control"), "utf8");
    const webPostinst = fs.readFileSync(path.join(webControlVerifyDirectory, "postinst"), "utf8");
    let webPostinstIsExecutable = false;
    await tar.t({
        file: verifyWebControlPath,
        onentry(entry) {
            if (entry.path === "postinst") webPostinstIsExecutable = (entry.mode & 0o111) === 0o111;
        }
    });
    if (!webControl.includes("Package: bloxdblocks-web-installer") ||
        !webControl.includes("Depends: ca-certificates, curl | wget") ||
        !webPostinst.includes("/releases/latest/download/BloxdBlocks-v3-Setup-linux-x64.deb") ||
        !webPostinstIsExecutable) {
        throw new Error("The generated Debian web installer is missing its download or installation configuration.");
    }
    const webInstallerBytes = fs.statSync(webInstallerPath).size;
    if (webInstallerBytes >= maxWebInstallerBytes) {
        throw new Error(`The Debian web installer must be smaller than 25 MB; got ${webInstallerBytes} bytes.`);
    }
    process.stdout.write(`Created full Linux package ${outputPath} (${fs.statSync(outputPath).size} bytes).\n`);
    process.stdout.write(`Created Debian web installer ${webInstallerPath} (${webInstallerBytes} bytes).\n`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

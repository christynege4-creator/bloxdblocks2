module.exports = {
    appId: "io.bloxdblocks.editor",
    productName: "BloxdBlocks",
    icon: "assets/favicon.ico",
    directories: {
        output: "release-artifacts"
    },
    files: [
        "index.html",
        "bloxdcodetool.html",
        "bloxdcodetool.css",
        "bloxdcodetool.js",
        "style.css",
        "download.html",
        "download.css",
        "docs/**/*",
        "assets/**/*",
        "electron/main.cjs",
        "!assets/downloads/**"
    ],
    artifactName: "BloxdBlocks-v3-Setup.${ext}",
    fileAssociations: [
        {
            ext: "bb",
            name: "BloxdBlocks Block File",
            description: "BloxdBlocks workspace file",
            role: "Editor"
        }
    ],
    win: {
        target: ["nsis"]
    },
    nsis: {
        oneClick: false,
        perMachine: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true
    },
    nsisWeb: {
        artifactName: "BloxdBlocks-v3-Setup.${ext}",
        appPackageUrl: "https://github.com/CHRISTYNEGE4-CREATOR/BLOXDBLOCKS/releases/latest/download/BloxdBlocks-v3-Setup-x64.nsis.7z",
        allowToChangeInstallationDirectory: true
    },
    mac: {
        icon: "assets/bloxdblocks-icon.png",
        target: [
            {
                target: "dmg",
                arch: ["universal"]
            }
        ],
        category: "public.app-category.developer-tools",
        identity: null
    },
    linux: {
        icon: "assets/bloxdblocks-icon.png",
        target: ["deb"],
        category: "Development",
        maintainer: "BloxdBlocks"
    }
};

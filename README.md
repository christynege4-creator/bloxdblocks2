# BloxdBlocks

A browser-based visual editor for building Bloxd.io world code. Arrange event, action, control, and value blocks in the workspace; the editor generates JavaScript world code as you work.

## Open the app

Open [`index.html`](./index.html) for the landing page, [`download.html`](./download.html) for desktop downloads, and [`docs/docs.html`](./docs/docs.html) for the editor guide. The browser editor can be opened directly from [`bloxdcodetool.html`](./bloxdcodetool.html); it uses CodeMirror from a CDN, so an internet connection is needed to load that dependency.

## Build the Windows installer

The desktop app uses Electron. Install Node.js and run `npm install`. Build Windows with `npm run dist:win`, macOS on a Mac with `npm run dist:mac`, and Debian/Ubuntu with `npm run dist:linux` (requires Ruby and FPM). The outputs are `assets/downloads/BloxdBlocks-v3-Setup.exe`, `.dmg`, and `.deb`; the Windows web installer also needs the full app archive from the matching GitHub Release. Each installer registers `.bb` files as **BloxdBlocks Block File**, opening them directly in the editor. To reduce publisher warnings, configure Windows signing with `CSC_LINK` and `CSC_KEY_PASSWORD`; macOS builds require Apple signing and notarization for trusted distribution. Never commit signing keys or passwords.

Push a version tag such as `v2.0.0` to run the cross-platform workflow. It builds and attaches the `.exe`, `.dmg`, `.deb`, and Windows `.nsis.7z` app archive to one GitHub Release. Build outputs are ignored by Git so the large packages are uploaded as release assets, not repository files. The Windows web installer downloads its archive from `https://github.com/CHRISTYNEGE4-CREATOR/BLOXDBLOCKS/releases/latest/download/BloxdBlocks-v3-Setup-x64.nsis.7z`.

The download page enables the installer link only when a non-empty package is served over HTTP. Unsigned installers may show operating-system security warnings.

## Use the editor

1. Drag an event block from the toolbox onto the workspace.
2. Drag actions and control blocks into the event body. Drag value blocks into compatible input sockets.
3. Copy the generated JavaScript source into your Bloxd.io world code.
4. Search the toolbox to find blocks by label, method name, or description.
5. Add variables and functions from their categories.
6. Use **SAVE** to export the complete workspace as a `.bb` file, then **LOAD** to select and restore that file.

`.bb` files stay on your device unless you choose to share them; they are not uploaded or synchronized by the editor.

## Documentation

- [About the project](./about/ABOUT.md)
- [Callbacks and events](./how-tos/EVENTS.md)
- [Bloxd API method blocks](./how-tos/API-METHODS.md)
- [Built-in operators and blocks](./how-tos/OPERATORS.md)
- [CustomTextStyling blocks](./how-tos/CUSTOM-STYLED-TEXT-OPERATORS.md)

The official [Bloxd callbacks](https://bloxd.io/docs/callbacks), [API reference](https://bloxd.io/docs/api-reference), and [type reference](https://bloxd.io/docs/types#CustomTextStyling) are the authoritative sources for runtime behavior and API parameter types.
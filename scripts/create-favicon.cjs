const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "assets", "bloxdblocks.logo.png");
const outputPath = path.join(root, "assets", "favicon.ico");
const png = fs.readFileSync(sourcePath);

function readChunks(buffer) {
    const chunks = [];
    for (let offset = 8; offset < buffer.length;) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString("ascii", offset + 4, offset + 8);
        chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length) });
        offset += length + 12;
        if (type === "IEND") break;
    }
    return chunks;
}

function decodePng(chunks, width, height, colorType) {
    if (colorType !== 2 && colorType !== 6) {
        throw new Error("The logo must be an RGB or RGBA PNG.");
    }
    const bytesPerPixel = colorType === 6 ? 4 : 3;
    const stride = width * bytesPerPixel;
    const compressed = Buffer.concat(chunks.filter(chunk => chunk.type === "IDAT").map(chunk => chunk.data));
    const raw = zlib.inflateSync(compressed);
    const decoded = Buffer.alloc(stride * height);
    let rawOffset = 0;

    for (let y = 0; y < height; y++) {
        const filter = raw[rawOffset++];
        const row = y * stride;
        for (let x = 0; x < stride; x++) {
            const value = raw[rawOffset++];
            const left = x >= bytesPerPixel ? decoded[row + x - bytesPerPixel] : 0;
            const above = y > 0 ? decoded[row + x - stride] : 0;
            const upperLeft = y > 0 && x >= bytesPerPixel ? decoded[row + x - stride - bytesPerPixel] : 0;
            let predictor = 0;
            if (filter === 1) predictor = left;
            else if (filter === 2) predictor = above;
            else if (filter === 3) predictor = Math.floor((left + above) / 2);
            else if (filter === 4) {
                const p = left + above - upperLeft;
                const pa = Math.abs(p - left);
                const pb = Math.abs(p - above);
                const pc = Math.abs(p - upperLeft);
                predictor = pa <= pb && pa <= pc ? left : pb <= pc ? above : upperLeft;
            } else if (filter !== 0) throw new Error(`Unsupported PNG filter: ${filter}`);
            decoded[row + x] = (value + predictor) & 255;
        }
    }

    if (colorType === 6) return decoded;
    const pixels = Buffer.alloc(width * height * 4);
    for (let index = 0; index < width * height; index++) {
        pixels[index * 4] = decoded[index * 3];
        pixels[index * 4 + 1] = decoded[index * 3 + 1];
        pixels[index * 4 + 2] = decoded[index * 3 + 2];
        pixels[index * 4 + 3] = 255;
    }
    return pixels;
}

function createIconImage(pixels, width, height, size) {
    const cropSize = Math.min(height - 64, 340);
    const cropLeft = 22;
    const cropTop = 15;
    if (cropLeft + cropSize > width || cropTop + cropSize > height) {
        throw new Error("The logo dimensions are too small for the icon crop.");
    }

    const bitmap = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
        const sourceY = cropTop + Math.min(cropSize - 1, Math.floor((y + 0.5) * cropSize / size));
        for (let x = 0; x < size; x++) {
            const sourceX = cropLeft + Math.min(cropSize - 1, Math.floor((x + 0.5) * cropSize / size));
            const source = (sourceY * width + sourceX) * 4;
            const target = ((size - y - 1) * size + x) * 4;
            bitmap[target] = pixels[source + 2];
            bitmap[target + 1] = pixels[source + 1];
            bitmap[target + 2] = pixels[source];
            bitmap[target + 3] = pixels[source + 3];
        }
    }

    const header = Buffer.alloc(40);
    header.writeUInt32LE(40, 0);
    header.writeInt32LE(size, 4);
    header.writeInt32LE(size * 2, 8);
    header.writeUInt16LE(1, 12);
    header.writeUInt16LE(32, 14);
    header.writeUInt32LE(size * size * 4, 20);
    const andMask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
    return Buffer.concat([header, bitmap, andMask]);
}

function createFileIconImage(pixels, width, height, size) {
    const bitmap = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
        const sourceY = Math.min(height - 1, Math.floor((y + 0.5) * height / size));
        for (let x = 0; x < size; x++) {
            const sourceX = Math.min(width - 1, Math.floor((x + 0.5) * width / size));
            const source = (sourceY * width + sourceX) * 4;
            const target = ((size - y - 1) * size + x) * 4;
            bitmap[target] = pixels[source + 2];
            bitmap[target + 1] = pixels[source + 1];
            bitmap[target + 2] = pixels[source];
            bitmap[target + 3] = pixels[source + 3];
        }
    }

    const header = Buffer.alloc(40);
    header.writeUInt32LE(40, 0);
    header.writeInt32LE(size, 4);
    header.writeInt32LE(size * 2, 8);
    header.writeUInt16LE(1, 12);
    header.writeUInt16LE(32, 14);
    header.writeUInt32LE(size * size * 4, 20);
    const andMask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
    return Buffer.concat([header, bitmap, andMask]);
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const typeBuffer = Buffer.from(type, "ascii");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
    return Buffer.concat([length, typeBuffer, data, checksum]);
}

function createPngIcon(pixels, width, height, size) {
    const cropSize = Math.min(height - 64, 340);
    const cropLeft = 22;
    const cropTop = 15;
    if (cropLeft + cropSize > width || cropTop + cropSize > height) {
        throw new Error("The logo dimensions are too small for the icon crop.");
    }

    const rows = Buffer.alloc((size * 4 + 1) * size);
    for (let y = 0; y < size; y++) {
        const row = y * (size * 4 + 1);
        rows[row] = 0;
        const sourceY = cropTop + Math.min(cropSize - 1, Math.floor((y + 0.5) * cropSize / size));
        for (let x = 0; x < size; x++) {
            const sourceX = cropLeft + Math.min(cropSize - 1, Math.floor((x + 0.5) * cropSize / size));
            const source = (sourceY * width + sourceX) * 4;
            const target = row + 1 + x * 4;
            pixels.copy(rows, target, source, source + 4);
        }
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk("IHDR", ihdr),
        pngChunk("IDAT", zlib.deflateSync(rows)),
        pngChunk("IEND", Buffer.alloc(0))
    ]);
}

function createFullImagePng(pixels, width, height, size) {
    const rows = Buffer.alloc((size * 4 + 1) * size);
    for (let y = 0; y < size; y++) {
        const row = y * (size * 4 + 1);
        rows[row] = 0;
        const sourceY = Math.min(height - 1, Math.floor((y + 0.5) * height / size));
        for (let x = 0; x < size; x++) {
            const sourceX = Math.min(width - 1, Math.floor((x + 0.5) * width / size));
            const source = (sourceY * width + sourceX) * 4;
            pixels.copy(rows, row + 1 + x * 4, source, source + 4);
        }
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk("IHDR", ihdr),
        pngChunk("IDAT", zlib.deflateSync(rows)),
        pngChunk("IEND", Buffer.alloc(0))
    ]);
}

function writeIco(filePath, images) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);
    let imageOffset = header.length + images.length * 16;
    const entries = images.map(({ size, data }) => {
        const entry = Buffer.alloc(16);
        entry[0] = size === 256 ? 0 : size;
        entry[1] = size === 256 ? 0 : size;
        entry.writeUInt16LE(1, 4);
        entry.writeUInt16LE(32, 6);
        entry.writeUInt32LE(data.length, 8);
        entry.writeUInt32LE(imageOffset, 12);
        imageOffset += data.length;
        return entry;
    });
    fs.writeFileSync(filePath, Buffer.concat([header, ...entries, ...images.map(image => image.data)]));
}

function createIcns(images) {
    const chunks = images.map(({ type, data }) => {
        const chunkHeader = Buffer.alloc(8);
        chunkHeader.write(type, 0, "ascii");
        chunkHeader.writeUInt32BE(data.length + chunkHeader.length, 4);
        return Buffer.concat([chunkHeader, data]);
    });
    const header = Buffer.alloc(8);
    header.write("icns", 0, "ascii");
    header.writeUInt32BE(header.length + chunks.reduce((size, chunk) => size + chunk.length, 0), 4);
    return Buffer.concat([header, ...chunks]);
}

const chunks = readChunks(png);
const ihdr = chunks.find(chunk => chunk.type === "IHDR");
if (!ihdr || ihdr.data[8] !== 8) throw new Error("The logo must be an 8-bit PNG.");
const width = ihdr.data.readUInt32BE(0);
const height = ihdr.data.readUInt32BE(4);
const pixels = decodePng(chunks, width, height, ihdr.data[9]);
const pngIconPath = path.join(root, "assets", "bloxdblocks-icon.png");
fs.writeFileSync(pngIconPath, createPngIcon(pixels, width, height, 512));
const images = [16, 24, 32, 48, 64, 128, 256].map(size => ({
    size,
    data: createIconImage(pixels, width, height, size)
}));
writeIco(outputPath, images);
process.stdout.write(`Created ${outputPath} with ${images.length} icon sizes and ${pngIconPath}.\n`);

const fileLogoPath = path.join(root, "assets", "file-logo.png");
const fileLogoChunks = readChunks(fs.readFileSync(fileLogoPath));
const fileLogoHeader = fileLogoChunks.find(chunk => chunk.type === "IHDR");
if (!fileLogoHeader || fileLogoHeader.data[8] !== 8) {
    throw new Error("The file logo must be an 8-bit PNG.");
}
const fileLogoWidth = fileLogoHeader.data.readUInt32BE(0);
const fileLogoHeight = fileLogoHeader.data.readUInt32BE(4);
if (fileLogoWidth !== fileLogoHeight) {
    throw new Error("The file logo must be square.");
}
const fileLogoPixels = decodePng(fileLogoChunks, fileLogoWidth, fileLogoHeight, fileLogoHeader.data[9]);
const fileIconSizes = [16, 24, 32, 48, 64, 128, 256];
const fileIcoPath = path.join(root, "assets", "file-logo.ico");
writeIco(fileIcoPath, fileIconSizes.map(size => ({
    size,
    data: createFileIconImage(fileLogoPixels, fileLogoWidth, fileLogoHeight, size)
})));

const fileIcnsPath = path.join(root, "assets", "file-logo.icns");
fs.writeFileSync(fileIcnsPath, createIcns([
    { type: "ic08", data: createFullImagePng(fileLogoPixels, fileLogoWidth, fileLogoHeight, 256) },
    { type: "ic09", data: createFullImagePng(fileLogoPixels, fileLogoWidth, fileLogoHeight, 512) },
    { type: "ic10", data: createFullImagePng(fileLogoPixels, fileLogoWidth, fileLogoHeight, 1024) }
]));
process.stdout.write(`Created ${fileIcoPath} and ${fileIcnsPath} from ${fileLogoPath}.\n`);

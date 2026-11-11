/** A picture's size in pixels, as it is shown (a JPEG's EXIF orientation applied). */
export interface IImageDimensions {
	width: number;
	height: number;
}

/** The largest side a header may state: anything larger is taken as a broken header, not a picture. */
const MAX_SIDE = 100_000;

/**
 * The size of a picture from the first bytes of its file — PNG, GIF, JPEG, WebP and BMP — or null when the bytes are
 * not one of those, or the header is cut short or out of range. Reads headers only: nothing is decoded, so the cost is
 * the same for any size of picture. A JPEG whose EXIF orientation turns it a quarter (5 to 8) answers its shown size,
 * width and height swapped, which is the size a client reserves.
 *
 * @param buffer The file's bytes (the upload already reads them to sniff the type).
 * @param mimeType The sniffed type, when known: only that format is tried.
 */
export function imageDimensions(buffer: Buffer | null | undefined, mimeType?: string | null): IImageDimensions | null {
	if (!buffer || buffer.length < 10) return null;
	const type = String(mimeType ?? '').toLowerCase();
	const readers: Array<[string, (bytes: Buffer) => IImageDimensions | null]> = [
		['image/png', pngSize],
		['image/gif', gifSize],
		['image/jpeg', jpegSize],
		['image/webp', webpSize],
		['image/bmp', bmpSize]
	];
	for (const [kind, read] of readers) {
		if (type && type !== kind && !(kind === 'image/bmp' && type === 'image/x-ms-bmp')) continue;
		try {
			const size = read(buffer);
			if (size) return valid(size);
		} catch {
			// A header cut short reads past the end: not a size.
		}
	}
	return null;
}

function valid(size: IImageDimensions): IImageDimensions | null {
	const ok = (side: number) => Number.isInteger(side) && side > 0 && side <= MAX_SIDE;
	return ok(size.width) && ok(size.height) ? size : null;
}

function pngSize(bytes: Buffer): IImageDimensions | null {
	// Signature, then the IHDR chunk: length (4), "IHDR", width (4), height (4).
	if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47 || bytes.toString('ascii', 12, 16) !== 'IHDR') return null;
	return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function gifSize(bytes: Buffer): IImageDimensions | null {
	const signature = bytes.toString('ascii', 0, 6);
	if (signature !== 'GIF87a' && signature !== 'GIF89a') return null;
	return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
}

function bmpSize(bytes: Buffer): IImageDimensions | null {
	if (bytes.length < 26 || bytes.toString('ascii', 0, 2) !== 'BM') return null;
	// The info header (40 bytes and later versions): signed 32-bit sides (a negative height is a top-down bitmap).
	return { width: Math.abs(bytes.readInt32LE(18)), height: Math.abs(bytes.readInt32LE(22)) };
}

function webpSize(bytes: Buffer): IImageDimensions | null {
	if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') return null;
	const chunk = bytes.toString('ascii', 12, 16);
	if (chunk === 'VP8X') {
		// Canvas size, 24-bit little-endian, minus one.
		return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
	}
	if (chunk === 'VP8L') {
		if (bytes[20] !== 0x2f) return null;
		const bits = bytes.readUInt32LE(21);
		return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
	}
	if (chunk === 'VP8 ') {
		// A key frame's start code, then 14-bit sides.
		if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
		return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
	}
	return null;
}

/** The start-of-frame markers that carry a JPEG's size (baseline, progressive, lossless, …; not DHT/JPG/DAC). */
const JPEG_FRAME_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegSize(bytes: Buffer): IImageDimensions | null {
	if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
	let offset = 2;
	let orientation = 1;
	while (offset + 4 <= bytes.length) {
		if (bytes[offset] !== 0xff) return null;
		const marker = bytes[offset + 1];
		// Fill bytes, and the markers that carry no length.
		if (marker === 0xff) {
			offset += 1;
			continue;
		}
		if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
			offset += 2;
			continue;
		}
		if (marker === 0xd9 || marker === 0xda) return null;
		const length = bytes.readUInt16BE(offset + 2);
		if (length < 2) return null;
		if (marker === 0xe1) orientation = exifOrientation(bytes, offset + 4, offset + 2 + length) ?? orientation;
		if (JPEG_FRAME_MARKERS.has(marker)) {
			const height = bytes.readUInt16BE(offset + 5);
			const width = bytes.readUInt16BE(offset + 7);
			// Orientations 5 to 8 turn the picture a quarter: it is shown with its sides swapped.
			return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
		}
		offset += 2 + length;
	}
	return null;
}

/** The orientation tag (0x0112) of an APP1 Exif segment, or null when it holds none. */
function exifOrientation(bytes: Buffer, start: number, end: number): number | null {
	if (end > bytes.length || bytes.toString('ascii', start, start + 6) !== 'Exif\u0000\u0000') return null;
	const tiff = start + 6;
	const order = bytes.toString('ascii', tiff, tiff + 2);
	if (order !== 'II' && order !== 'MM') return null;
	const little = order === 'II';
	const u16 = (at: number) => (little ? bytes.readUInt16LE(at) : bytes.readUInt16BE(at));
	const u32 = (at: number) => (little ? bytes.readUInt32LE(at) : bytes.readUInt32BE(at));
	const ifd = tiff + u32(tiff + 4);
	if (ifd + 2 > end) return null;
	const entries = u16(ifd);
	for (let index = 0; index < entries; index += 1) {
		const entry = ifd + 2 + index * 12;
		if (entry + 12 > end) return null;
		if (u16(entry) === 0x0112) {
			const value = u16(entry + 8);
			return value >= 1 && value <= 8 ? value : null;
		}
	}
	return null;
}

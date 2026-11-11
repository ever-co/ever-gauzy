import { imageDimensions } from './image-dimensions';

/** A PNG header: signature, then IHDR with the sides. */
function png(width: number, height: number): Buffer {
	const bytes = Buffer.alloc(33);
	Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
	bytes.writeUInt32BE(13, 8);
	bytes.write('IHDR', 12, 'ascii');
	bytes.writeUInt32BE(width, 16);
	bytes.writeUInt32BE(height, 20);
	return bytes;
}

function gif(width: number, height: number): Buffer {
	const bytes = Buffer.alloc(13);
	bytes.write('GIF89a', 0, 'ascii');
	bytes.writeUInt16LE(width, 6);
	bytes.writeUInt16LE(height, 8);
	return bytes;
}

function bmp(width: number, height: number): Buffer {
	const bytes = Buffer.alloc(54);
	bytes.write('BM', 0, 'ascii');
	bytes.writeInt32LE(width, 18);
	bytes.writeInt32LE(height, 22);
	return bytes;
}

/** A JPEG: SOI, an optional APP1 Exif segment with an orientation, a DQT segment, then SOF0 with the sides. */
function jpeg(width: number, height: number, orientation?: number, littleEndian = false): Buffer {
	const parts: Buffer[] = [Buffer.from([0xff, 0xd8])];
	if (orientation !== undefined) {
		const tiff = Buffer.alloc(8 + 2 + 12 + 4);
		tiff.write(littleEndian ? 'II' : 'MM', 0, 'ascii');
		const u16 = (value: number, at: number) => (littleEndian ? tiff.writeUInt16LE(value, at) : tiff.writeUInt16BE(value, at));
		const u32 = (value: number, at: number) => (littleEndian ? tiff.writeUInt32LE(value, at) : tiff.writeUInt32BE(value, at));
		u16(42, 2);
		u32(8, 4);
		u16(1, 8);
		u16(0x0112, 10);
		u16(3, 12);
		u32(1, 14);
		u16(orientation, 18);
		const payload = Buffer.concat([Buffer.from('Exif\u0000\u0000', 'binary'), tiff]);
		const header = Buffer.from([0xff, 0xe1, 0, 0]);
		header.writeUInt16BE(payload.length + 2, 2);
		parts.push(header, payload);
	}
	// A quantization table segment the reader must step over.
	parts.push(Buffer.from([0xff, 0xdb, 0x00, 0x04, 0x00, 0x00]));
	const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0, 0, 0, 0, 0x03]);
	sof.writeUInt16BE(height, 5);
	sof.writeUInt16BE(width, 7);
	parts.push(sof, Buffer.alloc(16));
	return Buffer.concat(parts);
}

function webp(chunk: 'VP8X' | 'VP8L' | 'VP8 ', width: number, height: number): Buffer {
	const bytes = Buffer.alloc(40);
	bytes.write('RIFF', 0, 'ascii');
	bytes.writeUInt32LE(32, 4);
	bytes.write('WEBP', 8, 'ascii');
	bytes.write(chunk, 12, 'ascii');
	if (chunk === 'VP8X') {
		bytes.writeUIntLE(width - 1, 24, 3);
		bytes.writeUIntLE(height - 1, 27, 3);
	} else if (chunk === 'VP8L') {
		bytes[20] = 0x2f;
		bytes.writeUInt32LE(((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14), 21);
	} else {
		bytes[23] = 0x9d;
		bytes[24] = 0x01;
		bytes[25] = 0x2a;
		bytes.writeUInt16LE(width, 26);
		bytes.writeUInt16LE(height, 28);
	}
	return bytes;
}

describe('imageDimensions', () => {
	it('reads the size of PNG, GIF, BMP and WebP headers', () => {
		expect(imageDimensions(png(1920, 1080), 'image/png')).toEqual({ width: 1920, height: 1080 });
		expect(imageDimensions(gif(320, 200), 'image/gif')).toEqual({ width: 320, height: 200 });
		expect(imageDimensions(bmp(64, -48), 'image/bmp')).toEqual({ width: 64, height: 48 });
		expect(imageDimensions(webp('VP8X', 4000, 3000), 'image/webp')).toEqual({ width: 4000, height: 3000 });
		expect(imageDimensions(webp('VP8L', 800, 600), 'image/webp')).toEqual({ width: 800, height: 600 });
		expect(imageDimensions(webp('VP8 ', 640, 480), 'image/webp')).toEqual({ width: 640, height: 480 });
	});

	it('reads a JPEG past its other segments, and swaps the sides when its EXIF orientation turns it a quarter', () => {
		expect(imageDimensions(jpeg(4032, 3024), 'image/jpeg')).toEqual({ width: 4032, height: 3024 });
		expect(imageDimensions(jpeg(4032, 3024, 1), 'image/jpeg')).toEqual({ width: 4032, height: 3024 });
		expect(imageDimensions(jpeg(4032, 3024, 6), 'image/jpeg')).toEqual({ width: 3024, height: 4032 });
		expect(imageDimensions(jpeg(4032, 3024, 8, true), 'image/jpeg')).toEqual({ width: 3024, height: 4032 });
		expect(imageDimensions(jpeg(4032, 3024, 3, true), 'image/jpeg')).toEqual({ width: 4032, height: 3024 });
	});

	it('tries every format when the type is not known', () => {
		expect(imageDimensions(jpeg(10, 20))).toEqual({ width: 10, height: 20 });
		expect(imageDimensions(png(5, 6), null)).toEqual({ width: 5, height: 6 });
	});

	it('answers null for anything that is not a readable picture header', () => {
		expect(imageDimensions(Buffer.from('%PDF-1.7 not a picture at all'), 'application/pdf')).toBeNull();
		expect(imageDimensions(png(100, 100), 'image/jpeg')).toBeNull();
		expect(imageDimensions(png(100, 100).subarray(0, 20), 'image/png')).toBeNull();
		expect(imageDimensions(jpeg(100, 100).subarray(0, 12), 'image/jpeg')).toBeNull();
		expect(imageDimensions(png(0, 100), 'image/png')).toBeNull();
		expect(imageDimensions(png(200_000, 100), 'image/png')).toBeNull();
		expect(imageDimensions(null)).toBeNull();
		expect(imageDimensions(Buffer.alloc(0))).toBeNull();
	});
});

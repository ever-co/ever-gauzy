import { crc32 } from 'node:zlib';
import { Jimp, JimpMime } from 'jimp';
import * as sharpModule from 'sharp';
import { createImageThumbnail, thumbnailFileName } from './image-thumbnail';

const sharp = ((sharpModule as unknown as { default?: typeof sharpModule.default }).default ??
	sharpModule) as unknown as typeof sharpModule.default;

/** A solid image of the given size, in the given format, through sharp. */
async function image(width: number, height: number, format: 'png' | 'jpeg', options: { orientation?: number } = {}) {
	let pipeline = sharp({ create: { width, height, channels: 3, background: '#4080c0' } });
	pipeline = format === 'png' ? pipeline.png() : pipeline.jpeg();
	if (options.orientation) pipeline = pipeline.withMetadata({ orientation: options.orientation });
	return pipeline.toBuffer();
}

describe('createImageThumbnail', () => {
	it('resizes to the width, keeping the aspect ratio and the format', async () => {
		const thumbnail = await createImageThumbnail(await image(500, 200, 'png'));
		expect(thumbnail).toMatchObject({ format: 'png', extension: 'png' });
		const metadata = await sharp(thumbnail.data).metadata();
		expect(metadata).toMatchObject({ format: 'png', width: 250, height: 100 });
	});

	it('names a JPEG thumbnail .jpg', async () => {
		const thumbnail = await createImageThumbnail(await image(300, 300, 'jpeg'));
		expect(thumbnail).toMatchObject({ format: 'jpeg', extension: 'jpg' });
	});

	it('takes a width, and encodes as PNG on request', async () => {
		const thumbnail = await createImageThumbnail(await image(400, 400, 'jpeg'), { width: 100, png: true });
		expect(thumbnail).toMatchObject({ format: 'png', extension: 'png' });
		const metadata = await sharp(thumbnail.data).metadata();
		expect(metadata).toMatchObject({ format: 'png', width: 100, height: 100 });
	});

	it('orients the thumbnail as the image displays (EXIF orientation)', async () => {
		// Orientation 6: the stored pixels are rotated 90° from how the image displays, so a 400×200 file displays
		// as 200×400 — and so must its thumbnail.
		const thumbnail = await createImageThumbnail(await image(400, 200, 'jpeg', { orientation: 6 }), {
			width: 100
		});
		const metadata = await sharp(thumbnail.data).metadata();
		expect(metadata).toMatchObject({ format: 'jpeg', width: 100, height: 200 });
		expect(metadata.orientation ?? 1).toBe(1);
	});

	// Jimp encodes, decodes and resizes in JavaScript: about a second on a desktop (the libvips cases take tens of
	// milliseconds), and past Jest's default 5 s on a CI runner busy with other suites.
	it('still decodes a BMP (which libvips does not) through Jimp, in its own format', async () => {
		const bmp = await new Jimp({ width: 300, height: 150, color: 0x4080c0ff }).getBuffer(JimpMime.bmp);
		const thumbnail = await createImageThumbnail(bmp);
		expect(thumbnail).toMatchObject({ format: 'bmp', extension: 'bmp' });
		const decoded = await Jimp.read(thumbnail.data);
		expect(decoded.mime).toBe(JimpMime.bmp);
		expect(decoded.width).toBe(250);
		expect(decoded.height).toBe(125);
	}, 30_000);

	it('refuses an image libvips recognises but will not decode, without handing it to Jimp', async () => {
		// A PNG header declaring far more pixels than sharp's default input limit: recognised (so no Jimp
		// fallback, which would decode it in JavaScript on the event loop), then refused by the decode.
		const huge = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#000' } })
			.png()
			.toBuffer();
		huge.writeUInt32BE(300_000, 16); // IHDR width
		huge.writeUInt32BE(300_000, 20); // IHDR height
		huge.writeUInt32BE(crc32(huge.subarray(12, 29)), 29); // IHDR CRC: a valid header, refused only for its size
		const read = jest.spyOn(Jimp, 'read');
		await expect(createImageThumbnail(huge)).rejects.toThrow();
		expect(read).not.toHaveBeenCalled();
		read.mockRestore();
	});

	it('thumbnails a JPEG libvips only warns about (extraneous bytes before a marker)', async () => {
		const jpeg = await image(64, 64, 'jpeg');
		const at = jpeg.indexOf(Buffer.from([0xff, 0xdb])); // DQT
		const warned = Buffer.concat([jpeg.subarray(0, at), Buffer.from([0x00, 0x11, 0x22, 0x33]), jpeg.subarray(at)]);
		await expect(createImageThumbnail(warned, { width: 32 })).resolves.toMatchObject({ format: 'jpeg' });
	});

	it('does not render an SVG, even one with dimensions', async () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20"/></svg>';
		await expect(createImageThumbnail(Buffer.from(svg))).rejects.toThrow(/Unsupported image format/);
	});

	it('refuses what is not an image at all', async () => {
		await expect(createImageThumbnail(Buffer.from('definitely not an image'))).rejects.toThrow();
	});
});

describe('thumbnailFileName', () => {
	it.each([
		['photo.jpg', 'jpg', 'thumb-photo.jpg'],
		['a PNG uploaded as .jpg', 'png', 'thumb-a PNG uploaded as .png'],
		['screenshot.2026-10-19.png', 'png', 'thumb-screenshot.2026-10-19.png'],
		['no-extension', 'jpg', 'thumb-no-extension.jpg']
	])('names %s with the thumbnail format', (filename, extension, expected) => {
		expect(thumbnailFileName(filename, extension)).toBe(expected);
	});
});

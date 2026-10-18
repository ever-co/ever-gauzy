import { Readable } from 'node:stream';
import { Jimp, JimpMime } from 'jimp';
import * as sharpModule from 'sharp';
import { createImageThumbnail, fileContentToBuffer, thumbnailFileName } from './image-thumbnail';

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

	it('still decodes a BMP (which libvips does not) through Jimp, in its own format', async () => {
		const bmp = await new Jimp({ width: 300, height: 150, color: 0x4080c0ff }).getBuffer(JimpMime.bmp);
		const thumbnail = await createImageThumbnail(bmp);
		expect(thumbnail).toMatchObject({ format: 'bmp', extension: 'bmp' });
		const decoded = await Jimp.read(thumbnail.data);
		expect(decoded.mime).toBe(JimpMime.bmp);
		expect(decoded.width).toBe(250);
		expect(decoded.height).toBe(125);
	});

	it('refuses what is not an image at all', async () => {
		await expect(createImageThumbnail(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).rejects.toThrow();
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

describe('fileContentToBuffer', () => {
	it.each([
		['nothing', undefined, undefined],
		['null', null, undefined],
		['a Buffer', Buffer.from('abc'), 'abc'],
		['a Uint8Array', new Uint8Array([97, 98, 99]), 'abc'],
		['a string', 'abc', 'abc'],
		['an object without bytes', { foo: 'bar' }, undefined]
	])('handles %s', async (_label, content, expected) => {
		const buffer = await fileContentToBuffer(content);
		expect(buffer === undefined ? undefined : buffer.toString()).toBe(expected);
	});

	it('reads an SDK body with transformToByteArray', async () => {
		const body = { transformToByteArray: async () => new Uint8Array([97, 98, 99]) };
		expect((await fileContentToBuffer(body))?.toString()).toBe('abc');
	});

	it('reads a stream to the end', async () => {
		const stream = Readable.from([Buffer.from('ab'), Buffer.from('c')]);
		expect((await fileContentToBuffer(stream))?.toString()).toBe('abc');
	});
});

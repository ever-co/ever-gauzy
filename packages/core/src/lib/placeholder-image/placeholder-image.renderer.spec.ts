import * as fs from 'fs';
import * as sharpModule from 'sharp';
import { renderPlaceholderImage } from './placeholder-image.renderer';
import { PlaceholderImage } from './placeholder-image-url';

const sharp = ((sharpModule as unknown as { default?: typeof sharpModule.default }).default ??
	sharpModule) as unknown as typeof sharpModule.default;

/** The decoded pixels of a PNG, as RGBA. */
async function pixels(png: Buffer) {
	const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const at = (x: number, y: number) => {
		const offset = (y * info.width + x) * 4;
		return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
	};
	/** How many pixels are (nearly) white. */
	const white = () => {
		let count = 0;
		for (let offset = 0; offset < data.length; offset += 4) {
			if (data[offset] > 240 && data[offset + 1] > 240 && data[offset + 2] > 240) count++;
		}
		return count;
	};
	return { info, at, white };
}

const placeholder = (overrides: Partial<PlaceholderImage> = {}): PlaceholderImage => ({
	width: 330,
	height: 300,
	background: '269aff',
	text: 'A',
	...overrides
});

describe('renderPlaceholderImage', () => {
	// The first image reads the font, and sharp starts its thread pool (seconds on a cold Windows runner).
	jest.setTimeout(60_000);

	it('draws a PNG of the size asked for, on the background asked for', async () => {
		const png = await renderPlaceholderImage(placeholder());
		const metadata = await sharp(png).metadata();
		expect(metadata).toMatchObject({ format: 'png', width: 330, height: 300 });

		const { at } = await pixels(png);
		expect(at(0, 0)).toEqual([0x26, 0x9a, 0xff, 255]);
		expect(at(329, 299)).toEqual([0x26, 0x9a, 0xff, 255]);
	});

	it('draws the text in white, in the middle', async () => {
		const { at, white, info } = await pixels(await renderPlaceholderImage(placeholder({ text: 'AB' })));
		// Glyphs of the 128-pixel font: thousands of white pixels, none of them at the edges.
		expect(white()).toBeGreaterThan(1000);
		for (let x = 0; x < info.width; x++) {
			expect(at(x, 0)).toEqual([0x26, 0x9a, 0xff, 255]);
			expect(at(x, info.height - 1)).toEqual([0x26, 0x9a, 0xff, 255]);
		}
	});

	it('draws no text when there is none, or none the font has', async () => {
		const empty = await pixels(await renderPlaceholderImage(placeholder({ text: '', background: '8b72ff' })));
		expect(empty.white()).toBe(0);

		const cyrillic = await pixels(await renderPlaceholderImage(placeholder({ text: 'Ж', background: '8b72ff' })));
		expect(cyrillic.white()).toBe(0);
	});

	it('draws Latin-1 letters, and leaves out the characters the font lacks', async () => {
		const { white } = await pixels(await renderPlaceholderImage(placeholder({ text: 'É' })));
		expect(white()).toBeGreaterThan(500);

		const mixed = await pixels(await renderPlaceholderImage(placeholder({ text: 'AЖ', background: 'ffaf26' })));
		const latin = await pixels(await renderPlaceholderImage(placeholder({ text: 'A', background: 'ffaf26' })));
		expect(mixed.white()).toBe(latin.white());
	});

	it('scales the text down to fit a small image', async () => {
		const large = await pixels(await renderPlaceholderImage(placeholder({ text: 'M' })));
		const small = await pixels(await renderPlaceholderImage(placeholder({ width: 40, height: 40, text: 'M' })));
		expect(small.white()).toBeGreaterThan(0);
		expect(small.white()).toBeLessThan(large.white() / 10);
	});

	it('fits a long text in a narrow image, and draws a tiny image without failing', async () => {
		const wide = await sharp(
			await renderPlaceholderImage(placeholder({ width: 60, height: 300, text: 'WWWW' }))
		).metadata();
		expect(wide).toMatchObject({ width: 60, height: 300 });

		for (const [width, height] of [
			[1, 1],
			[4, 4],
			[1024, 1]
		]) {
			const tiny = await sharp(
				await renderPlaceholderImage(placeholder({ width, height, text: 'WM' }))
			).metadata();
			expect(tiny).toMatchObject({ width, height });
		}
	});

	it('draws a placeholder once while it stays in the cache', async () => {
		const image = placeholder({ background: '0ecc9d', text: 'C' });
		expect(renderPlaceholderImage(image)).toBe(renderPlaceholderImage({ ...image }));
	});

	it('draws the background alone when the font cannot be read, and reads it again for the next one', async () => {
		// A fresh copy of the module: its font is not read yet.
		let render: typeof renderPlaceholderImage;
		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			render = require('./placeholder-image.renderer').renderPlaceholderImage;
		});
		const readFile = jest.spyOn(fs.promises, 'readFile').mockRejectedValueOnce(new Error('EACCES'));
		const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			const withoutFont = await pixels(await render(placeholder({ background: 'ffaf26', text: 'F' })));
			expect(withoutFont.info).toMatchObject({ width: 330, height: 300 });
			expect(withoutFont.white()).toBe(0);
			expect(error).toHaveBeenCalled();

			const withFont = await pixels(await render(placeholder({ background: 'ffaf26', text: 'G' })));
			expect(withFont.white()).toBeGreaterThan(1000);
		} finally {
			readFile.mockRestore();
			error.mockRestore();
		}
	});
});

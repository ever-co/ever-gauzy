import * as fs from 'fs';
import * as sharpModule from 'sharp';
import { renderPlaceholderImage } from './placeholder-image.renderer';
import { PlaceholderImage } from './placeholder-image-url';

const sharp = ((sharpModule as unknown as { default?: typeof sharpModule.default }).default ??
	sharpModule) as unknown as typeof sharpModule.default;

/** The PNG bytes of a placeholder. */
async function png(image: PlaceholderImage, render = renderPlaceholderImage): Promise<Buffer> {
	return (await render(image)).png;
}

/** The decoded pixels of a PNG, as RGBA. */
async function pixels(bytes: Buffer) {
	const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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

/** A fresh copy of the renderer module: its font is not read yet, its cache and its draw slots are empty. */
function freshRenderer(): typeof import('./placeholder-image.renderer') {
	let renderer: typeof import('./placeholder-image.renderer');
	jest.isolateModules(() => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		renderer = require('./placeholder-image.renderer');
	});
	return renderer;
}

describe('renderPlaceholderImage', () => {
	// The first image reads the font, and sharp starts its thread pool (seconds on a cold Windows runner).
	jest.setTimeout(60_000);

	it('draws a PNG of the size asked for, on the background asked for', async () => {
		const rendered = await renderPlaceholderImage(placeholder());
		expect(rendered.complete).toBe(true);
		const metadata = await sharp(rendered.png).metadata();
		expect(metadata).toMatchObject({ format: 'png', width: 330, height: 300 });

		const { at } = await pixels(rendered.png);
		expect(at(0, 0)).toEqual([0x26, 0x9a, 0xff, 255]);
		expect(at(329, 299)).toEqual([0x26, 0x9a, 0xff, 255]);
	});

	it('draws the text in white, in the middle', async () => {
		const { at, white, info } = await pixels(await png(placeholder({ text: 'AB' })));
		// Glyphs of the 128-pixel font: thousands of white pixels, none of them at the edges.
		expect(white()).toBeGreaterThan(1000);
		for (let x = 0; x < info.width; x++) {
			expect(at(x, 0)).toEqual([0x26, 0x9a, 0xff, 255]);
			expect(at(x, info.height - 1)).toEqual([0x26, 0x9a, 0xff, 255]);
		}
	});

	it('draws no text when there is none, or none the font has', async () => {
		const empty = await pixels(await png(placeholder({ text: '', background: '8b72ff' })));
		expect(empty.white()).toBe(0);

		const cyrillic = await renderPlaceholderImage(placeholder({ text: 'Ж', background: '8b72ff' }));
		expect((await pixels(cyrillic.png)).white()).toBe(0);
		// Not a failure: the font has no such glyph, and never will.
		expect(cyrillic.complete).toBe(true);
	});

	it('draws Latin-1 letters, and leaves out the characters the font lacks', async () => {
		const { white } = await pixels(await png(placeholder({ text: 'É' })));
		expect(white()).toBeGreaterThan(500);

		const mixed = await pixels(await png(placeholder({ text: 'AЖ', background: 'ffaf26' })));
		const latin = await pixels(await png(placeholder({ text: 'A', background: 'ffaf26' })));
		expect(mixed.white()).toBe(latin.white());
	});

	it('scales the text down to fit a small image', async () => {
		const large = await pixels(await png(placeholder({ text: 'M' })));
		const small = await pixels(await png(placeholder({ width: 40, height: 40, text: 'M' })));
		expect(small.white()).toBeGreaterThan(0);
		expect(small.white()).toBeLessThan(large.white() / 10);
	});

	it('fits a long text in a narrow image, and draws a tiny image without failing', async () => {
		const wide = await sharp(await png(placeholder({ width: 60, height: 300, text: 'WWWW' }))).metadata();
		expect(wide).toMatchObject({ width: 60, height: 300 });

		for (const [width, height] of [
			[1, 1],
			[4, 4],
			[1024, 1]
		]) {
			const tiny = await sharp(await png(placeholder({ width, height, text: 'WM' }))).metadata();
			expect(tiny).toMatchObject({ width, height });
		}
	});

	it('draws a placeholder once while it stays in the cache', async () => {
		const image = placeholder({ background: '0ecc9d', text: 'C' });
		expect(renderPlaceholderImage(image)).toBe(renderPlaceholderImage({ ...image }));
	});

	it('draws the background alone when the font cannot be read, keeps it nowhere, and draws it again with its text', async () => {
		const { renderPlaceholderImage: render } = freshRenderer();
		const readFile = jest.spyOn(fs.promises, 'readFile').mockRejectedValueOnce(new Error('EMFILE'));
		const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			const image = placeholder({ background: 'ffaf26', text: 'F' });

			const withoutFont = await render(image);
			expect(withoutFont.complete).toBe(false);
			const degraded = await pixels(withoutFont.png);
			expect(degraded.info).toMatchObject({ width: 330, height: 300 });
			expect(degraded.white()).toBe(0);
			expect(error).toHaveBeenCalled();

			// The same placeholder again: not served from the cache, drawn with its text now the font reads.
			const withFont = await render({ ...image });
			expect(withFont).not.toBe(withoutFont);
			expect(withFont.complete).toBe(true);
			expect((await pixels(withFont.png)).white()).toBeGreaterThan(1000);
		} finally {
			readFile.mockRestore();
			error.mockRestore();
		}
	});

	it('draws a few placeholders at a time, lets a bounded number wait, and refuses the rest', async () => {
		const { renderPlaceholderImage: render, PlaceholderImageBusyError: BusyError } = freshRenderer();
		// 4 drawing + 64 waiting fit; the 69th distinct placeholder of the burst is refused.
		const burst = Array.from({ length: 69 }, (_, index) =>
			render(placeholder({ width: 8 + index, height: 8, text: '' }))
		);

		await expect(burst[68]).rejects.toBeInstanceOf(BusyError);
		const drawn = await Promise.all(burst.slice(0, 68));
		expect(drawn.every(({ complete }) => complete)).toBe(true);

		// Once the burst is drawn, the refused one is drawn too: a refusal is not kept.
		await expect(render(placeholder({ width: 8 + 68, height: 8, text: '' }))).resolves.toMatchObject({
			complete: true
		});
	});
});

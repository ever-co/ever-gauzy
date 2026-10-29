import { Jimp, loadFont } from 'jimp';
import { SANS_8_WHITE, SANS_16_WHITE, SANS_32_WHITE, SANS_64_WHITE, SANS_128_WHITE } from 'jimp/fonts';
import * as sharpModule from 'sharp';
import { PlaceholderImage } from './placeholder-image-url';

// sharp 0.35 types its entry point as an ES module (a default export), while `require('sharp')` still returns the
// function itself: take whichever this runtime hands back.
const sharp = ((sharpModule as unknown as { default?: typeof sharpModule.default }).default ??
	sharpModule) as unknown as typeof sharpModule.default;

type BitmapFont = Awaited<ReturnType<typeof loadFont>>;

/**
 * The fonts the text is drawn in, largest first: the Open Sans bitmap fonts Jimp ships (white, ASCII and Latin-1).
 *
 * Bitmap fonts, not system ones: the API's production image (Alpine) has no fonts installed, so an SVG rasterized by
 * sharp would draw no text at all. A character these fonts lack (Cyrillic, CJK, ...) is left out of the image.
 */
const FONTS: ReadonlyArray<{ size: number; file: string }> = [
	{ size: 128, file: SANS_128_WHITE },
	{ size: 64, file: SANS_64_WHITE },
	{ size: 32, file: SANS_32_WHITE },
	{ size: 16, file: SANS_16_WHITE },
	{ size: 8, file: SANS_8_WHITE }
];

/** How many drawn images are kept in memory (a 330x300 placeholder is about 3 KB). */
const MAX_CACHED_IMAGES = 256;

/** Each font is read once per process (the 128-pixel one is a 4096x431 PNG). */
const loadedFonts = new Map<string, Promise<BitmapFont>>();

/** The drawn images, least recently used first. */
const drawnImages = new Map<string, Promise<Buffer>>();

/**
 * A font, read on first use.
 *
 * @param file - The font's `.fnt` file.
 */
function getFont(file: string): Promise<BitmapFont> {
	let font = loadedFonts.get(file);
	if (!font) {
		font = loadFont(file);
		loadedFonts.set(file, font);
		font.catch(() => loadedFonts.delete(file));
	}
	return font;
}

/**
 * Where the characters of `text` draw, relative to a line of `font` starting at 0.
 *
 * @param font - The font.
 * @param text - Characters the font has.
 */
function measure(font: BitmapFont, text: string): { width: number; top: number; bottom: number } {
	const characters = Array.from(text);
	let x = 0;
	let width = 0;
	let top = font.common.lineHeight;
	let bottom = 0;
	characters.forEach((character, index) => {
		const glyph = font.chars[character];
		width = Math.max(width, x + glyph.xoffset + glyph.width, x + glyph.xadvance);
		top = Math.min(top, glyph.yoffset);
		bottom = Math.max(bottom, glyph.yoffset + glyph.height);
		// The kerning Jimp's `print` applies before the next character.
		x += glyph.xadvance + (font.kernings[character]?.[characters[index + 1]] || 0);
	});
	return { width, top: Math.min(top, bottom), bottom };
}

/**
 * The text drawn in white on a transparent background, cropped to the glyphs, in the largest font whose size is at
 * most half the image's shorter side and whose text fits 90% of its width. `undefined` when there is nothing to draw.
 *
 * @param image - The placeholder.
 */
async function drawText(image: PlaceholderImage): Promise<{ data: Buffer; width: number; height: number } | undefined> {
	for (const [index, { size, file }] of FONTS.entries()) {
		// The smallest font is the last resort: an image too small for it gets its text cropped.
		const smallest = index === FONTS.length - 1;
		if (size > Math.min(image.width, image.height) / 2 && !smallest) {
			continue;
		}
		const font = await getFont(file);
		const text = Array.from(image.text)
			.filter((character) => font.chars[character])
			.join('');
		if (!text) {
			return undefined;
		}
		const { width, top, bottom } = measure(font, text);
		if (width > image.width * 0.9 && !smallest) {
			continue;
		}

		const canvas = new Jimp({ width: Math.max(1, width), height: font.common.lineHeight, color: 0x00000000 });
		canvas.print({ font, x: 0, y: 0, text });
		canvas.crop({
			x: 0,
			y: top,
			w: Math.min(canvas.bitmap.width, image.width),
			h: Math.max(1, Math.min(bottom - top, image.height))
		});
		return { data: canvas.bitmap.data, width: canvas.bitmap.width, height: canvas.bitmap.height };
	}
	return undefined;
}

/**
 * Draws a placeholder as a PNG.
 *
 * The background and the encoding run in sharp (libvips, on its own thread pool); only the few glyphs are drawn in
 * JavaScript, so a request does not hold the API's event loop for the whole image.
 *
 * @param image - The placeholder.
 */
async function draw(image: PlaceholderImage): Promise<Buffer> {
	const text = await drawText(image);
	const background = sharp({
		create: { width: image.width, height: image.height, channels: 4, background: `#${image.background}` }
	});
	if (text) {
		background.composite([
			{ input: text.data, raw: { width: text.width, height: text.height, channels: 4 }, gravity: 'centre' }
		]);
	}
	return background.png().toBuffer();
}

/**
 * A placeholder image as PNG bytes. The latest {@link MAX_CACHED_IMAGES} images drawn are kept, so a page of records
 * that share a placeholder draws it once.
 *
 * @param image - The placeholder (see `parsePlaceholderImage`).
 */
export function renderPlaceholderImage(image: PlaceholderImage): Promise<Buffer> {
	const key = `${image.width}x${image.height}/${image.background}/${image.text}`;
	let png = drawnImages.get(key);
	if (png) {
		// Most recently used last.
		drawnImages.delete(key);
	} else {
		png = draw(image);
		png.catch(() => drawnImages.delete(key));
	}
	drawnImages.set(key, png);
	if (drawnImages.size > MAX_CACHED_IMAGES) {
		drawnImages.delete(drawnImages.keys().next().value);
	}
	return png;
}

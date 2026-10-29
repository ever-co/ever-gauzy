import * as fs from 'fs';
import * as path from 'path';
import * as sharpModule from 'sharp';
import { PlaceholderImage } from './placeholder-image-url';

// sharp 0.35 types its entry point as an ES module (a default export), while `require('sharp')` still returns the
// function itself: take whichever this runtime hands back.
const sharp = ((sharpModule as unknown as { default?: typeof sharpModule.default }).default ??
	sharpModule) as unknown as typeof sharpModule.default;

/**
 * The font the text is drawn in: the 128-pixel white Open Sans bitmap font (BMFont: a `.fnt` file describing glyphs
 * on a PNG page) that Jimp ships, ASCII and Latin-1. A character it lacks (Cyrillic, CJK, ...) is left out.
 *
 * A bitmap font, not a system one: the API's production image (Alpine) has no fonts installed, so text in an SVG
 * rasterized by sharp would not be drawn at all. And not through Jimp's own `loadFont`, which cuts every glyph out of
 * the page in JavaScript: about 8 seconds of the API's event loop for this font.
 *
 * `jimp/fonts` exists only in the package's `exports` map, which the workspace's `moduleResolution: node` does not
 * read: Node resolves it at runtime, TypeScript is told its shape.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FONT_FILE = (require('jimp/fonts') as { SANS_128_WHITE: string }).SANS_128_WHITE;

/** How many drawn images are kept in memory (a 330x300 placeholder is about 3 KB). */
const MAX_CACHED_IMAGES = 256;

/** How many placeholders are drawn at a time, and how many more may wait for a slot before requests are refused. */
const MAX_ACTIVE_DRAWS = 4;
const MAX_WAITING_DRAWS = 64;

/** Too many placeholders are being drawn: the route answers 503, and the client tries again later. */
export class PlaceholderImageBusyError extends Error {
	constructor() {
		super('Too many placeholder images are being drawn; try again shortly.');
		this.name = 'PlaceholderImageBusyError';
	}
}

/** A drawn placeholder. */
export interface RenderedPlaceholderImage {
	/** The PNG bytes. */
	png: Buffer;
	/**
	 * Whether it was drawn as asked. `false` when its text could not be drawn (the font could not be read): the image
	 * is then the background alone and must not be cached.
	 */
	complete: boolean;
}

/** At most this share of the image's shorter side is text height, and this share of its width text width. */
const TEXT_HEIGHT_SHARE = 0.4;
const TEXT_WIDTH_SHARE = 0.8;

/** A glyph of the font: where it is on the page, and how it is placed on a line. */
interface Glyph {
	x: number;
	y: number;
	width: number;
	height: number;
	xoffset: number;
	yoffset: number;
	xadvance: number;
}

/** The font, read: its glyphs, its kerning pairs and its page decoded to RGBA. */
interface BitmapFont {
	glyphs: Map<string, Glyph>;
	/** The kerning between two characters, keyed by the two characters. */
	kernings: Map<string, number>;
	page: { data: Buffer; width: number };
}

/** An RGBA bitmap. */
interface Bitmap {
	data: Buffer;
	width: number;
	height: number;
}

let font: Promise<BitmapFont> | undefined;

/** The drawn images (and those being drawn), least recently used first. */
const drawnImages = new Map<string, Promise<RenderedPlaceholderImage>>();

/** The draws running, and the starts of those waiting for a slot. */
let activeDraws = 0;
const waitingDraws: Array<() => void> = [];

/**
 * The attributes of a BMFont XML tag.
 *
 * @param tag - The tag, e.g. `<char id="65" x="2" ... />`.
 */
function attributesOf(tag: string): Record<string, string> {
	return Object.fromEntries(Array.from(tag.matchAll(/(\w+)="([^"]*)"/g), ([, name, value]) => [name, value]));
}

/**
 * Reads the font: its description, and its page decoded by sharp (on libvips' thread pool).
 *
 * @param file - The font's `.fnt` file (BMFont, XML format, one page).
 */
async function readBitmapFont(file: string): Promise<BitmapFont> {
	const description = await fs.promises.readFile(file, 'utf8');
	const pageFile = attributesOf(/<page\b[^>]*>/.exec(description)?.[0] ?? '').file;
	if (!pageFile) {
		throw new Error(`The bitmap font ${file} names no page.`);
	}

	const glyphs = new Map<string, Glyph>();
	for (const [tag] of description.matchAll(/<char\b[^>]*>/g)) {
		const { id, page, ...metrics } = attributesOf(tag);
		if (Number(page ?? 0) !== 0) {
			continue;
		}
		glyphs.set(String.fromCodePoint(Number(id)), {
			x: Number(metrics.x),
			y: Number(metrics.y),
			width: Number(metrics.width),
			height: Number(metrics.height),
			xoffset: Number(metrics.xoffset),
			yoffset: Number(metrics.yoffset),
			xadvance: Number(metrics.xadvance)
		});
	}

	const kernings = new Map<string, number>();
	for (const [tag] of description.matchAll(/<kerning\b[^>]*>/g)) {
		const { first, second, amount } = attributesOf(tag);
		kernings.set(String.fromCodePoint(Number(first)) + String.fromCodePoint(Number(second)), Number(amount));
	}

	// Read through Node's `fs`, which the desktop apps' Electron extends to files inside `app.asar`; libvips reading the
	// path itself would not find them there.
	const { data, info } = await sharp(await fs.promises.readFile(path.join(path.dirname(file), pageFile)))
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	return { glyphs, kernings, page: { data, width: info.width } };
}

/** The font, read on first use (once per process). */
function getFont(): Promise<BitmapFont> {
	if (!font) {
		font = readBitmapFont(FONT_FILE);
		font.catch(() => (font = undefined));
	}
	return font;
}

/**
 * The text drawn in white on a transparent background, at the font's own size, cropped to the glyphs. `undefined`
 * when the font has none of its characters.
 *
 * Only the glyphs are copied in JavaScript (a few thousand pixels each).
 *
 * @param bitmapFont - The font.
 * @param text - The text.
 */
function drawGlyphs(bitmapFont: BitmapFont, text: string): Bitmap | undefined {
	const characters = Array.from(text).filter((character) => bitmapFont.glyphs.has(character));

	// Lay the glyphs out on a line, as Jimp's `print` does: advance, plus the kerning before the next character.
	let pen = 0;
	const placed = characters.map((character, index) => {
		const glyph = bitmapFont.glyphs.get(character);
		const placement = { glyph, x: pen + glyph.xoffset, y: glyph.yoffset };
		pen += glyph.xadvance + (bitmapFont.kernings.get(character + characters[index + 1]) ?? 0);
		return placement;
	});
	const drawn = placed.filter(({ glyph }) => glyph.width > 0 && glyph.height > 0);
	if (!drawn.length) {
		return undefined;
	}

	const left = Math.min(...drawn.map(({ x }) => x));
	const top = Math.min(...drawn.map(({ y }) => y));
	const width = Math.max(...drawn.map(({ x, glyph }) => x + glyph.width)) - left;
	const height = Math.max(...drawn.map(({ y, glyph }) => y + glyph.height)) - top;

	const data = Buffer.alloc(width * height * 4);
	const { page } = bitmapFont;
	for (const { glyph, x, y } of drawn) {
		for (let row = 0; row < glyph.height; row++) {
			for (let column = 0; column < glyph.width; column++) {
				const alpha = page.data[((glyph.y + row) * page.width + glyph.x + column) * 4 + 3];
				if (!alpha) {
					continue;
				}
				const offset = ((y - top + row) * width + (x - left + column)) * 4;
				data[offset] = data[offset + 1] = data[offset + 2] = 255;
				// Glyphs that overlap (kerning) keep the more opaque pixel.
				data[offset + 3] = Math.max(data[offset + 3], alpha);
			}
		}
	}
	return { data, width, height };
}

/**
 * The text of a placeholder, sized for it: at most {@link TEXT_HEIGHT_SHARE} of its shorter side high and
 * {@link TEXT_WIDTH_SHARE} of its width wide, and never larger than the font draws it. `undefined` when there is no
 * text to draw.
 *
 * @param image - The placeholder.
 */
async function drawText(image: PlaceholderImage): Promise<Bitmap | undefined> {
	if (!image.text) {
		return undefined;
	}
	const text = drawGlyphs(await getFont(), image.text);
	if (!text) {
		return undefined;
	}

	const scale = Math.min(
		1,
		(TEXT_HEIGHT_SHARE * Math.min(image.width, image.height)) / text.height,
		(TEXT_WIDTH_SHARE * image.width) / text.width
	);
	if (scale === 1) {
		return text;
	}
	const width = Math.max(1, Math.round(text.width * scale));
	const height = Math.max(1, Math.round(text.height * scale));
	const data = await sharp(text.data, { raw: { width: text.width, height: text.height, channels: 4 } })
		.resize(width, height, { fit: 'fill' })
		.raw()
		.toBuffer();
	return { data, width, height };
}

/**
 * Draws a placeholder as a PNG.
 *
 * The page of the font is decoded, and the text scaled, the background drawn and the image encoded, by sharp (libvips,
 * on its own thread pool): a request holds the API's event loop only to copy a few glyphs.
 *
 * @param image - The placeholder.
 */
async function draw(image: PlaceholderImage): Promise<RenderedPlaceholderImage> {
	// A font that cannot be read, or text that cannot be scaled, leaves the placeholder without its text rather than
	// without an image. Such an image is not complete: it is neither kept nor cached by clients, and the next request
	// for it reads the font again.
	let complete = true;
	const text = await drawText(image).catch((error) => {
		console.error('PlaceholderImage: the text could not be drawn:', error);
		complete = false;
		return undefined;
	});
	const background = sharp({
		create: { width: image.width, height: image.height, channels: 4, background: `#${image.background}` }
	});
	if (text) {
		background.composite([
			{ input: text.data, raw: { width: text.width, height: text.height, channels: 4 }, gravity: 'centre' }
		]);
	}
	return { png: await background.png().toBuffer(), complete };
}

/**
 * Runs a draw once one of the {@link MAX_ACTIVE_DRAWS} slots is free. The cache bounds the images kept, not the work:
 * without this, a burst of distinct placeholder URLs (the route is public) would start as many draws at once, each
 * holding its pixels and a libuv thread that file and crypto work also wait for.
 *
 * @param work - The draw.
 * @throws PlaceholderImageBusyError when {@link MAX_WAITING_DRAWS} draws already wait.
 */
async function withDrawSlot<T>(work: () => Promise<T>): Promise<T> {
	if (activeDraws < MAX_ACTIVE_DRAWS) {
		activeDraws++;
	} else if (waitingDraws.length < MAX_WAITING_DRAWS) {
		// The draw that ends hands its slot over (see below), so `activeDraws` stays as it is.
		await new Promise<void>((resolve) => waitingDraws.push(resolve));
	} else {
		throw new PlaceholderImageBusyError();
	}
	try {
		return await work();
	} finally {
		const next = waitingDraws.shift();
		if (next) {
			next();
		} else {
			activeDraws--;
		}
	}
}

/**
 * A placeholder image as PNG bytes. The latest {@link MAX_CACHED_IMAGES} complete images drawn are kept, so a page of
 * records that share a placeholder draws it once; at most {@link MAX_ACTIVE_DRAWS} are drawn at a time.
 *
 * @param image - The placeholder (see `parsePlaceholderImage`).
 * @throws PlaceholderImageBusyError (rejected) when too many draws already wait.
 */
export function renderPlaceholderImage(image: PlaceholderImage): Promise<RenderedPlaceholderImage> {
	const key = `${image.width}x${image.height}/${image.background}/${image.text}`;
	let rendered = drawnImages.get(key);
	if (rendered) {
		// Most recently used last.
		drawnImages.delete(key);
	} else {
		const drawing = withDrawSlot(() => draw(image));
		rendered = drawing;
		// Only a complete image stays: a failed draw, or one drawn without its text, is drawn again next time.
		const forget = () => drawnImages.get(key) === drawing && drawnImages.delete(key);
		drawing.then(({ complete }) => complete || forget(), forget);
	}
	drawnImages.set(key, rendered);
	if (drawnImages.size > MAX_CACHED_IMAGES) {
		drawnImages.delete(drawnImages.keys().next().value);
	}
	return rendered;
}

import * as path from 'path';
import { Jimp, JimpMime } from 'jimp';
import * as sharpModule from 'sharp';

// sharp 0.35 types its entry point as an ES module (a default export), while `require('sharp')` still returns the
// function itself: take whichever this runtime hands back.
const sharp = ((sharpModule as unknown as { default?: typeof sharpModule.default }).default ??
	sharpModule) as unknown as typeof sharpModule.default;

/** The formats the image upload endpoints accept that libvips decodes (BMP, also accepted, goes to Jimp). */
const SHARP_THUMBNAIL_FORMATS: ReadonlySet<string> = new Set(['jpeg', 'png', 'webp', 'gif']);

export interface ImageThumbnailOptions {
	/** The thumbnail's width in pixels; the height follows the aspect ratio. Default 250. */
	width?: number;
	/** Encode the thumbnail as PNG whatever the image's own format. Default: the image's own format. */
	png?: boolean;
}

export interface ImageThumbnail {
	/** The thumbnail's bytes. */
	data: Buffer;
	/** The format the bytes are encoded in, as sharp names it (`jpeg`, `png`, `webp`, `gif`, `bmp`, ...). */
	format: string;
	/** The file extension for that format (`jpg` for `jpeg`), so the file name says what the bytes are. */
	extension: string;
}

/**
 * The file extension that says what a thumbnail's bytes are.
 *
 * @param format The format as sharp names it.
 * @returns The extension, without the dot.
 */
export function imageExtensionOf(format: string): string {
	return format === 'jpeg' ? 'jpg' : format;
}

/**
 * The name of an upload's thumbnail: `thumb-<name>.<extension>`, the extension that of the thumbnail's actual
 * format rather than the client-supplied one of the upload (a PNG uploaded as `photo.jpg` gets a `.png` thumbnail,
 * and the public file route, which derives `Content-Type` from the extension, serves it right).
 *
 * @param filename The upload's file name.
 * @param extension The thumbnail's extension (see {@link ImageThumbnail.extension}).
 * @returns The thumbnail's file name.
 */
export function thumbnailFileName(filename: string, extension: string): string {
	return `thumb-${path.parse(filename).name}.${extension}`;
}

/**
 * The format libvips recognises the bytes as, or `undefined` when it does not decode them (BMP in the standard
 * build, or not an image at all). A probe of the header only, with the pixel limit off: the limit is for the decode,
 * which {@link createImageThumbnail} runs with it on.
 *
 * @param content The image's bytes.
 * @returns The format as sharp names it, or `undefined`.
 */
async function sharpFormatOf(content: Buffer): Promise<string | undefined> {
	try {
		return (await sharp(content, { limitInputPixels: false }).metadata()).format;
	} catch {
		return undefined;
	}
}

/**
 * A thumbnail of an uploaded image: `width` pixels wide, the height following the aspect ratio, in the image's own
 * format (or PNG), oriented as the image displays (the EXIF `Orientation` tag is applied, as Jimp applied it).
 *
 * sharp (libvips) decodes and resizes on its own thread pool. Jimp did it in JavaScript on the API's event loop,
 * inside the upload request, and every other request waited for it. For a format libvips does not decode in the
 * standard build — BMP is among those `imageUploadFileFilter` accepts — Jimp still decodes it, as before. Only that
 * case goes to Jimp: an image libvips recognises but refuses (too many pixels, a corrupt file) is refused.
 *
 * @param content The image's bytes.
 * @param options The width and the output format.
 * @returns The thumbnail's bytes and their format.
 */
export async function createImageThumbnail(
	content: Buffer,
	{ width = 250, png = false }: ImageThumbnailOptions = {}
): Promise<ImageThumbnail> {
	const recognised = await sharpFormatOf(content);
	if (recognised) {
		// libvips also renders SVG (librsvg), TIFF and HEIF: none is an accepted upload, so none is decoded here.
		if (!SHARP_THUMBNAIL_FORMATS.has(recognised)) {
			throw new Error(`Unsupported image format for a thumbnail: ${recognised}`);
		}
		// failOn 'error': a libvips warning ("Corrupt JPEG data: N extraneous bytes before marker", common in camera
		// JPEGs) does not refuse an image Jimp used to thumbnail. The pixel limit still applies.
		const pipeline = sharp(content, { failOn: 'error' }).autoOrient().resize({ width });
		const { data, info } = await (png ? pipeline.png() : pipeline).toBuffer({ resolveWithObject: true });
		return { data, format: info.format, extension: imageExtensionOf(info.format) };
	}
	// Not a format libvips decodes (or not an image at all: Jimp then throws, as it always did).
	const image = await Jimp.read(content);
	image.resize({ w: width });
	const mime = (png ? JimpMime.png : image.mime ?? JimpMime.png) as typeof JimpMime.png;
	const format = mime.replace('image/', '');
	return { data: await image.getBuffer(mime), format, extension: imageExtensionOf(format) };
}

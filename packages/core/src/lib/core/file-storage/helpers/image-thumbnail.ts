import * as path from 'path';
import { Jimp, JimpMime } from 'jimp';
import * as sharpModule from 'sharp';

// sharp 0.35 types its entry point as an ES module (a default export), while `require('sharp')` still returns the
// function itself: take whichever this runtime hands back.
const sharp = ((sharpModule as unknown as { default?: typeof sharpModule.default }).default ??
	sharpModule) as unknown as typeof sharpModule.default;

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
 * The stored file's bytes as a Buffer. The local provider returns a Buffer; the S3, Wasabi and DigitalOcean
 * providers return the SDK's stream (`GetObjectCommandOutput.Body`). `undefined` when the provider returned nothing.
 *
 * @param content What the file storage provider's `getFile` returned.
 * @returns The bytes, or `undefined`.
 */
export async function fileContentToBuffer(content: unknown): Promise<Buffer | undefined> {
	if (content === null || content === undefined) return undefined;
	if (Buffer.isBuffer(content)) return content;
	if (content instanceof Uint8Array) return Buffer.from(content);
	if (typeof content === 'string') return Buffer.from(content);
	const body = content as { transformToByteArray?: () => Promise<Uint8Array> };
	if (typeof body.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray());
	if (typeof (content as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
		const chunks: Buffer[] = [];
		for await (const chunk of content as AsyncIterable<Buffer | Uint8Array | string>) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
		}
		return Buffer.concat(chunks);
	}
	return undefined;
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
 * A thumbnail of an uploaded image: `width` pixels wide, the height following the aspect ratio, in the image's own
 * format (or PNG), oriented as the image displays (the EXIF `Orientation` tag is applied, as Jimp applied it).
 *
 * sharp (libvips) decodes and resizes on its own thread pool. Jimp did it in JavaScript on the API's event loop,
 * inside the upload request, and every other request waited for it. For a format libvips does not decode in the
 * standard build — BMP is among those `imageUploadFileFilter` accepts — Jimp still decodes it, as before.
 *
 * @param content The image's bytes.
 * @param options The width and the output format.
 * @returns The thumbnail's bytes and their format.
 */
export async function createImageThumbnail(
	content: Buffer,
	{ width = 250, png = false }: ImageThumbnailOptions = {}
): Promise<ImageThumbnail> {
	try {
		const pipeline = sharp(content).autoOrient().resize({ width });
		const { data, info } = await (png ? pipeline.png() : pipeline).toBuffer({ resolveWithObject: true });
		return { data, format: info.format, extension: imageExtensionOf(info.format) };
	} catch {
		// Not a format libvips decodes (or not an image at all: Jimp then throws, as it always did).
		const image = await Jimp.read(content);
		image.resize({ w: width });
		const mime = (png ? JimpMime.png : image.mime ?? JimpMime.png) as typeof JimpMime.png;
		const format = mime.replace('image/', '');
		return { data: await image.getBuffer(mime), format, extension: imageExtensionOf(format) };
	}
}

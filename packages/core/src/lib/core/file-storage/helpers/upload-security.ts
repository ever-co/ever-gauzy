import * as path from 'path';
import { BadRequestException } from '@nestjs/common';

/**
 * Extensions that are never safe to store, because uploads are served unauthenticated from
 * `/public/<key>` with a `Content-Type` derived from the on-disk extension. A file stored as
 * `.svg`/`.html` is therefore served as active content and executes script in the application's
 * origin — stored XSS (GHSA-p334-cm7f-php5).
 */
export const BLOCKED_UPLOAD_EXTENSIONS = ['.svg', '.svgz', '.html', '.htm', '.xml', '.xhtml'] as const;

/** Raster image MIME types accepted by the image upload endpoints. */
export const ALLOWED_IMAGE_MIME_TYPES = [
	'image/png',
	'image/jpeg',
	'image/jpg',
	'image/gif',
	'image/webp',
	'image/bmp'
] as const;

/** Video MIME types accepted by the video upload endpoints. */
export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;

/** Audio MIME types accepted by the audio upload endpoints. */
export const ALLOWED_AUDIO_MIME_TYPES = [
	'audio/mpeg',
	'audio/mp3',
	'audio/wav',
	'audio/x-wav',
	'audio/webm',
	'audio/ogg'
] as const;

/** Signature of the `fileFilter` callback multer expects. */
export type MulterFileFilterCallback = (error: Error | null, acceptFile: boolean) => void;

/**
 * Builds a multer `fileFilter` that accepts only the given MIME types and always rejects the
 * markup extensions in {@link BLOCKED_UPLOAD_EXTENSIONS}.
 *
 * Both halves are needed: the MIME type is supplied by the client and is trivially spoofed, while
 * the extension is what determines the `Content-Type` the file is later served with. Neither check
 * inspects the bytes, so callers that persist the file must also run {@link isMarkupContent} on the
 * stored content — see {@link assertNotMarkupContent}.
 *
 * @param allowedMimeTypes - The MIME types to accept.
 * @returns A multer-compatible `fileFilter`.
 */
export function createUploadFileFilter(allowedMimeTypes: readonly string[]) {
	return (_req: any, file: any, callback: MulterFileFilterCallback): void => {
		const extension = path.extname(file?.originalname || '').toLowerCase();
		const isAllowedMime = allowedMimeTypes.includes(file?.mimetype);
		const isBlockedExtension = (BLOCKED_UPLOAD_EXTENSIONS as readonly string[]).includes(extension);

		if (isAllowedMime && !isBlockedExtension) {
			callback(null, true);
		} else {
			callback(
				new BadRequestException(`Unsupported file type: ${file?.mimetype || extension || 'unknown'}`),
				false
			);
		}
	};
}

/** Multer `fileFilter` accepting only raster images. */
export const imageUploadFileFilter = createUploadFileFilter(ALLOWED_IMAGE_MIME_TYPES);

/** Multer `fileFilter` accepting only video files. */
export const videoUploadFileFilter = createUploadFileFilter(ALLOWED_VIDEO_MIME_TYPES);

/** Multer `fileFilter` accepting only audio files. */
export const audioUploadFileFilter = createUploadFileFilter(ALLOWED_AUDIO_MIME_TYPES);

/**
 * Detects whether the given file content is markup (SVG / XML / HTML / XHTML).
 *
 * Two checks:
 * 1. A leading UTF-16 / UTF-32 byte-order mark indicates a text file — raster image, video and
 *    audio container formats never start with those byte sequences — so such files are rejected
 *    (this closes the wide-encoding `<svg>`/`<xml>` XSS bypass).
 * 2. Otherwise (UTF-8, with or without BOM) the first non-whitespace byte is `<`.
 *
 * Binary media never starts with `<` nor a UTF-16/32 BOM, so this has no false positives on
 * legitimate uploads.
 *
 * @param content - The raw file bytes (or string) to inspect.
 * @returns `true` if the content appears to be markup.
 */
export function isMarkupContent(content: Buffer | string): boolean {
	if (!content) {
		return false;
	}
	const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
	if (buffer.length === 0) {
		return false;
	}
	const startsWith = (...bytes: number[]): boolean =>
		buffer.length >= bytes.length && bytes.every((value, index) => buffer[index] === value);

	// UTF-32 / UTF-16 BOMs (binary media never begins with these).
	if (
		startsWith(0xff, 0xfe, 0x00, 0x00) || // UTF-32 LE
		startsWith(0x00, 0x00, 0xfe, 0xff) || // UTF-32 BE
		startsWith(0xfe, 0xff) || // UTF-16 BE
		startsWith(0xff, 0xfe) // UTF-16 LE
	) {
		return true;
	}

	// UTF-8 (optional BOM): first non-whitespace byte is `<`.
	let i = 0;
	if (startsWith(0xef, 0xbb, 0xbf)) {
		i = 3;
	}
	while (i < buffer.length && (buffer[i] === 0x20 || buffer[i] === 0x09 || buffer[i] === 0x0a || buffer[i] === 0x0d)) {
		i++;
	}
	return buffer[i] === 0x3c; // '<'
}

/**
 * Throws a {@link BadRequestException} when the stored bytes are markup.
 *
 * Call this after the file has been written but before any database record is created, so a
 * rejected upload leaves nothing behind — `/public` serves straight from disk whether or not the
 * record exists.
 *
 * @param content - The raw stored bytes to inspect.
 * @throws BadRequestException when the content appears to be markup.
 */
export function assertNotMarkupContent(content: Buffer | string): void {
	if (isMarkupContent(content)) {
		throw new BadRequestException('Unsupported file content: markup/script files are not allowed');
	}
}

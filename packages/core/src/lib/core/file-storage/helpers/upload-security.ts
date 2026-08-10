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

/** Extensions accepted by the image upload endpoints. */
export const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'] as const;

/** Video MIME types accepted by the video upload endpoints. */
export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;

/** Extensions accepted by the video upload endpoints. */
export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm'] as const;

/** Audio MIME types accepted by the audio upload endpoints. */
export const ALLOWED_AUDIO_MIME_TYPES = [
	'audio/mpeg',
	'audio/mp3',
	'audio/wav',
	'audio/x-wav',
	'audio/webm',
	'audio/ogg'
] as const;

/** Extensions accepted by the audio upload endpoints. */
export const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.webm', '.weba', '.ogg', '.oga', '.m4a'] as const;

/** Signature of the `fileFilter` callback multer expects. */
export type MulterFileFilterCallback = (error: Error | null, acceptFile: boolean) => void;

/**
 * Builds a multer `fileFilter` that accepts a file only when BOTH its MIME type and its extension
 * are on the given allowlists.
 *
 * The extension is allowlisted rather than denylisted on purpose. `/public` derives `Content-Type`
 * from the stored extension, so anything not explicitly known-inert is a potential active-content
 * type — a denylist has to enumerate every dangerous extension (`.svg`, `.xhtml`, `.mhtml`, `.xsl`,
 * `.shtml`, no extension at all, …) and is wrong the moment one is missed. {@link
 * BLOCKED_UPLOAD_EXTENSIONS} is still applied as a backstop so a risky extension added to an
 * allowlist by mistake is still refused.
 *
 * Neither check inspects the bytes, and both the MIME type and the filename come from the client,
 * so callers that persist the file must also run {@link assertNotMarkupContent} on the stored
 * content.
 *
 * @param allowedMimeTypes - The MIME types to accept.
 * @param allowedExtensions - The lowercase extensions to accept, each including the leading dot.
 * @returns A multer-compatible `fileFilter`.
 */
export function createUploadFileFilter(allowedMimeTypes: readonly string[], allowedExtensions: readonly string[]) {
	return (_req: any, file: any, callback: MulterFileFilterCallback): void => {
		const extension = path.extname(file?.originalname || '').toLowerCase();
		const isAllowedMime = allowedMimeTypes.includes(file?.mimetype);
		const isAllowedExtension = allowedExtensions.includes(extension);
		const isBlockedExtension = (BLOCKED_UPLOAD_EXTENSIONS as readonly string[]).includes(extension);

		if (isAllowedMime && isAllowedExtension && !isBlockedExtension) {
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
export const imageUploadFileFilter = createUploadFileFilter(ALLOWED_IMAGE_MIME_TYPES, ALLOWED_IMAGE_EXTENSIONS);

/** Multer `fileFilter` accepting only video files. */
export const videoUploadFileFilter = createUploadFileFilter(ALLOWED_VIDEO_MIME_TYPES, ALLOWED_VIDEO_EXTENSIONS);

/** Multer `fileFilter` accepting only audio files. */
export const audioUploadFileFilter = createUploadFileFilter(ALLOWED_AUDIO_MIME_TYPES, ALLOWED_AUDIO_EXTENSIONS);

/**
 * Detects whether the given file content is markup (SVG / XML / HTML / XHTML).
 *
 * In every encoding the test is the same: the first meaningful character must be `<`.
 *
 * - **UTF-16 / UTF-32.** A byte-order mark is consumed first, then the NUL padding those encodings
 *   interleave, and the first real character must still be `<`. The BOM alone is deliberately NOT
 *   treated as proof of markup: `FF FE` is also a valid MPEG-1 Layer I audio frame header, so
 *   rejecting on the BOM by itself would refuse legitimate audio uploads. (A frame that really did
 *   continue `FF FE 3C ..` would carry a reserved sample-rate and be invalid anyway.)
 *
 * BOM-less UTF-16 is deliberately not detected. Doing so would mean treating a leading run of NULs
 * as padding, and an MP4 whose first box is 60 bytes begins with exactly `00 00 00 3C` — the check
 * would reject valid video. It is also barely a vector: XML without a BOM or an encoding
 * declaration is not parsed as UTF-16 by browsers, and the extension allowlist in
 * {@link createUploadFileFilter} already refuses `.svg`/`.xhtml` outright.
 * - **UTF-8**, with or without a BOM: the first non-whitespace byte is `<`.
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
	const isWhitespace = (byte: number): boolean =>
		byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;
	const LESS_THAN = 0x3c;

	// Wide encodings: consume the BOM, then the NUL padding, then require `<`.
	let wideBomLength = 0;
	if (startsWith(0xff, 0xfe, 0x00, 0x00) || startsWith(0x00, 0x00, 0xfe, 0xff)) {
		wideBomLength = 4; // UTF-32 LE / BE
	} else if (startsWith(0xff, 0xfe) || startsWith(0xfe, 0xff)) {
		wideBomLength = 2; // UTF-16 LE / BE
	}

	if (wideBomLength > 0) {
		// One character of padding is at most 3 NULs; bound the scan so a binary file that merely
		// happens to open with those two bytes is not searched indefinitely for a `<`.
		const limit = Math.min(buffer.length, wideBomLength + 8);
		let wide = wideBomLength;
		while (wide < limit && (buffer[wide] === 0x00 || isWhitespace(buffer[wide]))) {
			wide++;
		}
		return buffer[wide] === LESS_THAN;
	}

	// UTF-8 (optional BOM): first non-whitespace byte is `<`.
	let index = startsWith(0xef, 0xbb, 0xbf) ? 3 : 0;
	while (index < buffer.length && isWhitespace(buffer[index])) {
		index++;
	}
	return buffer[index] === LESS_THAN;
}

/**
 * Largest stored upload that is read back in full for the markup check.
 *
 * The check only ever inspects the first few bytes, but the storage providers expose whole-object
 * reads (`getFile`) with no ranged variant, so scanning a 2 GB video would mean holding it in
 * memory on the request path. Beyond this size the scan is skipped and the extension allowlist in
 * {@link createUploadFileFilter} carries the protection on its own — which it can, because
 * `/public` derives `Content-Type` from the stored extension and sends `nosniff`, so a `.mp4` is
 * never executed as markup whatever its bytes contain.
 */
export const MARKUP_SCAN_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Whether an upload of the given size should be read back and scanned for markup.
 *
 * @param size - The stored size in bytes, if known. An unknown size is scanned.
 * @returns `true` when the file is small enough to read in full.
 */
export function shouldScanForMarkup(size?: number): boolean {
	// `Number.isFinite` is already false for a non-number, so it covers the unknown-size case too.
	return !Number.isFinite(size) || (size as number) <= MARKUP_SCAN_MAX_BYTES;
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

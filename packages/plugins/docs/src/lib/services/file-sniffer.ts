/**
 * Magic-byte content sniffing for Documents uploads — pure functions, no I/O.
 *
 * The client-declared MIME is advisory only; the stored `document.mimeType` is always the
 * **sniffed canonical** value produced here. Sniff window: first 4096 bytes (ZIP internal
 * entry checks scan the whole buffer). Allowlist and signatures follow the security spec
 * (`08-permissions-security.md` §5): pdf, docx/xlsx/pptx/odt/ods (ZIP + internal entry),
 * csv/txt/md (strict UTF-8 text heuristic), html (sanitized downstream), png/jpg/webp/gif.
 * Markup masquerading as an image is rejected (image-asset hardening precedent) and
 * **SVG is not accepted in any form** — neither are `.xml`/`.xhtml`.
 */

/** Number of leading bytes inspected by the signature checks. */
export const SNIFF_WINDOW_BYTES = 4096;

/** One row of the sniffing allowlist. */
export interface ISniffedType {
	/** Canonical MIME stored on `document.mimeType`. */
	mimeType: string;
	/** Canonical extension used in storage keys (no dot). */
	extension: string;
}

/** Result of a sniff run. */
export interface ISniffResult {
	ok: boolean;
	/** Set when `ok` — the canonical detection. */
	type?: ISniffedType;
	/** Set when `!ok` — a stable `DOCS_*`-style error code. */
	code?: string;
	/** Set when `!ok` — a user-safe message. */
	message?: string;
}

/** Extensions that are never accepted under any name (executable-markup surface). */
const BANNED_EXTENSIONS = new Set(['svg', 'svgz', 'xml', 'xhtml', 'html', 'htm']);
// NOTE: html/htm are *removed* from BANNED at check time when the sniffed type is text/html —
// the ban above exists so that html can never ride in under an image/office extension.

/** Extension → expected canonical MIME for the extension ↔ signature consistency check. */
const EXTENSION_TO_MIME: Record<string, string> = {
	pdf: 'application/pdf',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	odt: 'application/vnd.oasis.opendocument.text',
	ods: 'application/vnd.oasis.opendocument.spreadsheet',
	csv: 'text/csv',
	txt: 'text/plain',
	md: 'text/markdown',
	html: 'text/html',
	htm: 'text/html',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif'
};

/** Canonical extension per canonical MIME (storage-key suffix). */
const MIME_TO_EXTENSION: Record<string, string> = {
	'application/pdf': 'pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
	'application/vnd.oasis.opendocument.text': 'odt',
	'application/vnd.oasis.opendocument.spreadsheet': 'ods',
	'text/csv': 'csv',
	'text/plain': 'txt',
	'text/markdown': 'md',
	'text/html': 'html',
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

/**
 * Extracts the lowercase extension (without dot) from a filename. Empty string when absent.
 */
export function extractExtension(filename: string): string {
	const match = /\.([A-Za-z0-9]+)$/.exec(filename ?? '');
	return match ? match[1].toLowerCase() : '';
}

/**
 * Returns true when the buffer starts with the given byte sequence at the given offset.
 */
function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
	if (buffer.length < offset + bytes.length) {
		return false;
	}
	return bytes.every((value, index) => buffer[offset + index] === value);
}

/**
 * Detects markup content (SVG / XML / HTML / XHTML) pretending to be something else —
 * the image-asset hardening check: a UTF-16/32 BOM, or first non-whitespace byte `<`.
 *
 * Raster images never start with `<` nor a UTF-16/32 BOM, so this has no false positives
 * on legitimate images.
 *
 * @param buffer The raw file bytes.
 * @returns True when the content appears to be markup.
 */
export function isMarkupContent(buffer: Buffer): boolean {
	if (!buffer || buffer.length === 0) {
		return false;
	}

	// UTF-32 / UTF-16 BOMs (a raster image never begins with these).
	if (
		startsWith(buffer, [0xff, 0xfe, 0x00, 0x00]) || // UTF-32 LE
		startsWith(buffer, [0x00, 0x00, 0xfe, 0xff]) || // UTF-32 BE
		startsWith(buffer, [0xfe, 0xff]) || // UTF-16 BE
		startsWith(buffer, [0xff, 0xfe]) // UTF-16 LE
	) {
		return true;
	}

	// UTF-8 (optional BOM): first non-whitespace byte is `<`.
	let i = startsWith(buffer, [0xef, 0xbb, 0xbf]) ? 3 : 0;
	while (i < buffer.length && (buffer[i] === 0x20 || buffer[i] === 0x09 || buffer[i] === 0x0a || buffer[i] === 0x0d)) {
		i++;
	}
	return buffer[i] === 0x3c; // '<'
}

/** `readUtf8Sequence`: the sequence is malformed — the buffer is not UTF-8 text. */
const UTF8_SEQUENCE_INVALID = -1;
/** `readUtf8Sequence`: the sequence is cut off by the sniff-window edge — tolerated. */
const UTF8_SEQUENCE_AT_WINDOW_EDGE = -2;

/**
 * True when the buffer opens with a UTF-16/32 BOM — the wide-encoding masquerade surface,
 * which disqualifies the content from the UTF-8 text heuristic.
 */
function hasWideEncodingBom(window: Buffer): boolean {
	return (
		startsWith(window, [0xff, 0xfe]) ||
		startsWith(window, [0xfe, 0xff]) ||
		startsWith(window, [0x00, 0x00, 0xfe, 0xff])
	);
}

/**
 * Number of continuation bytes a UTF-8 lead byte announces, or `null` when the byte is not a
 * valid multi-byte lead. Only called for bytes ≥ 0x80 (ASCII never reaches here).
 */
function utf8ContinuationCount(byte: number): number | null {
	if ((byte & 0xe0) === 0xc0) {
		return 1;
	}
	if ((byte & 0xf0) === 0xe0) {
		return 2;
	}
	if ((byte & 0xf8) === 0xf0) {
		return 3;
	}
	return null; // invalid lead byte
}

/**
 * Validates the multi-byte UTF-8 sequence starting at `index`.
 *
 * @param window The sniff window.
 * @param index Index of the lead byte.
 * @returns The index just past the sequence, {@link UTF8_SEQUENCE_AT_WINDOW_EDGE} when the
 *          sequence is cut off by the window edge (≤3 bytes missing — tolerated), or
 *          {@link UTF8_SEQUENCE_INVALID} on a bad lead/continuation byte.
 */
function readUtf8Sequence(window: Buffer, index: number): number {
	const extra = utf8ContinuationCount(window[index]);
	if (extra === null) {
		return UTF8_SEQUENCE_INVALID; // invalid lead byte
	}
	// Tolerate a sequence cut off by the sniff-window edge (≤3 bytes missing).
	if (index + extra >= window.length && window.length === SNIFF_WINDOW_BYTES) {
		return UTF8_SEQUENCE_AT_WINDOW_EDGE;
	}
	for (let k = 1; k <= extra; k++) {
		if (index + k >= window.length || (window[index + k] & 0xc0) !== 0x80) {
			return UTF8_SEQUENCE_INVALID; // invalid continuation byte
		}
	}
	return index + extra + 1;
}

/**
 * Strict UTF-8 text heuristic for csv/txt/md/html acceptance: no NUL bytes, no UTF-16/32
 * BOM, and valid UTF-8 within the sniff window (with a ≤3-byte trim tolerance for a
 * multi-byte sequence cut at the window edge).
 *
 * @param buffer The raw file bytes (only the sniff window is inspected).
 * @returns True when the content is plausibly UTF-8 text.
 */
export function isProbablyUtf8Text(buffer: Buffer): boolean {
	if (!buffer || buffer.length === 0) {
		return false;
	}
	const window = buffer.subarray(0, SNIFF_WINDOW_BYTES);

	// UTF-16/32 BOMs disqualify (wide-encoding masquerade surface).
	if (hasWideEncodingBom(window)) {
		return false;
	}

	let i = startsWith(window, [0xef, 0xbb, 0xbf]) ? 3 : 0;
	while (i < window.length) {
		const byte = window[i];
		if (byte === 0x00) {
			return false; // NUL byte → binary
		}
		if (byte < 0x80) {
			i++;
			continue;
		}
		const next = readUtf8Sequence(window, i);
		if (next === UTF8_SEQUENCE_AT_WINDOW_EDGE) {
			return true;
		}
		if (next === UTF8_SEQUENCE_INVALID) {
			return false;
		}
		i = next;
	}
	return true;
}

/**
 * Scans a ZIP container's local-file-header entry names for a prefix. Used to
 * discriminate OOXML (`word/`, `xl/`, `ppt/`) and ODF (`mimetype` entry content).
 *
 * The scan walks `PK\x03\x04` local headers (name follows at +30) across the buffer —
 * cheap, allocation-free, and tolerant of any central-directory layout.
 *
 * @param buffer The full file buffer.
 * @param predicate Called with each entry name; return true to stop and accept.
 * @returns True when any entry name satisfies the predicate.
 */
/** The ZIP local-file-header signature (PK 0x03 0x04). */
const ZIP_LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export function zipHasEntry(buffer: Buffer, predicate: (name: string) => boolean): boolean {
	let offset = 0;
	let guard = 0;
	while (offset + 30 <= buffer.length && guard < 4096) {
		guard++;
		const index = buffer.indexOf(ZIP_LOCAL_HEADER, offset);
		if (index === -1) {
			return false;
		}
		// 🛑 The loop guard bounds `offset`, but the read is at `index + 26` and `indexOf`
		// can land arbitrarily far past `offset`. A `PK\x03\x04` sequence inside the last
		// 29 bytes therefore made `readUInt16LE` throw RangeError instead of the sniffer
		// simply reporting "no match". A truncated header cannot carry an entry name, and
		// any later signature is nearer the end still, so the scan is finished.
		if (index + 30 > buffer.length) {
			return false;
		}
		const nameLength = buffer.readUInt16LE(index + 26);
		const nameStart = index + 30;
		if (nameStart + nameLength <= buffer.length && nameLength > 0 && nameLength < 512) {
			const name = buffer.toString('utf8', nameStart, nameStart + nameLength);
			if (predicate(name)) {
				return true;
			}
		}
		offset = index + 4;
	}
	return false;
}

/**
 * Reads the ODF `mimetype` entry (stored uncompressed as the first ZIP entry by spec).
 */
function readOdfMimetype(buffer: Buffer): string | null {
	// 🛑 `startsWith` proves only the 4-byte signature, but the fixed part of a ZIP local
	// file header is 30 bytes and the reads below sit at offsets 18/26/28. Without the
	// length guard a 4–29 byte buffer opening with `PK\x03\x04` threw RangeError out of
	// `sniffFile` — and the inbound-email path calls that outside its try/catch, turning
	// one malformed attachment into a 500 for the whole webhook delivery.
	if (buffer.length < 30 || !startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
		return null;
	}
	const nameLength = buffer.readUInt16LE(26);
	const extraLength = buffer.readUInt16LE(28);
	const nameStart = 30;
	const name = buffer.toString('utf8', nameStart, nameStart + nameLength);
	if (name !== 'mimetype') {
		return null;
	}
	const dataStart = nameStart + nameLength + extraLength;
	const size = buffer.readUInt32LE(18); // compressed size (== uncompressed for STORED)
	if (size === 0 || size > 128 || dataStart + size > buffer.length) {
		return null;
	}
	return buffer.toString('utf8', dataStart, dataStart + size);
}

/**
 * Sniffs a ZIP-based container into its canonical office type, or null when the internal
 * structure matches none of the accepted formats.
 */
function sniffZipContainer(buffer: Buffer): ISniffedType | null {
	const odfMime = readOdfMimetype(buffer);
	if (odfMime === 'application/vnd.oasis.opendocument.text') {
		return { mimeType: odfMime, extension: 'odt' };
	}
	if (odfMime === 'application/vnd.oasis.opendocument.spreadsheet') {
		return { mimeType: odfMime, extension: 'ods' };
	}
	if (zipHasEntry(buffer, (name) => name.startsWith('word/'))) {
		return { mimeType: EXTENSION_TO_MIME['docx'], extension: 'docx' };
	}
	if (zipHasEntry(buffer, (name) => name.startsWith('xl/'))) {
		return { mimeType: EXTENSION_TO_MIME['xlsx'], extension: 'xlsx' };
	}
	if (zipHasEntry(buffer, (name) => name.startsWith('ppt/'))) {
		return { mimeType: EXTENSION_TO_MIME['pptx'], extension: 'pptx' };
	}
	return null;
}

/**
 * Sniffs the canonical type from the raw bytes alone (no filename input). Returns null
 * when no binary signature matches — text types are resolved by `sniffFile` using the
 * filename extension to pick among csv/txt/md/html.
 */
export function sniffBinarySignature(buffer: Buffer): ISniffedType | null {
	if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) {
		return { mimeType: 'application/pdf', extension: 'pdf' }; // %PDF
	}
	if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
		return sniffZipContainer(buffer); // PK — OOXML / ODF
	}
	if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
		return { mimeType: 'image/png', extension: 'png' };
	}
	if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
		return { mimeType: 'image/jpeg', extension: 'jpg' };
	}
	if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) {
		return { mimeType: 'image/webp', extension: 'webp' }; // RIFF….WEBP
	}
	if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) {
		return { mimeType: 'image/gif', extension: 'gif' }; // GIF87a / GIF89a
	}
	return null;
}

/**
 * Full sniff gauntlet for one uploaded file: signature detection, text heuristic,
 * markup-in-image rejection, the SVG/XML ban, and extension ↔ signature ↔ declared-MIME
 * consistency (declared MIME may be empty or `application/octet-stream`).
 *
 * @param buffer The stored file bytes.
 * @param filename The client-supplied original filename (extension source).
 * @param declaredMime The client-declared MIME (advisory only).
 * @returns Accept/reject with the canonical type or a stable error code.
 */
export function sniffFile(buffer: Buffer, filename: string, declaredMime?: string): ISniffResult {
	const extension = extractExtension(filename);

	// The hard ban: SVG / XML / XHTML never enter, under any signature.
	if (['svg', 'svgz', 'xml', 'xhtml'].includes(extension)) {
		return reject('DOCS_FILE_TYPE_REJECTED', `File type .${extension} is not accepted`);
	}
	if (declaredMime && /svg|xml/i.test(declaredMime)) {
		return reject('DOCS_FILE_TYPE_REJECTED', `File type ${declaredMime} is not accepted`);
	}

	if (!buffer || buffer.length === 0) {
		return reject('DOCS_FILE_TYPE_REJECTED', 'Empty file');
	}

	// 1) Binary signatures first (pdf / zip-office / images).
	const binary = sniffBinarySignature(buffer);
	if (binary) {
		return acceptWithConsistency(binary, extension, declaredMime);
	}

	// 2) Text heuristic — csv / txt / md / html discriminated by extension.
	if (isProbablyUtf8Text(buffer)) {
		return sniffTextPayload(buffer, extension, declaredMime);
	}

	return reject('DOCS_FILE_TYPE_REJECTED', 'Unsupported or unrecognized file type');
}

/**
 * Resolves a payload that already passed the UTF-8 text heuristic into its canonical text
 * type. csv / txt / md / html are discriminated by the filename extension — the bytes alone
 * cannot tell them apart — and markup is only ever accepted under `.html`/`.htm`.
 *
 * @param buffer The stored file bytes.
 * @param extension The lowercase extension of the original filename (empty when absent).
 * @param declaredMime The client-declared MIME (advisory only).
 * @returns Accept/reject with the canonical type or a stable error code.
 */
function sniffTextPayload(buffer: Buffer, extension: string, declaredMime?: string): ISniffResult {
	if (extension === 'html' || extension === 'htm') {
		// Accepted; sanitized server-side before any storage of derived HTML.
		return acceptWithConsistency({ mimeType: 'text/html', extension: 'html' }, extension, declaredMime);
	}
	if (isMarkupContent(buffer)) {
		// Markup under a non-HTML text name (e.g. shape.svg renamed notes.txt) — reject.
		return reject('DOCS_FILE_TYPE_REJECTED', 'Markup content is only accepted as .html');
	}
	if (extension === 'csv') {
		return acceptWithConsistency({ mimeType: 'text/csv', extension: 'csv' }, extension, declaredMime);
	}
	if (extension === 'md') {
		return acceptWithConsistency({ mimeType: 'text/markdown', extension: 'md' }, extension, declaredMime);
	}
	if (extension === 'txt' || extension === '') {
		return acceptWithConsistency({ mimeType: 'text/plain', extension: 'txt' }, extension, declaredMime);
	}
	// A text payload under a binary extension (e.g. .png containing HTML) is a masquerade.
	return reject('DOCS_FILE_TYPE_REJECTED', `Content does not match the .${extension} file type`);
}

/**
 * Applies the extension ↔ signature ↔ declared-MIME consistency rule on an accepted type.
 */
function acceptWithConsistency(type: ISniffedType, extension: string, declaredMime?: string): ISniffResult {
	// Markup-in-image: an image signature can never carry markup by construction here, but a
	// banned extension riding an accepted signature (e.g. picture.svg with PNG bytes) is refused.
	if (extension && BANNED_EXTENSIONS.has(extension) && type.mimeType !== 'text/html') {
		return reject('DOCS_FILE_TYPE_REJECTED', `File type .${extension} is not accepted`);
	}

	// Extension consistency (missing extension tolerated; jpg/jpeg style aliases resolved by map).
	if (extension) {
		const expected = EXTENSION_TO_MIME[extension];
		if (expected && expected !== type.mimeType) {
			return reject(
				'DOCS_TYPE_MISMATCH',
				`File extension .${extension} does not match its content (${type.mimeType})`
			);
		}
	}

	// Declared-MIME consistency: empty and octet-stream are fine; a conflicting concrete type is not.
	if (declaredMime && declaredMime !== 'application/octet-stream') {
		const normalized = normalizeDeclared(declaredMime);
		// An empty normalization means "generic, non-conflicting" (e.g. application/zip for OOXML).
		if (normalized && normalized !== type.mimeType) {
			return reject(
				'DOCS_TYPE_MISMATCH',
				`Declared type ${declaredMime} does not match the file content (${type.mimeType})`
			);
		}
	}

	return { ok: true, type };
}

/** Normalizes common declared-MIME aliases to their canonical form. */
function normalizeDeclared(declared: string): string {
	const lower = declared.toLowerCase().split(';')[0].trim();
	const aliases: Record<string, string> = {
		'image/jpg': 'image/jpeg',
		'application/x-pdf': 'application/pdf',
		'text/x-markdown': 'text/markdown',
		'application/csv': 'text/csv',
		'application/zip': 'application/zip-any', // zip declared for office files — resolved below
		'application/x-zip-compressed': 'application/zip-any'
	};
	const normalized = aliases[lower] ?? lower;
	// A generic zip declaration is acceptable for any of the zip-based office formats.
	if (normalized === 'application/zip-any') {
		return ''; // treated as non-conflicting
	}
	return normalized;
}

/** Builds a rejection result. */
function reject(code: string, message: string): ISniffResult {
	return { ok: false, code, message };
}

/**
 * Returns the canonical storage-key extension for a canonical MIME (no dot),
 * stripped to `[a-z0-9]`.
 */
export function canonicalExtension(mimeType: string): string {
	return (MIME_TO_EXTENSION[mimeType] ?? 'bin').replace(/[^a-z0-9]/g, '');
}

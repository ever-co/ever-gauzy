import { inflateRawSync } from 'zlib';
import { DocsPermanentError } from '../errors';

/**
 * A dependency-free reader for the ZIP containers that OOXML (`.pptx`) and OpenDocument
 * (`.odt` / `.ods`) files are.
 *
 * Why hand-rolled: the plugin already ships a hand-rolled ZIP *writer* for the OOXML test
 * fixtures, for the same reason — a ZIP container is a short, fully specified format, and the
 * alternative is adding a general-purpose archive library to the backend's dependency tree to
 * read two office formats. The DOCX and XLSX paths get their ZIP handling for free inside
 * `mammoth` and `exceljs`; PPTX and ODF have no such parser in the tree, and this is what stands
 * in for it.
 *
 * Reads the CENTRAL DIRECTORY rather than streaming local headers: the central directory is the
 * authoritative index (a local header may carry zeroed sizes with a trailing data descriptor),
 * and it is what every real writer produces last.
 *
 * 🛑 Hardened, because the input is an untrusted upload: ZIP64 is refused rather than
 * mis-parsed, entry names are rejected if they escape the archive root, and both the per-entry
 * and the cumulative inflated size are capped so a zip bomb cannot exhaust the worker's heap.
 */

/** Largest inflated size accepted for ONE entry (a slide/content part is orders of magnitude smaller). */
export const OFFICE_PACKAGE_MAX_ENTRY_BYTES = 64 * 1024 * 1024;

/** Largest total inflated size one package may yield across all the entries an extractor reads. */
export const OFFICE_PACKAGE_MAX_TOTAL_BYTES = 192 * 1024 * 1024;

/** ZIP structural signatures. */
const SIGNATURE_EOCD = 0x06054b50;
const SIGNATURE_CENTRAL = 0x02014b50;
const SIGNATURE_LOCAL = 0x04034b50;

/** ZIP64 sentinel: a 32-bit field set to this means "the real value lives in the ZIP64 record". */
const ZIP64_SENTINEL = 0xffffffff;

/** Compression methods this reader understands. */
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

/** Maximum ZIP end-of-central-directory comment, i.e. how far back the EOCD scan must look. */
const MAX_EOCD_COMMENT_BYTES = 0xffff;

/** One indexed member of the archive. */
interface IPackageEntry {
	name: string;
	method: number;
	compressedSize: number;
	uncompressedSize: number;
	localHeaderOffset: number;
}

/** The read surface an extractor works against. */
export interface IOfficePackage {
	/** Every entry name in the archive, in central-directory order. */
	names(): string[];
	/** Whether an entry with this exact name exists. */
	has(name: string): boolean;
	/** The entry's decompressed bytes, or undefined when it does not exist. */
	read(name: string): Buffer | undefined;
	/** The entry decoded as UTF-8 with any BOM stripped, or undefined when it does not exist. */
	readText(name: string): string | undefined;
}

/**
 * Opens an OOXML / OpenDocument package for reading.
 *
 * @param buffer The uploaded file bytes.
 * @returns The package reader.
 * @throws DocsPermanentError when the bytes are not a readable ZIP container — a corrupt or
 *         password-protected office file is never going to succeed on a retry.
 */
export function openOfficePackage(buffer: Buffer): IOfficePackage {
	if (!buffer || buffer.length < 22) {
		throw new DocsPermanentError('The file could not be read — it is not a valid office package.');
	}

	const eocdOffset = findEndOfCentralDirectory(buffer);
	if (eocdOffset < 0) {
		throw new DocsPermanentError(
			'The file could not be read — it may be corrupt, password-protected, or not an office document.'
		);
	}

	const entryCount = buffer.readUInt16LE(eocdOffset + 10);
	const centralSize = buffer.readUInt32LE(eocdOffset + 12);
	const centralOffset = buffer.readUInt32LE(eocdOffset + 16);

	if (centralOffset === ZIP64_SENTINEL || centralSize === ZIP64_SENTINEL || entryCount === 0xffff) {
		// A ZIP64 package means a >4 GB / >65535-entry office file. Refusing beats guessing.
		throw new DocsPermanentError('ZIP64 office packages are not supported — re-save the file and try again.');
	}
	if (centralOffset + centralSize > buffer.length) {
		throw new DocsPermanentError('The file could not be read — its archive index is truncated.');
	}

	const entries = readCentralDirectory(buffer, centralOffset, entryCount);
	const index = new Map(entries.map((entry) => [entry.name, entry]));
	let inflatedTotal = 0;

	/** Decompresses one entry, enforcing both size fuses. */
	const readEntry = (entry: IPackageEntry): Buffer => {
		if (entry.uncompressedSize > OFFICE_PACKAGE_MAX_ENTRY_BYTES) {
			throw new DocsPermanentError('The office package contains an implausibly large part and was refused.');
		}
		const data = extractEntryBytes(buffer, entry);
		inflatedTotal += data.length;
		if (inflatedTotal > OFFICE_PACKAGE_MAX_TOTAL_BYTES) {
			throw new DocsPermanentError('The office package expands to an implausible size and was refused.');
		}
		return data;
	};

	return {
		names: () => entries.map((entry) => entry.name),
		has: (name: string) => index.has(name),
		read: (name: string) => {
			const entry = index.get(name);
			return entry ? readEntry(entry) : undefined;
		},
		readText: (name: string) => {
			const entry = index.get(name);
			if (!entry) return undefined;
			return stripByteOrderMark(readEntry(entry).toString('utf8'));
		}
	};
}

/**
 * Drops a leading UTF-8 byte-order mark.
 *
 * Office writers emit one on their XML parts routinely, and a BOM left in place is not
 * whitespace to an XML parser — it lands before the declaration and makes the part unparseable.
 * Written as an escape so no invisible character lives in this source file.
 */
function stripByteOrderMark(text: string): string {
	return text.replace(/^\uFEFF/, '');
}

/**
 * Scans backwards for the end-of-central-directory record.
 *
 * Backwards because the record sits at the very end of a well-formed archive but may be followed
 * by up to 64 KB of archive comment — and a *forward* scan would happily match the same four
 * bytes appearing inside compressed data.
 *
 * @param buffer The archive bytes.
 * @returns The EOCD offset, or -1 when there is none.
 */
function findEndOfCentralDirectory(buffer: Buffer): number {
	const earliest = Math.max(0, buffer.length - MAX_EOCD_COMMENT_BYTES - 22);
	for (let offset = buffer.length - 22; offset >= earliest; offset--) {
		if (buffer.readUInt32LE(offset) === SIGNATURE_EOCD) {
			return offset;
		}
	}
	return -1;
}

/**
 * Reads the central directory into the entry index.
 *
 * @param buffer The archive bytes.
 * @param offset Offset of the first central-directory record.
 * @param entryCount Number of records the EOCD declares.
 * @returns The indexed entries.
 */
function readCentralDirectory(buffer: Buffer, offset: number, entryCount: number): IPackageEntry[] {
	const entries: IPackageEntry[] = [];
	let cursor = offset;

	for (let i = 0; i < entryCount; i++) {
		if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== SIGNATURE_CENTRAL) {
			throw new DocsPermanentError('The file could not be read — its archive index is malformed.');
		}
		const method = buffer.readUInt16LE(cursor + 10);
		const compressedSize = buffer.readUInt32LE(cursor + 20);
		const uncompressedSize = buffer.readUInt32LE(cursor + 24);
		const nameLength = buffer.readUInt16LE(cursor + 28);
		const extraLength = buffer.readUInt16LE(cursor + 30);
		const commentLength = buffer.readUInt16LE(cursor + 32);
		const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
		const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);

		if (
			compressedSize === ZIP64_SENTINEL ||
			uncompressedSize === ZIP64_SENTINEL ||
			localHeaderOffset === ZIP64_SENTINEL
		) {
			throw new DocsPermanentError('ZIP64 office packages are not supported — re-save the file and try again.');
		}
		// Directory entries end in '/'; nothing to read from them. Absolute or traversing names
		// have no legitimate meaning inside an office package — the extractors only ever address
		// entries by their exact, known names, but an index containing them is a red flag.
		if (!name.endsWith('/') && !name.startsWith('/') && !name.split('/').includes('..')) {
			entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
		}

		cursor += 46 + nameLength + extraLength + commentLength;
	}

	return entries;
}

/**
 * Decompresses one entry, resolving its data offset through the LOCAL header (the central
 * directory records where the local header starts, not where its payload does — and the local
 * header's own extra field routinely differs in length from the central one).
 *
 * @param buffer The archive bytes.
 * @param entry The indexed entry.
 * @returns The decompressed payload.
 */
function extractEntryBytes(buffer: Buffer, entry: IPackageEntry): Buffer {
	const headerOffset = entry.localHeaderOffset;
	if (headerOffset + 30 > buffer.length || buffer.readUInt32LE(headerOffset) !== SIGNATURE_LOCAL) {
		throw new DocsPermanentError(`The office package part '${entry.name}' could not be located.`);
	}
	const nameLength = buffer.readUInt16LE(headerOffset + 26);
	const extraLength = buffer.readUInt16LE(headerOffset + 28);
	const start = headerOffset + 30 + nameLength + extraLength;
	const end = start + entry.compressedSize;
	if (end > buffer.length) {
		throw new DocsPermanentError(`The office package part '${entry.name}' is truncated.`);
	}

	const payload = buffer.subarray(start, end);
	if (entry.method === METHOD_STORED) {
		return Buffer.from(payload);
	}
	if (entry.method === METHOD_DEFLATE) {
		try {
			return inflateRawSync(payload, { maxOutputLength: OFFICE_PACKAGE_MAX_ENTRY_BYTES });
		} catch (error) {
			throw new DocsPermanentError(`The office package part '${entry.name}' could not be decompressed.`, error);
		}
	}
	throw new DocsPermanentError(
		`The office package uses an unsupported compression method (${entry.method}) — re-save the file and try again.`
	);
}

import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as unzipper from 'unzipper';
import {
	DOCS_IMPORT_NOT_A_ZIP,
	DOCS_IMPORT_SYMLINK,
	DOCS_IMPORT_TOO_LARGE,
	DOCS_IMPORT_TOO_MANY_ENTRIES,
	DOCS_IMPORT_UNSAFE_PATH,
	DOCS_IMPORT_ZIP_BOMB
} from '../docs.constants';

/** How much an import zip may hold and unpack to (`docs-import-export` spec FR-2). */
export interface IImportArchiveLimits {
	/** The entries of the central directory, folders included. */
	maxEntries: number;
	/** Everything the archive unpacks to, together. */
	maxUncompressedBytes: number;
	/** The inflation ratio (uncompressed : compressed) past which an entry is a bomb… */
	maxRatio: number;
	/** …once it inflates to at least this many bytes (a small, highly repetitive text is not one). */
	ratioMinBytes: number;
}

/**
 * Why an archive was refused: a stable `code` (`DOCS_IMPORT_*`) and the HTTP status that answers it — 413 for the
 * limits, 400 for an archive that is not one or names an unsafe path.
 */
export class ImportArchiveError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly status: 400 | 413 = 400
	) {
		super(message);
		this.name = 'ImportArchiveError';
	}
}

/** One file of the archive, as the import reads it. */
export interface IImportArchiveEntry {
	/** The normalized path inside the archive: `/`-separated, no `.` segment, no leading or trailing `/`. */
	readonly path: string;
	/** The size the central directory declares. */
	readonly size: number;
	readonly compressedSize: number;
	/** Whether the entry is encrypted (it cannot be read without a password the import never has). */
	readonly encrypted: boolean;
	/**
	 * Inflates the entry, counting as it goes: refused past the size the entry declares, and past the archive's
	 * remaining budget (the declared sizes are the archive's word, not a fact).
	 */
	read(): Promise<Buffer>;
}

/** The files of an archive, its folders, and what its central directory declares. */
export interface IImportArchive {
	entries: IImportArchiveEntry[];
	/** Every folder named by an entry, explicitly or as the parent of a file. */
	directories: string[];
	/** The total uncompressed size the central directory declares for the files. */
	declaredBytes: number;
}

/** `S_IFMT` / `S_IFLNK` of the Unix mode a zip keeps in the upper half of an entry's external attributes. */
const UNIX_FILE_TYPE_MASK = 0o170000;
const UNIX_SYMLINK = 0o120000;

/**
 * The entry's path, normalized, or null when it is unsafe: absolute (`/…`), with a drive letter (`C:…`), a NUL byte or
 * a `..` segment. Backslashes (written by some Windows archivers) are separators; `.` and empty segments are dropped.
 * An empty result (the archive's root) is returned as `''`.
 *
 * @param raw The path as the central directory names it.
 * @returns The safe, normalized path, or null.
 */
export function normalizeArchivePath(raw: string): string | null {
	const value = String(raw ?? '');
	if (value.includes('\0')) return null;
	const slashed = value.replace(/\\/g, '/');
	if (slashed.startsWith('/') || /^[a-zA-Z]:/.test(slashed)) return null;
	const segments: string[] = [];
	for (const segment of slashed.split('/')) {
		if (segment === '' || segment === '.') continue;
		if (segment === '..') return null;
		segments.push(segment);
	}
	return segments.join('/');
}

/** Whether a central-directory record is a symbolic link (the Unix file type of its external attributes). */
export function isSymlinkRecord(record: { externalFileAttributes?: number }): boolean {
	const mode = (Number(record?.externalFileAttributes ?? 0) >>> 16) & 0xffff;
	return (mode & UNIX_FILE_TYPE_MASK) === UNIX_SYMLINK;
}

/**
 * Opens an import zip and checks it whole before anything is extracted (`docs-import-export` spec FR-2):
 *
 * - not a zip → 400 `DOCS_IMPORT_NOT_A_ZIP`;
 * - more entries than {@link IImportArchiveLimits.maxEntries} → 413 `DOCS_IMPORT_TOO_MANY_ENTRIES`;
 * - an unsafe path → 400 `DOCS_IMPORT_UNSAFE_PATH`; a symbolic link → 400 `DOCS_IMPORT_SYMLINK`;
 * - declared sizes over {@link IImportArchiveLimits.maxUncompressedBytes} → 413 `DOCS_IMPORT_TOO_LARGE`;
 * - an entry whose declared inflation ratio passes {@link IImportArchiveLimits.maxRatio} → 413 `DOCS_IMPORT_ZIP_BOMB`.
 *
 * The entries are not read here; each `read()` inflates one entry through a counting stream that stops it the moment it
 * passes the size it declared or the archive's budget (413 `DOCS_IMPORT_ZIP_BOMB`). Two entries naming the same path
 * keep the first (a later one would silently replace a page).
 *
 * @param buffer The uploaded zip.
 * @param limits The limits of this installation.
 * @returns The archive's files and folders.
 */
export async function openImportArchive(buffer: Buffer, limits: IImportArchiveLimits): Promise<IImportArchive> {
	let directory: Awaited<ReturnType<typeof unzipper.Open.buffer>>;
	try {
		directory = await unzipper.Open.buffer(buffer);
	} catch {
		throw new ImportArchiveError(DOCS_IMPORT_NOT_A_ZIP, 'The file is not a zip archive.');
	}
	const records = Array.isArray(directory?.files) ? directory.files : [];
	if (records.length > limits.maxEntries) {
		throw new ImportArchiveError(
			DOCS_IMPORT_TOO_MANY_ENTRIES,
			`The archive holds ${records.length} entries; the import takes at most ${limits.maxEntries}.`,
			413
		);
	}

	const directories = new Set<string>();
	const seen = new Set<string>();
	const files: unzipper.File[] = [];
	const paths: string[] = [];
	let declaredBytes = 0;
	for (const record of records) {
		const path = normalizeArchivePath(record.path);
		if (path === null) {
			throw new ImportArchiveError(DOCS_IMPORT_UNSAFE_PATH, `The archive names an unsafe path: ${printable(record.path)}.`);
		}
		if (isSymlinkRecord(record)) {
			throw new ImportArchiveError(DOCS_IMPORT_SYMLINK, `The archive holds a symbolic link: ${printable(record.path)}.`);
		}
		if (!path) continue;
		const isDirectory = record.type === 'Directory' || /[/\\]$/.test(String(record.path));
		addParents(directories, path, isDirectory);
		if (isDirectory || seen.has(path)) continue;
		seen.add(path);
		const size = Math.max(0, Number(record.uncompressedSize) || 0);
		const compressed = Math.max(0, Number(record.compressedSize) || 0);
		if (size >= limits.ratioMinBytes && size > limits.maxRatio * Math.max(compressed, 1)) {
			throw new ImportArchiveError(DOCS_IMPORT_ZIP_BOMB, `The entry ${printable(path)} inflates past the import's limits.`, 413);
		}
		declaredBytes += size;
		files.push(record);
		paths.push(path);
	}
	if (declaredBytes > limits.maxUncompressedBytes) {
		throw new ImportArchiveError(
			DOCS_IMPORT_TOO_LARGE,
			`The archive unpacks to more than the ${limits.maxUncompressedBytes} bytes the import takes.`,
			413
		);
	}

	const budget = { remaining: limits.maxUncompressedBytes };
	const entries: IImportArchiveEntry[] = files.map((record, index) => ({
		path: paths[index],
		size: Math.max(0, Number(record.uncompressedSize) || 0),
		compressedSize: Math.max(0, Number(record.compressedSize) || 0),
		encrypted: (Number(record.flags) & 0x1) === 1,
		read: () => readCounted(record, paths[index], budget)
	}));
	return { entries, directories: [...directories].sort(), declaredBytes };
}

/** Inflates one record through a stream that counts what it writes against the declared size and the archive budget. */
async function readCounted(record: unzipper.File, path: string, budget: { remaining: number }): Promise<Buffer> {
	const declared = Math.max(0, Number(record.uncompressedSize) || 0);
	const chunks: Buffer[] = [];
	let written = 0;
	const counted = new Writable({
		write(chunk: Buffer, _encoding, callback) {
			written += chunk.length;
			if (written > declared || written > budget.remaining) {
				callback(new ImportArchiveError(DOCS_IMPORT_ZIP_BOMB, `The entry ${printable(path)} inflates past the size it declares.`, 413));
				return;
			}
			chunks.push(chunk);
			callback();
		}
	});
	await pipeline(record.stream(), counted);
	budget.remaining -= written;
	return Buffer.concat(chunks);
}

/** Adds every folder above `path` (and `path` itself when it is a folder). */
function addParents(directories: Set<string>, path: string, isDirectory: boolean): void {
	const segments = path.split('/');
	const upTo = isDirectory ? segments.length : segments.length - 1;
	for (let i = 1; i <= upTo; i++) {
		directories.add(segments.slice(0, i).join('/'));
	}
}

/** A path as a message may show it: control characters out, at most 200 characters. */
function printable(path: unknown): string {
	return JSON.stringify(String(path ?? '').replace(/[\u0000-\u001f\u007f]/g, '?').slice(0, 200));
}

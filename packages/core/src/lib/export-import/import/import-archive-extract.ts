import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { createWriteStream } from 'node:fs';
import * as path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as unzipper from 'unzipper';
import { EXPORT_MANIFEST_FILE } from '../export-manifest';

const MB = 1024 * 1024;

/** A positive whole number of megabytes from the environment, else the default. */
function megabytes(name: string, fallback: number): number {
	const value = Number(process.env[name]);
	return (Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback) * MB;
}

/** How large an import archive, and what it unpacks to, may be. */
export interface ImportArchiveLimits {
	/** The uploaded archive (`GAUZY_IMPORT_MAX_ARCHIVE_MB`, default 256). */
	maxArchiveBytes: number;
	/** Everything it unpacks to, together (`GAUZY_IMPORT_MAX_EXTRACTED_MB`, default 2048). */
	maxExtractedBytes: number;
	/** The entries of its central directory: one per table, and there are a few hundred tables. */
	maxEntries: number;
}

export const IMPORT_ARCHIVE_LIMITS: Readonly<ImportArchiveLimits> = Object.freeze({
	maxArchiveBytes: megabytes('GAUZY_IMPORT_MAX_ARCHIVE_MB', 256),
	maxExtractedBytes: megabytes('GAUZY_IMPORT_MAX_EXTRACTED_MB', 2048),
	maxEntries: 2000
});

/** The entries an import reads: one CSV per table, at the root (table names are `[a-z0-9_-]`), and the manifest. */
const TABLE_CSV = /^[A-Za-z0-9_-]+\.csv$/;

/**
 * Unpacks an import archive into `extractPath` (a fresh directory of this request), within {@link ImportArchiveLimits}.
 *
 * The archive used to be extracted whole, every entry at once, with no limit on the upload, on the number of entries or
 * on what they inflate to: one tenant administrator's deflate bomb (a few megabytes that inflate to gigabytes of zeros)
 * filled the API's disk or memory, for every tenant. Now:
 *
 * - only the entries the import reads are written: `<table>.csv` at the root and the export manifest;
 * - the central directory may list at most {@link ImportArchiveLimits.maxEntries} entries, and the sizes it declares for
 *   those may add up to at most {@link ImportArchiveLimits.maxExtractedBytes};
 * - each entry is inflated one at a time and counted as it is written, so one that inflates past the size it declared,
 *   or past the total, is stopped there — the declared sizes are the archive's word, not a fact.
 *
 * @throws PayloadTooLargeException when the archive unpacks to more than the limits allow.
 * @throws BadRequestException when it is not a ZIP, or names an entry twice.
 */
export async function extractImportArchive(
	archive: Buffer,
	extractPath: string,
	limits: ImportArchiveLimits = IMPORT_ARCHIVE_LIMITS
): Promise<void> {
	let directory: Awaited<ReturnType<typeof unzipper.Open.buffer>>;
	try {
		directory = await unzipper.Open.buffer(archive);
	} catch {
		throw new BadRequestException('The import file is not a ZIP archive.');
	}

	if (directory.files.length > limits.maxEntries) {
		throw new PayloadTooLargeException(`The import archive holds more than ${limits.maxEntries} entries.`);
	}

	const entries = directory.files.filter(
		(entry) => entry.type === 'File' && (TABLE_CSV.test(entry.path) || entry.path === EXPORT_MANIFEST_FILE)
	);
	if (new Set(entries.map((entry) => entry.path)).size !== entries.length) {
		throw new BadRequestException('The import archive names a table twice.');
	}

	const declared = entries.reduce((total, entry) => total + entry.uncompressedSize, 0);
	if (declared > limits.maxExtractedBytes) {
		throw new PayloadTooLargeException('The import archive unpacks to more than the import accepts.');
	}

	let written = 0;
	for (const entry of entries) {
		let entryWritten = 0;
		const counted = new Transform({
			transform(chunk: Buffer, _encoding, callback) {
				entryWritten += chunk.length;
				written += chunk.length;
				if (entryWritten > entry.uncompressedSize || written > limits.maxExtractedBytes) {
					callback(new PayloadTooLargeException('The import archive unpacks to more than it declares.'));
					return;
				}
				callback(null, chunk);
			}
		});
		await pipeline(entry.stream(), counted, createWriteStream(path.join(extractPath, entry.path), { flags: 'wx' }));
	}
}

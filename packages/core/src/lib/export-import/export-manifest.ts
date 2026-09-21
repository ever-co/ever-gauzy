import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

/**
 * The marker file Gauzy writes at the root of every *data* export archive.
 *
 * 🛑 Why this exists: the import side reverses the spreadsheet-formula escape
 * (`fromSpreadsheetSafeCsvRow`), and an uploaded ZIP is not
 * necessarily one this version produced — it can come from an older Gauzy, from a hand-filled
 * `/export/template` archive, or from external tooling. Decoding those unconditionally would
 * silently drop a legitimate leading apostrophe from a value such as `'=notes`. The marker is what
 * lets the importer tell "we escaped this" from "somebody else wrote this".
 */
export const EXPORT_MANIFEST_FILE = 'gauzy-export.json';

/** Value of {@link IExportManifest.format} this code writes and recognizes. */
export const EXPORT_MANIFEST_FORMAT = 'gauzy-export';

/** Archive format version this code writes. A newer archive is not decoded by an older server. */
export const EXPORT_MANIFEST_VERSION = 1;

/**
 * An uploaded archive is attacker-controlled, so the manifest is read defensively: anything bigger
 * than this is not one of ours (the real file is a couple of hundred bytes).
 */
const MAX_MANIFEST_BYTES = 64 * 1024;

/** What {@link EXPORT_MANIFEST_FILE} holds. */
export interface IExportManifest {
	/** Always {@link EXPORT_MANIFEST_FORMAT}; identifies the archive as a Gauzy data export. */
	readonly format: string;
	/** {@link EXPORT_MANIFEST_VERSION} at the time the archive was written. */
	readonly version: number;
	/** Whether every cell went through `toSpreadsheetSafeCsvRow` and must be un-escaped on import. */
	readonly spreadsheetSafeCells: boolean;
	/** When the archive was written, for operators reading the ZIP by hand. */
	readonly exportedAt: string;
}

/**
 * Builds the manifest describing what this server writes.
 *
 * Deliberately carries no tenant, organization or user id: the archive is handed to the caller and
 * the CSVs already say everything the importer needs.
 */
export function buildExportManifest(): IExportManifest {
	return {
		format: EXPORT_MANIFEST_FORMAT,
		version: EXPORT_MANIFEST_VERSION,
		spreadsheetSafeCells: true,
		exportedAt: new Date().toISOString()
	};
}

/**
 * Writes the manifest into an export job's CSV directory, which becomes the archive root.
 *
 * @param csvDir - The job's CSV directory.
 */
export async function writeExportManifest(csvDir: string): Promise<void> {
	const manifest = JSON.stringify(buildExportManifest(), null, 2);
	await fsp.writeFile(path.join(csvDir, EXPORT_MANIFEST_FILE), manifest, { encoding: 'utf8', mode: 0o600 });
}

/**
 * Reads the manifest of an extracted archive.
 *
 * Never throws: a missing, oversized, unreadable or malformed file simply means "not a Gauzy
 * export", which is the safe answer for every caller.
 *
 * @param extractPath - Directory the uploaded archive was extracted into.
 * @returns The parsed manifest, or `null`.
 */
export async function readExportManifest(extractPath: string): Promise<IExportManifest | null> {
	if (!extractPath || typeof extractPath !== 'string') {
		return null;
	}
	const manifestPath = path.join(extractPath, EXPORT_MANIFEST_FILE);
	try {
		const stats = await fsp.stat(manifestPath);
		if (!stats.isFile() || stats.size > MAX_MANIFEST_BYTES) {
			return null;
		}
		const parsed = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return null;
		}
		return parsed as IExportManifest;
	} catch {
		return null;
	}
}

/**
 * Whether the archive in `extractPath` was written by a Gauzy export that escaped its cells — i.e.
 * whether `fromSpreadsheetSafeCsvRow` may be applied to its rows.
 *
 * An archive with no manifest (anything older than this change, a filled-in `/export/template`, a
 * CSV set built by hand) is left exactly as it is.
 *
 * @param extractPath - Directory the uploaded archive was extracted into.
 */
export async function usesSpreadsheetSafeCells(extractPath: string): Promise<boolean> {
	const manifest = await readExportManifest(extractPath);
	return (
		!!manifest &&
		manifest.format === EXPORT_MANIFEST_FORMAT &&
		typeof manifest.version === 'number' &&
		manifest.version <= EXPORT_MANIFEST_VERSION &&
		manifest.spreadsheetSafeCells === true
	);
}

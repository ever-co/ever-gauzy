// cspell:ignore endobj
import { deflateRawSync } from 'node:zlib';
import { crc32 } from '../../knowledge/extraction/__fixtures__/zip.util';

/** One member of a test archive. */
export interface IImportZipEntry {
	/** The path as the central directory names it (written as is: unsafe paths are the point of some tests). */
	name: string;
	/** The payload; omitted for a folder entry (a name ending in `/`). */
	data?: string | Buffer;
	/** DEFLATE the payload (default STORED). */
	deflate?: boolean;
	/** The Unix mode kept in the upper half of the external attributes (e.g. `0o120777` for a symbolic link). */
	unixMode?: number;
	/** A declared uncompressed size other than the real one (a lying header). */
	declaredSize?: number;
	/** Mark the entry encrypted (general purpose flag bit 0). */
	encrypted?: boolean;
}

/**
 * Builds a zip for the import specs: STORED or DEFLATE entries, Unix modes (symbolic links), lying sizes and raw,
 * unnormalized names. UTF-8 names (flag bit 11), made by Unix (3) so the mode is meaningful.
 *
 * @param entries The archive members, in order.
 * @returns The `.zip` bytes.
 */
export function createImportZip(entries: IImportZipEntry[]): Buffer {
	const locals: Buffer[] = [];
	const centrals: Buffer[] = [];
	let offset = 0;
	for (const entry of entries) {
		const name = Buffer.from(entry.name, 'utf8');
		const raw = entry.data === undefined ? Buffer.alloc(0) : Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
		const method = entry.deflate ? 8 : 0;
		const body = entry.deflate ? deflateRawSync(raw) : raw;
		const crc = crc32(raw);
		const size = entry.declaredSize ?? raw.length;
		const flags = 0x0800 | (entry.encrypted ? 0x1 : 0);

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(flags, 6);
		local.writeUInt16LE(method, 8);
		local.writeUInt16LE(0, 10);
		local.writeUInt16LE(0x21, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(body.length, 18);
		local.writeUInt32LE(size, 22);
		local.writeUInt16LE(name.length, 26);
		local.writeUInt16LE(0, 28);
		locals.push(local, name, body);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE((3 << 8) | 20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(flags, 8);
		central.writeUInt16LE(method, 10);
		central.writeUInt16LE(0, 12);
		central.writeUInt16LE(0x21, 14);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(body.length, 20);
		central.writeUInt32LE(size, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt16LE(0, 30);
		central.writeUInt16LE(0, 32);
		central.writeUInt16LE(0, 34);
		central.writeUInt16LE(0, 36);
		const mode = entry.unixMode ?? (entry.name.endsWith('/') ? 0o040755 : 0o100644);
		central.writeUInt32LE(((mode & 0xffff) << 16) >>> 0, 38);
		central.writeUInt32LE(offset, 42);
		centrals.push(central, name);

		offset += local.length + name.length + body.length;
	}
	const centralSize = centrals.reduce((total, part) => total + part.length, 0);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(0, 4);
	end.writeUInt16LE(0, 6);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(centralSize, 12);
	end.writeUInt32LE(offset, 16);
	end.writeUInt16LE(0, 20);
	return Buffer.concat([...locals, ...centrals, end]);
}

/** A 1×1 PNG (red pixel) — a real image for the sniffer and `sharp`. */
export const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
	'base64'
);

/** A minimal one-page PDF the sniffer accepts. */
export const TINY_PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n', 'latin1');

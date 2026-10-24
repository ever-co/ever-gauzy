import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { extractImportArchive, ImportArchiveLimits } from './import-archive-extract';

/**
 * The import extracted the uploaded archive whole, every entry at once, with no limit on the upload, on the number of
 * entries or on what they inflate to: one tenant administrator's deflate bomb filled the API's disk or memory for every
 * tenant. The archives here are written by hand, so an entry can declare a size it does not have.
 */
interface Entry {
	name: string;
	content: Buffer | string;
	/** The uncompressed size the headers declare, when it is not the real one. */
	declaredSize?: number;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});

function crc32(data: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

/** A ZIP of deflated entries, written field by field. */
function zip(entries: Entry[]): Buffer {
	const locals: Buffer[] = [];
	const centrals: Buffer[] = [];
	let offset = 0;
	for (const { name, content, declaredSize } of entries) {
		const data = Buffer.from(content);
		const compressed = deflateRawSync(data);
		const fileName = Buffer.from(name, 'utf8');
		const size = declaredSize ?? data.length;

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(8, 8);
		local.writeUInt32LE(crc32(data), 14);
		local.writeUInt32LE(compressed.length, 18);
		local.writeUInt32LE(size, 22);
		local.writeUInt16LE(fileName.length, 26);
		locals.push(local, fileName, compressed);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(8, 10);
		central.writeUInt32LE(crc32(data), 16);
		central.writeUInt32LE(compressed.length, 20);
		central.writeUInt32LE(size, 24);
		central.writeUInt16LE(fileName.length, 28);
		central.writeUInt32LE(offset, 42);
		centrals.push(central, fileName);

		offset += local.length + fileName.length + compressed.length;
	}
	const directory = Buffer.concat(centrals);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(directory.length, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...locals, directory, end]);
}

const LIMITS: ImportArchiveLimits = { maxArchiveBytes: 1024 * 1024, maxExtractedBytes: 64 * 1024, maxEntries: 10 };

describe('extractImportArchive', () => {
	let root: string;
	let extractPath: string;

	beforeEach(async () => {
		root = await fsp.mkdtemp(path.join(os.tmpdir(), 'import-extract-'));
		extractPath = path.join(root, 'extract');
		await fsp.mkdir(extractPath);
	});

	afterEach(async () => {
		await fsp.rm(root, { recursive: true, force: true });
	});

	it('writes the table CSVs and the manifest, and nothing else', async () => {
		const archive = zip([
			{ name: 'user.csv', content: 'id,email\nrow-a,alice@example.com\n' },
			{ name: 'import-history.csv', content: 'id\n' },
			{ name: 'gauzy-export.json', content: '{"format":"gauzy-export","version":1}' },
			{ name: 'notes.txt', content: 'not a table' },
			{ name: 'nested/tag.csv', content: 'id\n' },
			{ name: '../escape.csv', content: 'id\n' }
		]);

		await extractImportArchive(archive, extractPath, LIMITS);

		expect((await fsp.readdir(extractPath)).sort()).toEqual([
			'gauzy-export.json',
			'import-history.csv',
			'user.csv'
		]);
		expect(fs.readFileSync(path.join(extractPath, 'user.csv'), 'utf8')).toContain('alice@example.com');
		expect(fs.existsSync(path.join(root, 'escape.csv'))).toBe(false);
	});

	it('stops an entry that inflates past the size it declares, before it fills the disk', async () => {
		// A megabyte of zeros deflates to about a kilobyte, and declares ten bytes.
		const archive = zip([{ name: 'time_log.csv', content: Buffer.alloc(1024 * 1024), declaredSize: 10 }]);

		await expect(
			extractImportArchive(archive, extractPath, { ...LIMITS, maxExtractedBytes: 1024 * 1024 * 1024 })
		).rejects.toBeInstanceOf(PayloadTooLargeException);
		const written = fs.existsSync(path.join(extractPath, 'time_log.csv'))
			? fs.statSync(path.join(extractPath, 'time_log.csv')).size
			: 0;
		expect(written).toBeLessThanOrEqual(64 * 1024);
	});

	it('refuses an archive whose entries declare more than the import accepts', async () => {
		const archive = zip([
			{ name: 'time_log.csv', content: Buffer.alloc(40 * 1024) },
			{ name: 'time_slot.csv', content: Buffer.alloc(40 * 1024) }
		]);

		await expect(extractImportArchive(archive, extractPath, LIMITS)).rejects.toBeInstanceOf(
			PayloadTooLargeException
		);
		expect(await fsp.readdir(extractPath)).toEqual([]);
	});

	it('refuses an archive with more entries than there are tables', async () => {
		const archive = zip(Array.from({ length: 11 }, (_, i) => ({ name: `table_${i}.csv`, content: 'id\n' })));

		await expect(extractImportArchive(archive, extractPath, LIMITS)).rejects.toBeInstanceOf(
			PayloadTooLargeException
		);
	});

	it('refuses an archive that names a table twice', async () => {
		const archive = zip([
			{ name: 'user.csv', content: 'id\nrow-a\n' },
			{ name: 'user.csv', content: 'id\nrow-b\n' }
		]);

		await expect(extractImportArchive(archive, extractPath, LIMITS)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('refuses a file that is not a ZIP', async () => {
		await expect(extractImportArchive(Buffer.from('id,email\n'), extractPath, LIMITS)).rejects.toBeInstanceOf(
			BadRequestException
		);
	});
});

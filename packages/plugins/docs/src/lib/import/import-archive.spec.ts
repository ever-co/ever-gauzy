import {
	DOCS_IMPORT_NOT_A_ZIP,
	DOCS_IMPORT_SYMLINK,
	DOCS_IMPORT_TOO_LARGE,
	DOCS_IMPORT_TOO_MANY_ENTRIES,
	DOCS_IMPORT_UNSAFE_PATH,
	DOCS_IMPORT_ZIP_BOMB
} from '../docs.constants';
import { createImportZip } from './__fixtures__/import-zip.fixture';
import { IImportArchiveLimits, ImportArchiveError, isSymlinkRecord, normalizeArchivePath, openImportArchive, verifyImportArchive } from './import-archive';

const LIMITS: IImportArchiveLimits = { maxEntries: 50, maxUncompressedBytes: 1024 * 1024, maxRatio: 200, ratioMinBytes: 64 * 1024 };

/** The archive error `promise` rejects with (fails the test when it resolves). */
async function refusal(promise: Promise<unknown>): Promise<ImportArchiveError> {
	try {
		await promise;
	} catch (error) {
		expect(error).toBeInstanceOf(ImportArchiveError);
		return error as ImportArchiveError;
	}
	throw new Error('expected the archive to be refused');
}

describe('normalizeArchivePath', () => {
	it.each([
		['Vault/Notes/Page.md', 'Vault/Notes/Page.md'],
		['./Vault//Notes/./Page.md', 'Vault/Notes/Page.md'],
		['Vault\\Notes\\Page.md', 'Vault/Notes/Page.md'],
		['Folder/', 'Folder'],
		['', '']
	])('normalizes %j to %j', (raw, expected) => {
		expect(normalizeArchivePath(raw)).toBe(expected);
	});

	it.each(['../etc/passwd', 'Vault/../../x.md', '/etc/passwd', 'C:/Windows/x.md', 'c:x.md', 'Vault\\..\\..\\x', 'a\u0000b.md'])(
		'refuses %j',
		(raw) => {
			expect(normalizeArchivePath(raw)).toBeNull();
		}
	);
});

describe('isSymlinkRecord', () => {
	it('reads the Unix file type of the external attributes', () => {
		expect(isSymlinkRecord({ externalFileAttributes: (0o120777 << 16) >>> 0 })).toBe(true);
		expect(isSymlinkRecord({ externalFileAttributes: (0o100644 << 16) >>> 0 })).toBe(false);
		expect(isSymlinkRecord({ externalFileAttributes: (0o040755 << 16) >>> 0 })).toBe(false);
		expect(isSymlinkRecord({ externalFileAttributes: 0x20 })).toBe(false); // a DOS "archive" attribute
	});
});

describe('openImportArchive', () => {
	it('lists the files and every folder, and reads an entry', async () => {
		const zip = createImportZip([
			{ name: 'Vault/' },
			{ name: 'Vault/Home.md', data: '# Home\n\nHello' },
			{ name: 'Vault/Notes/Deep/Page.md', data: 'deep', deflate: true }
		]);
		const archive = await openImportArchive(zip, LIMITS);

		expect(archive.entries.map((entry) => entry.path)).toEqual(['Vault/Home.md', 'Vault/Notes/Deep/Page.md']);
		expect(archive.directories).toEqual(['Vault', 'Vault/Notes', 'Vault/Notes/Deep']);
		expect(archive.declaredBytes).toBe('# Home\n\nHello'.length + 'deep'.length);
		expect((await archive.entries[1].read()).toString('utf8')).toBe('deep');
	});

	it('keeps the first of two entries naming the same path', async () => {
		const zip = createImportZip([
			{ name: 'a.md', data: 'first' },
			{ name: './a.md', data: 'second' }
		]);
		const archive = await openImportArchive(zip, LIMITS);
		expect(archive.entries).toHaveLength(1);
		expect((await archive.entries[0].read()).toString('utf8')).toBe('first');
	});

	it('refuses a file that is not a zip', async () => {
		const error = await refusal(openImportArchive(Buffer.from('not a zip at all'), LIMITS));
		expect(error.code).toBe(DOCS_IMPORT_NOT_A_ZIP);
		expect(error.status).toBe(400);
	});

	it('refuses more entries than the limit', async () => {
		const zip = createImportZip(Array.from({ length: 51 }, (_, i) => ({ name: `p${i}.md`, data: 'x' })));
		const error = await refusal(openImportArchive(zip, LIMITS));
		expect(error.code).toBe(DOCS_IMPORT_TOO_MANY_ENTRIES);
		expect(error.status).toBe(413);
	});

	it.each(['../outside.md', '/abs.md', 'C:/win.md', 'a/../../b.md'])('refuses the unsafe path %j', async (name) => {
		const error = await refusal(openImportArchive(createImportZip([{ name: 'ok.md', data: 'x' }, { name, data: 'x' }]), LIMITS));
		expect(error.code).toBe(DOCS_IMPORT_UNSAFE_PATH);
		expect(error.status).toBe(400);
	});

	it('refuses a symbolic link', async () => {
		const zip = createImportZip([
			{ name: 'Home.md', data: 'x' },
			{ name: 'link.md', data: '/etc/passwd', unixMode: 0o120777 }
		]);
		const error = await refusal(openImportArchive(zip, LIMITS));
		expect(error.code).toBe(DOCS_IMPORT_SYMLINK);
	});

	it('refuses declared sizes over the limit', async () => {
		const zip = createImportZip([{ name: 'big.md', data: 'x', declaredSize: LIMITS.maxUncompressedBytes + 1 }]);
		const error = await refusal(openImportArchive(zip, { ...LIMITS, ratioMinBytes: Number.MAX_SAFE_INTEGER }));
		expect(error.code).toBe(DOCS_IMPORT_TOO_LARGE);
		expect(error.status).toBe(413);
	});

	it('refuses an entry that inflates past the ratio (a zip bomb)', async () => {
		const zip = createImportZip([{ name: 'bomb.md', data: Buffer.alloc(512 * 1024, 0x61), deflate: true }]);
		const error = await refusal(openImportArchive(zip, LIMITS));
		expect(error.code).toBe(DOCS_IMPORT_ZIP_BOMB);
		expect(error.status).toBe(413);
	});

	it('stops an entry that inflates past the size it declares', async () => {
		const zip = createImportZip([{ name: 'liar.md', data: Buffer.alloc(4096, 0x62), deflate: true, declaredSize: 10 }]);
		const archive = await openImportArchive(zip, LIMITS);
		const error = await refusal(archive.entries[0].read());
		expect(error.code).toBe(DOCS_IMPORT_ZIP_BOMB);
	});

	it('refuses a lying entry when the archive is verified, before anything reads it', async () => {
		const zip = createImportZip([
			{ name: 'ok.md', data: 'fine' },
			{ name: 'liar.md', data: Buffer.alloc(4096, 0x62), deflate: true, declaredSize: 10 }
		]);
		const error = await refusal(verifyImportArchive(await openImportArchive(zip, LIMITS)));
		expect(error.code).toBe(DOCS_IMPORT_ZIP_BOMB);
	});

	it('charges an entry to the budget once, however often it is read', async () => {
		const archive = await openImportArchive(createImportZip([{ name: 'a.md', data: Buffer.alloc(600, 0x61) }]), { ...LIMITS, maxUncompressedBytes: 1000 });
		await verifyImportArchive(archive);
		await archive.entries[0].read();
		expect((await archive.entries[0].read()).length).toBe(600);
	});

	it('flags an encrypted entry', async () => {
		const archive = await openImportArchive(createImportZip([{ name: 'secret.md', data: 'x', encrypted: true }]), LIMITS);
		expect(archive.entries[0].encrypted).toBe(true);
	});
});

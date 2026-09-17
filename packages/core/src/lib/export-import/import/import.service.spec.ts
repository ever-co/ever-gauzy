import 'reflect-metadata';

jest.mock('../repositories/repositories.service', () => ({
	RepositoriesService: class RepositoriesService {}
}));
jest.mock('../../core', () => ({
	RequestContext: {
		currentTenantId: () => 'a0000000-0000-4000-8000-00000000000a',
		currentUserId: () => 'u0000000-0000-4000-8000-00000000000u'
	}
}));
jest.mock('../../core/utils', () => ({ convertToDatetime: (value: unknown) => value }));
jest.mock('../../core/entities/internal', () => ({ Organization: class Organization {} }));
jest.mock('./commands', () => ({ ImportEntityFieldMapOrCreateCommand: class ImportEntityFieldMapOrCreateCommand {} }));
jest.mock('../import-record', () => ({
	ImportRecordFindOrFailCommand: class ImportRecordFindOrFailCommand {},
	ImportRecordUpdateOrCreateCommand: class ImportRecordUpdateOrCreateCommand {}
}));

const deleteFile = jest.fn(async () => undefined);
const getFile = jest.fn();
jest.mock('../../core/file-storage', () => ({
	FileStorage: class FileStorage {
		getProvider() {
			return { getFile, deleteFile };
		}
	}
}));

import * as archiver from 'archiver';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { ImportService } from './import.service';
import { generateImportArchiveFileName } from './import-archive-file-name';

/**
 * Builds a ZIP holding a single `user.csv` and returns its bytes.
 */
async function buildArchive(csv: string): Promise<Buffer> {
	const chunks: Buffer[] = [];
	const archive = archiver('zip', { zlib: { level: 0 } });
	archive.on('data', (chunk: Buffer) => chunks.push(chunk));
	const finished = new Promise<void>((resolve, reject) => {
		archive.on('end', () => resolve());
		archive.on('error', reject);
	});
	archive.append(Buffer.from(csv, 'utf8'), { name: 'user.csv' });
	await archive.finalize();
	await finished;
	return Buffer.concat(chunks);
}

const ARCHIVES: Record<string, string> = {
	'import/tenant-a.zip': 'id,email\nrow-a,alice@example.com\n',
	'import/tenant-b.zip': 'id,email\nrow-b,bob@example.com\n'
};

function buildService(): { service: ImportService; imported: Record<string, unknown>[] } {
	const repositoriesService: any = {
		buildRepositoriesRelationsGraph: jest.fn(async () => [
			{
				repository: { metadata: { tableName: 'user' } },
				isStatic: false,
				relations: [],
				isCheckRelation: false
			}
		])
	};
	const service = new ImportService({ execute: jest.fn() } as any, repositoriesService);

	const imported: Record<string, unknown>[] = [];
	// Stop at the row level: what matters here is WHICH file's rows a request reads, not what the
	// command handlers then do with them.
	jest.spyOn(service as any, 'migrateImportEntityRecord').mockImplementation(async (...args: unknown[]) => {
		// Yield, so a concurrent import gets a chance to overwrite shared state if any is left.
		await new Promise((resolve) => setTimeout(resolve, 5));
		imported.push(args[1] as Record<string, unknown>);
		return true;
	});

	return { service, imported };
}

/**
 * The uploaded archive is a full tenant data dump and is kept for re-download. It must not sit at a
 * name anybody can guess, nor at one `serve-static` would hand out under `/public/`.
 */
describe('generateImportArchiveFileName', () => {
	it('is an unguessable dotfile ZIP name', () => {
		const name = generateImportArchiveFileName();

		// The old default was `import-<unix-seconds>-<0..999>.zip`: ~10 bits of guessing per second.
		expect(name).toMatch(/^\.import-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.zip$/);
		expect(name).not.toMatch(/import-\d{10}-\d{1,3}\.zip$/);
	});

	it('never repeats', () => {
		const names = new Set(Array.from({ length: 200 }, () => generateImportArchiveFileName()));
		expect(names.size).toBe(200);
	});
});

describe('ImportService', () => {
	const created: string[] = [];

	beforeEach(async () => {
		getFile.mockReset();
		deleteFile.mockReset();
		getFile.mockImplementation(async (key: string) => {
			// A real upload is fetched over the network or off disk; yield like one.
			await new Promise((resolve) => setTimeout(resolve, 5));
			return buildArchive(ARCHIVES[key]);
		});
		created.length = 0;
	});

	afterEach(async () => {
		for (const dir of created) {
			await fsp.rm(dir, { recursive: true, force: true }).catch(() => undefined);
		}
	});

	describe('per-request extraction directory (GHSA-g235-c4fm-4fc7)', () => {
		it('extracts outside the statically served public tree', async () => {
			const { service } = buildService();
			const extractPath = await service.createExtractDirectory();
			created.push(extractPath);

			// The old path was the FIXED `<assetPublicPath>/import/csv`, which `ServeStaticModule`
			// publishes unauthenticated at `/public/import/csv/<table>.csv`.
			expect(extractPath.startsWith(os.tmpdir())).toBe(true);
			expect(extractPath).not.toMatch(/[\\/]public[\\/]/);
			expect(fs.existsSync(extractPath)).toBe(true);
		});

		it('creates the extraction directory owner-only (0700)', async () => {
			const { service } = buildService();
			const extractPath = await service.createExtractDirectory();
			created.push(extractPath);

			if (process.platform === 'win32') {
				// POSIX permission bits are not meaningful on Windows; the ACL of %TEMP% applies instead.
				return;
			}
			expect((await fsp.stat(extractPath)).mode & 0o777).toBe(0o700);
		});

		it('gives concurrent imports different directories', async () => {
			const { service } = buildService();
			const [first, second] = await Promise.all([
				service.createExtractDirectory(),
				service.createExtractDirectory()
			]);
			created.push(first, second);

			expect(first).not.toBe(second);
		});

		it('does not let two concurrent imports read the other request CSV files', async () => {
			const { service, imported } = buildService();
			const [dirA, dirB] = await Promise.all([
				service.createExtractDirectory(),
				service.createExtractDirectory()
			]);
			created.push(dirA, dirB);

			await Promise.all([
				service.unzipAndParse(dirA, 'import/tenant-a.zip'),
				service.unzipAndParse(dirB, 'import/tenant-b.zip')
			]);

			// Every uploaded row was ingested exactly once, and each file was read from its own
			// directory. Sharing `_extractPath` (and the fixed `<public>/import/csv` path it always
			// resolved to) meant the second unzip overwrote the first request's files mid-parse.
			const ids = imported.map((row) => row['id']).sort();
			expect(ids).toEqual(['row-a', 'row-b']);

			expect(fs.readFileSync(path.join(dirA, 'user.csv'), 'utf8')).toContain('alice@example.com');
			expect(fs.readFileSync(path.join(dirB, 'user.csv'), 'utf8')).toContain('bob@example.com');
		});
	});

	describe('cleanup', () => {
		it('removes one extraction directory and leaves another alone', async () => {
			const { service } = buildService();
			const [dirA, dirB] = await Promise.all([
				service.createExtractDirectory(),
				service.createExtractDirectory()
			]);
			created.push(dirB);

			await fsp.writeFile(path.join(dirA, 'user.csv'), 'id\nrow-a\n');
			await fsp.writeFile(path.join(dirB, 'user.csv'), 'id\nrow-b\n');

			await service.removeExtractedFiles(dirA);

			expect(fs.existsSync(dirA)).toBe(false);
			expect(fs.existsSync(path.join(dirB, 'user.csv'))).toBe(true);
		});

		it('never deletes the uploaded archive — the Import page downloads it again', async () => {
			const { service } = buildService();
			const dir = await service.createExtractDirectory();
			created.push(dir);

			await service.unzipAndParse(dir, 'import/tenant-a.zip');
			await service.removeExtractedFiles(dir);

			expect(deleteFile).not.toHaveBeenCalled();
			expect((service as any).removeUploadedArchive).toBeUndefined();
		});

		it('removes every extracted file of an archive', async () => {
			const { service } = buildService();
			const dir = await service.createExtractDirectory();
			created.push(dir);

			await service.unzipAndParse(dir, 'import/tenant-a.zip');
			expect(fs.existsSync(path.join(dir, 'user.csv'))).toBe(true);

			await service.removeExtractedFiles(dir);
			expect(fs.existsSync(dir)).toBe(false);
		});

		it('refuses an empty path instead of deleting a default one', async () => {
			const { service } = buildService();
			await expect(service.removeExtractedFiles('')).resolves.toBeUndefined();
			await expect(service.removeExtractedFiles(undefined as unknown as string)).resolves.toBeUndefined();
		});

		it('never throws when the directory cannot be removed', async () => {
			const { service } = buildService();
			const removeSpy = jest.spyOn(fsp, 'rm').mockRejectedValueOnce(new Error('EBUSY'));

			await expect(
				service.removeExtractedFiles(path.join(os.tmpdir(), 'gauzy-import-nope'))
			).resolves.toBeUndefined();

			removeSpy.mockRestore();
		});
	});
});

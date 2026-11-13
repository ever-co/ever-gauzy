jest.mock('@gauzy/core', () => ({
	Comment: class Comment {},
	// The storage read's own refusal of a file past its bound, as `readStorageFileAsBuffer` throws it.
	FileContentTooLargeError: class FileContentTooLargeError extends Error {
		constructor(readonly maxBytes: number) {
			super(`The file is larger than the ${maxBytes} bytes that can be processed`);
			this.name = 'FileContentTooLargeError';
		}
	}
}));
jest.mock('./document.service', () => ({ DocumentService: class DocumentService {} }));
jest.mock('./document-upload.service', () => ({ DocumentUploadService: class DocumentUploadService {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class TypeOrmDocumentRepository {} }));
jest.mock('../dto/update-document-content.dto', () => ({}));
jest.mock('../dto/update-document-markdown.dto', () => ({}));

import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Writable } from 'node:stream';
import { DocumentKindEnum } from '@gauzy/contracts';
import { FileContentTooLargeError } from '@gauzy/core';
import { DOCS_MARKDOWN_TOO_MANY_PAGES, DOCS_NOT_A_PAGE } from '../docs.constants';
import { openOfficePackage } from '../knowledge/extraction/office-package.util';
import { DOCS_MARKDOWN_ASSETS_MAX_BYTES, DocumentMarkdownService, folderIndexMarkdown, zipFileNameOf } from './document-markdown.service';

interface INode {
	id: string;
	kind: DocumentKindEnum;
	name: string;
	parentId: string | null;
	index: number;
	originalFilename?: string;
	contentJson?: unknown;
	readable?: boolean;
	bytes?: string;
	/** The stored size; a file without one is read without knowing it. */
	fileSize?: number | null;
}

const text = (value: string) => ({ type: 'paragraph', content: [{ type: 'text', text: value }] });
const fileLink = (id: string, label: string) => ({ type: 'fileAttachment', attrs: { documentId: id, name: label } });

/** A tree: a folder with a page, a sub-folder holding a page and a file, a file, and a page the caller may not read. */
const TREE: INode[] = [
	{ id: 'f0000000-0000-4000-8000-000000000001', kind: DocumentKindEnum.FOLDER, name: 'Handbook', parentId: null, index: 0 },
	{ id: 'p0000000-0000-4000-8000-000000000002', kind: DocumentKindEnum.PAGE, name: 'Welcome', parentId: 'f0000000-0000-4000-8000-000000000001', index: 0, contentJson: { type: 'doc', content: [text('Hello'), fileLink('a0000000-0000-4000-8000-000000000005', 'the policy')] } },
	{ id: 'f0000000-0000-4000-8000-000000000003', kind: DocumentKindEnum.FOLDER, name: 'Policies', parentId: 'f0000000-0000-4000-8000-000000000001', index: 1 },
	{ id: 'p0000000-0000-4000-8000-000000000004', kind: DocumentKindEnum.PAGE, name: 'Travel', parentId: 'f0000000-0000-4000-8000-000000000003', index: 0, contentJson: { type: 'doc', content: [text('Book early')] } },
	{ id: 'a0000000-0000-4000-8000-000000000005', kind: DocumentKindEnum.FILE, name: 'Policy', originalFilename: 'policy.pdf', parentId: 'f0000000-0000-4000-8000-000000000003', index: 1, bytes: '%PDF-policy' },
	{ id: 'a0000000-0000-4000-8000-000000000006', kind: DocumentKindEnum.FILE, name: 'Logo', originalFilename: 'logo:final?.png', parentId: 'f0000000-0000-4000-8000-000000000001', index: 2, bytes: 'png-bytes' },
	{ id: 'p0000000-0000-4000-8000-000000000007', kind: DocumentKindEnum.PAGE, name: 'Secret', parentId: 'f0000000-0000-4000-8000-000000000001', index: 3, readable: false, contentJson: { type: 'doc', content: [text('hidden')] } }
];

function buildService(tree: INode[] = TREE) {
	const byId = new Map(tree.map((node) => [node.id, { tenantId: 'tenant-1', organizationId: 'org-1', ...node }]));
	const documents = {
		findOneScoped: jest.fn(async (id: string) => {
			const node = byId.get(id);
			if (!node || node.readable === false) throw new NotFoundException();
			return node;
		})
	};
	const uploads = {
		// As the storage read does: a file past the stated bound is refused while it is read, never handed back whole.
		getRawFile: jest.fn(async (id: string, _organizationId?: string, options?: { maxBytes?: number }) => {
			const node = byId.get(id);
			if (!node?.bytes) throw new NotFoundException();
			const buffer = Buffer.from(node.bytes);
			if (options?.maxBytes !== undefined && buffer.length > options.maxBytes) throw new FileContentTooLargeError(options.maxBytes);
			return { buffer, fileName: node.originalFilename };
		})
	};
	const repository = {
		find: jest.fn(async ({ where }: { where: { parentId: { _value: string[] }; kind: { _value: DocumentKindEnum[] } } }) =>
			tree
				.filter((node) => node.parentId && where.parentId._value.includes(node.parentId) && where.kind._value.includes(node.kind))
				.sort((left, right) => left.index - right.index)
				.map((node) => ({ id: node.id, parentId: node.parentId, index: node.index }))
		)
	};
	return { service: new DocumentMarkdownService(documents as never, uploads as never, repository as never), documents, uploads, repository };
}

/** Writes the zip of a root and opens it. */
async function zipOf(service: DocumentMarkdownService, rootId: string) {
	const root = await service.requireExportRoot(rootId as never);
	const chunks: Buffer[] = [];
	const output = new Writable({
		write(chunk, _encoding, callback) {
			chunks.push(Buffer.from(chunk));
			callback();
		}
	});
	const result = await service.writeSubtreeZip(root, undefined, output);
	const raw = Buffer.concat(chunks);
	return { result, zip: openOfficePackage(raw), raw };
}

describe('DocumentMarkdownService subtree export of a folder', () => {
	it('zips the pages, folders and files of a folder the caller may read, with an index', async () => {
		const { service } = buildService();
		const { result, zip } = await zipOf(service, TREE[0].id);
		expect(result).toEqual({ fileName: 'handbook.zip', pages: 2, files: 2 });
		expect(zip.names().sort()).toEqual(['index.md', 'logo-final-.png', 'policies/policy.pdf', 'policies/travel.md', 'welcome.md']);
		expect(zip.readText('policies/policy.pdf')).toBe('%PDF-policy');
		expect(zip.readText('policies/travel.md')).toContain('Book early');
		// The page links to the folder's file where the zip holds it, not to a copy under assets/.
		expect(zip.readText('welcome.md')).toContain('](policies/policy.pdf)');
		const index = zip.readText('index.md') ?? '';
		expect(index.startsWith('# Handbook\n')).toBe(true);
		expect(index).toContain('- [Welcome](welcome.md)');
		expect(index).toContain('- Policies/');
		expect(index).toContain('  - [Travel](policies/travel.md)');
		expect(index).toContain('  - [Policy](policies/policy.pdf)');
		// What the caller may not read is not there at all.
		expect(index).not.toContain('Secret');
		expect(zip.names().some((name) => name.includes('secret'))).toBe(false);
	});

	it('lists a file it could not read with its API link instead of copying it', async () => {
		const tree = TREE.map((node) => (node.id === 'a0000000-0000-4000-8000-000000000006' ? { ...node, bytes: undefined } : node));
		const { service } = buildService(tree);
		const { result, zip } = await zipOf(service, TREE[0].id);
		expect(result.files).toBe(1);
		expect(zip.has('logo-final-.png')).toBe(false);
		expect(zip.readText('index.md')).toContain('(/api/plugins/docs/documents/a0000000-0000-4000-8000-000000000006/raw) (not included)');
	});

	it('keeps the export of a page as it was: no files of the tree, the page as index.md', async () => {
		const { service } = buildService([
			{ ...TREE[1], parentId: null },
			{ ...TREE[4], parentId: TREE[1].id }
		]);
		const { result, zip } = await zipOf(service, TREE[1].id);
		expect(result).toMatchObject({ pages: 1, files: 0 });
		expect(zip.names()).toEqual(expect.arrayContaining(['index.md', 'assets/a0000000-0000-4000-8000-000000000005.pdf']));
	});

	it('refuses a file as the root of an export (409 DOCS_NOT_A_PAGE), and an unreadable root (404)', async () => {
		const { service } = buildService();
		await expect(service.requireExportRoot(TREE[4].id as never)).rejects.toBeInstanceOf(ConflictException);
		await service.requireExportRoot(TREE[4].id as never).catch((error: ConflictException) => expect((error.getResponse() as { code: string }).code).toBe(DOCS_NOT_A_PAGE));
		await expect(service.requireExportRoot(TREE[6].id as never)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('writes every folder as an entry, so an empty sub-folder is still there once extracted', async () => {
		const { service } = buildService([TREE[0], { id: 'f0000000-0000-4000-8000-000000000008', kind: DocumentKindEnum.FOLDER, name: 'Drafts', parentId: TREE[0].id, index: 0 }]);
		const { zip, raw } = await zipOf(service, TREE[0].id);
		// The reader skips directory entries; the zip's own directory names them.
		expect(raw.includes(Buffer.from('drafts/'))).toBe(true);
		expect(zip.readText('index.md')).toContain('- Drafts/');
	});

	it("never gives a child the path of its page's own index.md", async () => {
		const intro = 'p0000000-0000-4000-8000-000000000010';
		const { service } = buildService([
			TREE[0],
			{ id: intro, kind: DocumentKindEnum.PAGE, name: 'Intro', parentId: TREE[0].id, index: 0, contentJson: { type: 'doc', content: [text('The intro page')] } },
			{ id: 'a0000000-0000-4000-8000-000000000011', kind: DocumentKindEnum.FILE, name: 'Index', originalFilename: 'index.md', parentId: intro, index: 0, bytes: 'a file named index.md' },
			{ id: 'p0000000-0000-4000-8000-000000000012', kind: DocumentKindEnum.PAGE, name: 'Index', parentId: intro, index: 1, contentJson: { type: 'doc', content: [text('A page named Index')] } }
		]);
		const { zip } = await zipOf(service, TREE[0].id);
		const names = zip.names();
		expect(new Set(names).size).toBe(names.length);
		expect(zip.readText('intro/index.md')).toContain('The intro page');
		expect(names.filter((name) => name.startsWith('intro/')).sort()).toEqual(['intro/index-2.md', 'intro/index-3.md', 'intro/index.md']);
	});

	it('links a copied file by its encoded name, parentheses included', async () => {
		const report = 'a0000000-0000-4000-8000-000000000013';
		const { service } = buildService([
			TREE[0],
			{ id: 'p0000000-0000-4000-8000-000000000014', kind: DocumentKindEnum.PAGE, name: 'Notes', parentId: TREE[0].id, index: 0, contentJson: { type: 'doc', content: [fileLink(report, 'the report')] } },
			{ id: report, kind: DocumentKindEnum.FILE, name: 'Report', originalFilename: 'report (final)#1.pdf', parentId: TREE[0].id, index: 1, bytes: '%PDF-report' }
		]);
		const { zip } = await zipOf(service, TREE[0].id);
		expect(zip.readText('report (final)#1.pdf')).toBe('%PDF-report');
		expect(zip.readText('notes.md')).toContain('](report%20%28final%29%231.pdf)');
		expect(zip.readText('index.md')).toContain('](report%20%28final%29%231.pdf)');
	});

	it('cuts a long file name between characters, never inside one', async () => {
		const long = `${'a'.repeat(110)}${'\u{1F600}'.repeat(10)}.pdf`;
		const name = zipFileNameOf({ id: 'x', originalFilename: long, name: '' } as never);
		expect(name.length).toBeLessThanOrEqual(120);
		expect(name.endsWith('.pdf')).toBe(true);
		expect(() => encodeURIComponent(name)).not.toThrow();
		const file = 'a0000000-0000-4000-8000-000000000015';
		const { result } = await zipOf(buildService([TREE[0], { id: file, kind: DocumentKindEnum.FILE, name: 'Long', originalFilename: long, parentId: TREE[0].id, index: 0, bytes: '%PDF' }]).service, TREE[0].id);
		expect(result.files).toBe(1);
	});

	it('refuses (413) a subtree past the limit before any byte goes out, and takes one exactly at it', async () => {
		const pages = (count: number): INode[] =>
			Array.from({ length: count }, (_, at) => ({
				id: `p${String(at).padStart(7, '0')}-0000-4000-8000-000000000099`,
				kind: DocumentKindEnum.PAGE,
				name: `Page ${at}`,
				parentId: TREE[0].id,
				index: at,
				contentJson: { type: 'doc', content: [text(`Page ${at}`)] }
			}));
		const over = buildService([TREE[0], ...pages(501)]);
		const written: Buffer[] = [];
		const output = new Writable({
			write(chunk, _encoding, callback) {
				written.push(Buffer.from(chunk));
				callback();
			}
		});
		const refusal = await over.service.writeSubtreeZip((await over.service.requireExportRoot(TREE[0].id as never)) as never, undefined, output).catch((error) => error);
		expect(refusal.getStatus?.()).toBe(413);
		expect(refusal.getResponse().code).toBe(DOCS_MARKDOWN_TOO_MANY_PAGES);
		expect(written).toHaveLength(0);

		const { result } = await zipOf(buildService([TREE[0], ...pages(500)]).service, TREE[0].id);
		expect(result.pages).toBe(500);
	});

	it('counts only what the caller may read toward the limit: 500 readable pages and an unreadable one are exported', async () => {
		const pages: INode[] = Array.from({ length: 501 }, (_, at) => ({
			id: `p${String(at).padStart(7, '0')}-0000-4000-8000-000000000097`,
			kind: DocumentKindEnum.PAGE,
			name: `Page ${at}`,
			parentId: TREE[0].id,
			index: at,
			contentJson: { type: 'doc', content: [text(`Page ${at}`)] },
			...(at === 500 ? { readable: false } : {})
		}));
		const { result } = await zipOf(buildService([TREE[0], ...pages]).service, TREE[0].id);
		expect(result.pages).toBe(500);
	});

	it('bounds a walk through folders alone (413 past the node limit)', async () => {
		const folders: INode[] = Array.from({ length: 2001 }, (_, at) => ({
			id: `d${String(at).padStart(7, '0')}-0000-4000-8000-000000000098`,
			kind: DocumentKindEnum.FOLDER,
			name: `Folder ${at}`,
			parentId: TREE[0].id,
			index: at
		}));
		const { service } = buildService([TREE[0], ...folders]);
		const root = await service.requireExportRoot(TREE[0].id as never);
		const refusal = await service.writeSubtreeZip(root, undefined, new Writable({ write: (_chunk, _encoding, callback) => callback() })).catch((error) => error);
		expect(refusal.getStatus?.()).toBe(413);
	});

	describe('the byte budget', () => {
		const folder = TREE[0];
		const file = (n: number, bytes: string, fileSize?: number | null): INode => ({
			id: `a0000000-0000-4000-8000-0000000002${String(n).padStart(2, '0')}`,
			kind: DocumentKindEnum.FILE,
			name: `File ${n}`,
			originalFilename: `file-${n}.bin`,
			parentId: folder.id,
			index: n,
			bytes,
			fileSize
		});
		/** The service with a budget of `bytes` (the real one is 256 MiB). */
		const withBudget = (service: DocumentMarkdownService, bytes: number) => Object.defineProperty(service, 'assetsMaxBytes', { value: bytes });
		const warnings = () => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		afterEach(() => jest.restoreAllMocks());

		it('reads every file bounded by what is left of the budget, one without a stored size too', async () => {
			const known = file(1, '123456789', 9);
			const unknown = file(2, 'abc', null);
			const { service, uploads } = buildService([folder, known, unknown]);
			await zipOf(service, folder.id);
			expect(uploads.getRawFile.mock.calls).toEqual([
				[known.id, undefined, { maxBytes: DOCS_MARKDOWN_ASSETS_MAX_BYTES }],
				[unknown.id, undefined, { maxBytes: DOCS_MARKDOWN_ASSETS_MAX_BYTES - 9 }]
			]);
		});

		it('leaves out a file the read finds past the budget, lists it with its link, and goes on with the next', async () => {
			const warned = warnings();
			const first = file(1, '12345678');
			const tooBig = file(2, '12345678');
			const fits = file(3, '1234');
			const afterFull = file(4, 'x');
			const { service, uploads } = buildService([folder, first, tooBig, fits, afterFull]);
			withBudget(service, 12);
			const { result, zip } = await zipOf(service, folder.id);

			expect(result.files).toBe(2);
			expect(zip.readText('file-1.bin')).toBe('12345678');
			expect(zip.readText('file-3.bin')).toBe('1234');
			expect(zip.has('file-2.bin')).toBe(false);
			expect(zip.has('file-4.bin')).toBe(false);
			const index = zip.readText('index.md') ?? '';
			expect(index).toContain(`(/api/plugins/docs/documents/${tooBig.id}/raw) (not included)`);
			expect(index).toContain(`(/api/plugins/docs/documents/${afterFull.id}/raw) (not included)`);
			// The file past the budget was read only up to it; with nothing left, the next one is not read at all.
			expect(uploads.getRawFile.mock.calls.map(([id, , options]) => [id, options])).toEqual([
				[first.id, { maxBytes: 12 }],
				[tooBig.id, { maxBytes: 4 }],
				[fits.id, { maxBytes: 4 }]
			]);
			// Logged as past the budget, as the stored-size check logs it, not as a file that could not be read.
			const budgetWarnings = warned.mock.calls.map(([message]) => String(message)).filter((message) => message.includes('asset budget of 12 bytes is reached'));
			expect(budgetWarnings).toHaveLength(2);
			expect(budgetWarnings[0]).toContain(tooBig.id);
		});

		it('names the per-file limit, not the budget, when that lower bound refused the read', async () => {
			const warned = warnings();
			const big = file(1, '12345678');
			const { service, uploads } = buildService([folder, big]);
			withBudget(service, 100);
			// The per-file limit (5 bytes here) is below what is left of the budget: the read is refused at it.
			uploads.getRawFile.mockImplementationOnce(async () => {
				throw new FileContentTooLargeError(5);
			});
			const { result, zip } = await zipOf(service, folder.id);

			expect(result.files).toBe(0);
			expect(zip.readText('index.md')).toContain(`(/api/plugins/docs/documents/${big.id}/raw) (not included)`);
			const messages = warned.mock.calls.map(([message]) => String(message));
			expect(messages.some((message) => message.includes('asset budget'))).toBe(false);
			expect(messages).toContain(`Markdown export: file ${big.id} was not added (The file is larger than the 5 bytes that can be processed)`);
		});

		it('never reads a file whose stored size is past what is left', async () => {
			warnings();
			const first = file(1, '12345678', 8);
			const stored = file(2, '12345', 5);
			const { service, uploads } = buildService([folder, first, stored]);
			withBudget(service, 12);
			const { result } = await zipOf(service, folder.id);
			expect(result.files).toBe(1);
			expect(uploads.getRawFile).toHaveBeenCalledTimes(1);
		});

		it('bounds the files the pages show by what the folder files left of the same budget', async () => {
			warnings();
			const elsewhere = 'a0000000-0000-4000-8000-000000000299';
			const page: INode = {
				id: 'p0000000-0000-4000-8000-000000000298',
				kind: DocumentKindEnum.PAGE,
				name: 'Notes',
				parentId: folder.id,
				index: 0,
				contentJson: { type: 'doc', content: [fileLink(elsewhere, 'the chart')] }
			};
			const own = file(1, '123456');
			// A file the page shows from outside the folder: copied under assets/ only when it fits.
			const outside: INode = { id: elsewhere, kind: DocumentKindEnum.FILE, name: 'Chart', originalFilename: 'chart.png', parentId: 'f0000000-0000-4000-8000-00000000ffff', index: 0, bytes: '123456' };
			const { service, uploads } = buildService([folder, page, own, outside]);
			withBudget(service, 10);
			const { zip } = await zipOf(service, folder.id);

			expect(uploads.getRawFile).toHaveBeenLastCalledWith(elsewhere, undefined, { maxBytes: 4 });
			expect(zip.names().some((name) => name.startsWith('assets/'))).toBe(false);
			expect(zip.readText('notes.md')).toContain(`/api/plugins/docs/documents/${elsewhere}/raw`);
		});
	});

	it('zips an empty folder as an index that says so', async () => {
		const { service } = buildService([TREE[0]]);
		const { result, zip } = await zipOf(service, TREE[0].id);
		expect(result).toMatchObject({ pages: 0, files: 0 });
		expect(zip.readText('index.md')).toBe('# Handbook\n\n_This folder is empty._\n');
	});
});

describe('zipFileNameOf / folderIndexMarkdown', () => {
	it('names a file by its upload, without the characters a path refuses', () => {
		expect(zipFileNameOf({ id: 'x1234567-0', originalFilename: '../etc/passwd', name: 'n' } as never)).toBe('etc-passwd');
		expect(zipFileNameOf({ id: 'x1234567-0', originalFilename: '', name: 'Report: Q3' } as never)).toBe('Report- Q3');
		expect(zipFileNameOf({ id: 'x1234567-0', originalFilename: '', name: '' } as never)).toBe('x1234567');
		expect(zipFileNameOf({ id: 'x', originalFilename: `${'a'.repeat(200)}.pdf`, name: '' } as never)).toMatch(/^a+\.pdf$/);
		expect(zipFileNameOf({ id: 'x', originalFilename: `${'a'.repeat(200)}.pdf`, name: '' } as never).length).toBe(120);
	});

	it('writes names as text, never as Markdown', () => {
		expect(folderIndexMarkdown({ name: '*Bold* [x](y)' } as never, [], new Map())).toBe('# \\*Bold\\* \\[x\\](y)\n\n_This folder is empty._\n');
	});
});

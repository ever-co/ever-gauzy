jest.mock('@gauzy/core', () => ({ Comment: class Comment {} }));
jest.mock('./document.service', () => ({ DocumentService: class DocumentService {} }));
jest.mock('./document-upload.service', () => ({ DocumentUploadService: class DocumentUploadService {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class TypeOrmDocumentRepository {} }));
jest.mock('../dto/update-document-content.dto', () => ({}));
jest.mock('../dto/update-document-markdown.dto', () => ({}));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Writable } from 'node:stream';
import { DocumentKindEnum } from '@gauzy/contracts';
import { DOCS_NOT_A_PAGE } from '../docs.constants';
import { openOfficePackage } from '../knowledge/extraction/office-package.util';
import { DocumentMarkdownService, folderIndexMarkdown, zipFileNameOf } from './document-markdown.service';

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
	{ id: 'a0000000-0000-4000-8000-000000000006', kind: DocumentKindEnum.FILE, name: 'Logo', originalFilename: 'logo:final?.png', parentId: 'f0000000-0000-4000-8000-000000000001', index: 2, bytes: 'PNGDATA' },
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
		getRawFile: jest.fn(async (id: string) => {
			const node = byId.get(id);
			if (!node?.bytes) throw new NotFoundException();
			return { buffer: Buffer.from(node.bytes), fileName: node.originalFilename };
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
	return { result, zip: openOfficePackage(Buffer.concat(chunks)) };
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
		expect(zip.readText('index.md')).toContain('(/api/plugins/docs/documents/a0000000-0000-4000-8000-000000000006/download) (not included)');
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

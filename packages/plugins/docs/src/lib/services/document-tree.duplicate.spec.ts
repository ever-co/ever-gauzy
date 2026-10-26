/**
 * A deep duplicate copied the whole subtree, whoever could read it: the handler checked only the
 * root, `copyChildrenRecursive` loaded every child of each folder, and every copy is created by the
 * caller, so it is readable by them. Duplicating an ORGANIZATION folder therefore handed a colleague's
 * PRIVATE pages (content, extracted text) and files (the same storage key) back as the caller's own.
 * The copy now takes only the descendants the caller may read, and nothing below one it may not.
 */
jest.mock('@gauzy/config', () => ({ isSqlite: () => false, isBetterSqlite3: () => false }));
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));

import { DocumentKindEnum } from '@gauzy/contracts';
import { DocumentTreeService } from './document-tree.service';

const row = (overrides: Record<string, any>): any => ({
	tenantId: 'tenant-1',
	organizationId: 'org-1',
	kind: DocumentKindEnum.PAGE,
	index: 0,
	visibility: 'ORGANIZATION',
	createdByUserId: 'bob',
	...overrides
});

/** An in-memory table: `find` by `parentId` + scope, `create`/`save` append a new row with a fresh id. */
const buildRepository = (rows: any[]) => {
	let next = 0;
	return {
		rows,
		find: jest.fn(async ({ where }: any) =>
			rows
				.filter(
					(candidate) =>
						candidate.parentId === where.parentId &&
						candidate.tenantId === where.tenantId &&
						candidate.organizationId === where.organizationId
				)
				.sort((left, right) => left.index - right.index)
		),
		create: jest.fn((input: any) => ({ ...input })),
		save: jest.fn(async (input: any) => {
			const saved = { ...input, id: `copy-${++next}`, copiedFrom: input.name, createdByUserId: 'bob' };
			rows.push(saved);
			return saved;
		})
	};
};

describe('DocumentTreeService.duplicateDocument — a deep copy takes only what the caller may read', () => {
	const tree = () => [
		row({ id: 'folder', kind: DocumentKindEnum.FOLDER, name: 'Team folder', parentId: null }),
		row({ id: 'shared-page', name: 'Shared page', parentId: 'folder', index: 0 }),
		row({
			id: 'carol-private',
			name: 'Carol private',
			parentId: 'folder',
			index: 1,
			visibility: 'PRIVATE',
			createdByUserId: 'carol',
			contentHtml: '<p>salary review</p>'
		}),
		row({ id: 'below-private', name: 'Below private', parentId: 'carol-private', index: 0 }),
		row({
			id: 'carol-file',
			kind: DocumentKindEnum.FILE,
			name: 'Carol file',
			parentId: 'folder',
			index: 2,
			visibility: 'PRIVATE',
			createdByUserId: 'carol',
			storageKey: 'docs/carol/contract.pdf'
		})
	];

	/** Bob reads the ORGANIZATION rows and his own; Carol's PRIVATE rows are not shared with him. */
	const bobCanRead = async (document: any) =>
		document.visibility === 'ORGANIZATION' || document.createdByUserId === 'bob';

	it("leaves out a colleague's PRIVATE pages and files, and everything below them", async () => {
		const repository = buildRepository(tree());
		const service = new DocumentTreeService(repository as any);

		await service.duplicateDocument(repository.rows[0], { deep: true }, bobCanRead);

		const copied = repository.rows
			.filter((candidate) => candidate.id.startsWith('copy-'))
			.map((copy) => copy.copiedFrom);
		expect(copied).toEqual(['Team folder (copy)', 'Shared page']);
		expect(repository.rows.some((candidate) => candidate.id.startsWith('copy-') && candidate.storageKey)).toBe(
			false
		);
	});

	it('copies what the caller may read, a share included (control)', async () => {
		const repository = buildRepository(tree());
		const service = new DocumentTreeService(repository as any);
		const sharedWithBob = async (document: any) => (await bobCanRead(document)) || document.id === 'carol-private';

		await service.duplicateDocument(repository.rows[0], { deep: true }, sharedWithBob);

		const copied = repository.rows
			.filter((candidate) => candidate.id.startsWith('copy-'))
			.map((copy) => copy.copiedFrom);
		expect(copied).toEqual(['Team folder (copy)', 'Shared page', 'Carol private', 'Below private']);
	});

	it('copies no descendant when no read rule is given', async () => {
		const repository = buildRepository(tree());
		const service = new DocumentTreeService(repository as any);

		await service.duplicateDocument(repository.rows[0], { deep: true });

		expect(repository.rows.filter((candidate) => candidate.id.startsWith('copy-'))).toHaveLength(1);
	});
});

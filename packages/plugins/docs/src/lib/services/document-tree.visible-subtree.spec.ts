/**
 * The subtree operations of `DocumentTreeService` reach only the documents the caller may read.
 *
 * The tree's own reads see every row of the organization, and the archive, unarchive and subtree delete cascades
 * walked them all: a member who archived or deleted their organization folder archived or deleted another member's
 * PRIVATE page inside it, and the `DOCS_SUBTREE_NOT_ARCHIVED` refusal named it (and gave its id) while it was live.
 * A reorder accepted a hidden sibling's id where it refused any other id, which told the caller the sibling exists.
 * The request paths now hand in the read filter; with it, a hidden descendant is neither changed nor named.
 */
jest.mock('@gauzy/config', () => ({ isSqlite: () => false, isBetterSqlite3: () => false }));
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { DocumentKindEnum, ID } from '@gauzy/contracts';
import { DOCS_REORDER_MIXED_PARENTS, DOCS_SUBTREE_NOT_ARCHIVED } from '../docs.constants';
import { DocumentTreeService } from './document-tree.service';

/** A document row stub carrying only the fields the tree code reads. */
const node = (overrides: Record<string, any> = {}): any => ({
	tenantId: 'tenant-1',
	organizationId: 'org-1',
	kind: DocumentKindEnum.FOLDER,
	isArchived: true,
	parentId: null,
	index: 0,
	metadata: null,
	...overrides
});

/** An in-memory document table matching the `where` shapes the tree service uses. */
const buildRepository = (rows: any[]) => {
	const softDeleted: any[] = [];
	const matchesValue = (expected: any, actual: any): boolean => {
		if (expected instanceof FindOperator) {
			if (expected.type === 'in') {
				return (expected.value as any[]).includes(actual);
			}
			if (expected.type === 'isNull') {
				return (actual ?? null) === null;
			}
			throw new Error(`Unsupported find operator in the tree test double: ${expected.type}`);
		}
		return (actual ?? null) === (expected ?? null);
	};
	const matches = (where: any, row: any): boolean =>
		Object.entries(where ?? {}).every(([column, expected]) => matchesValue(expected, row[column]));
	const live = () => rows.filter((row) => !softDeleted.includes(row.id));

	const repository: any = {
		rows,
		softDeleted,
		find: jest.fn(async ({ where, order }: any) => {
			const found = live().filter((row) => matches(where, row));
			if (order?.index === 'ASC') {
				found.sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
			}
			return found;
		}),
		findOne: jest.fn(async ({ where }: any) => rows.find((row) => matches(where, row)) ?? null),
		update: jest.fn(async (criteria: any, patch: any) => {
			for (const row of rows.filter((candidate) => matches(criteria, candidate))) {
				Object.assign(row, patch);
			}
			return { affected: 1 };
		}),
		save: jest.fn(async (input: any) => input),
		softDelete: jest.fn(async (criteria: any) => {
			for (const row of rows.filter((candidate) => matches(criteria, candidate))) {
				softDeleted.push(row.id);
			}
			return { affected: softDeleted.length };
		})
	};
	// A transaction writes through the same table, and a failed one puts back what it wrote.
	repository.manager = {
		transaction: jest.fn(async (work: (manager: any) => Promise<unknown>) => {
			const before = rows.map((row) => ({ ...row }));
			const deletedBefore = [...softDeleted];
			try {
				return await work({ getRepository: () => repository });
			} catch (error) {
				rows.forEach((row, position) => Object.assign(row, before[position]));
				softDeleted.splice(0, softDeleted.length, ...deletedBefore);
				throw error;
			}
		})
	};
	return repository;
};

/** The read filter of a caller who cannot see the listed documents. */
const hiding =
	(...hidden: ID[]) =>
	async (ids: ID[]): Promise<ID[]> =>
		ids.filter((id) => !hidden.includes(id));

const row = (repository: any, id: string) => repository.rows.find((candidate: any) => candidate.id === id);

describe('DocumentTreeService — subtree operations reach only what the caller may read', () => {
	/**
	 * folder ── visible ── visible-child
	 *        └─ hidden (another member's PRIVATE page) ── below-hidden
	 */
	const tree = (overrides: Record<string, Record<string, any>> = {}) =>
		buildRepository([
			node({ id: 'grandparent', parentId: null, index: 0, ...overrides['grandparent'] }),
			node({ id: 'folder', parentId: 'grandparent', index: 0, ...overrides['folder'] }),
			node({ id: 'visible', name: 'Visible page', parentId: 'folder', index: 0, ...overrides['visible'] }),
			node({ id: 'visible-child', parentId: 'visible', index: 0, ...overrides['visible-child'] }),
			node({ id: 'hidden', name: 'Salary review', parentId: 'folder', index: 1, ...overrides['hidden'] }),
			node({ id: 'below-hidden', parentId: 'hidden', index: 0, ...overrides['below-hidden'] })
		]);

	it('archives the subtree the caller sees, never a hidden descendant or what lies below it', async () => {
		const repository = tree({
			folder: { isArchived: false },
			visible: { isArchived: false },
			'visible-child': { isArchived: false },
			hidden: { isArchived: false },
			'below-hidden': { isArchived: false }
		});
		const service = new DocumentTreeService(repository);

		await expect(service.archiveSubtree(row(repository, 'folder'), hiding('hidden'))).resolves.toBe(3);

		expect(row(repository, 'folder').isArchived).toBe(true);
		expect(row(repository, 'visible').isArchived).toBe(true);
		expect(row(repository, 'visible-child').isArchived).toBe(true);
		expect(row(repository, 'hidden').isArchived).toBe(false);
		expect(row(repository, 'below-hidden').isArchived).toBe(false);
	});

	it('unarchives the subtree and the ancestors the caller sees, never a hidden one', async () => {
		const repository = tree();
		const service = new DocumentTreeService(repository);

		await service.unarchiveSubtree(row(repository, 'visible'), hiding('hidden', 'grandparent'));

		expect(row(repository, 'visible').isArchived).toBe(false);
		expect(row(repository, 'visible-child').isArchived).toBe(false);
		expect(row(repository, 'folder').isArchived).toBe(false);
		expect(row(repository, 'grandparent').isArchived).toBe(true);
		expect(row(repository, 'hidden').isArchived).toBe(true);
	});

	it('does not name a live hidden descendant in the subtree-delete refusal, nor let it block the delete', async () => {
		const repository = tree({ hidden: { isArchived: false } });
		const service = new DocumentTreeService(repository);

		await expect(
			service.deleteDocument(row(repository, 'folder'), 'subtree', hiding('hidden'))
		).resolves.toBeDefined();
		expect(repository.softDeleted).toEqual(expect.arrayContaining(['folder', 'visible', 'visible-child']));
		expect(repository.softDeleted).not.toContain('hidden');
		expect(repository.softDeleted).not.toContain('below-hidden');
	});

	it('names only the live descendants the caller sees when it refuses a subtree delete', async () => {
		const repository = tree({ visible: { isArchived: false }, hidden: { isArchived: false } });
		const service = new DocumentTreeService(repository);

		const refusal = await service
			.deleteDocument(row(repository, 'folder'), 'subtree', hiding('hidden'))
			.catch((error) => error);

		expect(refusal).toBeInstanceOf(ConflictException);
		expect(refusal.getResponse()).toMatchObject({ code: DOCS_SUBTREE_NOT_ARCHIVED, documentIds: ['visible'] });
		expect(JSON.stringify(refusal.getResponse())).not.toContain('Salary review');
		expect(JSON.stringify(refusal.getResponse())).not.toContain('"hidden"');
		expect(repository.softDeleted).toHaveLength(0);
	});

	it("moves a hidden descendant, with its own subtree, to the deleted folder's parent", async () => {
		const repository = tree();
		const service = new DocumentTreeService(repository);

		await service.deleteDocument(row(repository, 'folder'), 'subtree', hiding('hidden'));

		expect(row(repository, 'hidden').parentId).toBe('grandparent');
		expect(row(repository, 'below-hidden').parentId).toBe('hidden');
		expect(repository.softDeleted).not.toContain('hidden');
	});

	it('deletes nothing when moving a hidden descendant out fails, leaving none under a deleted folder', async () => {
		// The delete and the move are one transaction: a move that failed after the delete left the hidden page live
		// under a deleted folder, out of reach of every tree read, and a retry could not finish it.
		const repository = tree();
		const service = new DocumentTreeService(repository);
		repository.update.mockRejectedValueOnce(new Error('connection lost'));

		await expect(service.deleteDocument(row(repository, 'folder'), 'subtree', hiding('hidden'))).rejects.toThrow(
			'connection lost'
		);

		expect(repository.manager.transaction).toHaveBeenCalledTimes(1);
		expect(repository.softDeleted).toHaveLength(0);
		expect(row(repository, 'hidden').parentId).toBe('folder');
	});

	it('refuses a hidden sibling in a reorder exactly as it refuses an id that is no sibling', async () => {
		const repository = tree();
		const service = new DocumentTreeService(repository);

		const hiddenSibling = await service
			.reorderDocuments('folder', ['hidden', 'visible'], 'tenant-1', 'org-1', hiding('hidden'))
			.catch((error) => error);
		const stranger = await service
			.reorderDocuments('folder', ['visible-child', 'visible'], 'tenant-1', 'org-1', hiding('hidden'))
			.catch((error) => error);

		expect(hiddenSibling).toBeInstanceOf(BadRequestException);
		expect(stranger).toBeInstanceOf(BadRequestException);
		expect(hiddenSibling.getResponse()).toMatchObject({ code: DOCS_REORDER_MIXED_PARENTS });
		expect(stranger.getResponse()).toMatchObject({ code: DOCS_REORDER_MIXED_PARENTS });
		expect(row(repository, 'hidden').index).toBe(1);
	});

	it('still reorders the siblings the caller sees', async () => {
		const repository = tree({ visible: { index: 2 } });
		const service = new DocumentTreeService(repository);

		await service.reorderDocuments('folder', ['visible'], 'tenant-1', 'org-1', hiding('hidden'));

		expect(row(repository, 'visible').index).toBe(0);
	});
});

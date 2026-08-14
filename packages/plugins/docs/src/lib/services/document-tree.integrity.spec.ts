/**
 * Regression cover for the tree mechanics of `DocumentTreeService`.
 *
 * Four defects are pinned here:
 *
 * 1. `assertNoCycle` / `unarchiveSubtree` walked the ancestor chain with no `visited` set, so a
 *    cycle already written into the data (the metadata `PUT` used to accept `parentId`) spun
 *    them forever instead of failing the request.
 * 2. `moveDocument` renumbered only the destination sibling list, leaving a hole in the source.
 * 3. `promote-children` renumbered nothing, so promoted children collided with their new
 *    siblings' indexes.
 * 4. The `subtree` delete checked `isArchived` on the ROOT only and silently trashed live,
 *    never-archived descendants.
 */
jest.mock('@gauzy/config', () => ({ isSqlite: () => false, isBetterSqlite3: () => false }), { virtual: true });
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));

import { ConflictException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { DocumentKindEnum } from '@gauzy/contracts';
import { DOCS_SUBTREE_NOT_ARCHIVED, DOCS_TREE_CYCLE } from '../docs.constants';
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

/**
 * An in-memory document table backing the repository seam. Rows are matched on the handful of
 * `where` shapes the tree service actually uses (`id`, `parentId`, `isArchived`, `In(...)`).
 */
const buildRepository = (rows: any[]) => {
	const updates: Array<{ id: any; patch: any }> = [];
	const softDeleted: any[] = [];

	/** Compares one `where` entry, resolving the `In(...)` / `IsNull()` find operators. */
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

	const repository: any = {
		rows,
		updates,
		softDeleted,
		find: jest.fn(async ({ where, order }: any) => {
			const found = rows.filter((row) => matches(where, row));
			if (order?.index === 'ASC') {
				found.sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
			}
			return found;
		}),
		findOne: jest.fn(async ({ where }: any) => rows.find((row) => matches(where, row)) ?? null),
		update: jest.fn(async (criteria: any, patch: any) => {
			for (const row of rows.filter((candidate) => matches(criteria, candidate))) {
				updates.push({ id: row.id, patch });
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
		}),
		restore: jest.fn(async () => ({ affected: 1 })),
		createQueryBuilder: jest.fn(() => {
			const qb: any = {
				withDeleted: () => qb,
				where: () => qb,
				andWhere: () => qb,
				getMany: async () => []
			};
			return qb;
		})
	};
	return repository;
};

/** The final `index` of every row, keyed by id — the shape the assertions care about. */
const indexesOf = (repository: any): Record<string, number> =>
	repository.rows.reduce((acc: Record<string, number>, row: any) => ({ ...acc, [row.id]: row.index }), {});

describe('DocumentTreeService — cycle guards terminate', () => {
	it('rejects a move under a pre-existing cycle instead of looping forever', async () => {
		// a → b → a is already in the data; moving `moved` under `a` must fail, not hang.
		const repository = buildRepository([
			node({ id: 'moved', parentId: null }),
			node({ id: 'a', parentId: 'b' }),
			node({ id: 'b', parentId: 'a' })
		]);
		const service = new DocumentTreeService(repository);

		const rejection = service.assertNoCycle(repository.rows[0], 'a');

		await expect(rejection).rejects.toBeInstanceOf(ConflictException);
		await expect(rejection).rejects.toMatchObject({ response: { code: DOCS_TREE_CYCLE } });
	});

	it('still rejects the plain self-parent and descendant-parent cases', async () => {
		const repository = buildRepository([node({ id: 'root' }), node({ id: 'child', parentId: 'root' })]);
		const service = new DocumentTreeService(repository);

		await expect(service.assertNoCycle(repository.rows[0], 'root')).rejects.toMatchObject({
			response: { code: DOCS_TREE_CYCLE }
		});
		await expect(service.assertNoCycle(repository.rows[0], 'child')).rejects.toMatchObject({
			response: { code: DOCS_TREE_CYCLE }
		});
	});

	it('terminates the unarchive ancestor walk on a pre-existing cycle', async () => {
		const repository = buildRepository([
			node({ id: 'leaf', parentId: 'a', isArchived: true }),
			node({ id: 'a', parentId: 'b', isArchived: true }),
			node({ id: 'b', parentId: 'a', isArchived: true })
		]);
		const service = new DocumentTreeService(repository);

		await expect(service.unarchiveSubtree(repository.rows[0])).resolves.toBeGreaterThan(0);
		expect(repository.rows.every((row: any) => row.isArchived === false)).toBe(true);
	});
});

describe('DocumentTreeService — sibling index maintenance', () => {
	it('renumbers BOTH the source and the destination sibling lists on a move', async () => {
		const repository = buildRepository([
			node({ id: 'src-0', parentId: 'src', index: 0 }),
			node({ id: 'moved', parentId: 'src', index: 1 }),
			node({ id: 'src-2', parentId: 'src', index: 2 }),
			node({ id: 'dst', parentId: null, index: 0, kind: DocumentKindEnum.FOLDER }),
			node({ id: 'src', parentId: null, index: 1, kind: DocumentKindEnum.FOLDER }),
			node({ id: 'dst-0', parentId: 'dst', index: 0 })
		]);
		const service = new DocumentTreeService(repository);
		const moved = repository.rows.find((row: any) => row.id === 'moved');

		await service.moveDocument(moved, 'dst', 0);

		const indexes = indexesOf(repository);
		// Destination: the moved node took slot 0 and pushed the incumbent down.
		expect(indexes['moved']).toBe(0);
		expect(indexes['dst-0']).toBe(1);
		// Source: compacted to a dense 0..n-1 range, no hole where the node used to sit.
		expect(indexes['src-0']).toBe(0);
		expect(indexes['src-2']).toBe(1);
	});

	it('leaves a same-parent reorder untouched apart from the spliced order', async () => {
		const repository = buildRepository([
			node({ id: 'a', parentId: 'p', index: 0 }),
			node({ id: 'b', parentId: 'p', index: 1 }),
			node({ id: 'c', parentId: 'p', index: 2 }),
			node({ id: 'p', parentId: null, index: 0, kind: DocumentKindEnum.FOLDER })
		]);
		const service = new DocumentTreeService(repository);
		const moved = repository.rows.find((row: any) => row.id === 'c');

		await service.moveDocument(moved, 'p', 0);

		expect(indexesOf(repository)).toMatchObject({ c: 0, a: 1, b: 2 });
	});

	it('renumbers the destination list after promote-children', async () => {
		const repository = buildRepository([
			node({ id: 'parent', parentId: null, index: 0, isArchived: true }),
			node({ id: 'sibling', parentId: null, index: 1 }),
			node({ id: 'child-a', parentId: 'parent', index: 0 }),
			node({ id: 'child-b', parentId: 'parent', index: 1 })
		]);
		const service = new DocumentTreeService(repository);
		const parent = repository.rows[0];

		await service.deleteDocument(parent, 'promote-children');

		// Both children are now root siblings of `sibling` with a dense, collision-free order.
		expect(repository.rows.find((row: any) => row.id === 'child-a').parentId).toBeNull();
		expect(repository.rows.find((row: any) => row.id === 'child-b').parentId).toBeNull();
		const promoted = repository.rows
			.filter((row: any) => row.id !== 'parent')
			.map((row: any) => row.index)
			.sort();
		expect(promoted).toEqual([0, 1, 2]);
	});
});

describe('DocumentTreeService — subtree delete precondition', () => {
	it('refuses to trash live descendants of an archived root', async () => {
		const repository = buildRepository([
			node({ id: 'root', parentId: null, isArchived: true }),
			node({ id: 'live-child', name: 'Live child', parentId: 'root', isArchived: false })
		]);
		const service = new DocumentTreeService(repository);

		const rejection = service.deleteDocument(repository.rows[0], 'subtree');

		await expect(rejection).rejects.toBeInstanceOf(ConflictException);
		await expect(rejection).rejects.toMatchObject({
			response: { code: DOCS_SUBTREE_NOT_ARCHIVED, documentIds: ['live-child'] }
		});
		expect(repository.softDeleted).toHaveLength(0);
	});

	it('deletes when the whole subtree is archived', async () => {
		const repository = buildRepository([
			node({ id: 'root', parentId: null, isArchived: true }),
			node({ id: 'child', parentId: 'root', isArchived: true })
		]);
		const service = new DocumentTreeService(repository);

		await service.deleteDocument(repository.rows[0], 'subtree');

		expect(repository.softDeleted).toEqual(expect.arrayContaining(['root', 'child']));
	});
});

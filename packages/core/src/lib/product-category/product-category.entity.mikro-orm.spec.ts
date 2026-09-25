import '../core/entities/internal';

import { MetadataStorage } from '@mikro-orm/core';
import { getMetadataArgsStorage } from 'typeorm';
// Imported before any case changes `DB_ORM`, so this registry holds the TypeORM mapping.
import { ProductCategory } from './product-category.entity';

/**
 * C7-4 — how `ProductCategory.parentId` is mapped on each ORM.
 *
 * The closure-table commit marked `parentId` `relationId: true`, beside TypeORM's `@TreeParent`.
 * `MultiORMColumn` turns `relationId` into `persist: false` for MikroORM (see `column.helper.ts`), which
 * is right for a column a MikroORM relation owns — and `parentId` has none: `@TreeParent` is TypeORM's,
 * and MikroORM has no tree strategy. Under `DB_ORM=mikro-orm` the column was therefore left out of every
 * INSERT and every SELECT, so a category filed under a parent was stored as a root and read back without
 * one, and the MikroORM walk of the subtree, which filters on the column, found nothing.
 *
 * The decorators register the active ORM's mapping at class-definition time, so the MikroORM half
 * re-imports the entities in a fresh module registry with `DB_ORM=mikro-orm`, as
 * `invoice-number-unique-mikro-orm.spec.ts` does. What the service does with the column on each ORM is
 * pinned against a real database by `product-category.service.spec.ts`.
 */
describe('ProductCategory.parentId mapping (C7-4)', () => {
	const originalOrm = process.env.DB_ORM;

	afterAll(() => {
		if (originalOrm === undefined) {
			delete process.env.DB_ORM;
		} else {
			process.env.DB_ORM = originalOrm;
		}
	});

	it('is a column under TypeORM that the tree parent relation joins on', () => {
		const storage = getMetadataArgsStorage();

		expect(
			storage.columns.some((column) => column.target === ProductCategory && column.propertyName === 'parentId')
		).toBe(true);
		expect(
			storage.relations.some(
				(relation) => relation.target === ProductCategory && relation.propertyName === 'parent' && relation.isTreeParent
			)
		).toBe(true);
		expect(storage.trees.some((tree) => tree.target === ProductCategory && tree.type === 'closure-table')).toBe(true);
	});

	it('is a persisted property under MikroORM, the only mapping of the column that ORM has', () => {
		process.env.DB_ORM = 'mikro-orm';

		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			require('../core/entities/internal');
		});

		// Read the storage by key rather than by class: MikroORM files metadata under
		// `<className>-<hash of the file the decorator ran in>`, and a lookup from this file would not
		// land on the key the isolated registry wrote.
		const storage: Record<string, { properties: Record<string, { persist?: boolean; kind?: string }> }> = (
			MetadataStorage as any
		).metadata;
		const categories = Object.entries(storage)
			.filter(([key]) => key.startsWith('ProductCategory-'))
			.map(([, meta]) => meta);

		expect(categories.length).toBeGreaterThan(0);

		for (const meta of categories) {
			expect(meta.properties['parentId']).toBeDefined();
			// The defect: `persist: false`, so the column was never written or read.
			expect(meta.properties['parentId'].persist).not.toBe(false);
			// `@TreeParent` is TypeORM's alone: nothing else maps `parentId` under MikroORM.
			expect(meta.properties['parent']).toBeUndefined();
			// Control: a relation id that a MikroORM relation does own is still a non-persisted mirror,
			// so the storage read here is the one `relationId: true` acts on.
			expect(meta.properties['imageId']?.persist).toBe(false);
			expect(meta.properties['image']?.kind).toBe('m:1');
		}
	});
});

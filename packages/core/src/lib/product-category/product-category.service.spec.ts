/**
 * The category tree (schema §2.2, task CE-97).
 *
 * Three rules, and this suite walks each of them. A parent a caller names has to exist, or the category
 * belongs to no tree at all and nothing about the row says so. A parent that is the category itself, or
 * one of its own descendants, has to be refused **before** anything is written — a cycle has no root
 * down that path, and the closure rows the ORM wrote on the way in are no help once it exists. And
 * removing a category has to detach its children first, which is the `SET NULL` rule the schema
 * promises and which SQLite cannot carry as a constraint.
 *
 * The base CRUD class is doubled, because it reaches the entity barrel and with it the whole application
 * graph. The service under test is the real one, over an in-memory table, and the tree repository the
 * TypeORM arm asks for is doubled too: what this suite pins is the *decision* the service makes about a
 * subtree — the closure table itself is proved by the migration, which the migration smoke test runs
 * from an empty database.
 */
jest.mock('../core/crud/tenant-aware-crud.service', () => {
	const { NotFoundException } = require('@nestjs/common');

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		/** The dialect the suite runs as. `mikro` makes the walk-through-`parentId` arm the live one. */
		get ormType(): string {
			return 'typeorm';
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async findAll(options: any = {}): Promise<any> {
			const items = await this.typeOrmRepository.find(options);

			return { items, total: items.length };
		}

		async paginate(options: any = {}): Promise<any> {
			const items = await this.typeOrmRepository.find(options);

			return { items, total: items.length };
		}

		async findOneByIdString(id: any): Promise<any> {
			const rows = await this.typeOrmRepository.find({ where: { id } });
			const row = rows[0];

			if (!row) {
				throw new NotFoundException('The requested record was not found');
			}

			return row;
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async save(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}
	}

	return { TenantAwareCrudService };
});

import { ProductCategory } from './product-category.entity';
import { ProductCategoryService } from './product-category.service';

type Row = Record<string, any>;

/**
 * The table, plus the tree repository the TypeORM arm reads it through.
 *
 * `getTreeRepository` answers the same subtree by walking `parentId`, which is what the ORM's closure
 * strategy answers from its closure table. The double therefore stands in for TypeORM's *answer*, and
 * the assertion that the service asked for it is what proves the arm taken.
 */
const ROOT = 'category-root';
const BRANCH = 'category-branch';
const LEAF = 'category-leaf';
const OTHER = 'category-other';

function fixture(rows: Row[] = []) {
	const calls: Array<{ method: string; criteria: unknown }> = [];

	const table = {
		categories: rows,
		find: async (options?: { where?: Record<string, unknown> }) => {
			const where = options?.where ?? {};

			return table.categories.filter((row) => {
				if (where.id !== undefined && row.id !== where.id) return false;
				if (where.parentId === null && row.parentId !== null && row.parentId !== undefined) return false;
				if (where.parentId !== null && where.parentId !== undefined) {
					const values = Array.isArray((where.parentId as any)?.value)
						? (where.parentId as any).value
						: [where.parentId];
					if (!values.includes(row.parentId)) return false;
				}

				return true;
			});
		},
		findOne: async (options?: { where?: Record<string, unknown> }) => (await table.find(options))[0] ?? null,
		create: (partial: Row) => ({ id: `category-${table.categories.length + 1}`, ...partial }),
		save: async (entity: Row) => {
			const existing = table.categories.findIndex((row) => row.id === entity.id);

			if (existing === -1) {
				table.categories.push(entity);
			} else {
				table.categories[existing] = entity;
			}

			return entity;
		},
		update: async (criteria: any, partial: Row) => {
			calls.push({ method: 'update', criteria });

			const where = criteria?.where ?? criteria;
			const matched = table.categories.filter((row) => row.parentId === where.parentId);

			for (const row of matched) {
				Object.assign(row, partial);
			}

			return { affected: matched.length };
		},
		delete: async (criteria: any) => {
			calls.push({ method: 'delete', criteria });

			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const at = table.categories.findIndex((row) => row.id === id);

			if (at !== -1) {
				table.categories.splice(at, 1);
			}

			return { affected: at === -1 ? 0 : 1 };
		},
		manager: {
			getTreeRepository: () => ({
				/**
				 * Every row below the given one, the row itself first — which is the order the ORM
				 * answers in, because the closure table carries the self-pair.
				 */
				findDescendants: async (category: Row) => {
					calls.push({ method: 'findDescendants', criteria: category.id });

					const descendants = [category];
					let level = [category.id];

					while (level.length > 0) {
						const children = table.categories.filter((row) => level.includes(row.parentId));

						if (children.length === 0) break;

						descendants.push(...children);
						level = children.map((row) => row.id);
					}

					return descendants;
				}
			})
		}
	};

	const service = new ProductCategoryService(table as never, {} as never);

	return { service, table, calls, rows: rows };
}

/** The three-level taxonomy every case below walks. */
const threeLevels = (): Row[] => [
	{ id: ROOT, parentId: null, slug: 'root' },
	{ id: BRANCH, parentId: ROOT, slug: 'branch' },
	{ id: LEAF, parentId: BRANCH, slug: 'leaf' },
	{ id: OTHER, parentId: null, slug: 'other' }
];

describe('ProductCategoryService — the parent a caller names', () => {
	it('refuses a parent that does not exist, naming the parent rather than the category', async () => {
		const { service, table } = fixture(threeLevels());

		await expect(service.create({ slug: 'orphan', parentId: 'no-such-category' } as never)).rejects.toMatchObject(
			{
				response: { code: 'PRODUCT_CATEGORY_PARENT_NOT_FOUND' }
			}
		);

		// Control: a service that wrote the row anyway would leave a category whose parent resolves to
		// nothing, and no read of the row would say so.
		expect(table.categories.map((row) => row.slug)).not.toContain('orphan');
	});

	it('creates a category under a parent that exists', async () => {
		const { service, table } = fixture(threeLevels());

		const created = await service.create({ slug: 'child', parentId: ROOT } as never);

		expect(created.parentId).toBe(ROOT);
		expect(table.categories.map((row) => row.slug)).toContain('child');
	});

	it('refuses a category as its own parent, before the write', async () => {
		const { service, table } = fixture(threeLevels());

		await expect(
			service.updateProductCategory(ROOT, { id: ROOT, parentId: ROOT, slug: 'root' } as never)
		).rejects.toMatchObject({ response: { code: 'PRODUCT_CATEGORY_CYCLE' } });

		// Control: this update is a delete-then-recreate, so a refusal that arrived one step later would
		// have removed the row it refused to change.
		expect(table.categories.map((row) => row.id)).toContain(ROOT);
		expect(table.categories.find((row) => row.id === ROOT)?.parentId).toBeNull();
	});

	it('refuses a parent inside the category being moved, which is what would close the loop', async () => {
		const { service, table } = fixture(threeLevels());

		await expect(
			service.updateProductCategory(ROOT, { id: ROOT, parentId: LEAF, slug: 'root' } as never)
		).rejects.toMatchObject({ response: { code: 'PRODUCT_CATEGORY_CYCLE' } });

		expect(table.categories.find((row) => row.id === ROOT)?.parentId).toBeNull();
		expect(table.categories.find((row) => row.id === LEAF)?.parentId).toBe(BRANCH);
	});

	it('accepts a re-parent that moves a branch under another root', async () => {
		const { service, table } = fixture(threeLevels());

		await service.updateProductCategory(BRANCH, { id: BRANCH, parentId: OTHER, slug: 'branch' } as never);

		expect(table.categories.find((row) => row.id === BRANCH)?.parentId).toBe(OTHER);
	});
});

describe('ProductCategoryService — the subtree', () => {
	it('answers the whole subtree, the category itself first', async () => {
		const { service } = fixture(threeLevels());

		const descendants = await service.findDescendants(ROOT);

		expect(descendants.map((row) => row.id)).toEqual([ROOT, BRANCH, LEAF]);
	});

	it('asks the tree repository for the subtree, which is what reads the closure table', async () => {
		const { service, calls } = fixture(threeLevels());

		await service.findDescendants(ROOT);

		// The TypeORM arm goes through `getTreeRepository`, and that repository is the only reader of
		// `product_category_closure`. Control: an arm that walked the rows itself would answer the same
		// list without the index the closure table exists to provide.
		expect(calls.filter((call) => call.method === 'findDescendants')).toHaveLength(1);
	});

	it('knows a category is inside another, and that an unrelated one is not', async () => {
		const { service } = fixture(threeLevels());

		await expect(service.isDescendantOf(ROOT, LEAF)).resolves.toBe(true);
		await expect(service.isDescendantOf(ROOT, ROOT)).resolves.toBe(true);
		await expect(service.isDescendantOf(BRANCH, ROOT)).resolves.toBe(false);
		await expect(service.isDescendantOf(ROOT, OTHER)).resolves.toBe(false);
	});
});

describe('ProductCategoryService — removing a category', () => {
	it('detaches the children before the row is deleted, so they become roots', async () => {
		const { service, table, calls } = fixture(threeLevels());

		await service.delete(ROOT);

		// Control: the order is the whole point. Deleting first leaves nothing to detach the children by,
		// and they keep naming a parent that no longer exists — which on SQLite is exactly what happens,
		// because the `SET NULL` rule cannot be a constraint there.
		expect(calls.map((call) => call.method)).toEqual(['update', 'delete']);
		expect(table.categories.map((row) => row.id)).not.toContain(ROOT);
		expect(table.categories.find((row) => row.id === BRANCH)?.parentId).toBeNull();
		expect(table.categories.find((row) => row.id === LEAF)?.parentId).toBe(BRANCH);
	});
});

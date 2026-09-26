/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a membership service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the order and cart packages' service specs do, and **the service under test is the real
 * one**: only the base CRUD class, the request context and the entity base classes are substituted.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			if (!id) {
				throw new NotFoundException('The requested record was not found');
			}

			const record = await this.typeOrmRepository.findOne({
				...options,
				where: { ...(options.where ?? {}), id }
			});

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async findOneByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			if (typeof id === 'string') {
				await this.findOneByIdString(id);
			}

			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}
	}

	return {
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		BaseEvent: class {},
		EventBus: class {},
		Product: class {},
		ProductVariant: class {},
		Tag: class {},
		ImageAsset: class {},
		OrganizationContact: class {},
		Warehouse: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { CollectionProduct } from './collection-product.entity';
import { CollectionProductService } from './collection-product.service';

/**
 * Manual membership of products in a collection.
 *
 * A merchandiser reorders a shelf, so the write the domain needs is "here is the whole set, in this
 * order" — not a sequence of adds and removes whose positions somebody has to repair afterwards
 * (doc 05 §4.4). The suite pins the properties the schema fixes:
 *
 * - a product appears **at most once per collection**, and a request that names it twice is refused
 *   rather than written with two ambiguous positions;
 * - membership is a *set with an order*: replacing it writes the additions, the removals and the new
 *   positions in one transaction, and the rows that are still requested are never duplicated;
 * - a removal names a member: removing a product the collection does not carry is a stated miss, not
 *   a silent success;
 * - membership is scoped to its collection — the same product on two shelves is two rows, and one
 *   shelf's reorder cannot touch the other's;
 * - position ties are broken by the instant each row was added, so a read of the membership is
 *   deterministic even when two rows declare the same position.
 *
 * The service is constructed directly with an in-memory double of its repository. The double states
 * the `where` and the `order` the service states, and models the `manager` the write path uses — the
 * `delete`, `update` and `insert` it issues inside one transaction — because a double that ignored
 * the requested set would make every membership case below vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const COLLECTION = '00000000-0000-4000-8000-000000000010';
const OTHER_COLLECTION = '00000000-0000-4000-8000-000000000011';
const P1 = '00000000-0000-4000-8000-000000000021';
const P2 = '00000000-0000-4000-8000-000000000022';
const P3 = '00000000-0000-4000-8000-000000000023';

/** The tables this suite drives, as plain arrays. */
interface ITables {
	collection_product: any[];
}

/** One `collection_product` row. */
const membership = (id: string, productId: string, position: number, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	collectionId: COLLECTION,
	productId,
	position,
	addedAt: new Date('2026-01-01T00:00:00.000Z'),
	...overrides
});

/**
 * The manager double: the three statements the write path issues, keyed by the entity they name.
 *
 * @param tables The whole datastore, so a statement can address the table its entity maps onto.
 * @param entityToTable The table each entity class writes.
 */
function manager(tables: ITables, entityToTable: Map<unknown, keyof ITables>) {
	let sequence = 0;
	const rows = (entity: unknown) => {
		const table = entityToTable.get(entity);

		if (!table) {
			throw new Error('the in-memory double was handed an entity it does not know');
		}

		return tables[table];
	};
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	/** The whole datastore, copied row by row, so a failed transaction can put it back. */
	const snapshot = () =>
		Object.fromEntries(
			Object.entries(tables).map(([table, tableRows]) => [table, tableRows.map((row) => ({ ...row }))])
		);
	const restore = (copy: Record<string, any[]>) => {
		for (const [table, tableRows] of Object.entries(copy)) {
			(tables as unknown as Record<string, any[]>)[table] = tableRows;
		}
	};

	const writeManager: any = {
		rows,
		/**
		 * The transaction the write path asks for: the callback sees the same datastore, and a throw
		 * from anywhere inside it leaves the datastore exactly as it was — which is the property every
		 * "nothing was written" assertion below depends on.
		 */
		transaction: async (run: (manager: any) => Promise<any>) => {
			const copy = snapshot();

			try {
				return await run(writeManager);
			} catch (error) {
				restore(copy);
				throw error;
			}
		},
		create: (entity: unknown, partial: any) => ({ ...partial }),
		save: async (entity: unknown, row: any) => {
			const table = rows(entity);
			const index = table.findIndex((candidate) => same(candidate.id, row.id));

			if (index >= 0) {
				table[index] = { ...table[index], ...row };

				return table[index];
			}

			table.push(row);

			return row;
		},
		find: async (entity: unknown, options: any = {}) =>
			rows(entity).filter((row: any) =>
				Object.entries(options.where ?? {}).every(([field, expected]) => same(row[field], expected))
			),
		findOne: async (entity: unknown, options: any = {}) =>
			rows(entity).find((row: any) =>
				Object.entries(options.where ?? {}).every(([field, expected]) => same(row[field], expected))
			) ?? null,
		insert: async (entity: unknown, partial: any) => {
			rows(entity).push({ id: `inserted-${++sequence}`, ...partial });

			return partial;
		},
		update: async (entity: unknown, id: unknown, patch: any) => {
			const row = rows(entity).find((candidate: any) => same(candidate.id, id));

			if (row) {
				Object.assign(row, patch);
			}

			return { affected: row ? 1 : 0 };
		},
		delete: async (entity: unknown, criteria: unknown) => {
			const ids = Array.isArray(criteria) ? criteria : [criteria];
			const table = rows(entity);
			let affected = 0;

			for (const id of ids) {
				const index = table.findIndex((candidate: any) => same(candidate.id, id));

				if (index >= 0) {
					table.splice(index, 1);
					affected += 1;
				}
			}

			return { affected };
		}
	};

	return writeManager;
}

/**
 * An in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 * @param writeManager The manager the service reaches through `repository.manager`.
 */
function repository(tables: ITables, tableName: keyof ITables, writeManager: any) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const matches = (row: any, where: any): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => {
			if (expected instanceof FindOperator) {
				if (expected.type === 'not') {
					return String(row[field] ?? '') !== String(expected.value ?? '');
				}

				throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}

			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});
	const sorted = (found: any[], order?: Record<string, 'ASC' | 'DESC'>) => {
		const columns = Object.keys(order ?? {});

		if (!columns.length) {
			return found;
		}

		return [...found].sort((left, right) => {
			for (const column of columns) {
				const a = left[column] instanceof Date ? left[column].getTime() : left[column];
				const b = right[column] instanceof Date ? right[column].getTime() : right[column];

				if (a === b) {
					continue;
				}

				const direction = order?.[column] === 'DESC' ? -1 : 1;

				return (a > b ? 1 : -1) * direction;
			}

			return 0;
		});
	};

	return {
		rows,
		manager: writeManager,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => sorted(rows().filter((row) => matches(row, options.where)), options.order),
		findOne: async (options: any = {}) => {
			const [row] = sorted(rows().filter((candidate) => matches(candidate, options.where)), options.order);

			return row ?? null;
		},
		findOneBy: async (where: any) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows().length,
		create: (partial: any) => ({ ...partial }),
		save: async (entity: any) => {
			if (entity.id) {
				const index = rows().findIndex((row) => row.id === entity.id);

				if (index >= 0) {
					rows()[index] = { ...rows()[index], ...entity };

					return rows()[index];
				}
			}

			const created = { id: `${String(tableName)}-new-${++sequence}`, ...entity };

			rows().push(created);

			return created;
		},
		update: async (criteria: any, partial: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/**
 * Builds the membership service over one in-memory `collection_product` table.
 *
 * @param rows The membership rows the fixture starts with.
 */
function membershipFixture(rows: any[] = []) {
	const tables: ITables = { collection_product: [...rows] };
	const entityToTable = new Map<unknown, keyof ITables>([[CollectionProduct, 'collection_product']]);
	const writeManager = manager(tables, entityToTable);
	const service = new CollectionProductService(
		repository(tables, 'collection_product', writeManager) as never,
		{} as never
	);
	const positionsOf = (collectionId: string = COLLECTION) =>
		tables.collection_product
			.filter((row) => row.collectionId === collectionId)
			.sort((left, right) => left.position - right.position)
			.map((row) => row.productId);

	return { service, tables, positionsOf };
}

describe('CollectionProductService — membership with an order (doc 05 §4.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('curates a product at the end of the collection, stamping when it was added', async () => {
		const fixture = membershipFixture();

		const first = await fixture.service.create({ collectionId: COLLECTION, productId: P1 } as never);
		const second = await fixture.service.create({ collectionId: COLLECTION, productId: P2 } as never);

		// The first row of a shelf is position zero and every later one follows it, so "new in" is the
		// order the merchandiser typed nothing for.
		expect(first).toMatchObject({ position: 0, productId: P1 });
		expect(second).toMatchObject({ position: 1, productId: P2 });
		expect(first.addedAt).toBeInstanceOf(Date);
	});

	it('refuses the same product twice in one request rather than ordering it twice', async () => {
		// Two rows for one product would make "position 2" and "position 5" both mean the same shelf
		// slot, and the order the buyer sees would depend on which row the database returned first.
		const fixture = membershipFixture();

		await expect(fixture.service.replaceProducts(COLLECTION, [P1, P2, P1])).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(fixture.tables.collection_product).toEqual([]);

		await expect(
			fixture.service.create({ collectionId: COLLECTION, productId: P1 } as never)
		).resolves.toBeDefined();
	});

	it('keeps one row when the same product is curated into the collection twice', async () => {
		const fixture = membershipFixture();

		await fixture.service.replaceProducts(COLLECTION, [P1]);
		const again = await fixture.service.replaceProducts(COLLECTION, [P1]);

		expect(fixture.tables.collection_product).toHaveLength(1);
		expect(again.map((row) => row.productId)).toEqual([P1]);
	});

	it('writes the whole requested set — additions, removals and the new positions — in one call', async () => {
		const fixture = membershipFixture([membership('row-1', P1, 0), membership('row-2', P2, 1)]);

		const replaced = await fixture.service.replaceProducts(COLLECTION, [P2, P3, P1]);

		expect(replaced.map((row) => row.productId)).toEqual([P2, P3, P1]);
		expect(replaced.map((row) => row.position)).toEqual([0, 1, 2]);
		// The rows that were already there keep their identity: a reorder moves them, it does not
		// replace them, or "new in" would report the whole shelf as new.
		expect(replaced.map((row) => row.id)).toEqual(expect.arrayContaining(['row-1', 'row-2']));
		expect(new Set(replaced.map((row) => row.id)).size).toBe(3);
		expect(fixture.tables.collection_product).toHaveLength(3);
	});

	it('removes the members that are no longer requested', async () => {
		const fixture = membershipFixture([membership('row-1', P1, 0), membership('row-2', P2, 1)]);

		await fixture.service.replaceProducts(COLLECTION, [P2]);

		expect(fixture.positionsOf()).toEqual([P2]);
		expect(fixture.tables.collection_product.map((row) => row.id)).toEqual(['row-2']);
	});

	it('removes one member and refuses to remove a product that is not one', async () => {
		const fixture = membershipFixture([membership('row-1', P1, 0), membership('row-2', P2, 1)]);

		await fixture.service.removeProduct(COLLECTION, P1);

		expect(fixture.positionsOf()).toEqual([P2]);

		await expect(fixture.service.removeProduct(COLLECTION, P1)).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.positionsOf()).toEqual([P2]);
	});

	it('scopes membership to the collection it belongs to', async () => {
		// The same product on two shelves is two rows, and one shelf's write is not the other's: a
		// membership row is addressed by its collection as well as by its product.
		const fixture = membershipFixture([
			membership('row-1', P1, 0),
			membership('row-2', P1, 0, { collectionId: OTHER_COLLECTION }),
			membership('row-3', P2, 1)
		]);

		await fixture.service.replaceProducts(COLLECTION, [P2]);

		expect(fixture.positionsOf(COLLECTION)).toEqual([P2]);
		expect(fixture.positionsOf(OTHER_COLLECTION)).toEqual([P1]);

		const listed = await fixture.service.findByCollection(COLLECTION);

		expect(listed.map((row) => row.id)).toEqual(['row-3']);
		expect(listed.every((row) => row.collectionId === COLLECTION)).toBe(true);
	});

	it('orders the membership by position and breaks a tie by the instant each row was added', async () => {
		// Positions are unique in practice but not constrained, so the read has to be deterministic
		// anyway: two rows that declare the same position are separated by when they were curated in.
		const fixture = membershipFixture([
			membership('later', P2, 3, { addedAt: new Date('2026-02-01T00:00:00.000Z') }),
			membership('earlier', P1, 3, { addedAt: new Date('2026-01-01T00:00:00.000Z') }),
			membership('first', P3, 0)
		]);

		const listed = await fixture.service.findByCollection(COLLECTION);

		expect(listed.map((row) => row.id)).toEqual(['first', 'earlier', 'later']);
	});
});

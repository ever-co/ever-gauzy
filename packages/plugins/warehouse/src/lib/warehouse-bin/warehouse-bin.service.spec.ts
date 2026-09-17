/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a position service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * as the catalogue and inventory packages' service specs do, and **the service under test is the
 * real one**: only the base CRUD class, the request context and the entity base classes are
 * substituted.
 *
 * The base-class double mirrors `TenantAwareCrudService` where the behaviour is observable to a
 * caller: `create` answers with the saved row, `update` reaches the repository and answers with
 * TypeORM's `UpdateResult`, and a write against an id that is not there is a miss rather than a
 * silent no-op.
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

		async findOneByIdString(id: any): Promise<any> {
			if (!id) {
				throw new NotFoundException('The requested record was not found');
			}

			const record = await this.typeOrmRepository.findOne({ where: { id } });

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

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
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
		User: class User {},
		Warehouse: class Warehouse {},
		SequenceService: class SequenceService {
			async allocate(): Promise<any> {
				throw new Error('no numbering series is configured in this double');
			}
		},
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
import {
	IWarehouseStockLedgerPort,
	WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED,
	WarehouseBinType,
	WarehouseStockMovementKind
} from '../warehouse.types';
import { WarehouseBinService } from './warehouse-bin.service';

/**
 * The positions inside a location: the tree, the closure it is walked through, and the measurement
 * that keeps a request honest.
 *
 * Three properties of this service are worth a suite of their own, and they are the three the
 * specification states (doc 09 §14.2 rules 1–4, §14.3, §14.10, INV-25):
 *
 * - **the tree and its closure are written together**, so a descendant query never reports stock
 *   under the wrong rack: a bin is its own ancestor, every ancestor of its parent becomes its
 *   ancestor, and a re-parent rewrites the whole subtree rather than the node alone;
 * - **a position never changes location or zone** — moving physical shelving is modelled by
 *   deactivating the old position and creating a new one, so a historical pick keeps the address it
 *   walked — and a position a printed pick line names cannot be renamed;
 * - **a capacity is a quantity in a stated unit**: a write that declares one without the other is
 *   refused, a request entered in another unit is converted exactly before it is compared, and
 *   exceeding the ceiling is a warning the record carries rather than a refusal.
 *
 * The service is constructed directly over in-memory doubles of its two repositories. The bin double
 * implements the closure statements the service issues — the descendant walk, the ancestor walk, the
 * insert, the subtree delete and the printed-pick-line count — so the assertions below read the state
 * the tree is in rather than a call log, and `INV-25` is checked the way it is stated.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const OTHER_WAREHOUSE = '00000000-0000-4000-8000-000000000011';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const OTHER_VARIANT = '00000000-0000-4000-8000-000000000031';

/** The tables this package owns that this suite drives, as plain arrays. */
interface ITables {
	bin: any[];
	zone: any[];
	/** The closure table, as the pairs the service writes through raw statements. */
	closure: Array<{ id_ancestor: string; id_descendant: string }>;
	/** The lines a printed pick list holds, which is what makes a position's code immutable. */
	pickLine: any[];
}

/** A closure pair, as a string key, so a set comparison does not depend on insertion order. */
const pairKey = (pair: { id_ancestor: string; id_descendant: string }) =>
	`${pair.id_ancestor}->${pair.id_descendant}`;

/**
 * An in-memory stand-in for one table's TypeORM repository, including the raw statements the service
 * issues against the closure table and the pick lines.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository reads and writes.
 */
function repository(tables: ITables, tableName: 'bin' | 'zone') {
	let sequence = 0;
	const rows = () => tables[tableName];
	const matches = (row: any, where: any = {}): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => {
			if (expected instanceof FindOperator) {
				if (expected.type === 'in') {
					return (expected.value as any[]).map(String).includes(String(row[field] ?? ''));
				}

				throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}

			// A missing column and a null column are the same thing to the database, and TypeORM drops
			// an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});
	const compare = (left: any, right: any): number => {
		const a = left instanceof Date ? left.getTime() : left;
		const b = right instanceof Date ? right.getTime() : right;

		if (typeof a === 'number' && typeof b === 'number') {
			return a - b;
		}

		return String(a ?? '') > String(b ?? '') ? 1 : -1;
	};
	const sorted = (found: any[], order?: Record<string, 'ASC' | 'DESC'>) => {
		const columns = Object.keys(order ?? {});

		if (!columns.length) {
			return found;
		}

		return [...found].sort((left, right) => {
			for (const column of columns) {
				if (compare(left[column], right[column]) === 0) {
					continue;
				}

				return compare(left[column], right[column]) * (order?.[column] === 'DESC' ? -1 : 1);
			}

			return 0;
		});
	};

	return {
		rows,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => sorted(rows().filter((row) => matches(row, options.where)), options.order),
		findOne: async (options: any = {}) => rows().find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: any) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async (options: any = {}) => rows().filter((row) => matches(row, options.where)).length,
		create: (partial: any) => ({ ...partial }),
		save: async (entity: any) => {
			if (entity.id) {
				const index = rows().findIndex((row) => row.id === entity.id);

				if (index >= 0) {
					rows()[index] = { ...rows()[index], ...entity };

					return rows()[index];
				}
			}

			// Generated ids carry an infix, so one can never collide with an id a fixture seeded.
			const created = { id: `${String(tableName)}-new-${++sequence}`, ...entity };

			rows().push(created);

			return created;
		},
		// The platform's `update` reaches TypeORM's own, which answers an `UpdateResult` and not the row.
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
		},
		/**
		 * The raw statements the service issues: the four closure reads and writes, and the count of
		 * printed pick lines that names the position. Anything else throws rather than answering wrongly.
		 */
		query: async (sql: string, params: any[] = []): Promise<any[]> => {
			if (/INSERT INTO "warehouse_bin_closure"/.test(sql)) {
				tables.closure.push({ id_ancestor: String(params[0]), id_descendant: String(params[1]) });

				return [];
			}

			if (/DELETE FROM "warehouse_bin_closure"/.test(sql)) {
				const removed = params.map(String);

				tables.closure = tables.closure.filter((pair) => !removed.includes(pair.id_descendant));

				return [];
			}

			if (/FROM "warehouse_bin_closure"/.test(sql)) {
				if (/"id_ancestor" = \? AND "id_descendant" = \?/.test(sql)) {
					return tables.closure
						.filter(
							(pair) =>
								pair.id_ancestor === String(params[0]) && pair.id_descendant === String(params[1])
						)
						.map((pair) => ({ id_ancestor: pair.id_ancestor }));
				}

				if (/"id_ancestor" = \?/.test(sql)) {
					return tables.closure
						.filter((pair) => pair.id_ancestor === String(params[0]))
						.map((pair) => ({ id_descendant: pair.id_descendant }));
				}

				if (/"id_descendant" = \?/.test(sql)) {
					return tables.closure
						.filter((pair) => pair.id_descendant === String(params[0]))
						.map((pair) => ({ id_ancestor: pair.id_ancestor }));
				}
			}

			if (/FROM "pick_list_line"/.test(sql)) {
				const total = tables.pickLine.filter(
					(line) => String(line.binId) === String(params[0]) && !line.deletedAt
				).length;

				return [{ total }];
			}

			throw new Error(`the in-memory double does not implement the statement "${sql}"`);
		}
	};
}

/** One `warehouse_bin` row, as the service reads it. */
const binRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseId: WAREHOUSE,
	zoneId: 'zone-1',
	code: id.toUpperCase(),
	type: WarehouseBinType.SHELF,
	isPickable: true,
	isBlocked: false,
	sortOrder: 0,
	version: 1,
	...overrides
});

/** One `warehouse_zone` row: the service only ever resolves a position's area through it. */
const zoneRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseId: WAREHOUSE,
	code: id.toUpperCase(),
	name: `Zone ${id}`,
	version: 1,
	...overrides
});

/** What the inventory capability answers with in a fixture, when one is registered. */
interface ILedgerSeed {
	/** What the ledger recorded per bin, which is the authoritative derived balance. */
	balances?: Array<{ binId: string; variantId: string; quantity: string; reservedQuantity?: string }>;
	/** What the level rows claim sits in each bin, which is what a count compares against. */
	claimed?: Array<{ binId: string; variantId: string; quantity: string }>;
	/** Where a variant is normally kept, which is what allocation reads. */
	home?: { binId?: string; quantity?: string };
}

/**
 * A hand-written stand-in for the inventory capability the service reads balances from and writes
 * movements to. Every movement the service asks for is kept, so "the difference was written as a
 * count" is asserted against what was asked for rather than against a call count.
 *
 * @param seed What the ledger recorded and what the level rows claim.
 */
function ledger(seed: ILedgerSeed = {}) {
	const movements: any[] = [];
	const asked: Array<Record<string, unknown>> = [];
	const port: IWarehouseStockLedgerPort = {
		readBinBalance: async (query) =>
			(seed.balances ?? []).find(
				(balance) =>
					String(balance.binId) === String(query.binId) &&
					String(balance.variantId) === String(query.variantId)
			),
		readBinBalances: async (binIds: any[]) =>
			(seed.balances ?? []).filter((balance) => binIds.map(String).includes(String(balance.binId))),
		readExpectedBinBalances: async (query) => {
			asked.push(query as Record<string, unknown>);

			return (seed.claimed ?? []).filter((balance) => query.binIds.map(String).includes(String(balance.binId)));
		},
		resolveHomeBin: async () => seed.home,
		recordMovement: async (request) => {
			movements.push(request);

			return { movementId: `movement-${movements.length}`, quantityAfter: '0.000000' };
		},
		relocate: async () => []
	};

	return { port, movements, asked };
}

/**
 * Builds the position service over in-memory doubles of its two repositories.
 *
 * @param options.bins The positions the fixture starts with.
 * @param options.zones The areas the fixture starts with.
 * @param options.closure The closure pairs the fixture starts with.
 * @param options.pickLines The printed pick lines the fixture starts with.
 * @param options.ledger What the inventory capability answers with; absent means none is registered.
 */
function binFixture(
	options: {
		bins?: any[];
		zones?: any[];
		closure?: Array<{ id_ancestor: string; id_descendant: string }>;
		pickLines?: any[];
		ledger?: ILedgerSeed;
	} = {}
) {
	const tables: ITables = {
		bin: [...(options.bins ?? [])],
		zone: [...(options.zones ?? [zoneRow('zone-1')])],
		closure: [...(options.closure ?? [])],
		pickLine: [...(options.pickLines ?? [])]
	};
	const capability = options.ledger ? ledger(options.ledger) : undefined;
	const service = new WarehouseBinService(
		repository(tables, 'bin') as never,
		{} as never,
		repository(tables, 'zone') as never,
		capability?.port as never
	);

	return {
		service,
		tables,
		capability,
		store: (id: string) => tables.bin.find((row) => row.id === id),
		ancestorsOf: (id: string): string[] =>
			tables.closure.filter((pair) => pair.id_descendant === id).map((pair) => pair.id_ancestor),
		descendantsOf: (id: string): string[] =>
			tables.closure.filter((pair) => pair.id_ancestor === id).map((pair) => pair.id_descendant),
		/** The closure as a set of pairs, for the "the old placement is gone" assertions. */
		pairs: (): string[] => tables.closure.map(pairKey)
	};
}

/**
 * A chain of positions, deepest last, each one parented to the one before it.
 *
 * @param ids The codes, in order from the root down.
 */
function chain(ids: string[]) {
	const bins: any[] = [];
	const closure: Array<{ id_ancestor: string; id_descendant: string }> = [];

	ids.forEach((id, index) => {
		bins.push(binRow(id, { parentId: index === 0 ? undefined : ids[index - 1], sortOrder: index }));
		closure.push({ id_ancestor: id, id_descendant: id });

		for (let above = index - 1; above >= 0; above--) {
			closure.push({ id_ancestor: ids[above], id_descendant: id });
		}
	});

	return { bins, closure };
}

describe('WarehouseBinService — creating a position and its place in the tree (doc 09 §14.2, INV-25)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates a position with the documented defaults and records it as its own ancestor', async () => {
		// The self-pair is what makes a descendant query return the node itself, so "everything under
		// rack B" is one indexed join rather than a recursive walk with a special case at the root.
		const fixture = binFixture();

		const created = await fixture.service.create({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			code: 'A-01'
		} as never);

		expect(created).toMatchObject({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			code: 'A-01',
			type: WarehouseBinType.SHELF,
			isPickable: true,
			isBlocked: false,
			sortOrder: 0,
			version: 1,
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(fixture.ancestorsOf(created.id)).toEqual([created.id]);
		expect(fixture.descendantsOf(created.id)).toEqual([created.id]);
	});

	it('records every ancestor of the parent as an ancestor of the child', async () => {
		// The closure is written in the same call as the bin, so the tree and the table it is walked
		// through can never disagree — a closure that lags one write behind reports stock under the
		// wrong rack and nothing would say so.
		const { bins, closure } = chain(['root', 'child']);
		const fixture = binFixture({ bins, closure });

		const grandchild = await fixture.service.create({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			parentId: 'child',
			code: 'GRANDCHILD'
		} as never);

		expect(new Set(fixture.ancestorsOf(grandchild.id))).toEqual(new Set([grandchild.id, 'child', 'root']));
		expect(new Set(fixture.descendantsOf('root'))).toEqual(new Set(['root', 'child', grandchild.id]));
	});

	it('keeps the type, pickability and order a caller states', async () => {
		const fixture = binFixture();

		const created = await fixture.service.create({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			code: 'P-01',
			type: WarehouseBinType.PALLET,
			isPickable: false,
			isBlocked: true,
			sortOrder: 9
		} as never);

		expect(created).toMatchObject({
			type: WarehouseBinType.PALLET,
			isPickable: false,
			isBlocked: true,
			sortOrder: 9
		});
	});

	it('normalises the declared capacities to the storage scale', async () => {
		const fixture = binFixture();

		const created = await fixture.service.create({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			code: 'P-01',
			capacityUnits: '1',
			capacityUnitId: 'unit-pallet',
			maxWeight: '480.5',
			maxWeightUnitId: 'unit-kg',
			maxVolume: '2',
			maxVolumeUnitId: 'unit-m3'
		} as never);

		expect(created).toMatchObject({
			capacityUnits: '1.000000',
			maxWeight: '480.500000',
			maxVolume: '2.000000'
		});
	});

	it('refuses a position that names no location, and one that carries no code', async () => {
		const fixture = binFixture();

		await expect(fixture.service.create({ zoneId: 'zone-1', code: 'A-01' } as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		await expect(fixture.service.create({ warehouseId: WAREHOUSE, code: '' } as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(fixture.tables.bin).toEqual([]);
		expect(fixture.tables.closure).toEqual([]);
	});

	it('refuses a code another position of the location already carries, and writes no closure row', async () => {
		const fixture = binFixture({ bins: [binRow('taken', { code: 'A-01' })] });

		await expect(
			fixture.service.create({ warehouseId: WAREHOUSE, zoneId: 'zone-1', code: 'A-01' } as never)
		).rejects.toThrow(/already used by a bin/);
		expect(fixture.tables.bin).toHaveLength(1);
		expect(fixture.tables.closure).toEqual([]);
	});

	it('accepts the same code at another location', async () => {
		// Control: a code is unique inside a location, not inside the installation.
		const fixture = binFixture({
			bins: [binRow('taken', { code: 'A-01' })],
			zones: [zoneRow('zone-1'), zoneRow('zone-1-elsewhere', { warehouseId: OTHER_WAREHOUSE })]
		});

		const created = await fixture.service.create({
			warehouseId: OTHER_WAREHOUSE,
			zoneId: 'zone-1-elsewhere',
			code: 'A-01'
		} as never);

		expect(created.warehouseId).toBe(OTHER_WAREHOUSE);
		expect(fixture.tables.bin).toHaveLength(2);
	});

	it('refuses a position in an area that does not exist', async () => {
		const fixture = binFixture();

		await expect(
			fixture.service.create({ warehouseId: WAREHOUSE, zoneId: 'no-such-zone', code: 'A-01' } as never)
		).rejects.toThrow(/zone named for this bin does not exist/);
		expect(fixture.tables.bin).toEqual([]);
	});

	it('refuses a position in an area of another location', async () => {
		const fixture = binFixture({ zones: [zoneRow('zone-1', { warehouseId: OTHER_WAREHOUSE })] });

		await expect(
			fixture.service.create({ warehouseId: WAREHOUSE, zoneId: 'zone-1', code: 'A-01' } as never)
		).rejects.toThrow(/BIN_LOCATION_MISMATCH/);
		expect(fixture.tables.bin).toEqual([]);
	});

	it('refuses a parent that does not exist, one of another location and one of another area', async () => {
		// Nesting has to stay inside the area: a child under a rack of another zone would be reached by
		// two different walking orders at once.
		const fixture = binFixture({
			bins: [
				binRow('here'),
				binRow('elsewhere', { warehouseId: OTHER_WAREHOUSE }),
				binRow('other-zone', { zoneId: 'zone-2' })
			]
		});

		await expect(
			fixture.service.create({
				warehouseId: WAREHOUSE,
				zoneId: 'zone-1',
				parentId: 'no-such-bin',
				code: 'A-01'
			} as never)
		).rejects.toThrow(/parent bin does not exist/);
		await expect(
			fixture.service.create({
				warehouseId: WAREHOUSE,
				zoneId: 'zone-1',
				parentId: 'elsewhere',
				code: 'A-01'
			} as never)
		).rejects.toThrow(/BIN_LOCATION_MISMATCH/);
		await expect(
			fixture.service.create({
				warehouseId: WAREHOUSE,
				zoneId: 'zone-1',
				parentId: 'other-zone',
				code: 'A-01'
			} as never)
		).rejects.toThrow(/only nest inside a bin of its own zone/);
		expect(fixture.tables.bin).toHaveLength(3);
	});

	it('refuses a capacity that does not declare the unit it is counted in', async () => {
		// A capacity is a quantity in a stated unit: a pallet position whose ceiling is `1` compared
		// against a request in pieces is either a wrong refusal or a wrong acceptance, and the unit
		// cannot be guessed (doc 09 §14.10, INV-28).
		const fixture = binFixture();

		await expect(
			fixture.service.create({
				warehouseId: WAREHOUSE,
				zoneId: 'zone-1',
				code: 'P-01',
				type: WarehouseBinType.PALLET,
				capacityUnits: '1'
			} as never)
		).rejects.toThrow(/WAREHOUSE_BIN_CAPACITY_UNIT_REQUIRED/);
		expect(fixture.tables.bin).toEqual([]);

		const declared = await fixture.service.create({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			code: 'P-01',
			type: WarehouseBinType.PALLET,
			capacityUnits: '1',
			capacityUnitId: 'unit-pallet'
		} as never);

		expect(declared).toMatchObject({ capacityUnits: '1.000000', capacityUnitId: 'unit-pallet' });
	});

	it('refuses a declared capacity of zero without a unit, and accepts a position with no capacity at all', async () => {
		// Boundary: `0` is a declared ceiling — an area that accepts nothing — so it is still a quantity
		// that needs its unit. No capacity at all is a different statement and needs nothing.
		const fixture = binFixture();

		await expect(
			fixture.service.create({ warehouseId: WAREHOUSE, zoneId: 'zone-1', code: 'A-01', capacityUnits: 0 } as never)
		).rejects.toThrow(/WAREHOUSE_BIN_CAPACITY_UNIT_REQUIRED/);

		const unbounded = await fixture.service.create({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			code: 'A-01'
		} as never);

		expect(unbounded.capacityUnits).toBeUndefined();
	});
});

describe('WarehouseBinService — creating a building by the rack (doc 09 §14.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('increments the trailing number and keeps the width it was written with', async () => {
		// The codes have to keep sorting the way the aisle is walked, so `A-01-09` is followed by
		// `A-01-10` rather than by `A-01-9`.
		const fixture = binFixture();

		const created = await fixture.service.createRange({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			from: 'A-01-09',
			count: 3
		});

		expect(created.map((bin) => bin.code)).toEqual(['A-01-09', 'A-01-10', 'A-01-11']);
		expect(created.map((bin) => bin.sortOrder)).toEqual([0, 1, 2]);
		expect(created.every((bin) => bin.type === WarehouseBinType.SHELF)).toBe(true);
	});

	it('starts the walk at the order the caller states', async () => {
		const fixture = binFixture();

		const created = await fixture.service.createRange({
			warehouseId: WAREHOUSE,
			zoneId: 'zone-1',
			from: 'B-01',
			count: 2,
			sortOrder: 10
		});

		expect(created.map((bin) => bin.sortOrder)).toEqual([10, 11]);
	});

	it('creates exactly one position for a range of one, which is the shortest legal range', async () => {
		const fixture = binFixture();

		const created = await fixture.service.createRange({ warehouseId: WAREHOUSE, zoneId: 'zone-1', from: 'A-1', count: 1 });

		expect(created.map((bin) => bin.code)).toEqual(['A-1']);
	});

	it('refuses a range of zero, of a negative count, of a fractional count and of no number to continue from', async () => {
		const fixture = binFixture();

		await expect(
			fixture.service.createRange({ warehouseId: WAREHOUSE, zoneId: 'zone-1', from: 'A-01', count: 0 })
		).rejects.toThrow(/at least one bin/);
		await expect(
			fixture.service.createRange({ warehouseId: WAREHOUSE, zoneId: 'zone-1', from: 'A-01', count: -1 })
		).rejects.toThrow(/at least one bin/);
		await expect(
			fixture.service.createRange({ warehouseId: WAREHOUSE, zoneId: 'zone-1', from: 'A-01', count: 1.5 })
		).rejects.toThrow(/at least one bin/);
		await expect(
			fixture.service.createRange({ warehouseId: WAREHOUSE, zoneId: 'zone-1', from: 'AISLE-A', count: 2 })
		).rejects.toThrow(/carries no number to continue from/);
		expect(fixture.tables.bin).toEqual([]);
	});

	it('refuses a range whose first code is already taken', async () => {
		const fixture = binFixture({ bins: [binRow('taken', { code: 'A-01' })] });

		await expect(
			fixture.service.createRange({ warehouseId: WAREHOUSE, zoneId: 'zone-1', from: 'A-01', count: 2 })
		).rejects.toThrow(/already used by a bin/);
		expect(fixture.tables.bin).toHaveLength(1);
	});
});

describe('WarehouseBinService — the two facts a position may never change (doc 09 §14.2 rule 1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses to move a position to another location', async () => {
		const fixture = binFixture({ bins: [binRow('bin-1')] });

		await expect(fixture.service.update('bin-1', { warehouseId: OTHER_WAREHOUSE } as never)).rejects.toThrow(
			/BIN_LOCATION_IMMUTABLE/
		);
		expect(fixture.store('bin-1')).toMatchObject({ warehouseId: WAREHOUSE, version: 1 });
	});

	it('refuses to move a position to another area, and accepts a restatement of its own area', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1')],
			zones: [zoneRow('zone-1'), zoneRow('zone-2')]
		});

		await expect(fixture.service.update('bin-1', { zoneId: 'zone-2' } as never)).rejects.toThrow(
			/BIN_LOCATION_IMMUTABLE/
		);
		expect(fixture.store('bin-1')).toMatchObject({ zoneId: 'zone-1', version: 1 });

		const updated = await fixture.service.update('bin-1', { zoneId: 'zone-1', sortOrder: 4 } as never);

		expect(updated).toMatchObject({ zoneId: 'zone-1', sortOrder: 4, version: 2 });
	});

	it('refuses a rename to a code another position of the location carries', async () => {
		const fixture = binFixture({ bins: [binRow('bin-1', { code: 'A-01' }), binRow('bin-2', { code: 'A-02' })] });

		await expect(fixture.service.update('bin-1', { code: 'A-02' } as never)).rejects.toThrow(
			/already used by a bin/
		);
		expect(fixture.store('bin-1')).toMatchObject({ code: 'A-01', version: 1 });
	});

	it('refuses a rename of a position a printed pick line already names', async () => {
		// The address as it was walked is what a historical pick keeps, which is why moving physical
		// shelving is modelled by deactivating the old position and creating a new one.
		const fixture = binFixture({
			bins: [binRow('bin-1', { code: 'A-01' })],
			pickLines: [
				{ id: 'line-1', binId: 'bin-1' },
				{ id: 'line-2', binId: 'bin-1' }
			]
		});

		await expect(fixture.service.update('bin-1', { code: 'A-09' } as never)).rejects.toThrow(
			/BIN_CODE_IMMUTABLE: 2 pick line/
		);
		expect(fixture.store('bin-1')).toMatchObject({ code: 'A-01', version: 1 });
	});

	it('accepts a rename of a position only deleted pick lines name', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1', { code: 'A-01' })],
			pickLines: [{ id: 'line-1', binId: 'bin-1', deletedAt: new Date() }]
		});

		const renamed = await fixture.service.update('bin-1', { code: 'A-09' } as never);

		expect(renamed).toMatchObject({ code: 'A-09', version: 2 });
	});

	it('lets a position whose capacity predates the unit column be edited for any other reason', async () => {
		// The migration leaves the unit null rather than guessing, and the capacity job asks the
		// operator for it; refusing every later edit of such a row would freeze it until then.
		const fixture = binFixture({ bins: [binRow('bin-1', { capacityUnits: '1.000000' })] });

		const updated = await fixture.service.update('bin-1', { sortOrder: 3 } as never);

		expect(updated).toMatchObject({ sortOrder: 3, capacityUnits: '1.000000', version: 2 });
	});

	it('refuses to change the capacity of such a position without declaring the unit at the same time', async () => {
		// The check is made against the row as it would stand, so stating one of the two fields is
		// stating the capacity.
		const fixture = binFixture({ bins: [binRow('bin-1', { capacityUnits: '1.000000' })] });

		await expect(fixture.service.update('bin-1', { capacityUnits: '2' } as never)).rejects.toThrow(
			/WAREHOUSE_BIN_CAPACITY_UNIT_REQUIRED/
		);
		expect(fixture.store('bin-1')).toMatchObject({ capacityUnits: '1.000000', version: 1 });

		const declared = await fixture.service.update('bin-1', {
			capacityUnits: '2',
			capacityUnitId: 'unit-pallet'
		} as never);

		expect(declared).toMatchObject({ capacityUnitId: 'unit-pallet', version: 2 });
		expect(Number(declared.capacityUnits)).toBe(2);
	});

	it('takes a position out of service and back without touching its address', async () => {
		const fixture = binFixture({ bins: [binRow('bin-1')] });

		await fixture.service.setBlocked('bin-1', true);

		expect(fixture.store('bin-1')).toMatchObject({ isBlocked: true, code: 'BIN-1', version: 2 });

		await fixture.service.setBlocked('bin-1', false);

		expect(fixture.store('bin-1')).toMatchObject({ isBlocked: false, version: 3 });
	});

	it('reports a position of another organization as missing', async () => {
		const fixture = binFixture({ bins: [binRow('theirs', { organizationId: OTHER_ORG })] });

		await expect(fixture.service.findOneScoped('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneDetailed('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneScoped('nope')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('WarehouseBinService — re-parenting a subtree (doc 09 §14.2 rule 2, INV-25)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('moves the subtree under the new parent and drops the old chain', async () => {
		// The closure describes where the subtree is *now*: a descendant query under the old root that
		// still returned the moved rack would report stock under a rack it left.
		const moved = chain(['left', 'leaf']);
		const target = chain(['right']);
		const fixture = binFixture({
			bins: [...moved.bins, ...target.bins],
			closure: [...moved.closure, ...target.closure]
		});

		await fixture.service.reparent('left', 'right');

		expect(fixture.store('left')).toMatchObject({ parentId: 'right', version: 2 });
		expect(new Set(fixture.ancestorsOf('left'))).toEqual(new Set(['left', 'right']));
		expect(new Set(fixture.descendantsOf('right'))).toEqual(new Set(['right', 'left', 'leaf']));
		// The chain above the moved rack is gone, and no pair is stored twice: a node with two parents'
		// worth of ancestors is a node two descendant queries disagree about.
		expect(fixture.pairs()).toHaveLength(new Set(fixture.pairs()).size);
		// `left->leaf` is a pair *inside* the subtree: the shelf is still a descendant of the rack it
		// moved with, so the re-parent rewrites the placement and leaves the interior alone. Every other
		// pair is the moved subtree's new ancestry — the old one (`left` under nothing) is gone.
		expect(new Set(fixture.pairs())).toEqual(
			new Set(['right->right', 'left->left', 'leaf->leaf', 'left->leaf', 'right->left', 'right->leaf'])
		);
	});

	// The defect: `relinkClosure` removes every closure row that described the subtree, then writes back
	// only the self-pairs of its members and the pairs that tie them to the new parent's ancestry. The
	// ancestry *inside* the subtree — the pairs that made a shelf a descendant of its own rack — is
	// removed and never rewritten, so after a single re-parent `descendantIds` answers a rack alone and
	// the shelf below it has become invisible to every subtree query.
	// (`warehouse-bin.service.ts`, the `pairs` initialiser in `relinkClosure`, line 814: the subtree's
	// own internal pairs are the ones missing.)
	it('[DEFECT] keeps the ancestry inside the subtree it moved', async () => {
		const moved = chain(['left', 'leaf']);
		const target = chain(['right']);
		const fixture = binFixture({
			bins: [...moved.bins, ...target.bins],
			closure: [...moved.closure, ...target.closure]
		});

		await fixture.service.reparent('left', 'right');

		expect(new Set(fixture.ancestorsOf('leaf'))).toEqual(new Set(['leaf', 'left', 'right']));
		expect(new Set(fixture.descendantsOf('left'))).toEqual(new Set(['left', 'leaf']));
	});

	it('makes a position a root when it is moved to no parent', async () => {
		const { bins, closure } = chain(['root', 'child', 'leaf']);
		const fixture = binFixture({ bins, closure });

		await fixture.service.reparent('child', null);

		expect(fixture.store('child')).toMatchObject({ parentId: null, version: 2 });
		// Nothing above the lifted position reaches it any more.
		expect(fixture.descendantsOf('root')).toEqual(['root']);
		expect(new Set(fixture.ancestorsOf('child'))).toEqual(new Set(['child']));
	});

	// The same defect reached from the other direction: lifting a subtree to a root is a re-parent, so
	// it loses the pairs that made the leaf a descendant of the position that was lifted.
	it('[DEFECT] keeps the ancestry inside the subtree it lifted to a root', async () => {
		const { bins, closure } = chain(['root', 'child', 'leaf']);
		const fixture = binFixture({ bins, closure });

		await fixture.service.reparent('child', null);

		expect(new Set(fixture.descendantsOf('child'))).toEqual(new Set(['child', 'leaf']));
		expect(new Set(fixture.ancestorsOf('leaf'))).toEqual(new Set(['leaf', 'child']));
	});

	it('is idempotent: re-parenting the same subtree twice leaves the same closure', async () => {
		const moved = chain(['left', 'leaf']);
		const target = chain(['right']);
		const fixture = binFixture({
			bins: [...moved.bins, ...target.bins],
			closure: [...moved.closure, ...target.closure]
		});

		await fixture.service.reparent('left', 'right');
		const once = [...fixture.pairs()].sort();

		await fixture.service.reparent('left', 'right');

		expect([...fixture.pairs()].sort()).toEqual(once);
	});

	it('refuses to make a position its own parent', async () => {
		const fixture = binFixture({ bins: [binRow('bin-1')] });

		await expect(fixture.service.reparent('bin-1', 'bin-1')).rejects.toThrow(/BIN_HIERARCHY_CYCLE/);
		expect(fixture.store('bin-1')).toMatchObject({ version: 1 });
	});

	it('refuses a target of another area', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1'), binRow('other-zone', { zoneId: 'zone-2' })],
			zones: [zoneRow('zone-1'), zoneRow('zone-2')]
		});

		await expect(fixture.service.reparent('bin-1', 'other-zone')).rejects.toThrow(/own zone/);
		expect(fixture.store('bin-1')).toMatchObject({ version: 1 });
	});

	it('refuses a target inside the position’s own subtree and rewrites nothing', async () => {
		// The move would make the ancestor chain a cycle, and every later descendant query would walk
		// it forever.
		const { bins, closure } = chain(['root', 'child', 'leaf']);
		const fixture = binFixture({ bins, closure });
		const before = [...fixture.pairs()].sort();

		await expect(fixture.service.reparent('root', 'leaf')).rejects.toThrow(/BIN_HIERARCHY_CYCLE/);
		await expect(fixture.service.reparent('child', 'leaf')).rejects.toThrow(/BIN_HIERARCHY_CYCLE/);
		expect(fixture.store('root')).toMatchObject({ version: 1 });
		expect(fixture.store('child')).toMatchObject({ version: 1 });
		expect([...fixture.pairs()].sort()).toEqual(before);
	});

	it('accepts a move that lands exactly on the documented depth limit', async () => {
		// The limit is five levels, counted from the root at depth zero: a subtree three levels high
		// under a parent at depth one puts its deepest position at depth four, which is the deepest a
		// position may sit at. The move is accepted rather than refused, which is the boundary.
		const deep = chain(['a0', 'a1', 'a2']);
		const branch = chain(['b0', 'b1']);
		const fixture = binFixture({ bins: [...deep.bins, ...branch.bins], closure: [...deep.closure, ...branch.closure] });

		await fixture.service.reparent('a0', 'b1');

		expect(fixture.store('a0')).toMatchObject({ parentId: 'b1', version: 2 });
		expect(new Set(fixture.ancestorsOf('a0'))).toEqual(new Set(['a0', 'b1', 'b0']));
	});

	it('refuses a move that would put a position one level past the limit', async () => {
		// One past the boundary above: a subtree three levels high under a parent already at depth two
		// would reach depth five.
		const deep = chain(['a0', 'a1', 'a2']);
		const branch = chain(['b0', 'b1', 'b2']);
		const fixture = binFixture({ bins: [...deep.bins, ...branch.bins], closure: [...deep.closure, ...branch.closure] });

		await expect(fixture.service.reparent('a0', 'b2')).rejects.toThrow(/BIN_HIERARCHY_TOO_DEEP/);
		expect(fixture.store('a0')).toMatchObject({ parentId: undefined, version: 1 });
	});

	it('refuses to nest a new position past the limit as well', async () => {
		// The same bound holds on the way in: a position created under the deepest allowed parent would
		// sit one level too far down.
		const { bins, closure } = chain(['d0', 'd1', 'd2', 'd3', 'd4']);
		const fixture = binFixture({ bins, closure });

		await expect(
			fixture.service.create({
				warehouseId: WAREHOUSE,
				zoneId: 'zone-1',
				parentId: 'd4',
				code: 'DEEP'
			} as never)
		).rejects.toThrow(/BIN_HIERARCHY_TOO_DEEP/);
		expect(fixture.tables.bin).toHaveLength(5);
	});
});

describe('WarehouseBinService — reading the building (doc 09 §14.2, §14.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const readFixture = () =>
		binFixture({
			bins: [
				binRow('second', { code: 'B', sortOrder: 1, isPickable: true }),
				binRow('first', { code: 'A', sortOrder: 1, isPickable: true }),
				binRow('earlier', { code: 'Z', sortOrder: 0, isPickable: true }),
				binRow('blocked', { code: 'C', sortOrder: 2, isPickable: true, isBlocked: true }),
				binRow('grouping', { code: 'D', sortOrder: 3, isPickable: false }),
				binRow('other-area', { code: 'E', zoneId: 'zone-2', sortOrder: 0, isPickable: true }),
				binRow('elsewhere', {
					code: 'F',
					zoneId: 'zone-9',
					warehouseId: OTHER_WAREHOUSE,
					sortOrder: 0,
					isPickable: true
				})
			],
			zones: [zoneRow('zone-1'), zoneRow('zone-2')]
		});

	it('returns exactly the positions a picker may walk to, in walking order', async () => {
		// Order first, then the code — so a shared order is still a reproducible walk. A blocked
		// position and a grouping position are excluded, because neither holds allocation-visible
		// stock; which *areas* are part of the walk is the zone service's answer, so a position of
		// another area of the same location is still a position of this location.
		const fixture = readFixture();

		expect((await fixture.service.findPickableBins(WAREHOUSE)).map((bin) => bin.id)).toEqual([
			'other-area',
			'earlier',
			'first',
			'second'
		]);
	});

	it('narrows the walk to one area when the caller names one', async () => {
		const fixture = readFixture();

		expect((await fixture.service.findPickableBins(WAREHOUSE, 'zone-2')).map((bin) => bin.id)).toEqual([
			'other-area'
		]);
	});

	it('reads every position of an area, including the ones that may not be picked from', async () => {
		// This is the read a count and a capacity plan use, so it is scoped by area rather than by
		// pickability, and a position of the same area at another location does not appear.
		const fixture = readFixture();

		expect((await fixture.service.findInZone('zone-1')).map((bin) => bin.id)).toEqual([
			'earlier',
			'first',
			'second',
			'blocked',
			'grouping'
		]);
	});

	it('reads a whole area as a forest with each node’s children attached', async () => {
		const { bins, closure } = chain(['rack', 'shelf', 'slot']);
		const fixture = binFixture({ bins: [...bins, binRow('free', { code: 'Z-FREE', sortOrder: 5 })], closure });

		const roots = await fixture.service.findTree(WAREHOUSE);

		expect(roots.map((bin) => bin.id)).toEqual(['rack', 'free']);
		expect(roots[0].children.map((bin: any) => bin.id)).toEqual(['shelf']);
		expect(roots[0].children[0].children.map((bin: any) => bin.id)).toEqual(['slot']);
		expect(roots[1].children).toEqual([]);
	});

	it('reads a subtree from the closure, itself included', async () => {
		const { bins, closure } = chain(['rack', 'shelf', 'slot']);
		const fixture = binFixture({ bins: [...bins, binRow('free')], closure });

		expect(new Set((await fixture.service.findSubtree('rack')).map((bin) => bin.id))).toEqual(
			new Set(['rack', 'shelf', 'slot'])
		);
		// A leaf is a subtree of one, which is what the self-pair buys.
		expect((await fixture.service.findSubtree('slot')).map((bin) => bin.id)).toEqual(['slot']);
	});

	it('refuses to derive the contents of a position when no inventory capability is registered', async () => {
		// A tenant that has not adopted the ledger can still maintain zones and positions; what it
		// cannot do is have a balance derived, and the refusal says so rather than answering zero.
		const fixture = binFixture({ bins: [binRow('bin-1')] });

		await expect(fixture.service.findContents('bin-1')).rejects.toThrow(/WAREHOUSE_STOCK_LEDGER_UNAVAILABLE/);
	});

	it('derives the contents of a position from the ledger, never from a column here', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1'), binRow('bin-2')],
			ledger: {
				balances: [
					{ binId: 'bin-1', variantId: VARIANT, quantity: '7.000000' },
					{ binId: 'bin-1', variantId: OTHER_VARIANT, quantity: '3.000000' },
					{ binId: 'bin-2', variantId: VARIANT, quantity: '99.000000' }
				]
			}
		});

		expect(await fixture.service.findContents('bin-1')).toEqual([
			{ binId: 'bin-1', variantId: VARIANT, quantity: '7.000000' },
			{ binId: 'bin-1', variantId: OTHER_VARIANT, quantity: '3.000000' }
		]);
		// Nothing is stored on the position itself: two writers of one level is how a level drifts.
		expect(fixture.store('bin-1').quantity).toBeUndefined();
	});
});

describe('WarehouseBinService — deleting a position (doc 09 §14.2 rule 4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses to delete a position that still holds positions under it', async () => {
		// The foreign key from a child is the bin itself, so deleting a rack would leave its shelves
		// parented to nothing.
		const { bins, closure } = chain(['rack', 'shelf']);
		const fixture = binFixture({ bins, closure, ledger: { balances: [] } });

		await expect(fixture.service.delete('rack')).rejects.toThrow(/BIN_HAS_CHILDREN: the bin still holds 1/);
		expect(fixture.tables.bin).toHaveLength(2);
	});

	it('refuses to delete a position whose derived balance is not zero', async () => {
		// The check is the point of the method: deleting a position that holds stock would erase where
		// the stock was, and blocking it is the operation the operator actually wants.
		const fixture = binFixture({
			bins: [binRow('bin-1')],
			ledger: { balances: [{ binId: 'bin-1', variantId: VARIANT, quantity: '-0.000001' }] }
		});

		await expect(fixture.service.delete('bin-1')).rejects.toThrow(/BIN_HAS_CONTENT/);
		expect(fixture.tables.bin).toHaveLength(1);
	});

	it('deletes an empty position that holds nothing under it and takes its closure rows with it', async () => {
		const { bins, closure } = chain(['rack', 'shelf']);
		const fixture = binFixture({
			bins,
			closure,
			ledger: { balances: [{ binId: 'shelf', variantId: VARIANT, quantity: '0.000000' }] }
		});

		await expect(fixture.service.delete('shelf')).resolves.toMatchObject({ affected: 1 });

		expect(fixture.tables.bin.map((bin) => bin.id)).toEqual(['rack']);
		expect(fixture.pairs()).toEqual(['rack->rack']);
	});

	it('deletes a position the ledger holds no balance row for at all', async () => {
		// Control for the guard above: with a ledger registered and no rows for the position, the
		// derived contents are empty and the delete proceeds.
		const fixture = binFixture({ bins: [binRow('bin-1')], ledger: { balances: [] } });

		expect(await fixture.service.findContents('bin-1')).toEqual([]);
		await expect(fixture.service.delete('bin-1')).resolves.toMatchObject({ affected: 1 });
	});
});

describe('WarehouseBinService — a capacity is a quantity in a stated unit (doc 09 §14.10, INV-28)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const capacityFixture = (overrides: Record<string, unknown> = {}) =>
		binFixture({ bins: [binRow('bin-1', { type: WarehouseBinType.PALLET, ...overrides })] });

	it('answers a position that declares no capacity with nothing to compare', async () => {
		const fixture = capacityFixture();

		const check = await fixture.service.checkCapacity({ binId: 'bin-1', quantity: '480' });

		expect(check).toMatchObject({ binId: 'bin-1', requestedQuantity: '480.000000', exceeded: false, notices: [] });
		expect(check.capacityUnits).toBeUndefined();
		expect(check.requestedInCapacityUnit).toBeUndefined();
	});

	it('reports a capacity declared without its unit and converts nothing', async () => {
		// Converting into an undeclared unit would be a guess dressed as a measurement, so the operator
		// is asked instead (INV-28).
		const fixture = capacityFixture({ capacityUnits: '1.000000' });

		const check = await fixture.service.checkCapacity({ binId: 'bin-1', quantity: '480', unitId: 'unit-piece' });

		expect(check).toMatchObject({
			capacityUnits: '1.000000',
			requestedQuantity: '480.000000',
			requestedUnitId: 'unit-piece',
			exceeded: false,
			notices: [WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED]
		});
		expect(check.requestedInCapacityUnit).toBeUndefined();
	});

	it('converts a request in another unit through the stated factor and compares the exact result', async () => {
		// The factor is how many of the capacity's unit one of the request's unit is — here a position
		// whose ceiling is one pallet, against a request counted in pairs.
		const fixture = capacityFixture({ capacityUnits: '1', capacityUnitId: 'unit-pallet' });

		const at = await fixture.service.checkCapacity({
			binId: 'bin-1',
			quantity: '2',
			unitId: 'unit-pair',
			conversionFactor: '0.5'
		});

		expect(at.requestedInCapacityUnit).toBe('1.000000');
		expect(at.exceeded).toBe(false);
		expect(at.notices).toEqual([]);

		const past = await fixture.service.checkCapacity({
			binId: 'bin-1',
			quantity: '3',
			unitId: 'unit-pair',
			conversionFactor: '0.5'
		});

		expect(past.requestedInCapacityUnit).toBe('1.500000');
		expect(past.exceeded).toBe(true);
		expect(past.remainingQuantity).toBe('-0.500000');
	});

	it('answers the boundary the way the ceiling reads: exactly on it is not past it, one unit past it is', async () => {
		const fixture = capacityFixture({ capacityUnits: '10', capacityUnitId: 'unit-piece' });

		const at = await fixture.service.checkCapacity({ binId: 'bin-1', quantity: '10' });
		const past = await fixture.service.checkCapacity({ binId: 'bin-1', quantity: '10.000001' });

		expect(at).toMatchObject({ exceeded: false, remainingQuantity: '0.000000', notices: [] });
		expect(past).toMatchObject({
			exceeded: true,
			remainingQuantity: '-0.000001',
			notices: ['WAREHOUSE_BIN_CAPACITY_EXCEEDED']
		});
	});

	it('compares without floating point drift at the scale where it would matter', async () => {
		// `0.1 × 3` is `0.30000000000000004` as a double, so a comparison made on floats answers "past
		// the ceiling" for a request that is exactly on it. The conversion is taken at twice the
		// storage scale and quantised back once, so the answer is the measurement rather than the
		// representation.
		const fixture = capacityFixture({ capacityUnits: '0.3', capacityUnitId: 'unit-litre' });

		const check = await fixture.service.checkCapacity({ binId: 'bin-1', quantity: '0.1', conversionFactor: '3' });

		expect(check).toMatchObject({ requestedInCapacityUnit: '0.300000', exceeded: false, remainingQuantity: '0.000000' });
		expect(0.1 * 3 > 0.3).toBe(true);
	});

	it('rounds a converted quantity half away from zero, in both directions', async () => {
		// The seventh decimal of a converted quantity decides the comparison, and rounding towards zero
		// would let a request that is over the ceiling answer as though it were under it.
		const fixture = capacityFixture({ capacityUnits: '1', capacityUnitId: 'unit-piece' });

		const positive = await fixture.service.checkCapacity({
			binId: 'bin-1',
			quantity: '1',
			conversionFactor: '0.0000005'
		});
		const negative = await fixture.service.checkCapacity({
			binId: 'bin-1',
			quantity: '-1',
			conversionFactor: '0.0000005'
		});

		expect(positive.requestedInCapacityUnit).toBe('0.000001');
		expect(negative.requestedInCapacityUnit).toBe('-0.000001');
	});

	it('normalises the requested quantity at the storage scale before it converts it', async () => {
		// A quantity written with more precision than a column holds compares the way the column will
		// store it, which is what makes the check reproducible against the record.
		const fixture = capacityFixture({ capacityUnits: '1', capacityUnitId: 'unit-piece' });

		const check = await fixture.service.checkCapacity({ binId: 'bin-1', quantity: '2.0000004' });

		expect(check.requestedQuantity).toBe('2.000000');
		expect(check.exceeded).toBe(true);
	});

	it('treats a negative request as below the ceiling and reports the room it leaves', async () => {
		// Boundary: a correction can be stated as a negative quantity, and it is a measurement like any
		// other — the ceiling is not a floor.
		const fixture = capacityFixture({ capacityUnits: '5', capacityUnitId: 'unit-piece' });

		const check = await fixture.service.checkCapacity({ binId: 'bin-1', quantity: '-2' });

		expect(check).toMatchObject({ requestedInCapacityUnit: '-2.000000', remainingQuantity: '7.000000', exceeded: false });
	});

	it('lists the positions whose capacity has no unit, pallet positions first and then by code', async () => {
		// The ambiguity is operational rather than theoretical for a pallet position, so those are the
		// ones the operator is asked about first.
		const fixture = binFixture({
			bins: [
				binRow('shelf-b', { code: 'B-02', capacityUnits: '50.000000' }),
				binRow('pallet-b', { code: 'P-02', type: WarehouseBinType.PALLET, capacityUnits: '1.000000' }),
				binRow('pallet-a', { code: 'P-01', type: WarehouseBinType.PALLET, capacityUnits: '1.000000' }),
				binRow('declared', { code: 'A-01', capacityUnits: '10.000000', capacityUnitId: 'unit-piece' }),
				binRow('unbounded', { code: 'A-02' }),
				binRow('elsewhere', {
					code: 'A-03',
					warehouseId: OTHER_WAREHOUSE,
					capacityUnits: '7.000000'
				})
			]
		});

		const warnings = await fixture.service.capacityWarnings();

		expect(warnings.map((warning) => warning.binId)).toEqual(['pallet-a', 'pallet-b', 'elsewhere', 'shelf-b']);
		expect(warnings[0]).toMatchObject({
			code: 'P-01',
			type: WarehouseBinType.PALLET,
			capacityUnits: '1.000000',
			notice: WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED
		});
	});

	it('narrows the warning list to one location when the caller names one', async () => {
		const fixture = binFixture({
			bins: [
				binRow('mine', { code: 'A-01', capacityUnits: '1.000000' }),
				binRow('elsewhere', { code: 'A-02', warehouseId: OTHER_WAREHOUSE, capacityUnits: '1.000000' })
			]
		});

		expect((await fixture.service.capacityWarnings(WAREHOUSE)).map((warning) => warning.binId)).toEqual(['mine']);
		expect((await fixture.service.capacityWarnings()).map((warning) => warning.binId)).toEqual([
			'mine',
			'elsewhere'
		]);
	});
});

describe('WarehouseBinService — counting a position against the ledger (doc 09 §14.10, INV-23)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a reconciliation when no inventory capability is registered', async () => {
		// The level is the ledger's to decide, so a service that could not reach it has nothing to
		// compare against and says so rather than reporting a clean sheet.
		const fixture = binFixture({ bins: [binRow('bin-1')] });

		await expect(fixture.service.reconcile({ warehouseId: WAREHOUSE })).rejects.toThrow(
			/WAREHOUSE_STOCK_LEDGER_UNAVAILABLE/
		);
	});

	it('reports nothing when what the level rows claim and what the ledger recorded agree', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1')],
			ledger: {
				balances: [{ binId: 'bin-1', variantId: VARIANT, quantity: '10.000000' }],
				claimed: [{ binId: 'bin-1', variantId: VARIANT, quantity: '10.000000' }]
			}
		});

		const report = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(report).toMatchObject({ warehouseId: WAREHOUSE, binIds: ['bin-1'], driftCount: 0, movementIds: [] });
		expect(report.lines).toEqual([]);
		expect(fixture.capability?.movements).toEqual([]);
	});

	it('reports the difference between the two and writes it as a count when the caller asks for a repair', async () => {
		// The repair is a `COUNT` movement written through the inventory capability: this service states
		// what was found and the ledger decides the level, because the ledger is the only authority for
		// quantity.
		const fixture = binFixture({
			bins: [binRow('bin-1')],
			ledger: {
				balances: [{ binId: 'bin-1', variantId: VARIANT, quantity: '7.000000' }],
				claimed: [{ binId: 'bin-1', variantId: VARIANT, quantity: '10.000000' }]
			}
		});

		const report = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(report.driftCount).toBe(1);
		expect(report.lines[0]).toMatchObject({
			binId: 'bin-1',
			variantId: VARIANT,
			expectedQuantity: '10.000000',
			countedQuantity: '7.000000',
			difference: '-3.000000',
			repaired: true
		});
		expect(report.movementIds).toEqual(['movement-1']);
		expect(fixture.capability?.movements[0]).toMatchObject({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			binId: 'bin-1',
			quantity: '-3.000000',
			kind: WarehouseStockMovementKind.COUNT,
			referenceType: 'WAREHOUSE_BIN_RECONCILIATION',
			referenceId: 'bin-1'
		});
	});

	it('reports the difference without writing anything when the caller does not ask for a repair', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1')],
			ledger: {
				balances: [{ binId: 'bin-1', variantId: VARIANT, quantity: '12.000000' }],
				claimed: [{ binId: 'bin-1', variantId: VARIANT, quantity: '10.000000' }]
			}
		});

		const report = await fixture.service.reconcile({ warehouseId: WAREHOUSE });

		expect(report.lines[0]).toMatchObject({ difference: '2.000000', repaired: false });
		expect(report.movementIds).toEqual([]);
		expect(fixture.capability?.movements).toEqual([]);
	});

	it('reports a claimed balance with no movement against a ledger that says the position is empty', async () => {
		// A position whose level rows claim stock and whose ledger recorded none is the drift the step
		// exists for, and it is reported in the direction the correction has to move.
		const fixture = binFixture({
			bins: [binRow('bin-1')],
			ledger: {
				balances: [{ binId: 'bin-1', variantId: VARIANT, quantity: '0.000000' }],
				claimed: [{ binId: 'bin-1', variantId: VARIANT, quantity: '4.000000' }]
			}
		});

		const report = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(report.lines[0]).toMatchObject({ expectedQuantity: '4.000000', countedQuantity: '0.000000', difference: '-4.000000' });
		expect(fixture.capability?.movements[0]).toMatchObject({ quantity: '-4.000000' });
	});

	it('reports one line per position and variant that disagrees, and leaves the agreeing ones out', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1'), binRow('bin-2')],
			ledger: {
				balances: [
					{ binId: 'bin-1', variantId: VARIANT, quantity: '7.000000' },
					{ binId: 'bin-1', variantId: OTHER_VARIANT, quantity: '3.000000' },
					{ binId: 'bin-2', variantId: VARIANT, quantity: '5.000000' }
				],
				claimed: [
					{ binId: 'bin-1', variantId: VARIANT, quantity: '7.000000' },
					{ binId: 'bin-1', variantId: OTHER_VARIANT, quantity: '1.000000' },
					{ binId: 'bin-2', variantId: VARIANT, quantity: '5.000000' }
				]
			}
		});

		const report = await fixture.service.reconcile({ warehouseId: WAREHOUSE, repair: true });

		expect(report.driftCount).toBe(1);
		expect(report.lines.map((line) => `${line.binId}:${line.variantId}`)).toEqual([`bin-1:${OTHER_VARIANT}`]);
		expect(fixture.capability?.movements).toHaveLength(1);
	});

	it('counts exactly the positions of the location, or exactly the ones the caller names', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1'), binRow('bin-2'), binRow('elsewhere', { warehouseId: OTHER_WAREHOUSE })],
			ledger: { balances: [], claimed: [] }
		});

		const whole = await fixture.service.reconcile({ warehouseId: WAREHOUSE });
		const named = await fixture.service.reconcile({ warehouseId: WAREHOUSE, binIds: ['bin-2'] });

		expect(whole.binIds).toEqual(['bin-1', 'bin-2']);
		expect(named.binIds).toEqual(['bin-2']);
	});

	it('asks the ledger only for the positions in scope, so a count cannot read the whole building', async () => {
		const fixture = binFixture({
			bins: [binRow('bin-1'), binRow('bin-2')],
			ledger: { balances: [], claimed: [] }
		});

		await fixture.service.reconcile({ warehouseId: WAREHOUSE, binIds: ['bin-1'] });

		expect(fixture.capability?.asked).toEqual([{ warehouseId: WAREHOUSE, binIds: ['bin-1'] }]);
	});
});

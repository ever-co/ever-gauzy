/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a zone service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the catalogue and inventory packages' service specs do, and **the service under test is
 * the real one**: only the base CRUD class, the request context and the entity base classes are
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
import { RequestContext } from '@gauzy/core';
import { WarehouseZoneType } from '../warehouse.types';
import { WarehouseZoneService } from './warehouse-zone.service';

/**
 * The areas of a stock location, and the two rules the rest of the domain asks them for.
 *
 * A zone is configuration, so most of this suite is validation — the visiting order has to be a
 * sequence with no ties, the temperature window has to be a window, and an area that holds positions
 * is blocked rather than deleted (doc 09 §14.2). The interesting half is the rule resolution the
 * package exists for: which areas may be *picked* from, in walking order, and which may *accept*
 * goods, in preference order. Both are answered here so allocation, the pick path and the capacity
 * plan cannot disagree about which bins are eligible, which is why they are pinned rather than
 * assumed.
 *
 * The suite drives the service through one in-memory stand-in per table. The double states the
 * `where`, the `order` and the `take` the service states, because a double that returned every row
 * regardless would make the location-scoping, the type defaulting and the walking-order cases below
 * vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const OTHER_WAREHOUSE = '00000000-0000-4000-8000-000000000011';

/** The tables this package owns that this suite drives, as plain arrays. */
interface ITables {
	zone: any[];
	bin: any[];
}

/**
 * An in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository reads and writes.
 */
function repository(tables: ITables, tableName: keyof ITables) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const matches = (row: any, where: any = {}): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => {
			if (expected && typeof expected === 'object' && 'type' in (expected as any)) {
				throw new Error(`the in-memory double does not implement the "${(expected as any).type}" operator`);
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

				const direction = order?.[column] === 'DESC' ? -1 : 1;

				return compare(left[column], right[column]) * direction;
			}

			return 0;
		});
	};
	const selected = (found: any[], options: any = {}) => {
		const ordered = sorted(found, options.order);

		return options.take ? ordered.slice(options.skip ?? 0, (options.skip ?? 0) + options.take) : ordered;
	};

	return {
		rows,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => selected(rows().filter((row) => matches(row, options.where)), options),
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
		}
	};
}

/** One `warehouse_zone` row, as the service reads it. */
const zoneRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseId: WAREHOUSE,
	name: `Zone ${id}`,
	code: id.toUpperCase(),
	type: WarehouseZoneType.STORAGE,
	priority: 0,
	isPickable: true,
	isReceivable: true,
	isShippable: false,
	isBlocked: false,
	version: 1,
	...overrides
});

/**
 * Builds the zone service over one in-memory `warehouse_zone` table and one `warehouse_bin` table.
 *
 * @param zones The zones the fixture starts with.
 * @param bins The positions the fixture starts with.
 */
function zoneFixture(zones: any[] = [], bins: any[] = []) {
	const tables: ITables = { zone: [...zones], bin: [...bins] };
	const service = new WarehouseZoneService(
		repository(tables, 'zone') as never,
		{} as never,
		repository(tables, 'bin') as never
	);

	return { service, tables, store: (id: string) => tables.zone.find((row) => row.id === id) };
}

describe('WarehouseZoneService — creating an area and the defaults its type carries (doc 09 §14.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates a zone at the end of the sequence, unblocked and at version one', async () => {
		// The first area of a location claims position zero, because the walking order is the first key
		// of every pick-list sort and a sequence that starts at one would leave a hole nothing fills.
		const fixture = zoneFixture();

		const created = await fixture.service.create({
			warehouseId: WAREHOUSE,
			code: 'A-01',
			name: 'Reserve'
		} as never);

		expect(created).toMatchObject({
			warehouseId: WAREHOUSE,
			code: 'A-01',
			name: 'Reserve',
			type: WarehouseZoneType.STORAGE,
			priority: 0,
			isBlocked: false,
			version: 1,
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(fixture.tables.zone).toHaveLength(1);
	});

	it('appends a new area after the last one of its own type, not after the last one of the location', async () => {
		// Two areas of one type sharing a position is what makes a pick path non-deterministic, so the
		// position is resolved against the type's own sequence. The picking area below is a control: it
		// is unaffected by how many storage areas exist.
		const fixture = zoneFixture([
			zoneRow('storage-1', { type: WarehouseZoneType.STORAGE, priority: 0 }),
			zoneRow('storage-2', { type: WarehouseZoneType.STORAGE, priority: 1 }),
			zoneRow('picking-1', { type: WarehouseZoneType.PICKING, priority: 0 })
		]);

		const storage = await fixture.service.create({
			warehouseId: WAREHOUSE,
			code: 'A-03',
			type: WarehouseZoneType.STORAGE
		} as never);
		const picking = await fixture.service.create({
			warehouseId: WAREHOUSE,
			code: 'P-02',
			type: WarehouseZoneType.PICKING
		} as never);

		expect(storage.priority).toBe(2);
		expect(picking.priority).toBe(1);
	});

	it.each([
		[WarehouseZoneType.RECEIVING, false, true, false],
		[WarehouseZoneType.PICKING, true, false, false],
		[WarehouseZoneType.STORAGE, true, true, false],
		[WarehouseZoneType.SHIPPING, false, false, true],
		[WarehouseZoneType.QUARANTINE, false, false, false],
		[WarehouseZoneType.PACKING, false, false, false]
	])(
		'gives a %s area the pickable/receivable/shippable defaults its type carries',
		async (type, isPickable, isReceivable, isShippable) => {
			const fixture = zoneFixture();

			const created = await fixture.service.create({
				warehouseId: WAREHOUSE,
				code: 'X',
				type
			} as never);

			expect(created).toMatchObject({ isPickable, isReceivable, isShippable });
		}
	);

	it('keeps the flags a caller states, whatever the type would default them to', async () => {
		// The defaults are defaults: a site that picks out of a packing bench says so.
		const fixture = zoneFixture();

		const created = await fixture.service.create({
			warehouseId: WAREHOUSE,
			code: 'X',
			type: WarehouseZoneType.PACKING,
			isPickable: true,
			isReceivable: true,
			isShippable: true,
			isBlocked: true
		} as never);

		expect(created).toMatchObject({ isPickable: true, isReceivable: true, isShippable: true, isBlocked: true });
	});

	it('refuses a zone that names no location and a zone that carries no code', async () => {
		const fixture = zoneFixture();

		await expect(fixture.service.create({ code: 'A-01' } as never)).rejects.toBeInstanceOf(BadRequestException);
		await expect(fixture.service.create({ warehouseId: WAREHOUSE } as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(fixture.tables.zone).toEqual([]);
	});

	it('refuses a code already used by an area of the same location, and writes nothing', async () => {
		const fixture = zoneFixture([zoneRow('taken', { code: 'A-01' })]);

		await expect(
			fixture.service.create({ warehouseId: WAREHOUSE, code: 'A-01', name: 'Another' } as never)
		).rejects.toThrow(/already used by a zone/);
		expect(fixture.tables.zone).toHaveLength(1);
	});

	it('accepts the same code at another location', async () => {
		// Control: a code is unique inside a location, not inside the installation.
		const fixture = zoneFixture([zoneRow('taken', { code: 'A-01' })]);

		const created = await fixture.service.create({
			warehouseId: OTHER_WAREHOUSE,
			code: 'A-01'
		} as never);

		expect(created.warehouseId).toBe(OTHER_WAREHOUSE);
		expect(fixture.tables.zone).toHaveLength(2);
	});

	it('normalises the temperature bounds to the storage scale', async () => {
		const fixture = zoneFixture();

		const created = await fixture.service.create({
			warehouseId: WAREHOUSE,
			code: 'COLD',
			type: WarehouseZoneType.STORAGE,
			minTemperature: '-18.5',
			maxTemperature: '2'
		} as never);

		expect(created.minTemperature).toBe('-18.500000');
		expect(created.maxTemperature).toBe('2.000000');
	});

	it('refuses an inverted temperature window and accepts one whose bounds are equal', async () => {
		// The boundary the check exists for: `min === max` is a window of one degree, and only a lower
		// bound strictly above the upper one is not a window (doc 09 §14.2).
		const fixture = zoneFixture();

		await expect(
			fixture.service.create({
				warehouseId: WAREHOUSE,
				code: 'COLD',
				minTemperature: '8',
				maxTemperature: '2'
			} as never)
		).rejects.toBeInstanceOf(BadRequestException);
		expect(fixture.tables.zone).toEqual([]);

		const equal = await fixture.service.create({
			warehouseId: WAREHOUSE,
			code: 'COLD',
			minTemperature: '2',
			maxTemperature: '2'
		} as never);

		expect(equal).toMatchObject({ minTemperature: '2.000000', maxTemperature: '2.000000' });
	});

	it('leaves both bounds unstated when the caller states neither', async () => {
		// A zone with no declared window carries no window at all — it is not silently given one.
		const fixture = zoneFixture();

		const created = await fixture.service.create({ warehouseId: WAREHOUSE, code: 'A-01' } as never);

		expect(created.minTemperature).toBeUndefined();
		expect(created.maxTemperature).toBeUndefined();
	});
});

describe('WarehouseZoneService — updating an area (doc 09 §14.2 rule 1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses to move an area to another location and leaves it where it was', async () => {
		// Every position of the area would silently change address, and a historical pick names a bin of
		// an area of a location.
		const fixture = zoneFixture([zoneRow('zone-1', { warehouseId: WAREHOUSE })]);

		await expect(
			fixture.service.update('zone-1', { warehouseId: OTHER_WAREHOUSE } as never)
		).rejects.toThrow(/belongs to one location/);
		expect(fixture.store('zone-1')).toMatchObject({ warehouseId: WAREHOUSE, version: 1 });
	});

	it('accepts an update that re-states the area’s own location and bumps the version once', async () => {
		const fixture = zoneFixture([zoneRow('zone-1', { warehouseId: WAREHOUSE })]);

		const updated = await fixture.service.update('zone-1', {
			warehouseId: WAREHOUSE,
			name: 'Renamed'
		} as never);

		expect(updated).toMatchObject({ warehouseId: WAREHOUSE, name: 'Renamed', version: 2 });
	});

	it('refuses an update that would invert the window against the bound already stored', async () => {
		// The check reads the window as it would stand, not the fields the caller happened to send: a
		// caller that states only a new lower bound is still stating a window.
		const fixture = zoneFixture([zoneRow('zone-1', { minTemperature: '2.000000', maxTemperature: '8.000000' })]);

		await expect(fixture.service.update('zone-1', { minTemperature: '9' } as never)).rejects.toThrow(
			/not a window/
		);
		expect(fixture.store('zone-1')).toMatchObject({ minTemperature: '2.000000', version: 1 });
	});

	it('reports an area of another tenant or organization as missing', async () => {
		// A different answer for "not yours" and "does not exist" leaks the existence of another
		// tenant's rows, so both are the same miss.
		const fixture = zoneFixture([zoneRow('theirs', { organizationId: OTHER_ORG })]);

		await expect(fixture.service.findOneScoped('theirs')).rejects.toBeInstanceOf(NotFoundException);

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);

		expect((await fixture.service.findOneScoped('theirs')).id).toBe('theirs');
	});

	it('reports an area that is not there as missing', async () => {
		const fixture = zoneFixture();

		await expect(fixture.service.findOneScoped('nope')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneDetailed('nope')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('WarehouseZoneService — the pick path and the put-away path (doc 09 §14.2, §14.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const pathFixture = () =>
		zoneFixture([
			zoneRow('bulk', {
				code: 'B-01',
				type: WarehouseZoneType.STORAGE,
				priority: 2,
				isPickable: true,
				isReceivable: true
			}),
			zoneRow('pick', {
				code: 'P-01',
				type: WarehouseZoneType.PICKING,
				priority: 0,
				isPickable: true,
				isReceivable: false
			}),
			zoneRow('pack', {
				code: 'K-01',
				type: WarehouseZoneType.PACKING,
				priority: 1,
				isPickable: false,
				isReceivable: false
			}),
			zoneRow('blocked', {
				code: 'P-02',
				type: WarehouseZoneType.PICKING,
				priority: 1,
				isPickable: true,
				isBlocked: true
			}),
			zoneRow('elsewhere', {
				warehouseId: OTHER_WAREHOUSE,
				code: 'P-00',
				type: WarehouseZoneType.PICKING,
				priority: 0
			})
		]);

	it('returns exactly the pickable, unblocked areas of the location, in walking order', async () => {
		// What comes back is the set allocation may choose a bin from: a pass-through area is excluded
		// because it holds no allocation-visible stock, a blocked area is excluded because it is out of
		// service, and another location's area is not this location's path at all.
		const fixture = pathFixture();

		const path = await fixture.service.findPickPath(WAREHOUSE);

		expect(path.map((zone) => zone.id)).toEqual(['pick', 'bulk']);
	});

	it('breaks a shared position by code, so the walk is reproducible', async () => {
		// A shared position is refused by `reorder`, but a location configured through repeated creates
		// can still hold one; the tie-break is what keeps the path total.
		const fixture = zoneFixture([
			zoneRow('second', { code: 'B', priority: 1, isPickable: true }),
			zoneRow('first', { code: 'A', priority: 1, isPickable: true })
		]);

		expect((await fixture.service.findPickPath(WAREHOUSE)).map((zone) => zone.id)).toEqual(['first', 'second']);
	});

	it('returns the receivable, unblocked areas in preference order for put-away', async () => {
		const fixture = pathFixture();

		const path = await fixture.service.findPutAwayPath(WAREHOUSE);

		expect(path.map((zone) => zone.id)).toEqual(['bulk']);
	});

	it('narrows the put-away path to the kinds of goods being put away, and widens it to every receivable area when none is stated', async () => {
		// A receiving area and a reserve area are both legitimate answers to different questions, which
		// is why the caller states the kinds it will accept.
		const fixture = zoneFixture([
			zoneRow('receiving', { type: WarehouseZoneType.RECEIVING, priority: 0, isReceivable: true }),
			zoneRow('reserve', { type: WarehouseZoneType.STORAGE, priority: 1, isReceivable: true }),
			zoneRow('returns', { type: WarehouseZoneType.RETURNS, priority: 2, isReceivable: true }),
			zoneRow('quarantine', { type: WarehouseZoneType.QUARANTINE, priority: 3, isReceivable: false })
		]);

		expect((await fixture.service.findPutAwayPath(WAREHOUSE, [WarehouseZoneType.STORAGE])).map((z) => z.id)).toEqual(
			['reserve']
		);
		expect(
			(await fixture.service.findPutAwayPath(WAREHOUSE, [WarehouseZoneType.RECEIVING, WarehouseZoneType.RETURNS])).map(
				(z) => z.id
			)
		).toEqual(['receiving', 'returns']);
		expect((await fixture.service.findPutAwayPath(WAREHOUSE)).map((z) => z.id)).toEqual([
			'receiving',
			'reserve',
			'returns'
		]);
	});

	it('reports a location that has no pickable area at all, and accepts one that has', async () => {
		// Without a pickable area every generated list would carry unbinned lines, which is a
		// configuration fault worth naming at the moment it is configured.
		const empty = zoneFixture([zoneRow('pack', { type: WarehouseZoneType.PACKING, isPickable: false })]);

		await expect(empty.service.assertHasPickingZone(WAREHOUSE)).rejects.toThrow(/WAREHOUSE_NO_PICKING_ZONE/);

		const blocked = zoneFixture([zoneRow('pick', { type: WarehouseZoneType.PICKING, isBlocked: true })]);

		await expect(blocked.service.assertHasPickingZone(WAREHOUSE)).rejects.toThrow(/WAREHOUSE_NO_PICKING_ZONE/);

		const usable = pathFixture();

		await expect(usable.service.assertHasPickingZone(WAREHOUSE)).resolves.toBeUndefined();
	});

	it('answers an unknown location with an empty path rather than an error', async () => {
		// Nothing is configured is not a fault of the read; the caller that needs the area asserts it.
		const fixture = pathFixture();

		expect(await fixture.service.findPickPath('no-such-location')).toEqual([]);
		expect(await fixture.service.findPutAwayPath('no-such-location')).toEqual([]);
	});
});

describe('WarehouseZoneService — taking an area out of service (doc 09 §14.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('removes an area from the pick path without touching the positions inside it', async () => {
		// The units stay where they physically are; what changes is that the allocator no longer offers
		// the bins. That is the whole point — a stocktake has to be able to say "these units are here
		// and nobody may touch them".
		const fixture = zoneFixture(
			[zoneRow('zone-1', { code: 'A-01', isPickable: true })],
			[{ id: 'bin-1', zoneId: 'zone-1', tenantId: TENANT, organizationId: ORG, isPickable: true }]
		);

		await fixture.service.setBlocked('zone-1', true);

		expect(fixture.store('zone-1')).toMatchObject({ isBlocked: true, version: 2 });
		expect(await fixture.service.findPickPath(WAREHOUSE)).toEqual([]);
		// The positions are untouched, and they are still the rows a count reads.
		expect(fixture.tables.bin).toHaveLength(1);
		expect(fixture.tables.bin[0]).toMatchObject({ id: 'bin-1', isPickable: true });

		await fixture.service.setBlocked('zone-1', false);

		expect((await fixture.service.findPickPath(WAREHOUSE)).map((zone) => zone.id)).toEqual(['zone-1']);
		expect(fixture.store('zone-1')).toMatchObject({ isBlocked: false, version: 3 });
	});
});

describe('WarehouseZoneService — rewriting the walking order (doc 09 §14.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	const orderFixture = () =>
		zoneFixture([
			zoneRow('a', { code: 'A', priority: 0, isPickable: true }),
			zoneRow('b', { code: 'B', priority: 1, isPickable: true }),
			zoneRow('c', { code: 'C', priority: 2, isPickable: true })
		]);

	it('rewrites the whole sequence and answers the new walking order', async () => {
		const fixture = orderFixture();

		const reordered = await fixture.service.reorder(WAREHOUSE, [
			{ id: 'c', priority: 0 },
			{ id: 'a', priority: 1 },
			{ id: 'b', priority: 2 }
		]);

		expect(reordered.map((zone) => zone.id)).toEqual(['c', 'a', 'b']);
		expect(fixture.tables.zone.map((zone) => zone.priority)).toEqual([1, 2, 0]);
		// Every rewritten area takes exactly one version bump.
		expect(fixture.store('c')).toMatchObject({ version: 2 });
		expect(fixture.store('a')).toMatchObject({ version: 2 });
	});

	it('refuses two areas sharing a position and rewrites nothing at all', async () => {
		// A partial reorder is what leaves two areas claiming the same position and a pick path that
		// depends on the order the database happens to return rows in, so the whole sequence is
		// validated before any of it is written.
		const fixture = orderFixture();

		await expect(
			fixture.service.reorder(WAREHOUSE, [
				{ id: 'a', priority: 0 },
				{ id: 'b', priority: 0 }
			])
		).rejects.toThrow(/cannot share position 0/);
		expect(fixture.tables.zone.map((zone) => zone.priority)).toEqual([0, 1, 2]);
		expect(fixture.tables.zone.map((zone) => zone.version)).toEqual([1, 1, 1]);
	});

	it('refuses a reorder that states no position', async () => {
		const fixture = orderFixture();

		await expect(fixture.service.reorder(WAREHOUSE, [])).rejects.toThrow(/at least one zone/);
	});

	it('accepts a reorder of a single area', async () => {
		// Boundary: the shortest legal sequence.
		const fixture = orderFixture();

		await fixture.service.reorder(WAREHOUSE, [{ id: 'b', priority: 7 }]);

		expect(fixture.store('b')).toMatchObject({ priority: 7, version: 2 });
	});

	it('refuses a reorder that names an area of another location', async () => {
		const fixture = zoneFixture([
			zoneRow('mine', { priority: 0 }),
			zoneRow('theirs', { warehouseId: OTHER_WAREHOUSE, priority: 0 })
		]);

		await expect(fixture.service.reorder(WAREHOUSE, [{ id: 'theirs', priority: 1 }])).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(fixture.store('theirs')).toMatchObject({ priority: 0, version: 1 });
	});

	// The defect: `reorder` validates every position, then walks the areas writing each one, and only
	// discovers that an area is not there when it reaches it. A sequence that is refused half way
	// through is exactly the state the method says it exists to prevent — some areas at their new
	// positions, the rest at their old ones, and two of them claiming the same number.
	// (`warehouse-zone.service.ts`, the `await this.typeOrmWarehouseZoneRepository.update(...)` inside
	// the `for (const zone of zones)` loop of `reorder`, line 170.)
	it.failing('[DEFECT] leaves every position as it was when a reorder is refused', async () => {
		const fixture = orderFixture();

		await expect(
			fixture.service.reorder(WAREHOUSE, [
				{ id: 'a', priority: 5 },
				{ id: 'not-here', priority: 6 }
			])
		).rejects.toBeInstanceOf(NotFoundException);

		expect(fixture.tables.zone.map((zone) => zone.priority)).toEqual([0, 1, 2]);
		expect(fixture.tables.zone.map((zone) => zone.version)).toEqual([1, 1, 1]);
	});
});

describe('WarehouseZoneService — deleting an area (doc 09 §14.2 rule 4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('deletes an area that holds no position', async () => {
		const fixture = zoneFixture([zoneRow('empty')]);

		await expect(fixture.service.delete('empty')).resolves.toMatchObject({ affected: 1 });
		expect(fixture.tables.zone).toEqual([]);
	});

	it('refuses an area that still holds positions, naming how many', async () => {
		// Deleting it would take the addresses of the stock inside it with it, and the operator's
		// problem is the stock, not the row.
		const fixture = zoneFixture(
			[zoneRow('zone-1')],
			[
				{ id: 'bin-1', zoneId: 'zone-1', tenantId: TENANT, organizationId: ORG },
				{ id: 'bin-2', zoneId: 'zone-1', tenantId: TENANT, organizationId: ORG },
				{ id: 'bin-3', zoneId: 'zone-1', tenantId: TENANT, organizationId: OTHER_ORG }
			]
		);

		await expect(fixture.service.delete('zone-1')).rejects.toThrow(/ZONE_HAS_BINS: the zone still holds 2/);
		expect(fixture.tables.zone).toHaveLength(1);
	});

	it('deletes an area whose positions all belong to another organization', async () => {
		// Control for the count above: the positions are counted inside the caller's own scope, so a
		// row of another organization is not this caller's obstacle.
		const fixture = zoneFixture(
			[zoneRow('zone-1')],
			[{ id: 'bin-1', zoneId: 'zone-1', tenantId: TENANT, organizationId: OTHER_ORG }]
		);

		await expect(fixture.service.delete('zone-1')).resolves.toMatchObject({ affected: 1 });
	});
});

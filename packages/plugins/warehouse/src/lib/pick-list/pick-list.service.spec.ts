/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a pick list service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * as the catalogue and inventory packages' service specs do, and **the services under test are the
 * real ones**: only the base CRUD class, the request context and the entity base classes are
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
		// The ORM the services branch on. These suites drive the TypeORM path, which is what the doubles model;
		// both ORMs are driven against real SQLite in `warehouse-delete.dual-orm.spec.ts`.
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
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
import { PickListLineService } from '../pick-list-line/pick-list-line.service';
import { PickWaveService } from '../pick-wave/pick-wave.service';
import {
	IWarehouseFulfillmentPort,
	IWarehouseStockLedgerPort,
	PICK_NUMBER_KEY,
	PickListLineStatus,
	PickListStatus,
	PickWaveStatus,
	WarehouseBinType
} from '../warehouse.types';
import { PickListService } from './pick-list.service';

/**
 * The work, per picker: the lists, their derivation from shipments, and their lifecycle.
 *
 * A list is not authored, it is derived, and the derivation is what gives the domain the property it
 * exists for: the quantities a list asks for are exactly what the shipments still need, never more
 * and never less (doc 09 §14.5, INV-21). Everything `PickListService` does with those rows is a
 * state machine — `PENDING → ASSIGNED → IN_PROGRESS → PICKED`, plus `→ CANCELED` while nothing has
 * been picked — and the two refusals the suite pins are the ones that protect the record: a list
 * with a recorded outcome is never withdrawn (`PICK_LIST_HAS_PICKS`), and a line with no outcome is
 * never closed (`PICK_LINE_PENDING`).
 *
 * The service is constructed with its real collaborators — the line service and the wave service —
 * over in-memory tables, so the derivation writes through the same path production uses and the
 * caches the wave keeps are recomputed by the wave's own code. Only the walk (the zones and the
 * pickable positions), the shipment capability and the inventory capability are hand-written
 * doubles, because those are the package's own boundaries.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const PICKER = '00000000-0000-4000-8000-000000000050';
const ORDER = '00000000-0000-4000-8000-000000000060';
const SHIPMENT = '00000000-0000-4000-8000-000000000070';
const VARIANT_A = '00000000-0000-4000-8000-000000000030';
const VARIANT_B = '00000000-0000-4000-8000-000000000031';

/** The tables this package owns that this suite drives, as plain arrays. */
interface ITables {
	pickList: any[];
	pickListLine: any[];
	pickWave: any[];
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
		}
	};
}

/** The platform numbering series, as a hand-written double. */
function numbering(prefixes: string[] = [PICK_NUMBER_KEY]) {
	const allocated: string[] = [];
	let sequence = 0;

	return {
		allocated,
		service: {
			async allocate(key: string) {
				if (!prefixes.includes(key)) {
					throw new Error(`no series is configured for "${key}"`);
				}

				allocated.push(key);

				return { formatted: `${key}-${String(++sequence).padStart(6, '0')}` };
			}
		}
	};
}

/** One `pick_list` row, as the service reads it. */
const listRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseId: WAREHOUSE,
	number: `PICK-${id}`,
	status: PickListStatus.PENDING,
	priority: 0,
	lineCount: 0,
	pickedCount: 0,
	shortCount: 0,
	version: 1,
	...overrides
});

/** One `pick_list_line` row, as the service reads it. */
const lineRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	pickListId: 'list-1',
	variantId: VARIANT_A,
	binId: 'bin-1',
	quantityRequested: '1.000000',
	quantityPicked: '0.000000',
	quantityShort: '0.000000',
	status: PickListLineStatus.PENDING,
	position: 0,
	...overrides
});

/** One `pick_wave` row. */
const waveRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseId: WAREHOUSE,
	number: `PICK-${id}`,
	status: PickWaveStatus.DRAFT,
	priority: 0,
	orderCount: 0,
	lineCount: 0,
	version: 1,
	...overrides
});

/** The walk the location is configured with: two areas, one position each. */
const WALK = [
	{ id: 'bin-1', zoneId: 'zone-pick', warehouseId: WAREHOUSE, code: 'P-01', type: WarehouseBinType.SHELF },
	{ id: 'bin-2', zoneId: 'zone-bulk', warehouseId: WAREHOUSE, code: 'B-01', type: WarehouseBinType.SHELF }
];

/** One shipment line, as the shipment capability reports it. */
const shippable = (overrides: Record<string, unknown> = {}) => ({
	fulfillmentLineId: 'fl-1',
	fulfillmentId: SHIPMENT,
	orderLineId: 'ol-1',
	variantId: VARIANT_A,
	quantity: '3.000000',
	warehouseId: WAREHOUSE,
	...overrides
});

/**
 * Builds the list service with its real collaborators over in-memory tables.
 *
 * @param options.lists The lists the fixture starts with.
 * @param options.lines The lines the fixture starts with.
 * @param options.waves The waves the fixture starts with.
 * @param options.shippable The lines the shipment capability reports.
 * @param options.homeBins Where the inventory capability says each variant is normally kept.
 * @param options.series The numbering series the organization has configured.
 * @param options.withFulfillment Whether the shipment capability is registered at all.
 * @param options.walk The pickable positions of the location, in walking order.
 */
function pickListFixture(
	options: {
		lists?: any[];
		lines?: any[];
		waves?: any[];
		shippable?: any[];
		homeBins?: Record<string, string>;
		series?: string[];
		withFulfillment?: boolean;
		walk?: any[];
	} = {}
) {
	const tables: ITables = {
		pickList: [...(options.lists ?? [])],
		pickListLine: [...(options.lines ?? [])],
		pickWave: [...(options.waves ?? [])]
	};
	const walk = options.walk ?? WALK;
	const series = numbering(options.series);
	const movements: any[] = [];
	const shipped: any[] = [];

	const listRepository = repository(tables, 'pickList');
	const lineRepository = repository(tables, 'pickListLine');
	const waveRepository = repository(tables, 'pickWave');
	const stockLedger: IWarehouseStockLedgerPort = {
		readBinBalance: async () => undefined,
		readBinBalances: async () => [],
		readExpectedBinBalances: async () => [],
		resolveHomeBin: async (query) => {
			const binId = options.homeBins?.[String(query.variantId)];

			return binId ? { binId, quantity: '0.000000' } : undefined;
		},
		recordMovement: async (request) => {
			movements.push(request);

			return { movementId: `movement-${movements.length}`, quantityAfter: '0.000000' };
		},
		relocate: async () => [],
		// The two operations this domain does not perform. A home-bin declaration and a put-away belong to
		// the bin surface, and a pick neither declares where stock lives nor walks it in; they are stated
		// here because the port declares them, and as refusals a test would see rather than as silent no-ops.
		setHomeBin: async () => {
			throw new Error('a pick does not declare home bins');
		},
		putAway: async () => {
			throw new Error('a pick does not put stock away');
		}
	};
	const lineService = new PickListLineService(
		lineRepository as never,
		{} as never,
		listRepository as never,
		stockLedger
	);
	const waveService = new PickWaveService(
		waveRepository as never,
		{} as never,
		listRepository as never,
		lineRepository as never,
		series.service as never
	);
	const zoneService = {
		findPickPath: async (warehouseId: string) =>
			warehouseId === WAREHOUSE ? [{ id: 'zone-pick' }, { id: 'zone-bulk' }] : []
	};
	const binService = {
		findPickableBins: async (warehouseId: string, zoneId: string) =>
			warehouseId === WAREHOUSE ? walk.filter((bin) => bin.zoneId === zoneId) : []
	};
	const fulfillment: IWarehouseFulfillmentPort = {
		listShippableLines: async (query) =>
			(options.shippable ?? []).filter(
				(line) =>
					!query.fulfillmentIds?.length || query.fulfillmentIds.map(String).includes(String(line.fulfillmentId))
			),
		listShipped: async () => shipped,
		claimForManifest: async () => 0,
		releaseFromManifest: async () => 0
	};
	const service = new PickListService(
		listRepository as never,
		{} as never,
		lineService,
		waveService,
		binService as never,
		zoneService as never,
		series.service as never,
		waveRepository as never,
		(options.withFulfillment ?? true) ? fulfillment : undefined,
		stockLedger
	);

	return {
		service,
		tables,
		series,
		movements,
		lineService,
		waveService,
		store: (id: string) => tables.pickList.find((row) => row.id === id),
		linesOf: (pickListId: string) => tables.pickListLine.filter((row) => row.pickListId === pickListId),
		wave: (id: string) => tables.pickWave.find((row) => row.id === id)
	};
}

describe('PickListService — deriving a list from the shipments it serves (doc 09 §14.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(PICKER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('asks for exactly what the shipments still need and takes the quantity the shipment reports', async () => {
		// The derivation reads the shipment side, never the cart: by the time work is released the cart is
		// gone, and what a list may ask for is what the shipment still needs (INV-21).
		const fixture = pickListFixture({
			shippable: [
				shippable({ fulfillmentLineId: 'fl-1', variantId: VARIANT_A, quantity: '3' }),
				shippable({ fulfillmentLineId: 'fl-2', variantId: VARIANT_B, quantity: '2.5', orderLineId: 'ol-2' })
			]
		});

		const list = await fixture.service.create({
			warehouseId: WAREHOUSE,
			fulfillmentIds: [SHIPMENT]
		} as never);

		const lines = fixture.linesOf(list.id);

		expect(lines).toHaveLength(2);
		expect(lines.map((line) => [line.variantId, line.quantityRequested])).toEqual([
			[VARIANT_A, '3.000000'],
			[VARIANT_B, '2.500000']
		]);
		expect(lines.every((line) => line.status === PickListLineStatus.PENDING)).toBe(true);
		expect(lines.every((line) => line.quantityPicked === '0.000000')).toBe(true);
	});

	it('allocates the position the level row calls home, and the first position of the walk when it calls none', async () => {
		// The comparator is total and stable, so the same state always allocates the same position — which
		// is what makes a printed document and a device agree about the walk.
		const fixture = pickListFixture({
			shippable: [
				shippable({ fulfillmentLineId: 'fl-1', variantId: VARIANT_A }),
				shippable({ fulfillmentLineId: 'fl-2', variantId: VARIANT_B, orderLineId: 'ol-2' })
			],
			homeBins: { [VARIANT_A]: 'bin-2' }
		});

		const list = await fixture.service.create({ warehouseId: WAREHOUSE, fulfillmentIds: [SHIPMENT] } as never);
		const byVariant = new Map(fixture.linesOf(list.id).map((line) => [line.variantId, line]));

		expect(byVariant.get(VARIANT_A)).toMatchObject({
			binId: 'bin-2',
			zoneId: 'zone-bulk',
			position: 1,
			fulfillmentLineId: 'fl-1',
			orderLineId: 'ol-1'
		});
		expect(byVariant.get(VARIANT_B)).toMatchObject({ binId: 'bin-1', zoneId: 'zone-pick', position: 0 });
	});

	it('leaves out the lines that have nothing left to collect', async () => {
		// A shipment line that was already picked down to zero is not work, and it is not an error either.
		const fixture = pickListFixture({
			shippable: [
				shippable({ fulfillmentLineId: 'fl-1', quantity: '3' }),
				shippable({ fulfillmentLineId: 'fl-2', quantity: '0', orderLineId: 'ol-2' }),
				shippable({ fulfillmentLineId: 'fl-3', quantity: '-1', orderLineId: 'ol-3' })
			]
		});

		const list = await fixture.service.create({ warehouseId: WAREHOUSE, fulfillmentIds: [SHIPMENT] } as never);

		expect(fixture.linesOf(list.id).map((line) => line.fulfillmentLineId)).toEqual(['fl-1']);
	});

	it('refuses to create an empty list when nothing at all is left to collect', async () => {
		const fixture = pickListFixture({ shippable: [shippable({ quantity: '0' })] });

		await expect(
			fixture.service.create({ warehouseId: WAREHOUSE, fulfillmentIds: [SHIPMENT] } as never)
		).rejects.toThrow(/PICK_NOTHING_TO_PICK/);
		expect(fixture.tables.pickListLine).toEqual([]);
	});

	it('refuses to derive lines when the shipment capability is not registered', async () => {
		const fixture = pickListFixture({ withFulfillment: false, shippable: [shippable()] });

		await expect(
			fixture.service.create({ warehouseId: WAREHOUSE, fulfillmentIds: [SHIPMENT] } as never)
		).rejects.toThrow(/WAREHOUSE_FULFILLMENT_UNAVAILABLE/);
	});

	// The defect: `create` writes the list row, then derives its lines, and the derivation is what
	// refuses — so a refused creation leaves a numbered, empty, line-less list behind. The
	// specification states the opposite for the same operation: the wave, its lists and their lines are
	// created in one transaction (doc 09 §14.4), and a list that covers nothing can never be completed
	// or packed, so what is left behind is a row an operator has to clean up by hand.
	// (`pick-list.service.ts`, the `await this.deriveLines(list, fulfillmentIds)` call on line 89, after
	// the `super.create(...)` on line 79.)
	it('[DEFECT] writes nothing when the derivation of the lines refuses', async () => {
		const fixture = pickListFixture({ withFulfillment: false, shippable: [shippable()] });

		await expect(
			fixture.service.create({ warehouseId: WAREHOUSE, fulfillmentIds: [SHIPMENT] } as never)
		).rejects.toThrow(/WAREHOUSE_FULFILLMENT_UNAVAILABLE/);

		expect(fixture.tables.pickList).toEqual([]);
	});

	it('refuses a list that names no location and a list whose wave does not exist', async () => {
		const fixture = pickListFixture();

		await expect(fixture.service.create({} as never)).rejects.toThrow(/must name the location/);
		await expect(fixture.service.create({ warehouseId: WAREHOUSE, waveId: 'ghost' } as never)).rejects.toThrow(
			/does not exist/
		);
	});

	it('refuses to add a list to a wave that is no longer a draft, and leaves the wave as it was', async () => {
		// A released wave is frozen and handed to the floor: its lists exist and the positions they name
		// are pinned.
		for (const status of [
			PickWaveStatus.RELEASED,
			PickWaveStatus.IN_PROGRESS,
			PickWaveStatus.PICKED,
			PickWaveStatus.CLOSED,
			PickWaveStatus.CANCELED
		]) {
			const fixture = pickListFixture({ waves: [waveRow('wave-1', { status })] });

			await expect(
				fixture.service.create({ warehouseId: WAREHOUSE, waveId: 'wave-1' } as never)
			).rejects.toThrow(/frozen and cannot take another pick list/);
			expect(fixture.wave('wave-1')).toMatchObject({ status, version: 1 });
		}
	});

	it('leaves a list that covers nothing in its unassigned state', async () => {
		// The control for the case below: a list created without shipments has no line written into it, so
		// nothing touches its status and it is `PENDING` — which is the state `assign` accepts.
		const fixture = pickListFixture();

		const list = await fixture.service.create({ warehouseId: WAREHOUSE } as never);

		expect(list).toMatchObject({ status: PickListStatus.PENDING, lineCount: 0 });
	});

	// The defect: the derivation writes its rows through the line service, and the line service promotes
	// the list to `IN_PROGRESS` whenever it recomputes the counters — which it does on every line it
	// adds. A list derived from shipments is therefore never `PENDING`: it is `IN_PROGRESS` before a
	// picker has been near it. The machine says the opposite, twice over — `[*] --> PENDING : derived
	// from fulfilments or planned into a wave`, and `ASSIGNED --> IN_PROGRESS : first line picked` (doc
	// 09 §14.5) — and the practical consequence is that `assign`, which accepts only `PENDING`, can never
	// be used on the work the derivation exists to produce.
	// (`pick-list.service.ts`, the `deriveLines` call on line 89 that reaches
	// `PickListLineService.refreshListCounters`, whose `{ status: PickListStatus.IN_PROGRESS, ... }`
	// branch is on lines 347-349 of `pick-list-line.service.ts`.)
	it('[DEFECT] leaves a list derived from shipments in its unassigned state until a line is picked', async () => {
		const fixture = pickListFixture({ shippable: [shippable()] });

		const list = await fixture.service.create({ warehouseId: WAREHOUSE, fulfillmentIds: [SHIPMENT] } as never);

		expect(list.status).toBe(PickListStatus.PENDING);
		expect(list.startedAt).toBeUndefined();
	});

	it('takes the priority of the wave it is added to, and the caller’s own when there is no wave', async () => {
		const fixture = pickListFixture({ waves: [waveRow('wave-1', { priority: 4 })] });

		const inWave = await fixture.service.create({ warehouseId: WAREHOUSE, waveId: 'wave-1' } as never);
		const alone = await fixture.service.create({ warehouseId: WAREHOUSE } as never);
		const stated = await fixture.service.create({ warehouseId: WAREHOUSE, priority: 9 } as never);

		expect(inWave.priority).toBe(4);
		expect(alone.priority).toBe(0);
		expect(stated.priority).toBe(9);
	});

	it('names the list by the one shipment it serves, and names none when it serves several', async () => {
		// A list that covers exactly one shipment can be asked "which shipment is this?", and a list that
		// covers a batch cannot.
		const single = pickListFixture({ shippable: [shippable()] });
		const batch = pickListFixture({
			shippable: [shippable({ fulfillmentLineId: 'fl-1' }), shippable({ fulfillmentLineId: 'fl-2', fulfillmentId: 'shipment-2', orderLineId: 'ol-2' })]
		});

		const one = await single.service.create({ warehouseId: WAREHOUSE, fulfillmentIds: [SHIPMENT] } as never);
		const many = await batch.service.create({
			warehouseId: WAREHOUSE,
			fulfillmentIds: [SHIPMENT, 'shipment-2']
		} as never);

		expect(one.fulfillmentId).toBe(SHIPMENT);
		expect(many.fulfillmentId).toBeUndefined();
		expect(batch.tables.pickListLine).toHaveLength(2);
	});

	it('recomputes the counters of the wave it was derived into', async () => {
		// A wave on its own is an empty batch; the work is the lists under it, and the counters are
		// re-derived from them rather than incremented.
		const fixture = pickListFixture({
			waves: [waveRow('wave-1', { lineCount: 0 })],
			shippable: [shippable(), shippable({ fulfillmentLineId: 'fl-2', variantId: VARIANT_B, orderLineId: 'ol-2' })]
		});

		await fixture.service.create({ warehouseId: WAREHOUSE, waveId: 'wave-1', fulfillmentIds: [SHIPMENT] } as never);

		expect(fixture.wave('wave-1')).toMatchObject({ lineCount: 2, orderCount: 0 });
	});

	it('refuses a list when the organization has no numbering series, and writes nothing', async () => {
		const fixture = pickListFixture({ series: [] });

		await expect(fixture.service.create({ warehouseId: WAREHOUSE } as never)).rejects.toThrow(
			/No numbering series is configured for picking/
		);
		expect(fixture.tables.pickList).toEqual([]);
	});

	it('creates a wave and derives its work into it in one call', async () => {
		// A wave on its own is an empty batch, and what an operator means by "release this picking work"
		// is the wave and the lists under it.
		const fixture = pickListFixture({ shippable: [shippable()] });

		const wave = await fixture.service.createWaveWithLists({
			warehouseId: WAREHOUSE,
			fulfillmentIds: [SHIPMENT]
		});

		expect(wave).toMatchObject({ status: PickWaveStatus.DRAFT, warehouseId: WAREHOUSE });
		expect(fixture.tables.pickList).toHaveLength(1);
		expect(fixture.tables.pickList[0]).toMatchObject({ waveId: wave.id, warehouseId: WAREHOUSE });
		expect(fixture.wave(wave.id)).toMatchObject({ lineCount: 1 });
	});

	it('creates the wave alone when no shipment is named', async () => {
		// The empty boundary of the same call.
		const fixture = pickListFixture();

		const wave = await fixture.service.createWaveWithLists({ warehouseId: WAREHOUSE, fulfillmentIds: [] });

		expect(fixture.tables.pickList).toEqual([]);
		expect(fixture.tables.pickWave).toHaveLength(1);
		expect(wave.number).toBe('PICK-000001');
	});
});

describe('PickListService — the list state machine (doc 09 §14.5, §14.11)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(PICKER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('assigns an unassigned list to a picker and bumps its version once', async () => {
		// Assigning is the moment the route and the position order freeze, because a printed document and
		// a device that disagree about the walk is how a line gets walked to twice.
		const fixture = pickListFixture({ lists: [listRow('list-1')] });

		const assigned = await fixture.service.assign('list-1', PICKER);

		expect(assigned).toMatchObject({
			status: PickListStatus.ASSIGNED,
			assignedToUserId: PICKER,
			version: 2
		});
	});

	it('refuses to assign a list that is not unassigned', async () => {
		for (const status of [
			PickListStatus.ASSIGNED,
			PickListStatus.IN_PROGRESS,
			PickListStatus.PICKED,
			PickListStatus.CANCELED
		]) {
			const fixture = pickListFixture({ lists: [listRow('list-1', { status })] });

			await expect(fixture.service.assign('list-1', PICKER)).rejects.toThrow(/cannot be assigned/);
			expect(fixture.store('list-1')).toMatchObject({ status, version: 1 });
		}
	});

	it('refuses to assign a list without naming the picker it goes to', async () => {
		const fixture = pickListFixture({ lists: [listRow('list-1')] });

		await expect(fixture.service.assign('list-1', undefined as never)).rejects.toThrow(
			/requires the picker it is assigned to/
		);
		expect(fixture.store('list-1')).toMatchObject({ status: PickListStatus.PENDING, version: 1 });
	});

	it('starts an unassigned or an assigned list and stamps the time', async () => {
		for (const status of [PickListStatus.PENDING, PickListStatus.ASSIGNED]) {
			const fixture = pickListFixture({ lists: [listRow('list-1', { status })] });

			const started = await fixture.service.start('list-1');

			expect(started).toMatchObject({ status: PickListStatus.IN_PROGRESS, version: 2 });
			expect(started.startedAt).toBeInstanceOf(Date);
		}
	});

	it('keeps the start time a list already carries when it is started again after a reopen', async () => {
		// `startedAt` is written once: the moment the first picker walked the list is a fact about the
		// floor, not about the last call.
		const first = new Date('2026-02-01T08:00:00.000Z');
		const fixture = pickListFixture({ lists: [listRow('list-1', { startedAt: first })] });

		const started = await fixture.service.start('list-1');

		expect(started.startedAt).toEqual(first);
	});

	it('refuses to start a list that is closed', async () => {
		for (const status of [PickListStatus.PICKED, PickListStatus.CANCELED]) {
			const fixture = pickListFixture({ lists: [listRow('list-1', { status })] });

			await expect(fixture.service.start('list-1')).rejects.toThrow(/cannot be started/);
			expect(fixture.store('list-1')).toMatchObject({ status, version: 1 });
		}
	});

	it('moves the wave to in progress when its first list is started, and leaves a draft wave alone', async () => {
		// The wave follows its work rather than the other way round: a wave is being walked when one of
		// its lists is, and a draft wave has not been released at all.
		const released = pickListFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.RELEASED })],
			lists: [listRow('list-1', { waveId: 'wave-1' })]
		});
		const draft = pickListFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.DRAFT })],
			lists: [listRow('list-1', { waveId: 'wave-1' })]
		});

		await released.service.start('list-1');
		await draft.service.start('list-1');

		expect(released.wave('wave-1')).toMatchObject({ status: PickWaveStatus.IN_PROGRESS, version: 2 });
		expect(released.wave('wave-1').startedAt).toBeInstanceOf(Date);
		expect(draft.wave('wave-1')).toMatchObject({ status: PickWaveStatus.DRAFT, version: 1 });
	});

	it('completes a list whose lines all reached an outcome', async () => {
		const fixture = pickListFixture({
			lists: [listRow('list-1', { status: PickListStatus.IN_PROGRESS })],
			lines: [
				lineRow('line-1', { status: PickListLineStatus.PICKED, quantityPicked: '3.000000', position: 0 }),
				lineRow('line-2', { status: PickListLineStatus.SKIPPED, quantityShort: '1.000000', position: 1 })
			]
		});

		const completed = await fixture.service.complete('list-1');

		expect(completed).toMatchObject({ status: PickListStatus.PICKED, lineCount: 2, pickedCount: 1, shortCount: 1 });
		expect(completed.completedAt).toBeInstanceOf(Date);
	});

	it('closes a list short as picked, because the shortfall belongs to the lines', async () => {
		// A list that folded the shortfall into its own status would make "may this shipment be packed?" a
		// question with two answers.
		const fixture = pickListFixture({
			lists: [listRow('list-1', { status: PickListStatus.IN_PROGRESS })],
			lines: [
				lineRow('line-1', { status: PickListLineStatus.SHORT, quantityPicked: '1.000000', quantityShort: '2.000000' }),
				lineRow('line-2', { status: PickListLineStatus.SKIPPED, quantityShort: '4.000000', position: 1 })
			]
		});

		const completed = await fixture.service.complete('list-1');

		expect(completed).toMatchObject({ status: PickListStatus.PICKED, pickedCount: 1, shortCount: 2 });
	});

	it('refuses to complete a list while a line still has no outcome', async () => {
		const fixture = pickListFixture({
			lists: [listRow('list-1', { status: PickListStatus.IN_PROGRESS })],
			lines: [
				lineRow('line-1', { status: PickListLineStatus.PICKED, quantityPicked: '1.000000' }),
				lineRow('line-2', { status: PickListLineStatus.PENDING, position: 1 }),
				lineRow('line-3', { status: PickListLineStatus.PENDING, position: 2 })
			]
		});

		await expect(fixture.service.complete('list-1')).rejects.toThrow(/PICK_LINE_PENDING: 2 line/);
		expect(fixture.store('list-1')).toMatchObject({ status: PickListStatus.IN_PROGRESS });
	});

	it('recomputes the counters of the wave a completed list belongs to', async () => {
		const fixture = pickListFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.IN_PROGRESS })],
			lists: [listRow('list-1', { waveId: 'wave-1', orderId: ORDER, status: PickListStatus.IN_PROGRESS })],
			lines: [lineRow('line-1', { status: PickListLineStatus.PICKED, quantityPicked: '1.000000' })]
		});

		await fixture.service.complete('list-1');

		expect(fixture.wave('wave-1')).toMatchObject({ lineCount: 1, orderCount: 1 });
	});

	it('cancels a list nothing has been picked from and withdraws its lines', async () => {
		// Cancelling touches neither reservations nor stock: picking consumes a reservation checkout
		// already took, so a cancellation is not a stock event.
		const fixture = pickListFixture({
			lists: [listRow('list-1', { status: PickListStatus.ASSIGNED })],
			lines: [lineRow('line-1'), lineRow('line-2', { position: 1 })]
		});

		const cancelled = await fixture.service.cancel('list-1', 'The customer withdrew the order.');

		expect(cancelled).toMatchObject({ status: PickListStatus.CANCELED, note: 'The customer withdrew the order.' });
		expect(fixture.linesOf('list-1').map((line) => line.status)).toEqual([
			PickListLineStatus.CANCELED,
			PickListLineStatus.CANCELED
		]);
		expect(fixture.movements).toEqual([]);
	});

	it('keeps the note the list already carried when no reason is stated', async () => {
		const fixture = pickListFixture({ lists: [listRow('list-1', { note: 'Original note.' })] });

		expect((await fixture.service.cancel('list-1')).note).toBe('Original note.');
	});

	it('refuses to cancel a list any of whose lines has an outcome', async () => {
		// The way back is a short close of the remaining lines, which is what actually happened on the
		// floor and is what the record should say.
		const fixture = pickListFixture({
			lists: [listRow('list-1', { status: PickListStatus.IN_PROGRESS })],
			lines: [lineRow('line-1'), lineRow('line-2', { status: PickListLineStatus.PICKED, position: 1 })]
		});

		await expect(fixture.service.cancel('list-1')).rejects.toThrow(/PICK_LIST_HAS_PICKS: 1 line/);
		expect(fixture.store('list-1')).toMatchObject({ status: PickListStatus.IN_PROGRESS, version: 1 });
		expect(fixture.linesOf('list-1').map((line) => line.status)).toEqual([
			PickListLineStatus.PENDING,
			PickListLineStatus.PICKED
		]);
	});

	it('refuses to cancel a list that is already closed', async () => {
		for (const status of [PickListStatus.PICKED, PickListStatus.CANCELED]) {
			const fixture = pickListFixture({ lists: [listRow('list-1', { status })] });

			await expect(fixture.service.cancel('list-1')).rejects.toThrow(/already closed/);
			expect(fixture.store('list-1')).toMatchObject({ status, version: 1 });
		}
	});

	// The defect: `complete` checks only that no line is still pending, so a list that was cancelled —
	// whose lines were all withdrawn, and which the machine says is terminal — is moved to `PICKED` by
	// the next call. `CANCELED` has no outgoing transition at all (doc 09 §14.5, §14.11), and a picked
	// list is what a pack slip may be created from, so the defect lets a withdrawn list be packed.
	// (`pick-list.service.ts`, `complete`, which guards on the lines' statuses on line 211 and never on
	// the list's own.)
	it('[DEFECT] refuses to complete a list that was cancelled', async () => {
		const fixture = pickListFixture({
			lists: [listRow('list-1', { status: PickListStatus.CANCELED })],
			lines: [lineRow('line-1', { status: PickListLineStatus.CANCELED })]
		});

		await expect(fixture.service.complete('list-1')).rejects.toBeInstanceOf(BadRequestException);
		expect(fixture.store('list-1')).toMatchObject({ status: PickListStatus.CANCELED });
	});

	it('reports a list of another organization as missing', async () => {
		const fixture = pickListFixture({ lists: [listRow('theirs', { organizationId: OTHER_ORG })] });

		await expect(fixture.service.findOneScoped('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneDetailed('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneScoped('nope')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('PickListService — the counters a list carries (doc 09 §14.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(PICKER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('counts every line, the lines that were dealt with and the lines that came up short', async () => {
		const fixture = pickListFixture({
			lists: [listRow('list-1')],
			lines: [
				lineRow('picked', { status: PickListLineStatus.PICKED, position: 0 }),
				lineRow('short', { status: PickListLineStatus.SHORT, position: 1 }),
				lineRow('skipped', { status: PickListLineStatus.SKIPPED, position: 2 }),
				lineRow('pending', { status: PickListLineStatus.PENDING, position: 3 })
			]
		});

		await fixture.service.refreshCaches('list-1');

		expect(fixture.store('list-1')).toMatchObject({ lineCount: 4, pickedCount: 2, shortCount: 2 });
	});

	it('reports zero for a list that covers nothing, which is the empty boundary', async () => {
		const fixture = pickListFixture({ lists: [listRow('list-1', { lineCount: 9, pickedCount: 9, shortCount: 9 })] });

		await fixture.service.refreshCaches('list-1');

		expect(fixture.store('list-1')).toMatchObject({ lineCount: 0, pickedCount: 0, shortCount: 0 });
	});

	it('reads a list with its lines in walking order', async () => {
		const fixture = pickListFixture({
			lists: [listRow('list-1')],
			lines: [
				lineRow('third', { position: 20 }),
				lineRow('first', { position: 0 }),
				lineRow('second', { position: 10 }),
				lineRow('other', { position: 0, pickListId: 'list-2' })
			]
		});

		const detailed = await fixture.service.findOneDetailed('list-1');

		expect(detailed.lines.map((line: any) => line.id)).toEqual(['first', 'second', 'third']);
	});

	it('leaves out a shipment line whose variant has no position in the walk', async () => {
		// A location that is configured with no pickable position produces a list that covers nothing,
		// which is why the wave's release check refuses a line that carries no bin. The value asserted
		// here is the one a caller sees: no line, rather than a line nobody can walk to.
		const fixture = pickListFixture({ shippable: [shippable()], walk: [] });

		const list = await fixture.service.create({ warehouseId: WAREHOUSE, fulfillmentIds: [SHIPMENT] } as never);

		expect(fixture.linesOf(list.id)).toEqual([]);
	});
});

/**
 * The property the derivation exists for, asserted across the whole flow rather than at one step:
 * what a list asks for over its life never exceeds what the shipment still needs, and the wave's
 * counters always describe the work currently under it.
 */
describe('PickListService — what a list asks for never exceeds what the shipment needs (INV-21)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(PICKER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('conserves the shipment quantity across a partial pick and a short close of the remainder', async () => {
		const fixture = pickListFixture({
			shippable: [shippable({ quantity: '5.000000' })]
		});

		const list = await fixture.service.create({ warehouseId: WAREHOUSE, fulfillmentIds: [SHIPMENT] } as never);
		const line = fixture.linesOf(list.id)[0];

		// A partial pick takes three of the five and writes the two it could not find back to stock.
		await fixture.lineService.recordPick(line.id, { pickedQuantity: '3' });
		await fixture.service.complete(list.id);

		const recorded = fixture.linesOf(list.id)[0];

		expect(Number(recorded.quantityPicked) + Number(recorded.quantityShort)).toBeCloseTo(5, 6);
		expect(Number(recorded.quantityPicked)).toBeLessThanOrEqual(Number(recorded.quantityRequested));
		expect(fixture.movements).toHaveLength(1);
		expect(fixture.store(list.id)).toMatchObject({ status: PickListStatus.PICKED, lineCount: 1, pickedCount: 1 });
	});

	it('recomputes the wave from what its lists hold after a list is completed', async () => {
		const fixture = pickListFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.DRAFT })],
			shippable: [shippable()]
		});

		const wave = await fixture.service.createWaveWithLists({ warehouseId: WAREHOUSE, fulfillmentIds: [SHIPMENT] });
		const list = fixture.tables.pickList[0];

		expect(fixture.wave(wave.id)).toMatchObject({ lineCount: 1, orderCount: 0 });
		// The positions are pinned at release, so the wave can be handed to the floor.
		await fixture.waveService.release(wave.id);

		expect(fixture.wave(wave.id)).toMatchObject({ status: PickWaveStatus.RELEASED, lineCount: 1 });

		await fixture.lineService.recordPick(fixture.linesOf(list.id)[0].id, { pickedQuantity: '3' });
		await fixture.service.complete(list.id);

		expect(fixture.store(list.id)).toMatchObject({ status: PickListStatus.PICKED });
		expect(fixture.wave(wave.id)).toMatchObject({ lineCount: 1, orderCount: 0 });
	});
});

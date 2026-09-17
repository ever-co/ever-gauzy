/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a pick line service needs and none of which is
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
import { RequestContext } from '@gauzy/core';
import {
	IWarehouseStockLedgerPort,
	PickListLineStatus,
	PickListStatus,
	WarehouseStockMovementKind
} from '../warehouse.types';
import { PickListLineService } from './pick-list-line.service';

/**
 * The lines of a pick list: what was asked for, what was taken, and what the ledger has to be told.
 *
 * Three outcomes are recorded here and they are deliberately different things (doc 09 §14.5,
 * INV-21):
 *
 * - a **pick** took what the list asked for, and the ledger is already right, because the level was
 *   decremented when the shipment consumed its reservations — so nothing is written;
 * - a **short pick** took less, which means the ledger is wrong — it believes goods are gone that
 *   were never on the shelf — so the missing quantity is written back as an `ADJUSTMENT` in the same
 *   call as the line;
 * - a **skip** is a decision on the floor rather than a stock count: the stock stays where it is, so
 *   nothing is corrected and only the shortfall is recorded.
 *
 * The suite pins the conservation each of them has to satisfy — `picked + short = requested`, and a
 * pick never exceeds what the list asks for — because that is the arithmetic the whole picking flow
 * is built on, and it pins the compensating pair a substitution writes, because that is the one
 * place picking moves stock twice.
 *
 * The service is constructed directly over in-memory doubles of its two repositories and a
 * hand-written stand-in for the inventory capability, which keeps every movement it was asked for so
 * "what the ledger has to be told" is asserted rather than counted.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const PICKER = '00000000-0000-4000-8000-000000000050';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const SUBSTITUTE = '00000000-0000-4000-8000-000000000031';

/** The tables this package owns that this suite drives, as plain arrays. */
interface ITables {
	line: any[];
	list: any[];
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

/**
 * A hand-written stand-in for the inventory capability: every movement the service asks for is kept,
 * so what the line tells the ledger is asserted against the request rather than against a call count.
 */
function ledger() {
	const movements: any[] = [];
	const port: IWarehouseStockLedgerPort = {
		readBinBalance: async () => undefined,
		readBinBalances: async () => [],
		readExpectedBinBalances: async () => [],
		resolveHomeBin: async () => undefined,
		recordMovement: async (request) => {
			movements.push(request);

			return { movementId: `movement-${movements.length}`, quantityAfter: '0.000000' };
		},
		relocate: async () => []
	};

	return { port, movements };
}

/** One `pick_list_line` row, as the service reads it. */
const lineRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	pickListId: 'list-1',
	variantId: VARIANT,
	binId: 'bin-1',
	quantityRequested: '5.000000',
	quantityPicked: '0.000000',
	quantityShort: '0.000000',
	status: PickListLineStatus.PENDING,
	position: 0,
	...overrides
});

/** One `pick_list` row: the line service reads its status and its location. */
const listRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseId: WAREHOUSE,
	number: `PICK-${id}`,
	status: PickListStatus.PENDING,
	lineCount: 0,
	pickedCount: 0,
	shortCount: 0,
	version: 1,
	...overrides
});

/**
 * Builds the line service over in-memory doubles of its two repositories.
 *
 * @param options.lines The lines the fixture starts with.
 * @param options.lists The lists the fixture starts with.
 * @param options.withLedger Whether the inventory capability is registered at all.
 */
function lineFixture(options: { lines?: any[]; lists?: any[]; withLedger?: boolean } = {}) {
	const tables: ITables = {
		line: [...(options.lines ?? [])],
		list: [...(options.lists ?? [listRow('list-1')])]
	};
	const capability = ledger();
	const service = new PickListLineService(
		repository(tables, 'line') as never,
		{} as never,
		repository(tables, 'list') as never,
		(options.withLedger ?? true) ? (capability.port as never) : undefined
	);

	return {
		service,
		tables,
		capability,
		store: (id: string) => tables.line.find((row) => row.id === id),
		list: (id: string) => tables.list.find((row) => row.id === id)
	};
}

describe('PickListLineService — adding a line to a list (doc 09 §14.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(PICKER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('adds a pending line with its quantities stored at the storage scale', async () => {
		const fixture = lineFixture();

		const created = await fixture.service.create({
			pickListId: 'list-1',
			variantId: VARIANT,
			binId: 'bin-1',
			quantityRequested: '5'
		} as never);

		expect(created).toMatchObject({
			pickListId: 'list-1',
			variantId: VARIANT,
			binId: 'bin-1',
			quantityRequested: '5.000000',
			quantityPicked: '0.000000',
			quantityShort: '0.000000',
			status: PickListLineStatus.PENDING,
			position: 0,
			tenantId: TENANT,
			organizationId: ORG
		});
	});

	it('recomputes the counters of the list it was added to', async () => {
		// The counters are re-derived from the lines rather than incremented: a counter that drifts is
		// worse than no counter, because it is believed.
		const fixture = lineFixture({ lines: [lineRow('line-0')] });

		await fixture.service.create({ pickListId: 'list-1', variantId: VARIANT, quantityRequested: '2' } as never);

		expect(fixture.list('list-1')).toMatchObject({ lineCount: 2, pickedCount: 0, shortCount: 0 });
	});

	it('refuses a line that names no list, and one whose list does not exist', async () => {
		const fixture = lineFixture();

		await expect(fixture.service.create({ variantId: VARIANT, quantityRequested: '1' } as never)).rejects.toThrow(
			/must name it/
		);
		await expect(
			fixture.service.create({ pickListId: 'ghost', variantId: VARIANT, quantityRequested: '1' } as never)
		).rejects.toThrow(/does not exist/);
		expect(fixture.tables.line).toEqual([]);
	});

	it('refuses a line on a list that is already closed', async () => {
		for (const status of [PickListStatus.PICKED, PickListStatus.CANCELED]) {
			const fixture = lineFixture({ lists: [listRow('list-1', { status })] });

			await expect(
				fixture.service.create({ pickListId: 'list-1', variantId: VARIANT, quantityRequested: '1' } as never)
			).rejects.toThrow(/closed and cannot accept lines/);
			expect(fixture.tables.line).toEqual([]);
		}
	});

	it('accepts a line on a list that is being worked', async () => {
		// Control for the refusal above: the boundary is terminal, not "already touched".
		for (const status of [PickListStatus.PENDING, PickListStatus.ASSIGNED, PickListStatus.IN_PROGRESS]) {
			const fixture = lineFixture({ lists: [listRow('list-1', { status })] });

			await expect(
				fixture.service.create({ pickListId: 'list-1', variantId: VARIANT, quantityRequested: '1' } as never)
			).resolves.toMatchObject({ status: PickListLineStatus.PENDING });
		}
	});

	it('refuses a line that names no variant', async () => {
		const fixture = lineFixture();

		await expect(
			fixture.service.create({ pickListId: 'list-1', quantityRequested: '1' } as never)
		).rejects.toThrow(/must name the variant/);
	});

	it('refuses a line that requests zero or a negative quantity, and accepts the smallest one a column holds', async () => {
		// Boundary: a line that asks for nothing is not work, and a negative request is a correction
		// wearing a pick line's clothes.
		const fixture = lineFixture();

		await expect(
			fixture.service.create({ pickListId: 'list-1', variantId: VARIANT, quantityRequested: '0' } as never)
		).rejects.toThrow(/must request a positive quantity/);
		await expect(
			fixture.service.create({ pickListId: 'list-1', variantId: VARIANT, quantityRequested: '-1' } as never)
		).rejects.toThrow(/must request a positive quantity/);

		const smallest = await fixture.service.create({
			pickListId: 'list-1',
			variantId: VARIANT,
			quantityRequested: '0.000001'
		} as never);

		expect(smallest.quantityRequested).toBe('0.000001');
	});
});

describe('PickListLineService — recording a pick (doc 09 §14.5, INV-21)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(PICKER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records an exact pick as picked and tells the ledger nothing', async () => {
		// The level was already decremented when the shipment consumed its reservations, so a pick that
		// takes what the list asked for leaves the ledger exactly right.
		const fixture = lineFixture({ lines: [lineRow('line-1', { quantityRequested: '5.000000' })] });

		const picked = await fixture.service.recordPick('line-1', { pickedQuantity: '5' });

		expect(picked).toMatchObject({
			quantityPicked: '5.000000',
			quantityShort: '0.000000',
			status: PickListLineStatus.PICKED,
			pickedByUserId: PICKER
		});
		expect(picked.pickedAt).toBeInstanceOf(Date);
		expect(fixture.capability.movements).toEqual([]);
	});

	it('records a short pick, closes the remainder short and writes the shortfall back to stock', async () => {
		// A bin that held less than the list asked for is a stock error: the ledger believes goods are
		// gone that were never on the shelf, and the correction is an adjustment for exactly the
		// difference.
		const fixture = lineFixture({ lines: [lineRow('line-1', { quantityRequested: '5.000000' })] });

		const picked = await fixture.service.recordPick('line-1', { pickedQuantity: '3' });

		expect(picked).toMatchObject({
			quantityPicked: '3.000000',
			quantityShort: '2.000000',
			status: PickListLineStatus.SHORT
		});
		expect(fixture.capability.movements).toHaveLength(1);
		expect(fixture.capability.movements[0]).toMatchObject({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			binId: 'bin-1',
			quantity: '2.000000',
			kind: WarehouseStockMovementKind.ADJUSTMENT,
			referenceType: 'PICK_LIST_LINE',
			referenceId: 'line-1'
		});
	});

	it('accepts a pick of nothing and closes the whole line short', async () => {
		// The lower boundary: a picker who finds the bin empty records zero, and the whole request is the
		// shortfall — which is also the strongest replenishment signal downstream.
		const fixture = lineFixture({ lines: [lineRow('line-1', { quantityRequested: '5.000000' })] });

		const picked = await fixture.service.recordPick('line-1', { pickedQuantity: 0 });

		expect(picked).toMatchObject({
			quantityPicked: '0.000000',
			quantityShort: '5.000000',
			status: PickListLineStatus.SHORT
		});
		expect(fixture.capability.movements[0]).toMatchObject({ quantity: '5.000000' });
	});

	it('refuses a pick one unit over what the line asks for, and records nothing', async () => {
		// The list is what the shipment needs, so an over-pick is a real error rather than a tolerance.
		const fixture = lineFixture({ lines: [lineRow('line-1', { quantityRequested: '5.000000' })] });

		await expect(fixture.service.recordPick('line-1', { pickedQuantity: '5.000001' })).rejects.toThrow(
			/PICK_OVER_QUANTITY/
		);
		expect(fixture.store('line-1')).toMatchObject({
			quantityPicked: '0.000000',
			status: PickListLineStatus.PENDING
		});
		expect(fixture.capability.movements).toEqual([]);
	});

	it('conserves the request over a range of picks: what was taken plus what was short is what was asked for', async () => {
		// The arithmetic the whole picking flow rests on (INV-21), and the one the package validation
		// downstream reads.
		for (const taken of ['0', '0.000001', '1', '4.999999', '5']) {
			const fixture = lineFixture({ lines: [lineRow('line-1', { quantityRequested: '5.000000' })] });

			const picked = await fixture.service.recordPick('line-1', { pickedQuantity: taken });
			const total =
				Number(picked.quantityPicked) + Number(picked.quantityShort);

			expect(total).toBeCloseTo(5, 6);
			expect(picked.status).toBe(
				Number(picked.quantityShort) === 0 ? PickListLineStatus.PICKED : PickListLineStatus.SHORT
			);
		}
	});

	it('refuses a second outcome on a line that already has one', async () => {
		// Idempotency of the transition: a device that re-sends a confirmation cannot pick the same line
		// twice, which is what keeps the fulfilment quantity conserved.
		const fixture = lineFixture({ lines: [lineRow('line-1')] });

		await fixture.service.recordPick('line-1', { pickedQuantity: '5' });

		await expect(fixture.service.recordPick('line-1', { pickedQuantity: '5' })).rejects.toThrow(
			/already has an outcome and cannot be picked again/
		);
		await expect(fixture.service.recordSkip('line-1')).rejects.toThrow(/cannot be skipped/);
		await expect(
			fixture.service.recordSubstitution('line-1', { substituteVariantId: SUBSTITUTE, substituteQuantity: '1' })
		).rejects.toThrow(/cannot be substituted/);
		// The second call changed nothing at all.
		expect(fixture.store('line-1')).toMatchObject({ quantityPicked: '5.000000', quantityShort: '0.000000' });
		expect(fixture.capability.movements).toEqual([]);
	});

	it('refuses to correct a shortfall when no inventory capability is registered', async () => {
		// An operation with a quantity to move and no ledger to move it through fails loudly instead of
		// adjusting a level here.
		const fixture = lineFixture({ lines: [lineRow('line-1')], withLedger: false });

		await expect(fixture.service.recordPick('line-1', { pickedQuantity: '3' })).rejects.toThrow(
			/WAREHOUSE_STOCK_LEDGER_UNAVAILABLE/
		);
		expect(fixture.store('line-1')).toMatchObject({ status: PickListLineStatus.PENDING });
	});

	it('refuses a short pick on a line that has no bin to correct against', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1', { binId: undefined })] });

		await expect(fixture.service.recordPick('line-1', { pickedQuantity: '3' })).rejects.toThrow(
			/has no bin, so the shortfall has nowhere to be corrected against/
		);
		expect(fixture.capability.movements).toEqual([]);
	});

	it('records the bin the picker corrected to and the lot and serials that were scanned', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1')] });

		const picked = await fixture.service.recordPick('line-1', {
			pickedQuantity: '5',
			binId: 'bin-9',
			lotNumber: 'LOT-42',
			serialNumbers: ['S-1', 'S-2'],
			note: 'Taken from the overflow position.'
		});

		expect(picked).toMatchObject({
			binId: 'bin-9',
			lotNumber: 'LOT-42',
			serialNumbers: ['S-1', 'S-2'],
			note: 'Taken from the overflow position.'
		});
	});

	it('recomputes the list counters after the pick', async () => {
		const fixture = lineFixture({
			lines: [lineRow('line-1'), lineRow('line-2', { position: 1 })],
			lists: [listRow('list-1', { status: PickListStatus.ASSIGNED })]
		});

		await fixture.service.recordPick('line-1', { pickedQuantity: '5' });

		expect(fixture.list('list-1')).toMatchObject({ lineCount: 2, pickedCount: 1, shortCount: 0 });
	});

	it('reports a line of another organization as missing', async () => {
		const fixture = lineFixture({ lines: [lineRow('theirs', { organizationId: OTHER_ORG })] });

		await expect(fixture.service.findOneScoped('theirs')).rejects.toBeInstanceOf(NotFoundException);

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);

		expect((await fixture.service.findOneScoped('theirs')).id).toBe('theirs');
	});
});

describe('PickListLineService — recording a substitution (doc 09 §14.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(PICKER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records the substitute as picked and writes the compensating pair for the two variants', async () => {
		// The pick succeeded — the line answers "is this list finished?", not "was it exactly what the
		// customer ordered" — and the swap implies two movements: the original goes back on the level it
		// was believed to have left, and the substitute comes off the one it was taken from.
		const fixture = lineFixture({ lines: [lineRow('line-1', { quantityRequested: '5.000000' })] });

		const recorded = await fixture.service.recordSubstitution('line-1', {
			substituteVariantId: SUBSTITUTE,
			substituteQuantity: '2',
			substitutionReason: 'The ordered unit was damaged.'
		});

		expect(recorded).toMatchObject({
			substituteVariantId: SUBSTITUTE,
			substituteQuantity: '2.000000',
			substitutionReason: 'The ordered unit was damaged.',
			status: PickListLineStatus.PICKED,
			binId: 'bin-1'
		});
		// `quantityPicked` stays untouched: it measures what was taken of the variant the list named.
		expect(recorded.quantityPicked).toBe('0.000000');
		expect(fixture.capability.movements).toHaveLength(2);
		expect(fixture.capability.movements[0]).toMatchObject({
			variantId: VARIANT,
			binId: 'bin-1',
			quantity: '2.000000',
			kind: WarehouseStockMovementKind.ADJUSTMENT,
			referenceId: 'line-1'
		});
		expect(fixture.capability.movements[1]).toMatchObject({
			variantId: SUBSTITUTE,
			binId: 'bin-1',
			quantity: '-2.000000',
			kind: WarehouseStockMovementKind.SALE,
			referenceId: 'line-1'
		});
	});

	it('nets the pair to zero in quantity, so a swap never changes what the location holds', async () => {
		for (const quantity of ['0.000001', '1', '5']) {
			const fixture = lineFixture({ lines: [lineRow('line-1', { quantityRequested: '5.000000' })] });

			await fixture.service.recordSubstitution('line-1', {
				substituteVariantId: SUBSTITUTE,
				substituteQuantity: quantity
			});

			const [back, out] = fixture.capability.movements;

			expect(Number(back.quantity) + Number(out.quantity)).toBeCloseTo(0, 6);
		}
	});

	it('accepts a substitution of exactly what the line asks for', async () => {
		// The upper boundary of a legal substitution.
		const fixture = lineFixture({ lines: [lineRow('line-1', { quantityRequested: '5.000000' })] });

		const recorded = await fixture.service.recordSubstitution('line-1', {
			substituteVariantId: SUBSTITUTE,
			substituteQuantity: '5'
		});

		expect(recorded.substituteQuantity).toBe('5.000000');
	});

	it('refuses a substitution that takes more than the line asks for', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1', { quantityRequested: '5.000000' })] });

		await expect(
			fixture.service.recordSubstitution('line-1', {
				substituteVariantId: SUBSTITUTE,
				substituteQuantity: '5.000001'
			})
		).rejects.toThrow(/PICK_OVER_QUANTITY/);
		expect(fixture.store('line-1')).toMatchObject({ status: PickListLineStatus.PENDING });
		expect(fixture.capability.movements).toEqual([]);
	});

	it('refuses a substitution that names no variant, one of a non-positive quantity, and one that states neither', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1')] });

		await expect(
			fixture.service.recordSubstitution('line-1', { substituteQuantity: '1' } as never)
		).rejects.toThrow(/must name the variant taken and a positive quantity/);
		await expect(
			fixture.service.recordSubstitution('line-1', { substituteVariantId: SUBSTITUTE, substituteQuantity: '0' })
		).rejects.toThrow(/must name the variant taken and a positive quantity/);
		await expect(
			fixture.service.recordSubstitution('line-1', { substituteVariantId: SUBSTITUTE, substituteQuantity: '-2' })
		).rejects.toThrow(/must name the variant taken and a positive quantity/);
		expect(fixture.store('line-1')).toMatchObject({ status: PickListLineStatus.PENDING });
	});

	it('records both movements against the position the substitute was actually taken from', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1')] });

		const recorded = await fixture.service.recordSubstitution('line-1', {
			substituteVariantId: SUBSTITUTE,
			substituteQuantity: '2',
			binId: 'bin-7'
		});

		expect(recorded.binId).toBe('bin-7');
		expect(fixture.capability.movements.map((movement) => movement.binId)).toEqual(['bin-7', 'bin-7']);
	});

	it('refuses a substitution when no inventory capability is registered', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1')], withLedger: false });

		await expect(
			fixture.service.recordSubstitution('line-1', { substituteVariantId: SUBSTITUTE, substituteQuantity: '1' })
		).rejects.toThrow(/WAREHOUSE_STOCK_LEDGER_UNAVAILABLE/);
		expect(fixture.store('line-1')).toMatchObject({ status: PickListLineStatus.PENDING });
	});

	it('refuses a substitution on a line with no bin to record it against', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1', { binId: undefined })] });

		await expect(
			fixture.service.recordSubstitution('line-1', { substituteVariantId: SUBSTITUTE, substituteQuantity: '1' })
		).rejects.toThrow(/has no bin, so the substitution has nowhere to be recorded against/);
		expect(fixture.capability.movements).toEqual([]);
	});
});

describe('PickListLineService — skipping a line (doc 09 §14.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(PICKER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records a skip as the whole line short and moves no stock', async () => {
		// A skip is a decision on the floor rather than a stock count: the goods are still on the shelf,
		// so nothing is corrected here and the shortfall is reported for a decision downstream.
		const fixture = lineFixture({ lines: [lineRow('line-1', { quantityRequested: '5.000000' })] });

		const skipped = await fixture.service.recordSkip('line-1', 'The position was blocked by a pallet.');

		expect(skipped).toMatchObject({
			quantityPicked: '0.000000',
			quantityShort: '5.000000',
			status: PickListLineStatus.SKIPPED,
			note: 'The position was blocked by a pallet.',
			pickedByUserId: PICKER
		});
		expect(fixture.capability.movements).toEqual([]);
	});

	it('keeps the note the line already carried when none is stated', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1', { note: 'Keep the original note.' })] });

		expect((await fixture.service.recordSkip('line-1')).note).toBe('Keep the original note.');
	});

	it('recomputes the counters of the list after a skip', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1')] });

		await fixture.service.recordSkip('line-1');

		expect(fixture.list('list-1')).toMatchObject({ lineCount: 1, pickedCount: 0, shortCount: 1 });
	});

	it('counts a short line as both picked and short, and a skipped line as short only', async () => {
		// The two counters answer two different questions: how much of the list was dealt with, and how
		// much of it came up short.
		const fixture = lineFixture({
			lines: [
				lineRow('line-1', { position: 0 }),
				lineRow('line-2', { position: 1 }),
				lineRow('line-3', { position: 2 })
			]
		});

		await fixture.service.recordPick('line-1', { pickedQuantity: '5' });
		await fixture.service.recordPick('line-2', { pickedQuantity: '3' });
		await fixture.service.recordSkip('line-3');

		expect(fixture.list('list-1')).toMatchObject({ lineCount: 3, pickedCount: 2, shortCount: 2 });
	});
});

describe('PickListLineService — attaching lines to a pack slip (doc 09 §14.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(PICKER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('attaches every line that has an outcome and leaves the ones nobody visited alone', async () => {
		// It is what makes "a picked unit is never left unpacked" checkable: the slip covers a set
		// rather than a claim.
		const fixture = lineFixture({
			lines: [
				lineRow('picked', { position: 0, status: PickListLineStatus.PICKED }),
				lineRow('short', { position: 1, status: PickListLineStatus.SHORT }),
				lineRow('skipped', { position: 2, status: PickListLineStatus.SKIPPED }),
				lineRow('pending', { position: 3, status: PickListLineStatus.PENDING }),
				lineRow('cancelled', { position: 4, status: PickListLineStatus.CANCELED })
			]
		});

		const attached = await fixture.service.attachToPackSlip('list-1', 'slip-1');

		expect(attached.map((line) => line.id)).toEqual(['picked', 'short', 'skipped']);
		expect(fixture.store('picked')).toMatchObject({ packSlipId: 'slip-1' });
		expect(fixture.store('pending').packSlipId).toBeUndefined();
		expect(fixture.store('cancelled').packSlipId).toBeUndefined();
	});

	it('attaches nothing for a list nobody has walked yet', async () => {
		// The empty boundary: a slip created against an untouched list covers no line, which is the
		// state the incomplete-slip refusal reads.
		const fixture = lineFixture({ lines: [lineRow('line-1', { status: PickListLineStatus.PENDING })] });

		expect(await fixture.service.attachToPackSlip('list-1', 'slip-1')).toEqual([]);
		expect(fixture.store('line-1').packSlipId).toBeUndefined();
	});

	it('detaches every line of a slip without editing what was picked', async () => {
		// A cancellation is a statement about the package, not about the walking.
		const fixture = lineFixture({
			lines: [
				lineRow('line-1', { status: PickListLineStatus.PICKED, packSlipId: 'slip-1', quantityPicked: '5.000000' }),
				lineRow('line-2', { status: PickListLineStatus.PICKED, packSlipId: 'slip-1', quantityPicked: '3.000000' }),
				lineRow('line-3', { status: PickListLineStatus.PICKED, packSlipId: 'slip-2', quantityPicked: '1.000000' })
			]
		});

		await fixture.service.detachFromPackSlip('slip-1');

		expect(fixture.store('line-1').packSlipId).toBeNull();
		expect(fixture.store('line-2').packSlipId).toBeNull();
		expect(fixture.store('line-3')).toMatchObject({ packSlipId: 'slip-2' });
		expect(fixture.store('line-1').quantityPicked).toBe('5.000000');
	});

	it('reads the lines of a list in the order the pick path visits them', async () => {
		const fixture = lineFixture({
			lines: [
				lineRow('third', { position: 20 }),
				lineRow('first', { position: 0 }),
				lineRow('second', { position: 10 }),
				lineRow('other-list', { position: 0, pickListId: 'list-2' })
			]
		});

		expect((await fixture.service.findForList('list-1')).map((line) => line.id)).toEqual([
			'first',
			'second',
			'third'
		]);
	});
});

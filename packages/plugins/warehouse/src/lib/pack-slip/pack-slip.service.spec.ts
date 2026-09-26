/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a packing service needs and none of which is
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
import { PACK_NUMBER_KEY, PackSlipStatus, PickListLineStatus, PickListStatus } from '../warehouse.types';
import { PackSlipService } from './pack-slip.service';

/**
 * Packing: the record of what went into which package, and the weight a carrier rates.
 *
 * A slip is created from work that is already picked and it covers the lines of one list, which is
 * what makes "a picked unit is never left unpacked" checkable — every picked line of the list is
 * attached to the slip when it is created, so packing validates a set rather than a claim (doc 09
 * §14.6). The machine has exactly two transitions, `OPEN → PACKED` and `OPEN → CANCELED`, and a
 * `PACKED` slip is immutable: a re-pack cancels it and creates a new one, so the first packing
 * survives in the history and a label is produced against a record that cannot change underneath it.
 *
 * Packing writes **no stock movement** — stock left at fulfilment creation — so the only quantity
 * this suite asks about is the weight the slip carries, and it asks that it is stored at the storage
 * scale rather than as whatever string was typed at the bench.
 *
 * The service is constructed with the real line service over in-memory tables, so the attachment and
 * the detachment of the lines it covers are exercised through the code that owns them. Only the list
 * read is a hand-written double, because the list service's own behaviour belongs to its own suite.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const PACKER = '00000000-0000-4000-8000-000000000050';
const SHIPMENT = '00000000-0000-4000-8000-000000000070';
const VARIANT = '00000000-0000-4000-8000-000000000030';

/** The tables this package owns that this suite drives, as plain arrays. */
interface ITables {
	slip: any[];
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

/** The platform numbering series, as a hand-written double. */
function numbering(prefixes: string[] = [PACK_NUMBER_KEY]) {
	let sequence = 0;

	return {
		service: {
			async allocate(key: string) {
				if (!prefixes.includes(key)) {
					throw new Error(`no series is configured for "${key}"`);
				}

				return { formatted: `${key}-${String(++sequence).padStart(6, '0')}` };
			}
		}
	};
}

/** One `pack_slip` row, as the service reads it. */
const slipRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseId: WAREHOUSE,
	pickListId: 'list-1',
	number: `PACK-${id}`,
	status: PackSlipStatus.OPEN,
	packageCount: 1,
	version: 1,
	...overrides
});

/** One `pick_list_line` row: the slip reads its status and the slip it is attached to. */
const lineRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	pickListId: 'list-1',
	variantId: VARIANT,
	quantityRequested: '1.000000',
	quantityPicked: '1.000000',
	quantityShort: '0.000000',
	status: PickListLineStatus.PICKED,
	position: 0,
	...overrides
});

/** One `pick_list` row: the slip service reads its status. */
const listRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseId: WAREHOUSE,
	number: `PICK-${id}`,
	status: PickListStatus.PICKED,
	version: 1,
	...overrides
});

/**
 * Builds the packing service with the real line service over in-memory tables.
 *
 * @param options.slips The slips the fixture starts with.
 * @param options.lines The lines the fixture starts with.
 * @param options.lists The lists the fixture starts with.
 * @param options.series The numbering series the organization has configured.
 */
function packSlipFixture(
	options: { slips?: any[]; lines?: any[]; lists?: any[]; series?: string[] } = {}
) {
	const tables: ITables = {
		slip: [...(options.slips ?? [])],
		line: [...(options.lines ?? [])],
		list: [...(options.lists ?? [listRow('list-1')])]
	};
	const slipRepository = repository(tables, 'slip');
	const lineRepository = repository(tables, 'line');
	const listRepository = repository(tables, 'list');
	const lineService = new PickListLineService(lineRepository as never, {} as never, listRepository as never);
	const listService = {
		findOneScoped: async (id: string) => {
			const list = tables.list.find((row) => row.id === id);

			if (!list) {
				throw new NotFoundException('The pick list was not found.');
			}

			return list;
		}
	};
	const series = numbering(options.series);
	const service = new PackSlipService(
		slipRepository as never,
		{} as never,
		listService as never,
		lineService,
		series.service as never
	);

	return {
		service,
		tables,
		lineService,
		store: (id: string) => tables.slip.find((row) => row.id === id),
		line: (id: string) => tables.line.find((row) => row.id === id)
	};
}

describe('PackSlipService — creating a slip from picked work (doc 09 §14.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(PACKER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates an open slip with the allocated number and one package', async () => {
		const fixture = packSlipFixture();

		const created = await fixture.service.create({
			warehouseId: WAREHOUSE,
			pickListId: 'list-1',
			fulfillmentId: SHIPMENT
		} as never);

		expect(created).toMatchObject({
			warehouseId: WAREHOUSE,
			pickListId: 'list-1',
			fulfillmentId: SHIPMENT,
			number: 'PACK-000001',
			status: PackSlipStatus.OPEN,
			packageCount: 1,
			version: 1,
			tenantId: TENANT,
			organizationId: ORG
		});
	});

	it('attaches every line of the list that has an outcome, and leaves the rest alone', async () => {
		// It is what makes "a picked unit is never left unpacked" checkable after the fact.
		const fixture = packSlipFixture({
			lines: [
				lineRow('picked', { status: PickListLineStatus.PICKED, position: 0 }),
				lineRow('short', { status: PickListLineStatus.SHORT, position: 1 }),
				lineRow('skipped', { status: PickListLineStatus.SKIPPED, position: 2 }),
				lineRow('pending', { status: PickListLineStatus.PENDING, position: 3 }),
				lineRow('cancelled', { status: PickListLineStatus.CANCELED, position: 4 }),
				lineRow('other-list', { pickListId: 'list-2', position: 0 })
			]
		});

		const created = await fixture.service.create({ warehouseId: WAREHOUSE, pickListId: 'list-1' } as never);

		expect(fixture.line('picked')).toMatchObject({ packSlipId: created.id });
		expect(fixture.line('short')).toMatchObject({ packSlipId: created.id });
		expect(fixture.line('skipped')).toMatchObject({ packSlipId: created.id });
		expect(fixture.line('pending').packSlipId).toBeUndefined();
		expect(fixture.line('other-list').packSlipId).toBeUndefined();
	});

	it('creates a slip against a shipment alone, covering no line of any list', async () => {
		// The boundary the constructor allows: packing that does not follow a pick list has nothing to
		// attach, and that is a legal slip rather than an error.
		const fixture = packSlipFixture({ lines: [lineRow('picked')] });

		const created = await fixture.service.create({ warehouseId: WAREHOUSE, fulfillmentId: SHIPMENT } as never);

		expect(created).toMatchObject({ status: PackSlipStatus.OPEN, fulfillmentId: SHIPMENT });
		expect(created.pickListId).toBeUndefined();
		expect(fixture.line('picked').packSlipId).toBeUndefined();
	});

	it('refuses a slip that names no location, and one that names neither a list nor a shipment', async () => {
		const fixture = packSlipFixture();

		await expect(fixture.service.create({ pickListId: 'list-1' } as never)).rejects.toThrow(
			/must name the location the packing happens at/
		);
		await expect(fixture.service.create({ warehouseId: WAREHOUSE } as never)).rejects.toThrow(
			/one of the two is required/
		);
		expect(fixture.tables.slip).toEqual([]);
	});

	it('refuses a slip created from a list that is not picked', async () => {
		// `PICKED` is the state a slip may be created from: packing work that is still being walked is how
		// a parcel is sealed with a line nobody has visited.
		for (const status of [
			PickListStatus.PENDING,
			PickListStatus.ASSIGNED,
			PickListStatus.IN_PROGRESS,
			PickListStatus.CANCELED
		]) {
			const fixture = packSlipFixture({ lists: [listRow('list-1', { status })] });

			await expect(
				fixture.service.create({ warehouseId: WAREHOUSE, pickListId: 'list-1' } as never)
			).rejects.toThrow(/created from a picked list/);
			expect(fixture.tables.slip).toEqual([]);
		}
	});

	it('refuses a slip whose list does not exist', async () => {
		const fixture = packSlipFixture();

		await expect(
			fixture.service.create({ warehouseId: WAREHOUSE, pickListId: 'ghost' } as never)
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('numbers slips consecutively and refuses when the organization has no numbering series', async () => {
		const fixture = packSlipFixture();

		const first = await fixture.service.create({ warehouseId: WAREHOUSE, pickListId: 'list-1' } as never);
		const second = await fixture.service.create({ warehouseId: WAREHOUSE, pickListId: 'list-1' } as never);

		expect([first.number, second.number]).toEqual(['PACK-000001', 'PACK-000002']);

		const unnumbered = packSlipFixture({ series: [] });

		await expect(
			unnumbered.service.create({ warehouseId: WAREHOUSE, pickListId: 'list-1' } as never)
		).rejects.toThrow(/No numbering series is configured for packing/);
		expect(unnumbered.tables.slip).toEqual([]);
	});
});

describe('PackSlipService — sealing a slip (doc 09 §14.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(PACKER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records the packages, the weights and the tracking number, and closes the slip', async () => {
		const fixture = packSlipFixture({
			slips: [slipRow('slip-1')],
			lines: [lineRow('line-1', { packSlipId: 'slip-1' })]
		});

		const packed = await fixture.service.pack('slip-1', {
			packageCount: 2,
			totalWeight: '3.25',
			totalVolume: '0.5',
			carrierKey: 'acme',
			trackingNumber: 'TRACK-1',
			labelUrl: 'https://labels.invalid/1',
			note: 'Two parcels.'
		});

		expect(packed).toMatchObject({
			status: PackSlipStatus.PACKED,
			packageCount: 2,
			totalWeight: '3.250000',
			totalVolume: '0.500000',
			carrierKey: 'acme',
			trackingNumber: 'TRACK-1',
			labelUrl: 'https://labels.invalid/1',
			note: 'Two parcels.',
			packedByUserId: PACKER,
			version: 2
		});
		expect(packed.packedAt).toBeInstanceOf(Date);
	});

	it('keeps the packages and the carrier the slip already carried when the call states none', async () => {
		const fixture = packSlipFixture({
			slips: [slipRow('slip-1', { packageCount: 3, carrierKey: 'acme', trackingNumber: 'TRACK-1' })],
			lines: [lineRow('line-1', { packSlipId: 'slip-1' })]
		});

		const packed = await fixture.service.pack('slip-1', {} as never);

		expect(packed).toMatchObject({ packageCount: 3, carrierKey: 'acme', trackingNumber: 'TRACK-1' });
	});

	it('refuses a slip that covers no line of the list it was created from', async () => {
		const fixture = packSlipFixture({ slips: [slipRow('slip-1')] });

		await expect(fixture.service.pack('slip-1', { packageCount: 1 })).rejects.toThrow(
			/PACK_SLIP_INCOMPLETE: this slip covers no line/
		);
		expect(fixture.store('slip-1')).toMatchObject({ status: PackSlipStatus.OPEN, version: 1 });
	});

	it('refuses to seal a slip while a line it covers has no outcome', async () => {
		// A picked unit left unpacked is a shipment that arrives short and nobody knows why, so every line
		// the slip covers has to carry an outcome before it is sealed.
		const fixture = packSlipFixture({
			slips: [slipRow('slip-1')],
			lines: [
				lineRow('line-1', { packSlipId: 'slip-1', position: 0 }),
				lineRow('line-2', { packSlipId: 'slip-1', status: PickListLineStatus.PENDING, position: 1 }),
				lineRow('line-3', { packSlipId: 'slip-1', status: PickListLineStatus.CANCELED, position: 2 })
			]
		});

		await expect(fixture.service.pack('slip-1', { packageCount: 1 })).rejects.toThrow(
			/PACK_SLIP_INCOMPLETE: 2 line\(s\)/
		);
		expect(fixture.store('slip-1')).toMatchObject({ status: PackSlipStatus.OPEN });
	});

	it('ignores a line of the list that is attached to another slip', async () => {
		// Control for the two refusals above: the slip covers the lines attached to *it*, so a line of the
		// same list that went into an earlier parcel is not this slip's obstacle.
		const fixture = packSlipFixture({
			slips: [slipRow('slip-1')],
			lines: [
				lineRow('line-1', { packSlipId: 'slip-1' }),
				lineRow('line-2', { packSlipId: 'slip-2', status: PickListLineStatus.PENDING, position: 1 })
			]
		});

		const packed = await fixture.service.pack('slip-1', { packageCount: 1 });

		expect(packed.status).toBe(PackSlipStatus.PACKED);
	});

	it('refuses to seal a slip that is already closed, because a re-pack is a new slip', async () => {
		// A `PACKED` slip is immutable: the label was produced against it, and the first packing has to
		// survive in the history.
		for (const status of [PackSlipStatus.PACKED, PackSlipStatus.CANCELED]) {
			const fixture = packSlipFixture({
				slips: [slipRow('slip-1', { status })],
				lines: [lineRow('line-1', { packSlipId: 'slip-1' })]
			});

			await expect(fixture.service.pack('slip-1', { packageCount: 1 })).rejects.toThrow(
				/is closed; a re-pack cancels it and creates a new one/
			);
			expect(fixture.store('slip-1')).toMatchObject({ status, version: 1 });
		}
	});

	it('refuses a package count of zero, of a negative number and of a fraction', async () => {
		// Boundary: a sealed parcel holds at least one package, and half a package is not a package.
		for (const packageCount of [0, -1, 1.5]) {
			const fixture = packSlipFixture({
				slips: [slipRow('slip-1')],
				lines: [lineRow('line-1', { packSlipId: 'slip-1' })]
			});

			await expect(fixture.service.pack('slip-1', { packageCount })).rejects.toThrow(
				/A packed slip holds at least one package/
			);
			expect(fixture.store('slip-1')).toMatchObject({ status: PackSlipStatus.OPEN });
		}
	});

	it('accepts a sealed parcel of exactly one package, which is the lower boundary', async () => {
		const fixture = packSlipFixture({
			slips: [slipRow('slip-1', { packageCount: 5 })],
			lines: [lineRow('line-1', { packSlipId: 'slip-1' })]
		});

		expect((await fixture.service.pack('slip-1', { packageCount: 1 })).packageCount).toBe(1);
	});

	it('refuses a tracking number already attached to another slip of the same carrier', async () => {
		// The number is what a carrier is asked about, so two live slips cannot carry it.
		const fixture = packSlipFixture({
			slips: [
				slipRow('slip-1', { number: 'PACK-000001' }),
				slipRow('slip-2', {
					number: 'PACK-000002',
					status: PackSlipStatus.PACKED,
					carrierKey: 'acme',
					trackingNumber: 'TRACK-1'
				})
			],
			lines: [lineRow('line-1', { packSlipId: 'slip-1' })]
		});

		await expect(
			fixture.service.pack('slip-1', { packageCount: 1, carrierKey: 'acme', trackingNumber: 'TRACK-1' })
		).rejects.toThrow(/PACK_SLIP_TRACKING_DUPLICATE/);
		// The refusal names the slip that already holds it, which is what an operator needs to resolve it.
		await expect(
			fixture.service.pack('slip-1', { packageCount: 1, carrierKey: 'acme', trackingNumber: 'TRACK-1' })
		).rejects.toThrow(/PACK-000002/);
		expect(fixture.store('slip-1')).toMatchObject({ status: PackSlipStatus.OPEN });
	});

	it('accepts the same tracking number under another carrier and under no carrier at all', async () => {
		// The pair is the identity: two carriers may issue the same string, and a slip that names no
		// carrier is a slip the platform has not been told about yet.
		const otherCarrier = packSlipFixture({
			slips: [
				slipRow('slip-1'),
				slipRow('slip-2', { carrierKey: 'acme', trackingNumber: 'TRACK-1', status: PackSlipStatus.PACKED })
			],
			lines: [lineRow('line-1', { packSlipId: 'slip-1' })]
		});

		expect(
			(await otherCarrier.service.pack('slip-1', { packageCount: 1, carrierKey: 'other', trackingNumber: 'TRACK-1' }))
				.status
		).toBe(PackSlipStatus.PACKED);

		const noCarrier = packSlipFixture({
			slips: [slipRow('slip-1')],
			lines: [lineRow('line-1', { packSlipId: 'slip-1' })]
		});

		expect((await noCarrier.service.pack('slip-1', { packageCount: 1, trackingNumber: 'TRACK-1' })).trackingNumber).toBe(
			'TRACK-1'
		);
	});

	it('writes no stock movement at all, because packing is physical handling rather than movement', async () => {
		// Stock left at fulfilment creation; a slip records what went into the parcel and nothing else.
		const fixture = packSlipFixture({
			slips: [slipRow('slip-1')],
			lines: [lineRow('line-1', { packSlipId: 'slip-1' })]
		});

		const packed = await fixture.service.pack('slip-1', { packageCount: 1, totalWeight: '1.5' });

		expect(packed).not.toHaveProperty('movementId');
		expect(fixture.store('slip-1')).not.toHaveProperty('quantity');
	});
});

describe('PackSlipService — cancelling a slip (doc 09 §14.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(PACKER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('cancels an open slip and detaches its lines without editing what was picked', async () => {
		// The picked quantity is what physically happened, and a cancellation is a statement about the
		// package, not about the walking.
		const fixture = packSlipFixture({
			slips: [slipRow('slip-1')],
			lines: [
				lineRow('line-1', { packSlipId: 'slip-1', quantityPicked: '2.000000' }),
				lineRow('line-2', { packSlipId: 'slip-2', quantityPicked: '1.000000', position: 1 })
			]
		});

		const cancelled = await fixture.service.cancel('slip-1', 'The label was printed wrongly.');

		expect(cancelled).toMatchObject({
			status: PackSlipStatus.CANCELED,
			note: 'The label was printed wrongly.',
			version: 2
		});
		expect(fixture.line('line-1').packSlipId).toBeNull();
		expect(fixture.line('line-1').quantityPicked).toBe('2.000000');
		expect(fixture.line('line-2')).toMatchObject({ packSlipId: 'slip-2' });
	});

	it('keeps the note the slip already carried when no reason is stated', async () => {
		const fixture = packSlipFixture({ slips: [slipRow('slip-1', { note: 'Original note.' })] });

		expect((await fixture.service.cancel('slip-1')).note).toBe('Original note.');
	});

	it('refuses to cancel a slip that is not open', async () => {
		for (const status of [PackSlipStatus.PACKED, PackSlipStatus.CANCELED]) {
			const fixture = packSlipFixture({ slips: [slipRow('slip-1', { status })] });

			await expect(fixture.service.cancel('slip-1')).rejects.toThrow(/only an open slip can be/);
			expect(fixture.store('slip-1')).toMatchObject({ status, version: 1 });
		}
	});

	it('reports a slip of another organization as missing', async () => {
		const fixture = packSlipFixture({ slips: [slipRow('theirs', { organizationId: OTHER_ORG })] });

		await expect(fixture.service.findOneScoped('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneDetailed('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneScoped('nope')).rejects.toBeInstanceOf(NotFoundException);
	});
});

/**
 * The property the two-transition machine exists for, walked end to end: work is picked, a slip is
 * created against it, the lines it covers are exactly the lines that were walked, and the slip is
 * sealed once and never edited again.
 */
describe('PackSlipService — a picked unit is never left unpacked (doc 09 §14.6)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(PACKER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('covers exactly the lines that reached an outcome, and seals once', async () => {
		const fixture = packSlipFixture({
			lines: [
				lineRow('walked', { status: PickListLineStatus.PICKED, position: 0 }),
				lineRow('short', { status: PickListLineStatus.SHORT, position: 1 }),
				lineRow('untouched', { status: PickListLineStatus.PENDING, position: 2 })
			]
		});

		const slip = await fixture.service.create({ warehouseId: WAREHOUSE, pickListId: 'list-1' } as never);
		const covered = fixture.tables.line.filter((line) => line.packSlipId === slip.id);

		expect(covered.map((line) => line.id)).toEqual(['walked', 'short']);

		const packed = await fixture.service.pack(slip.id, { packageCount: 1, totalWeight: '1' });

		expect(packed).toMatchObject({ status: PackSlipStatus.PACKED, totalWeight: '1.000000' });
		// The second seal is not a transition, and the first seal is what the label was produced against.
		await expect(fixture.service.pack(slip.id, { packageCount: 1 })).rejects.toThrow(
			/is closed; a re-pack cancels it and creates a new one/
		);
		expect(fixture.store(slip.id)).toMatchObject({ status: PackSlipStatus.PACKED, version: 2 });
	});

	it('refuses every illegal transition of the two-transition machine', async () => {
		// `OPEN → PACKED` and `OPEN → CANCELED` are the whole machine; there is nothing between them.
		const packed = packSlipFixture({
			slips: [slipRow('slip-1', { status: PackSlipStatus.PACKED })],
			lines: [lineRow('line-1', { packSlipId: 'slip-1' })]
		});
		const cancelled = packSlipFixture({
			slips: [slipRow('slip-1', { status: PackSlipStatus.CANCELED })],
			lines: [lineRow('line-1', { packSlipId: 'slip-1' })]
		});

		await expect(packed.service.cancel('slip-1')).rejects.toBeInstanceOf(BadRequestException);
		await expect(cancelled.service.cancel('slip-1')).rejects.toBeInstanceOf(BadRequestException);
		await expect(cancelled.service.pack('slip-1', { packageCount: 1 })).rejects.toBeInstanceOf(BadRequestException);
	});
});

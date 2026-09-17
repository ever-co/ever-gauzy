/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a wave service needs and none of which is
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
import { PICK_NUMBER_KEY, PickListStatus, PickWaveStatus, PickWaveStrategy } from '../warehouse.types';
import { PickWaveService } from './pick-wave.service';

/**
 * The release unit of warehouse work: the waves an operator releases, assigns, watches and closes.
 *
 * A wave is where "is this batch of work finished?" is answered, so most of this service is a state
 * machine and the checks that go with it (doc 09 §14.4, §14.11). The machine moves forward only —
 * `DRAFT → RELEASED → IN_PROGRESS → PICKED | PARTIALLY_PICKED → CLOSED`, plus `→ CANCELED` while it
 * is still being worked — and the two gates the suite pins are the ones the derivation exists for: a
 * wave may only be released when every line it covers has a bin, and may only be closed when every
 * list under it has reached a terminal state.
 *
 * One further property is asserted here because the whole design rests on it: the counters are
 * **recomputed from the lists and their lines, never incremented**, because a counter that drifts is
 * worse than no counter — it is believed. Cancelling a wave cancels its lists and touches neither a
 * reservation nor a stock level, which is why nothing about quantity appears in this suite.
 *
 * The service is constructed directly over in-memory doubles of its three repositories. The double
 * states the `where` the service states, so the tenant scoping and the "lines of this wave" walk are
 * not vacuous, and the numbering series is a hand-written double rather than a mock library.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const PICKER = '00000000-0000-4000-8000-000000000050';
const ORDER = '00000000-0000-4000-8000-000000000060';
const OTHER_ORDER = '00000000-0000-4000-8000-000000000061';

/** The tables this package owns that this suite drives, as plain arrays. */
interface ITables {
	wave: any[];
	pickList: any[];
	pickListLine: any[];
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

	return {
		rows,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => rows().filter((row) => matches(row, options.where)),
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
 * The platform numbering series, as a hand-written double.
 *
 * @param prefixes The series keys the fixture knows; any other key is a series the organization has
 * not configured, which is what the refusal case is about.
 */
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

/** One `pick_wave` row, as the service reads it. */
const waveRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseId: WAREHOUSE,
	number: `PICK-${id}`,
	strategy: PickWaveStrategy.BATCH,
	status: PickWaveStatus.DRAFT,
	priority: 0,
	orderCount: 0,
	lineCount: 0,
	version: 1,
	...overrides
});

/** One `pick_list` row: the wave reads its status and its order. */
const listRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseId: WAREHOUSE,
	waveId: 'wave-1',
	number: `PICK-${id}`,
	status: PickListStatus.PENDING,
	priority: 0,
	version: 1,
	...overrides
});

/** One `pick_list_line` row: the wave reads its status and its bin. */
const lineRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	pickListId: 'list-1',
	binId: 'bin-1',
	position: 0,
	status: 'PENDING',
	...overrides
});

/**
 * Builds the wave service over in-memory doubles of its three repositories.
 *
 * @param options.waves The waves the fixture starts with.
 * @param options.lists The pick lists the fixture starts with.
 * @param options.lines The pick lines the fixture starts with.
 * @param options.series The numbering series the organization has configured.
 */
function waveFixture(
	options: { waves?: any[]; lists?: any[]; lines?: any[]; series?: string[] } = {}
) {
	const tables: ITables = {
		wave: [...(options.waves ?? [])],
		pickList: [...(options.lists ?? [])],
		pickListLine: [...(options.lines ?? [])]
	};
	const series = numbering(options.series);
	const service = new PickWaveService(
		repository(tables, 'wave') as never,
		{} as never,
		repository(tables, 'pickList') as never,
		repository(tables, 'pickListLine') as never,
		series.service as never
	);

	return {
		service,
		tables,
		series,
		store: (id: string) => tables.wave.find((row) => row.id === id),
		list: (id: string) => tables.pickList.find((row) => row.id === id),
		line: (id: string) => tables.pickListLine.find((row) => row.id === id)
	};
}

describe('PickWaveService — creating a wave (doc 09 §14.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates a draft wave with the allocated number, the documented defaults and empty counters', async () => {
		// A wave on its own is an empty batch: the counters are zero because nothing has been derived
		// into it yet, and they are recomputed rather than incremented from here on.
		const fixture = waveFixture();

		const created = await fixture.service.create({ warehouseId: WAREHOUSE } as never);

		expect(created).toMatchObject({
			warehouseId: WAREHOUSE,
			number: 'PICK-000001',
			strategy: PickWaveStrategy.BATCH,
			status: PickWaveStatus.DRAFT,
			priority: 0,
			orderCount: 0,
			lineCount: 0,
			version: 1,
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(fixture.series.allocated).toEqual([PICK_NUMBER_KEY]);
	});

	it('keeps the strategy, the priority and the plan the caller states', async () => {
		const fixture = waveFixture();

		const created = await fixture.service.create({
			warehouseId: WAREHOUSE,
			strategy: PickWaveStrategy.ZONE,
			priority: 5,
			pickerUserId: PICKER,
			plannedAt: new Date('2026-02-01T08:00:00.000Z')
		} as never);

		expect(created).toMatchObject({
			strategy: PickWaveStrategy.ZONE,
			priority: 5,
			pickerUserId: PICKER,
			plannedAt: new Date('2026-02-01T08:00:00.000Z')
		});
	});

	it('numbers waves consecutively', async () => {
		const fixture = waveFixture();

		const first = await fixture.service.create({ warehouseId: WAREHOUSE } as never);
		const second = await fixture.service.create({ warehouseId: WAREHOUSE } as never);

		expect([first.number, second.number]).toEqual(['PICK-000001', 'PICK-000002']);
	});

	it('refuses a wave that names no location', async () => {
		const fixture = waveFixture();

		await expect(fixture.service.create({} as never)).rejects.toThrow(/must name the location/);
		expect(fixture.tables.wave).toEqual([]);
	});

	it('refuses a wave when the organization has no numbering series, and writes nothing', async () => {
		// A wave without its number is not a document, so the refusal happens before the row exists.
		const fixture = waveFixture({ series: [] });

		await expect(fixture.service.create({ warehouseId: WAREHOUSE } as never)).rejects.toThrow(
			/No numbering series is configured for picking \(key "PICK"\)/
		);
		expect(fixture.tables.wave).toEqual([]);
	});
});

describe('PickWaveService — the release gate (doc 09 §14.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('releases a draft wave whose lines all have a bin, and stamps the operator and the time', async () => {
		// Release is the gate the whole derivation exists for: a line with no bin is a line nobody can
		// pick, and releasing it would put work on the floor that cannot be completed.
		const fixture = waveFixture({
			waves: [waveRow('wave-1')],
			lists: [listRow('list-1', { orderId: ORDER })],
			lines: [lineRow('line-1', { binId: 'bin-1' }), lineRow('line-2', { binId: 'bin-2' })]
		});

		const released = await fixture.service.release('wave-1', PICKER);

		expect(released).toMatchObject({ status: PickWaveStatus.RELEASED, pickerUserId: PICKER });
		expect(released.releasedAt).toBeInstanceOf(Date);
		// The release recomputes what the wave covers, so the counters describe the work that was just
		// handed over rather than the empty batch it was a moment ago.
		expect(released).toMatchObject({ lineCount: 2, orderCount: 1 });
	});

	it('refuses to release a wave with a line that has no bin, and leaves it a draft', async () => {
		const fixture = waveFixture({
			waves: [waveRow('wave-1')],
			lists: [listRow('list-1')],
			lines: [lineRow('line-1', { binId: 'bin-1' }), lineRow('line-2', { binId: undefined })]
		});

		await expect(fixture.service.release('wave-1')).rejects.toThrow(/PICK_LINE_UNBINNED: 1 line/);
		expect(fixture.store('wave-1')).toMatchObject({ status: PickWaveStatus.DRAFT, version: 1 });
	});

	it('refuses to release a wave that is not a draft', async () => {
		// Every transition is refused from any other state with that state's code (doc 09 §14.11).
		for (const status of [
			PickWaveStatus.RELEASED,
			PickWaveStatus.IN_PROGRESS,
			PickWaveStatus.PICKED,
			PickWaveStatus.CLOSED,
			PickWaveStatus.CANCELED
		]) {
			const fixture = waveFixture({ waves: [waveRow('wave-1', { status })] });

			await expect(fixture.service.release('wave-1')).rejects.toThrow(/WAVE_ILLEGAL_TRANSITION/);
			expect(fixture.store('wave-1')).toMatchObject({ status });
		}
	});

	it('reports a wave of another organization as missing', async () => {
		// A different answer for "not yours" and "does not exist" leaks the existence of another
		// tenant's rows, so both are the same miss.
		const fixture = waveFixture({ waves: [waveRow('theirs', { organizationId: OTHER_ORG })] });

		await expect(fixture.service.findOneScoped('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneDetailed('theirs')).rejects.toBeInstanceOf(NotFoundException);

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);

		expect((await fixture.service.findOneScoped('theirs')).id).toBe('theirs');
	});
});

describe('PickWaveService — the wave state machine (doc 09 §14.4, §14.11)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('moves a released wave to in progress and stamps the start once', async () => {
		const fixture = waveFixture({ waves: [waveRow('wave-1', { status: PickWaveStatus.RELEASED })] });

		const started = await fixture.service.start('wave-1');

		expect(started).toMatchObject({ status: PickWaveStatus.IN_PROGRESS, version: 2 });
		expect(started.startedAt).toBeInstanceOf(Date);

		// The machine only moves forward: a second start is not a transition.
		await expect(fixture.service.start('wave-1')).rejects.toThrow(/WAVE_ILLEGAL_TRANSITION/);
	});

	it('refuses to start a wave that was never released', async () => {
		const fixture = waveFixture({ waves: [waveRow('wave-1', { status: PickWaveStatus.DRAFT })] });

		await expect(fixture.service.start('wave-1')).rejects.toThrow(/WAVE_ILLEGAL_TRANSITION/);
		expect(fixture.store('wave-1')).toMatchObject({ status: PickWaveStatus.DRAFT, version: 1 });
	});

	it('completes an in-progress wave whose lists are all terminal and whose lines all resolved', async () => {
		const fixture = waveFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.IN_PROGRESS })],
			lists: [listRow('list-1', { status: PickListStatus.PICKED, orderId: ORDER })],
			lines: [lineRow('line-1', { status: 'PICKED' }), lineRow('line-2', { status: 'PICKED' })]
		});

		const completed = await fixture.service.complete('wave-1');

		expect(completed.status).toBe(PickWaveStatus.PICKED);
		expect(completed.completedAt).toBeInstanceOf(Date);
		expect(completed).toMatchObject({ lineCount: 2, orderCount: 1 });
	});

	it('completes a wave with a short or skipped line as partially picked', async () => {
		// The state is derived rather than asserted: the shortfall is a fact about the wave that the
		// packing step and the backorder decision both read.
		const incomplete = waveFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.IN_PROGRESS })],
			lists: [listRow('list-1', { status: PickListStatus.PICKED })],
			lines: [lineRow('line-1', { status: 'PICKED' }), lineRow('line-2', { status: 'SHORT' })]
		});
		const skipped = waveFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.IN_PROGRESS })],
			lists: [listRow('list-1', { status: PickListStatus.PICKED })],
			lines: [lineRow('line-1', { status: 'SKIPPED' })]
		});

		expect((await incomplete.service.complete('wave-1')).status).toBe(PickWaveStatus.PARTIALLY_PICKED);
		expect((await skipped.service.complete('wave-1')).status).toBe(PickWaveStatus.PARTIALLY_PICKED);
	});

	it('refuses to complete a wave while one of its lists is still being worked', async () => {
		const fixture = waveFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.IN_PROGRESS })],
			lists: [
				listRow('list-1', { status: PickListStatus.PICKED }),
				listRow('list-2', { status: PickListStatus.IN_PROGRESS })
			],
			lines: [lineRow('line-1', { status: 'PICKED' })]
		});

		await expect(fixture.service.complete('wave-1')).rejects.toThrow(/PICK_LIST_OPEN: 1 pick list/);
		expect(fixture.store('wave-1')).toMatchObject({ status: PickWaveStatus.IN_PROGRESS });
	});

	it('treats a cancelled list as terminal for the completion guard', async () => {
		// Control: a list that was withdrawn contributes nothing to the wave's outstanding work.
		const fixture = waveFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.IN_PROGRESS })],
			lists: [listRow('list-1', { status: PickListStatus.CANCELED })],
			lines: [lineRow('line-1', { status: 'CANCELED' })]
		});

		expect((await fixture.service.complete('wave-1')).status).toBe(PickWaveStatus.PICKED);
	});

	it('refuses to complete a wave that carries no pick list at all', async () => {
		const fixture = waveFixture({ waves: [waveRow('wave-1', { status: PickWaveStatus.IN_PROGRESS })] });

		await expect(fixture.service.complete('wave-1')).rejects.toThrow(/nothing to complete/);
	});

	it('refuses to complete a wave that is not in progress', async () => {
		for (const status of [PickWaveStatus.DRAFT, PickWaveStatus.RELEASED, PickWaveStatus.PICKED]) {
			const fixture = waveFixture({ waves: [waveRow('wave-1', { status })] });

			await expect(fixture.service.complete('wave-1')).rejects.toThrow(/WAVE_ILLEGAL_TRANSITION/);
		}
	});

	it('closes a wave whose output was packed and manifested', async () => {
		for (const status of [PickWaveStatus.PICKED, PickWaveStatus.PARTIALLY_PICKED]) {
			const fixture = waveFixture({
				waves: [waveRow('wave-1', { status })],
				lists: [listRow('list-1', { status: PickListStatus.PICKED })]
			});

			const closed = await fixture.service.close('wave-1');

			expect(closed).toMatchObject({ status: PickWaveStatus.CLOSED, version: 2 });
		}
	});

	it('refuses to close a wave whose picking has not finished', async () => {
		for (const status of [
			PickWaveStatus.DRAFT,
			PickWaveStatus.RELEASED,
			PickWaveStatus.IN_PROGRESS,
			PickWaveStatus.CLOSED,
			PickWaveStatus.CANCELED
		]) {
			const fixture = waveFixture({ waves: [waveRow('wave-1', { status })] });

			await expect(fixture.service.close('wave-1')).rejects.toThrow(/WAVE_ILLEGAL_TRANSITION/);
			expect(fixture.store('wave-1')).toMatchObject({ status });
		}
	});

	it('refuses to close a picked wave that still has an open list', async () => {
		// The two gates are independent: the status says picking finished, the lists say what actually
		// happened, and the lists win.
		const fixture = waveFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.PICKED })],
			lists: [listRow('list-1', { status: PickListStatus.IN_PROGRESS })]
		});

		await expect(fixture.service.close('wave-1')).rejects.toThrow(/PICK_LIST_OPEN/);
		expect(fixture.store('wave-1')).toMatchObject({ status: PickWaveStatus.PICKED, version: 1 });
	});
});

describe('PickWaveService — closing a wave short (doc 09 §14.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('closes a wave short, records why, and cancels the lists that are still open', async () => {
		// This is an operator's decision rather than a derived state: the shortfall drives a backorder or
		// a re-allocation, which is why the wave stops here rather than pretending the batch completed.
		const fixture = waveFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.IN_PROGRESS })],
			lists: [
				listRow('list-1', { status: PickListStatus.PICKED }),
				listRow('list-2', { status: PickListStatus.IN_PROGRESS })
			],
			lines: [lineRow('line-1', { status: 'SHORT' })]
		});

		const closed = await fixture.service.closeShort('wave-1', 'The pallet could not be reached.');

		expect(closed).toMatchObject({
			status: PickWaveStatus.PARTIALLY_PICKED,
			metadata: { closedShort: true, closedShortReason: 'The pallet could not be reached.' }
		});
		expect(closed.completedAt).toBeInstanceOf(Date);
		// The list that already finished is left exactly as it was, and the open one carries the reason.
		expect(fixture.list('list-1')).toMatchObject({ status: PickListStatus.PICKED });
		expect(fixture.list('list-2')).toMatchObject({
			status: PickListStatus.CANCELED,
			note: 'The pallet could not be reached.',
			version: 2
		});
	});

	it('recomputes the counters of a wave that was closed short', async () => {
		const fixture = waveFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.IN_PROGRESS })],
			lists: [listRow('list-1', { orderId: ORDER }), listRow('list-2', { orderId: ORDER })],
			lines: [lineRow('line-1', { pickListId: 'list-1' }), lineRow('line-2', { pickListId: 'list-2' })]
		});

		const closed = await fixture.service.closeShort('wave-1');

		expect(closed).toMatchObject({ lineCount: 2, orderCount: 1 });
	});

	it('refuses to close short a wave that is already closed or cancelled', async () => {
		for (const status of [PickWaveStatus.CLOSED, PickWaveStatus.CANCELED]) {
			const fixture = waveFixture({ waves: [waveRow('wave-1', { status })] });

			await expect(fixture.service.closeShort('wave-1')).rejects.toThrow(/WAVE_ILLEGAL_TRANSITION/);
			expect(fixture.store('wave-1')).toMatchObject({ status, version: 1 });
		}
	});

	it('accepts a short close of a draft wave, which is how a batch is abandoned on the floor', async () => {
		// Boundary control for the refusal above: a wave that never reached the floor can still be
		// closed short rather than cancelled, and its open list is withdrawn with it.
		const fixture = waveFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.DRAFT })],
			lists: [listRow('list-1')]
		});

		expect((await fixture.service.closeShort('wave-1')).status).toBe(PickWaveStatus.PARTIALLY_PICKED);
		expect(fixture.list('list-1')).toMatchObject({ status: PickListStatus.CANCELED });
	});
});

describe('PickWaveService — cancelling a wave (doc 09 §14.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('cancels a wave that nothing has been picked from and withdraws its open lists', async () => {
		// The wave owns the cascade: the lists are the rows a picker reads, so the cancellation is
		// recorded on them rather than left implied by the wave's status.
		const fixture = waveFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.RELEASED })],
			lists: [
				listRow('list-1', { status: PickListStatus.PENDING }),
				listRow('list-2', { status: PickListStatus.ASSIGNED }),
				listRow('list-3', { status: PickListStatus.PICKED })
			],
			lines: [lineRow('line-1', { status: 'PENDING' })]
		});

		const cancelled = await fixture.service.cancel('wave-1', 'The carrier cancelled the collection.');

		expect(cancelled).toMatchObject({
			status: PickWaveStatus.CANCELED,
			metadata: { cancelReason: 'The carrier cancelled the collection.' },
			version: 2
		});
		expect(fixture.list('list-1')).toMatchObject({ status: PickListStatus.CANCELED, note: 'The carrier cancelled the collection.' });
		expect(fixture.list('list-2')).toMatchObject({ status: PickListStatus.CANCELED });
		expect(fixture.list('list-3')).toMatchObject({ status: PickListStatus.PICKED });
	});

	it('cancels a draft wave and a wave already being walked', async () => {
		for (const status of [PickWaveStatus.DRAFT, PickWaveStatus.RELEASED, PickWaveStatus.IN_PROGRESS]) {
			const fixture = waveFixture({ waves: [waveRow('wave-1', { status })] });

			expect((await fixture.service.cancel('wave-1')).status).toBe(PickWaveStatus.CANCELED);
		}
	});

	it('refuses to cancel a wave any of whose lines already has an outcome', async () => {
		// The way back from a wave that was partly walked is a short close, which is what actually
		// happened on the floor and is what the record should say.
		const fixture = waveFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.IN_PROGRESS })],
			lists: [listRow('list-1', { status: PickListStatus.IN_PROGRESS })],
			lines: [lineRow('line-1', { status: 'PENDING' }), lineRow('line-2', { status: 'PICKED' })]
		});

		await expect(fixture.service.cancel('wave-1')).rejects.toThrow(/PICK_LIST_HAS_PICKS: 1 line/);
		expect(fixture.store('wave-1')).toMatchObject({ status: PickWaveStatus.IN_PROGRESS, version: 1 });
		expect(fixture.list('list-1')).toMatchObject({ status: PickListStatus.IN_PROGRESS });
	});

	it('refuses to cancel a wave that reached a terminal picked or closed state', async () => {
		for (const status of [
			PickWaveStatus.PICKED,
			PickWaveStatus.PARTIALLY_PICKED,
			PickWaveStatus.CLOSED,
			PickWaveStatus.CANCELED
		]) {
			const fixture = waveFixture({ waves: [waveRow('wave-1', { status })] });

			await expect(fixture.service.cancel('wave-1')).rejects.toThrow(/WAVE_ILLEGAL_TRANSITION/);
			expect(fixture.store('wave-1')).toMatchObject({ status });
		}
	});

	it('leaves a wave that is already cancelled exactly as it was', async () => {
		// Idempotency of the refusal: the second call changes nothing, including the timestamp of the
		// first cancellation.
		const fixture = waveFixture({
			waves: [waveRow('wave-1', { status: PickWaveStatus.CANCELED, metadata: { cancelReason: 'first' } })]
		});

		await expect(fixture.service.cancel('wave-1', 'second')).rejects.toThrow(/WAVE_ILLEGAL_TRANSITION/);
		expect(fixture.store('wave-1')).toMatchObject({ metadata: { cancelReason: 'first' }, version: 1 });
	});
});

describe('PickWaveService — the counters are recomputed, never incremented (doc 09 §14.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('counts distinct orders rather than lists, and every line of every list', async () => {
		// A batch wave covers several orders in one pass, so two lists of one order are one order's work.
		const fixture = waveFixture({
			waves: [waveRow('wave-1')],
			lists: [
				listRow('list-1', { orderId: ORDER }),
				listRow('list-2', { orderId: ORDER }),
				listRow('list-3', { orderId: OTHER_ORDER }),
				listRow('list-4', { orderId: undefined })
			],
			lines: [
				lineRow('line-1', { pickListId: 'list-1' }),
				lineRow('line-2', { pickListId: 'list-1' }),
				lineRow('line-3', { pickListId: 'list-3' })
			]
		});

		await fixture.service.recomputeCaches('wave-1');

		expect(fixture.store('wave-1')).toMatchObject({ orderCount: 2, lineCount: 3 });
	});

	it('rewrites a drifted counter back to what the lists actually hold', async () => {
		// The property the recompute exists for: a wave whose counters were written by an older,
		// wrong run is corrected from the rows rather than adjusted by a delta.
		const fixture = waveFixture({
			waves: [waveRow('wave-1', { orderCount: 99, lineCount: 99 })],
			lists: [listRow('list-1', { orderId: ORDER })],
			lines: [lineRow('line-1')]
		});

		await fixture.service.recomputeCaches('wave-1');

		expect(fixture.store('wave-1')).toMatchObject({ orderCount: 1, lineCount: 1 });
	});

	it('reports zero for a wave that covers nothing', async () => {
		// The empty-collection boundary: no list is no work, not an error.
		const fixture = waveFixture({ waves: [waveRow('wave-1', { orderCount: 4, lineCount: 9 })] });

		await fixture.service.recomputeCaches('wave-1');

		expect(fixture.store('wave-1')).toMatchObject({ orderCount: 0, lineCount: 0 });
	});

	it('counts only the lines of its own lists', async () => {
		// The walk is per list, so a line of another wave's list is not this wave's line count.
		const fixture = waveFixture({
			waves: [waveRow('wave-1')],
			lists: [listRow('list-1'), listRow('other', { waveId: 'wave-2' })],
			lines: [lineRow('line-1', { pickListId: 'list-1' }), lineRow('line-2', { pickListId: 'other' })]
		});

		await fixture.service.recomputeCaches('wave-1');

		expect(fixture.store('wave-1')).toMatchObject({ lineCount: 1 });
	});

	it('counts nothing at all for a wave whose lists are another organization’s', async () => {
		// The cache is derived inside the caller's scope, so another organization's lists cannot inflate
		// it — and the wave itself is still the caller's to read.
		const fixture = waveFixture({
			waves: [waveRow('wave-1', { lineCount: 3 })],
			lists: [listRow('theirs', { organizationId: OTHER_ORG })]
		});

		await fixture.service.recomputeCaches('wave-1');

		expect(fixture.store('wave-1')).toMatchObject({ orderCount: 0, lineCount: 0 });
	});

	it('reports a wave that is not there as missing when it recomputes', async () => {
		const fixture = waveFixture();

		await expect(fixture.service.recomputeCaches('nope')).rejects.toBeInstanceOf(NotFoundException);
	});
});

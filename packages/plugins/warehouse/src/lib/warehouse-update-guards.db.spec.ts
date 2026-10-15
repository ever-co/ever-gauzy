/**
 * The generic edit of a warehouse document cannot move what only its own operations move (review R2-13), against a
 * real database.
 *
 * `PUT /pick-lists/:id`, `/pick-list-lines/:id`, `/pick-waves/:id`, `/pack-slips/:id` and `/carrier-manifests/:id`
 * — and the `update*` mutations that mirror them — validated bodies that are `PartialType` of the full DTO and
 * reached the inherited update, which wrote whatever they named: the status, the counters, the timestamps, the
 * version, the picked and short quantities. So a pick line recorded `SHORT` (which wrote its shortfall movement)
 * could be put back to `PENDING` and picked again, writing a second movement; a list nobody picked could be set
 * `PICKED`; a manifest could be set `HANDED_OVER` without `handOver`, or have the frozen membership in its
 * metadata rewritten. Each document now accepts only the members its DTO says an edit may change; any other
 * member is refused with `*_FIELD_NOT_WRITABLE` unless the body merely restates the stored value.
 *
 * The services are the package's own; the database is an in-memory better-sqlite3 connection; the repositories
 * are TypeORM's own, so a refused edit is read back from the table rather than from a double. The stock ledger is
 * a port to another package and is the one thing recorded rather than run. `@gauzy/core` is doubled at the module
 * boundary for the reason the package's other suites give, its CRUD base reduced to the tenant-scoped reads and
 * writes the real one performs.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared, and mapped below by fixture schemas. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/** The CRUD base, reduced to what the real one does for these calls: everything scoped to the caller's tenant. */
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		private scoped(where: Record<string, unknown> = {}): Record<string, unknown> {
			return { ...where, ...(mockCaller.tenantId ? { tenantId: mockCaller.tenantId } : {}) };
		}

		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			const record = await this.typeOrmRepository.findOne({
				...options,
				where: this.scoped({ ...(options.where ?? {}), id })
			});

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
			} else if (!('version' in id) && !(await this.typeOrmRepository.findOne({ where: this.scoped(id) }))) {
				// The real base reads criteria-selected rows first (`findOneByWhereOptions`) and answers a miss with 404.
				throw new NotFoundException('The requested record was not found');
			}

			return this.typeOrmRepository.update(this.scoped(typeof id === 'string' ? { id } : id), partial);
		}
	}

	return {
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
		SequenceService: class SequenceService {},
		RequestContext: {
			currentUser: () => (mockCaller.tenantId ? { tenantId: mockCaller.tenantId } : null),
			currentUserId: () => null,
			currentTenantId: () => mockCaller.tenantId,
			currentOrganizationId: () => mockCaller.organizationId,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

/** The caller the request context answers with. */
const mockCaller: { tenantId: string | null; organizationId: string | null } = { tenantId: null, organizationId: null };

import 'reflect-metadata';
import { DataSource, EntitySchema } from 'typeorm';
import { CarrierManifest } from './carrier-manifest/carrier-manifest.entity';
import { CarrierManifestService } from './carrier-manifest/carrier-manifest.service';
import { PackSlip } from './pack-slip/pack-slip.entity';
import { PackSlipService } from './pack-slip/pack-slip.service';
import { PickListLine } from './pick-list-line/pick-list-line.entity';
import { PickListLineService } from './pick-list-line/pick-list-line.service';
import { PickList } from './pick-list/pick-list.entity';
import { PickListService } from './pick-list/pick-list.service';
import { PickWave } from './pick-wave/pick-wave.entity';
import { PickWaveService } from './pick-wave/pick-wave.service';
import { WarehouseBin } from './warehouse-bin/warehouse-bin.entity';
import { WarehouseZone } from './warehouse-zone/warehouse-zone.entity';
import {
	CarrierManifestStatus,
	IWarehouseStockLedgerPort,
	PackSlipStatus,
	PickListLineStatus,
	PickListStatus,
	PickWaveStatus
} from './warehouse.types';

type Row = Record<string, any>;

const TENANT = '00000000-0000-4000-8000-00000000000a';
const ORG = '00000000-0000-4000-8000-0000000000a1';
const WAREHOUSE = '00000000-0000-4000-8000-0000000001a1';
const BIN = '00000000-0000-4000-8000-0000000001b1';
const VARIANT = '00000000-0000-4000-8000-0000000003a1';
const USER = '00000000-0000-4000-8000-0000000009a1';
const WAVE = '00000000-0000-4000-8000-0000000004a1';
const LIST = '00000000-0000-4000-8000-0000000005a1';
const LINE = '00000000-0000-4000-8000-0000000006a1';
const SLIP = '00000000-0000-4000-8000-0000000007a1';
const MANIFEST = '00000000-0000-4000-8000-0000000008a1';
const LINE_2 = '00000000-0000-4000-8000-0000000006a2';

/*
|--------------------------------------------------------------------------
| Fixture schemas: the columns the services read and write
|--------------------------------------------------------------------------
*/

const base = () => ({
	id: { type: 'varchar', primary: true, generated: 'uuid' },
	createdAt: { type: 'datetime', createDate: true },
	updatedAt: { type: 'datetime', updateDate: true },
	deletedAt: { type: 'datetime', nullable: true, deleteDate: true },
	tenantId: { type: 'varchar', nullable: true },
	organizationId: { type: 'varchar', nullable: true }
});

const text = { type: 'varchar', nullable: true };
const date = { type: 'datetime', nullable: true };
const json = { type: 'simple-json', nullable: true };
const count = { type: 'int', default: 0 };
const decimal = (options: Row = {}) => ({ type: 'decimal', precision: 20, scale: 6, nullable: true, ...options });

const schemas = [
	new EntitySchema<any>({
		name: 'WarehouseZone',
		target: WarehouseZone,
		tableName: 'warehouse_zone',
		columns: { ...(base() as any), name: text }
	}),
	new EntitySchema<any>({
		name: 'WarehouseBin',
		target: WarehouseBin,
		tableName: 'warehouse_bin',
		columns: { ...(base() as any), code: text }
	}),
	new EntitySchema<any>({
		name: 'PickWave',
		target: PickWave,
		tableName: 'pick_wave',
		columns: {
			...(base() as any),
			warehouseId: { type: 'varchar' },
			channelId: text,
			number: { type: 'varchar' },
			strategy: { type: 'varchar' },
			status: { type: 'varchar' },
			priority: count,
			pickerUserId: text,
			plannedAt: date,
			releasedAt: date,
			startedAt: date,
			completedAt: date,
			orderCount: count,
			lineCount: count,
			version: { type: 'int', default: 1 },
			metadata: json
		},
		// The wave's own read (`findOneDetailed`) answers it with its lists.
		relations: {
			pickLists: { type: 'one-to-many', target: 'PickList', inverseSide: 'wave' }
		}
	}),
	new EntitySchema<any>({
		name: 'PickList',
		target: PickList,
		tableName: 'pick_list',
		columns: {
			...(base() as any),
			waveId: text,
			warehouseId: { type: 'varchar' },
			zoneId: text,
			fulfillmentId: text,
			orderId: text,
			number: { type: 'varchar' },
			status: { type: 'varchar' },
			assignedToUserId: text,
			priority: count,
			lineCount: count,
			pickedCount: count,
			shortCount: count,
			startedAt: date,
			completedAt: date,
			note: text,
			version: { type: 'int', default: 1 },
			metadata: json
		},
		relations: {
			wave: { type: 'many-to-one', target: 'PickWave', joinColumn: { name: 'waveId' }, inverseSide: 'pickLists' },
			zone: { type: 'many-to-one', target: 'WarehouseZone', joinColumn: { name: 'zoneId' } }
		}
	}),
	new EntitySchema<any>({
		name: 'PickListLine',
		target: PickListLine,
		tableName: 'pick_list_line',
		columns: {
			...(base() as any),
			pickListId: { type: 'varchar' },
			orderLineId: text,
			fulfillmentLineId: text,
			variantId: { type: 'varchar' },
			binId: text,
			zoneId: text,
			quantityRequested: decimal({ nullable: false, default: 0 }),
			quantityPicked: decimal({ nullable: false, default: 0 }),
			quantityShort: decimal({ nullable: false, default: 0 }),
			status: { type: 'varchar' },
			substituteVariantId: text,
			substituteQuantity: decimal(),
			substitutionReason: text,
			packSlipId: text,
			position: count,
			pickedAt: date,
			pickedByUserId: text,
			lotNumber: text,
			expiryDate: date,
			serialNumbers: json,
			note: text,
			metadata: json
		},
		relations: {
			bin: {
				type: 'many-to-one',
				target: 'WarehouseBin',
				joinColumn: { name: 'binId' },
				createForeignKeyConstraints: false
			},
			zone: {
				type: 'many-to-one',
				target: 'WarehouseZone',
				joinColumn: { name: 'zoneId' },
				createForeignKeyConstraints: false
			}
		}
	}),
	new EntitySchema<any>({
		name: 'PackSlip',
		target: PackSlip,
		tableName: 'pack_slip',
		columns: {
			...(base() as any),
			warehouseId: { type: 'varchar' },
			pickListId: { type: 'varchar' },
			orderId: text,
			fulfillmentId: text,
			number: { type: 'varchar' },
			status: { type: 'varchar' },
			carrierKey: text,
			packageCount: { type: 'int', nullable: true },
			totalWeight: decimal(),
			totalVolume: decimal(),
			trackingNumber: text,
			labelUrl: text,
			packedAt: date,
			packedByUserId: text,
			note: text,
			version: { type: 'int', default: 1 },
			metadata: json
		}
	}),
	new EntitySchema<any>({
		name: 'CarrierManifest',
		target: CarrierManifest,
		tableName: 'carrier_manifest',
		columns: {
			...(base() as any),
			warehouseId: { type: 'varchar' },
			carrier: { type: 'varchar' },
			service: text,
			number: { type: 'varchar' },
			status: { type: 'varchar' },
			manifestDate: date,
			windowFrom: date,
			windowTo: date,
			shipmentCount: count,
			packageCount: count,
			totalWeight: decimal(),
			closedAt: date,
			handedOverAt: date,
			canceledAt: date,
			documentUrl: text,
			documentData: json,
			note: text,
			version: { type: 'int', default: 1 },
			metadata: json
		}
	})
];

/*
|--------------------------------------------------------------------------
| Harness
|--------------------------------------------------------------------------
*/

interface IHarness {
	dataSource: DataSource;
	lists: PickListService;
	lines: PickListLineService;
	waves: PickWaveService;
	slips: PackSlipService;
	manifests: CarrierManifestService;
	/** Every movement the services asked the stock ledger for. */
	movements: Row[];
	/**
	 * The platform outbox, recorded: each fact it was asked to append, and whether the manager it was handed was
	 * inside an open transaction. `failOn` names a fact it refuses, after the move that earned it was written.
	 */
	outbox: { appended: Row[]; failOn: string | null };
	row: (table: string, id: string) => Promise<Row | undefined>;
	set: (table: string, id: string, values: Row) => Promise<void>;
}

async function harness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: schemas,
		synchronize: true,
		logging: false
	});
	await dataSource.initialize();

	const insert = async (table: string, row: Row) => {
		const columns = Object.keys(row);
		await dataSource.query(
			`INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns
				.map(() => '?')
				.join(', ')})`,
			columns.map((column) =>
				row[column] !== null && typeof row[column] === 'object' ? JSON.stringify(row[column]) : row[column]
			)
		);
	};
	const scope = { tenantId: TENANT, organizationId: ORG };

	await insert('pick_wave', {
		id: WAVE,
		warehouseId: WAREHOUSE,
		number: 'WAVE-1',
		strategy: 'BATCH',
		status: PickWaveStatus.DRAFT,
		...scope
	});
	// A list of one line asking for five units of one variant from one bin, assigned and not yet picked from.
	await insert('pick_list', {
		id: LIST,
		warehouseId: WAREHOUSE,
		number: 'PICK-1',
		status: PickListStatus.ASSIGNED,
		assignedToUserId: USER,
		lineCount: 1,
		...scope
	});
	await insert('pick_list_line', {
		id: LINE,
		pickListId: LIST,
		variantId: VARIANT,
		binId: BIN,
		quantityRequested: '5',
		status: PickListLineStatus.PENDING,
		...scope
	});
	await insert('pack_slip', {
		id: SLIP,
		warehouseId: WAREHOUSE,
		pickListId: LIST,
		number: 'PACK-1',
		status: PackSlipStatus.OPEN,
		...scope
	});
	await insert('carrier_manifest', {
		id: MANIFEST,
		warehouseId: WAREHOUSE,
		carrier: 'ups',
		number: 'MAN-1',
		status: CarrierManifestStatus.DRAFT,
		metadata: { members: ['00000000-0000-4000-8000-00000000f001'] },
		...scope
	});

	const movements: Row[] = [];
	const ledger = {
		recordMovement: async (request: Row) => {
			movements.push(request);

			return { id: `movement-${movements.length}` };
		}
	} as unknown as IWarehouseStockLedgerPort;

	const outbox: IHarness['outbox'] = { appended: [], failOn: null };
	const outboxService = {
		append: async (manager: any, event: Row) => {
			if (event.name === outbox.failOn) {
				throw new Error('the outbox is unavailable');
			}

			outbox.appended.push({
				...event,
				inTransaction: Boolean(manager?.queryRunner?.isTransactionActive),
				// What the list's lines look like from inside the transaction the fact is appended in.
				lineStatuses: (
					await manager.query('SELECT "status" FROM "pick_list_line" WHERE "pickListId" = ?', [event.aggregateId])
				).map((row: Row) => row.status)
			});

			return event;
		}
	};

	const repository = (entity: unknown) => dataSource.getRepository(entity as any) as any;
	const lines = new PickListLineService(
		repository(PickListLine),
		undefined as any,
		repository(PickList),
		outboxService as any,
		ledger
	);
	const waves = new PickWaveService(
		repository(PickWave),
		undefined as any,
		repository(PickList),
		repository(PickListLine),
		undefined as any,
		lines,
		outboxService as any
	);
	const lists = new PickListService(
		repository(PickList),
		undefined as any,
		lines,
		waves,
		undefined as any,
		undefined as any,
		undefined as any,
		repository(PickWave),
		outboxService as any,
		undefined,
		ledger
	);

	return {
		dataSource,
		lists,
		lines,
		waves,
		slips: new PackSlipService(repository(PackSlip), undefined as any, lists, lines, undefined as any),
		manifests: new CarrierManifestService(repository(CarrierManifest), undefined as any, undefined as any),
		movements,
		outbox,
		row: async (table, id) => (await dataSource.query(`SELECT * FROM "${table}" WHERE "id" = ?`, [id]))[0],
		set: async (table, id, values) => {
			const columns = Object.keys(values);
			await dataSource.query(
				`UPDATE "${table}" SET ${columns.map((column) => `"${column}" = ?`).join(', ')} WHERE "id" = ?`,
				[...columns.map((column) => values[column]), id]
			);
		}
	};
}

/** An instant as SQLite holds it: TypeORM writes a `datetime` as UTC text without a zone. */
const instant = (stored: unknown): number => new Date(`${String(stored).replace(' ', 'T')}Z`).getTime();

/** The refusal every guarded edit answers with, naming the members it refused. */
const refused = (code: string, fields: string[]) => ({
	status: 400,
	response: { code, details: expect.objectContaining({ fields }) }
});

describe('a generic edit cannot move what a warehouse document’s operations move (R2-13, DB-backed)', () => {
	let h: IHarness;

	beforeEach(async () => {
		h = await harness();
		mockCaller.tenantId = TENANT;
		mockCaller.organizationId = ORG;
	});

	afterEach(async () => {
		mockCaller.tenantId = null;
		mockCaller.organizationId = null;
		await h.dataSource.destroy();
	});

	describe('pick list lines', () => {
		it('refuses to put a SHORT line back to PENDING, so its shortfall cannot be written twice', async () => {
			await h.lines.recordPick(LINE, { pickedQuantity: '3' } as any);
			expect(h.movements).toHaveLength(1);

			await expect(h.lines.update(LINE, { status: PickListLineStatus.PENDING } as any)).rejects.toMatchObject(
				refused('PICK_LIST_LINE_FIELD_NOT_WRITABLE', ['status'])
			);
			await expect(h.lines.recordPick(LINE, { pickedQuantity: '3' } as any)).rejects.toBeDefined();

			expect((await h.row('pick_list_line', LINE))?.status).toBe(PickListLineStatus.SHORT);
			expect(h.movements).toHaveLength(1);
		});

		it('refuses the outcome, the quantities and the position of a line', async () => {
			for (const [member, value] of [
				['quantityPicked', '5'],
				['quantityShort', '2'],
				['quantityRequested', '50'],
				['binId', '00000000-0000-4000-8000-0000000001b2'],
				['packSlipId', SLIP],
				['pickedAt', new Date().toISOString()]
			] as const) {
				await expect(h.lines.update(LINE, { [member]: value } as any)).rejects.toMatchObject(
					refused('PICK_LIST_LINE_FIELD_NOT_WRITABLE', [member])
				);
			}

			const line = await h.row('pick_list_line', LINE);
			expect([line?.status, Number(line?.quantityPicked), line?.binId, line?.packSlipId]).toEqual([
				PickListLineStatus.PENDING,
				0,
				BIN,
				null
			]);
		});

		it('control: a note is written, and a body that restates the stored outcome is accepted', async () => {
			await h.lines.update(LINE, {
				note: 'top shelf',
				status: PickListLineStatus.PENDING,
				quantityRequested: '5'
			} as any);

			const line = await h.row('pick_list_line', LINE);
			expect([line?.note, line?.status]).toEqual(['top shelf', PickListLineStatus.PENDING]);
		});
	});

	describe('pick lists', () => {
		it('refuses to complete a list nobody picked, or to move its counters, timestamps or version', async () => {
			for (const [member, value] of [
				['status', PickListStatus.PICKED],
				['pickedCount', 1],
				['completedAt', new Date().toISOString()],
				['version', 7],
				['warehouseId', '00000000-0000-4000-8000-0000000001a2']
			] as const) {
				await expect(h.lists.update(LIST, { [member]: value } as any)).rejects.toMatchObject(
					refused('PICK_LIST_FIELD_NOT_WRITABLE', [member])
				);
			}

			const list = await h.row('pick_list', LIST);
			expect([list?.status, list?.pickedCount, list?.completedAt, list?.version]).toEqual([
				PickListStatus.ASSIGNED,
				0,
				null,
				1
			]);
		});

		it('refuses an edit that selects lists by anything but an id', async () => {
			await expect(
				h.lists.update({ warehouseId: WAREHOUSE } as any, { note: 'all of them' } as any)
			).rejects.toMatchObject({
				status: 400,
				response: { code: 'PICK_LIST_FIELD_NOT_WRITABLE' }
			});
		});

		it('control: the assignee, the priority and the note are written, and cancelling still cancels the open lines', async () => {
			const other = '00000000-0000-4000-8000-0000000009a2';
			await h.lists.update(LIST, {
				assignedToUserId: other,
				priority: 3,
				note: 'rush',
				status: PickListStatus.ASSIGNED
			} as any);

			const list = await h.row('pick_list', LIST);
			expect([list?.assignedToUserId, list?.priority, list?.note]).toEqual([other, 3, 'rush']);

			await h.lists.cancel(LIST, 'changed plan');
			expect((await h.row('pick_list', LIST))?.status).toBe(PickListStatus.CANCELED);
			expect((await h.row('pick_list_line', LINE))?.status).toBe(PickListLineStatus.CANCELED);
		});
	});

	describe('a pick list move and the fact it announces commit together (pickListChanged)', () => {
		/** A second open line on the list, asking for five units from the same bin. */
		const insertLine = async (id: string) =>
			await h.dataSource.query(
				'INSERT INTO "pick_list_line" ("id", "pickListId", "variantId", "binId", "quantityRequested", "status", "tenantId", "organizationId") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
				[id, LIST, VARIANT, BIN, '5', PickListLineStatus.PENDING, TENANT, ORG]
			);

		it('appends the fact through the transaction that writes the move', async () => {
			await h.lists.start(LIST);

			expect((await h.row('pick_list', LIST))?.status).toBe(PickListStatus.IN_PROGRESS);
			expect(h.outbox.appended.map((event) => [event.name, event.aggregateId, event.inTransaction])).toEqual([
				['pick_list.started', LIST, true]
			]);
			expect(h.outbox.appended[0]).toMatchObject({ tenantId: TENANT, organizationId: ORG, aggregateType: 'PICK_LIST' });
		});

		it('rolls the move back when its fact cannot be appended', async () => {
			h.outbox.failOn = 'pick_list.started';

			await expect(h.lists.start(LIST)).rejects.toThrow(/outbox is unavailable/);

			const list = await h.row('pick_list', LIST);
			expect([list?.status, list?.startedAt, list?.version]).toEqual([PickListStatus.ASSIGNED, null, 1]);
			expect(h.outbox.appended).toEqual([]);
		});

		it('announces nothing for a move that did not happen: a list another call moved meanwhile is refused', async () => {
			// The list was read ASSIGNED and is CANCELED by the time the move's statement runs: the statement is
			// predicated on the status the operation read, so it changes no row, and the fact is never appended.
			const read = await h.lists.findOneScoped(LIST);
			await h.set('pick_list', LIST, { status: PickListStatus.CANCELED });

			await expect(
				(h.lists as any).move(read, 'pick_list.started', { status: PickListStatus.IN_PROGRESS })
			).rejects.toMatchObject({ status: 409, response: { code: 'PICK_LIST_EDIT_CONFLICT' } });

			expect((await h.row('pick_list', LIST))?.status).toBe(PickListStatus.CANCELED);
			expect(h.outbox.appended).toEqual([]);
		});

		it('control: a cancellation is written and announced once', async () => {
			await h.lists.cancel(LIST, 'changed plan');

			expect((await h.row('pick_list', LIST))?.status).toBe(PickListStatus.CANCELED);
			expect(h.outbox.appended.map((event) => event.name)).toEqual(['pick_list.canceled']);
		});

		it('cancels the list’s open lines in the transaction that writes the cancellation and appends its fact', async () => {
			await h.lists.cancel(LIST, 'changed plan');

			// From inside the transaction the fact is appended in, the lines are already withdrawn: a consumer is never
			// handed a CANCELED list whose lines are still open.
			expect(h.outbox.appended.map((event) => [event.name, event.inTransaction, event.lineStatuses])).toEqual([
				['pick_list.canceled', true, [PickListLineStatus.CANCELED]]
			]);
			expect((await h.row('pick_list_line', LINE))?.status).toBe(PickListLineStatus.CANCELED);
		});

		it('rolls the cancellation and its fact back when a line cannot be withdrawn', async () => {
			jest.spyOn(h.lines, 'cancelOpenLine').mockRejectedValue(new Error('the line could not be written'));

			await expect(h.lists.cancel(LIST, 'changed plan')).rejects.toThrow(/the line could not be written/);

			const list = await h.row('pick_list', LIST);
			expect([list?.status, list?.version]).toEqual([PickListStatus.ASSIGNED, 1]);
			expect((await h.row('pick_list_line', LINE))?.status).toBe(PickListLineStatus.PENDING);
			expect(h.outbox.appended).toEqual([]);
		});

		it('refuses a move from a read whose version moved on, though the status did not', async () => {
			const read = await h.lists.findOneScoped(LIST);
			// Another transition took the version the move read (the status it reached is the same one).
			await h.set('pick_list', LIST, { version: 5 });

			await expect(
				(h.lists as any).move(read, 'pick_list.started', {
					status: PickListStatus.IN_PROGRESS,
					version: (read.version ?? 1) + 1
				})
			).rejects.toMatchObject({ status: 409, response: { code: 'PICK_LIST_EDIT_CONFLICT' } });

			const list = await h.row('pick_list', LIST);
			expect([list?.status, list?.version]).toEqual([PickListStatus.ASSIGNED, 5]);
			expect(h.outbox.appended).toEqual([]);
		});

		it('two moves from one read: the second is refused, and one fact is appended', async () => {
			const read = await h.lists.findOneScoped(LIST);
			const startFrom = (from: unknown) =>
				(h.lists as any).move(from, 'pick_list.started', {
					status: PickListStatus.IN_PROGRESS,
					version: (read.version ?? 1) + 1
				});

			await startFrom(read);
			await expect(startFrom(read)).rejects.toMatchObject({ status: 409, response: { code: 'PICK_LIST_EDIT_CONFLICT' } });

			expect(h.outbox.appended.map((event) => event.name)).toEqual(['pick_list.started']);
		});

		it('announces a created list with the version create() answers, not the one it had before its caches were written', async () => {
			const facts: Row[] = [];
			const lists = new PickListService(
				h.dataSource.getRepository(PickList) as any,
				undefined as any,
				h.lines,
				h.waves,
				undefined as any,
				undefined as any,
				{ allocate: async () => ({ formatted: 'PICK-9' }) } as any,
				h.dataSource.getRepository(PickWave) as any,
				{ append: async (_manager: unknown, event: Row) => facts.push(event) } as any,
				undefined,
				undefined
			);

			const created = await lists.create({ warehouseId: WAREHOUSE } as any);
			const stored = await h.row('pick_list', created.id);

			expect(facts.map((event) => [event.name, event.data.version])).toEqual([['pick_list.created', created.version]]);
			expect(created.version).toBe(stored?.version);
		});

		it('the first pick announces pick_list.started once, with the version it stored', async () => {
			await insertLine(LINE_2);

			await h.lines.recordPick(LINE, { pickedQuantity: '5' } as any);
			await h.lines.recordPick(LINE_2, { pickedQuantity: '5' } as any);

			const list = await h.row('pick_list', LIST);
			expect([list?.status, list?.version, list?.pickedCount]).toEqual([PickListStatus.IN_PROGRESS, 2, 2]);
			expect(h.outbox.appended.map((event) => [event.name, event.aggregateId, event.inTransaction, event.data.version])).toEqual([
				['pick_list.started', LIST, true, 2]
			]);
		});

		it('two concurrent first picks announce once and both picks are recorded', async () => {
			await insertLine(LINE_2);
			// The second pick read the list before the first pick's promotion committed: it holds ASSIGNED at version 1.
			const staleRead = await h.dataSource.getRepository(PickList).findOne({ where: { id: LIST } });

			await h.lines.recordPick(LINE, { pickedQuantity: '5' } as any);
			jest.spyOn(h.dataSource.getRepository(PickList), 'findOne').mockResolvedValueOnce(staleRead as any);
			await expect(h.lines.recordPick(LINE_2, { pickedQuantity: '5' } as any)).resolves.toMatchObject({
				status: PickListLineStatus.PICKED
			});

			const list = await h.row('pick_list', LIST);
			expect([list?.status, list?.version, list?.pickedCount]).toEqual([PickListStatus.IN_PROGRESS, 2, 2]);
			expect([(await h.row('pick_list_line', LINE))?.status, (await h.row('pick_list_line', LINE_2))?.status]).toEqual([
				PickListLineStatus.PICKED,
				PickListLineStatus.PICKED
			]);
			expect(h.outbox.appended.map((event) => event.name)).toEqual(['pick_list.started']);
		});

		it('a counter refresh that moves no status announces nothing and keeps the version', async () => {
			await h.set('pick_list', LIST, { status: PickListStatus.IN_PROGRESS });

			await h.lines.recordPick(LINE, { pickedQuantity: '5' } as any);

			const list = await h.row('pick_list', LIST);
			expect([list?.status, list?.version, list?.pickedCount]).toEqual([PickListStatus.IN_PROGRESS, 1, 1]);
			expect(h.outbox.appended).toEqual([]);
		});

		it('cancelling a wave cancels its open lists’ lines and announces each list', async () => {
			await h.set('pick_list', LIST, { waveId: WAVE });

			await h.waves.cancel(WAVE, 'no longer needed');

			const list = await h.row('pick_list', LIST);
			expect([list?.status, list?.version]).toEqual([PickListStatus.CANCELED, 2]);
			expect((await h.row('pick_list_line', LINE))?.status).toBe(PickListLineStatus.CANCELED);
			expect(h.outbox.appended.map((event) => [event.name, event.aggregateId, event.inTransaction, event.lineStatuses])).toEqual([
				['pick_list.canceled', LIST, true, [PickListLineStatus.CANCELED]]
			]);
		});

		it('closing a wave short withdraws only what was never picked, so no CANCELED list keeps an open line', async () => {
			await h.set('pick_list', LIST, { waveId: WAVE });
			await insertLine(LINE_2);
			await h.lines.recordPick(LINE, { pickedQuantity: '5' } as any);

			await h.waves.closeShort(WAVE, 'the shift ended');

			expect((await h.row('pick_list', LIST))?.status).toBe(PickListStatus.CANCELED);
			expect([(await h.row('pick_list_line', LINE))?.status, (await h.row('pick_list_line', LINE_2))?.status]).toEqual([
				PickListLineStatus.PICKED,
				PickListLineStatus.CANCELED
			]);
			expect(h.outbox.appended.map((event) => [event.name, event.lineStatuses])).toEqual([
				['pick_list.started', [PickListLineStatus.PICKED, PickListLineStatus.PENDING]],
				['pick_list.canceled', [PickListLineStatus.PICKED, PickListLineStatus.CANCELED]]
			]);
		});

		it('a wave’s list whose open line cannot be withdrawn keeps its status, its lines and announces nothing', async () => {
			await h.set('pick_list', LIST, { waveId: WAVE });
			jest.spyOn(h.lines, 'cancelOpenLine').mockRejectedValue(new Error('the line could not be written'));

			await expect(h.waves.cancel(WAVE, 'no longer needed')).rejects.toThrow(/the line could not be written/);

			const list = await h.row('pick_list', LIST);
			expect([list?.status, list?.version]).toEqual([PickListStatus.ASSIGNED, 1]);
			expect((await h.row('pick_list_line', LINE))?.status).toBe(PickListLineStatus.PENDING);
			expect(h.outbox.appended).toEqual([]);
		});

		it('announces the version the move stored', async () => {
			await h.lists.start(LIST);

			const stored = await h.row('pick_list', LIST);
			expect(h.outbox.appended.map((event) => event.data.version)).toEqual([stored?.version]);
			expect(stored?.version).toBe(2);
		});
	});

	describe('pick waves', () => {
		it('accepts an echoed metadata object whose keys come back in another order, and writes the rest of the edit', async () => {
			await h.set('pick_wave', WAVE, { metadata: JSON.stringify({ cancelReason: 'none', closedShort: false }) });

			await h.waves.update(WAVE, { metadata: { closedShort: false, cancelReason: 'none' }, priority: 5 } as any);

			const wave = await h.row('pick_wave', WAVE);
			expect([wave?.priority, JSON.parse(wave?.metadata)]).toEqual([
				5,
				{ cancelReason: 'none', closedShort: false }
			]);
		});

		it('refuses to release a wave by edit, or to move its counters and its server-written metadata', async () => {
			for (const [member, value] of [
				['status', PickWaveStatus.RELEASED],
				['releasedAt', new Date().toISOString()],
				['orderCount', 4],
				['metadata', { cancelReason: 'rewritten' }]
			] as const) {
				await expect(h.waves.update(WAVE, { [member]: value } as any)).rejects.toMatchObject(
					refused('PICK_WAVE_FIELD_NOT_WRITABLE', [member])
				);
			}

			expect((await h.row('pick_wave', WAVE))?.status).toBe(PickWaveStatus.DRAFT);
		});

		it('refuses to change what a released wave contains', async () => {
			await h.set('pick_wave', WAVE, { status: PickWaveStatus.RELEASED });

			await expect(h.waves.update(WAVE, { strategy: 'ZONE' } as any)).rejects.toMatchObject(
				refused('PICK_WAVE_FIELD_NOT_WRITABLE', ['strategy'])
			);
			expect((await h.row('pick_wave', WAVE))?.strategy).toBe('BATCH');
		});

		it('control: a draft wave takes a new priority, plan, picker and strategy', async () => {
			const plannedAt = new Date('2026-10-15T08:00:00.000Z');
			await h.waves.update(WAVE, { priority: 2, plannedAt, pickerUserId: USER, strategy: 'ZONE' } as any);

			const wave = await h.row('pick_wave', WAVE);
			expect([wave?.priority, instant(wave?.plannedAt), wave?.pickerUserId, wave?.strategy]).toEqual([
				2,
				plannedAt.getTime(),
				USER,
				'ZONE'
			]);
		});
	});

	describe('pack slips', () => {
		it('refuses an edit checked against an OPEN slip that was packed before the edit wrote', async () => {
			// The check read the slip OPEN; `pack` sealed it before the write. The write is predicated on the status the
			// check read, so it lands on nothing and the edit is refused instead of rewriting the sealed slip.
			const open = await h.slips.findOneScoped(SLIP);
			await h.set('pack_slip', SLIP, { status: PackSlipStatus.PACKED, packageCount: 1 });
			jest.spyOn(h.slips, 'findOneScoped').mockResolvedValueOnce(open);

			await expect(h.slips.update(SLIP, { packageCount: 4 } as any)).rejects.toMatchObject({
				status: 409,
				response: { code: 'PACK_SLIP_EDIT_CONFLICT' }
			});
			expect((await h.row('pack_slip', SLIP))?.packageCount).toBe(1);
		});

		it('refuses to mark a slip PACKED by edit, or to state its tracking number past the uniqueness check', async () => {
			for (const [member, value] of [
				['status', PackSlipStatus.PACKED],
				['trackingNumber', '1Z999'],
				['packedAt', new Date().toISOString()]
			] as const) {
				await expect(h.slips.update(SLIP, { [member]: value } as any)).rejects.toMatchObject(
					refused('PACK_SLIP_FIELD_NOT_WRITABLE', [member])
				);
			}

			const slip = await h.row('pack_slip', SLIP);
			expect([slip?.status, slip?.trackingNumber]).toEqual([PackSlipStatus.OPEN, null]);
		});

		it('refuses any edit of a PACKED slip, which is immutable', async () => {
			await h.set('pack_slip', SLIP, { status: PackSlipStatus.PACKED });

			await expect(h.slips.update(SLIP, { note: 'late edit' } as any)).rejects.toMatchObject(
				refused('PACK_SLIP_FIELD_NOT_WRITABLE', ['note'])
			);
		});

		it('control: an open slip takes its package count, weight and note', async () => {
			await h.slips.update(SLIP, { packageCount: 2, totalWeight: '3.5', note: 'fragile' } as any);

			const slip = await h.row('pack_slip', SLIP);
			expect([slip?.packageCount, Number(slip?.totalWeight), slip?.note]).toEqual([2, 3.5, 'fragile']);
		});
	});

	describe('carrier manifests', () => {
		it('refuses to hand a manifest over by edit, or to rewrite its counters and its frozen membership', async () => {
			for (const [member, value] of [
				['status', CarrierManifestStatus.HANDED_OVER],
				['handedOverAt', new Date().toISOString()],
				['shipmentCount', 9],
				['metadata', { members: [] }]
			] as const) {
				await expect(h.manifests.update(MANIFEST, { [member]: value } as any)).rejects.toMatchObject(
					refused('CARRIER_MANIFEST_FIELD_NOT_WRITABLE', [member])
				);
			}

			const manifest = await h.row('carrier_manifest', MANIFEST);
			expect([manifest?.status, JSON.parse(manifest?.metadata)]).toEqual([
				CarrierManifestStatus.DRAFT,
				{ members: ['00000000-0000-4000-8000-00000000f001'] }
			]);
		});

		it('refuses to move the window of a manifest that is no longer a draft', async () => {
			await h.set('carrier_manifest', MANIFEST, { status: CarrierManifestStatus.CLOSED });

			await expect(
				h.manifests.update(MANIFEST, { windowTo: new Date().toISOString() } as any)
			).rejects.toMatchObject(refused('CARRIER_MANIFEST_FIELD_NOT_WRITABLE', ['windowTo']));
		});

		it('control: a draft manifest takes its window, its day and a note', async () => {
			const windowFrom = new Date('2026-10-15T14:00:00.000Z');
			const windowTo = new Date('2026-10-15T16:00:00.000Z');
			await h.manifests.update(MANIFEST, {
				windowFrom,
				windowTo,
				note: 'dock 2',
				status: CarrierManifestStatus.DRAFT
			} as any);

			const manifest = await h.row('carrier_manifest', MANIFEST);
			expect([instant(manifest?.windowFrom), instant(manifest?.windowTo), manifest?.note]).toEqual([
				windowFrom.getTime(),
				windowTo.getTime(),
				'dock 2'
			]);
		});
	});
});

import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Conditional time entry edits (ever-co/ever-teams#5382), on both ORMs, over one database whose tables TypeORM created.
 *
 * An edit (`PUT /timesheet/time-log/:id`) is saved under the `updatedAt` the caller read (`expectedUpdatedAt`): the
 * entry is locked and compared in the write's own transaction, and a write saved meanwhile refuses the edit with 409,
 * nothing written, the 409 carrying the entry as it is now. Without the precondition the edit is saved as before.
 *
 * Every write that changes an entry moves its `updatedAt` past what it held, so the precondition sees it: the edit
 * itself, and the invoice lines that bill the entry, keep its time, or let it go when they are deleted.
 *
 * The edit's write runs through TypeORM on both ORMs (`TimeLogUpdateHandler`); what differs per ORM is the read of the
 * version the caller sends back (the CRUD base's), the handler's reads of the time slots, and the invoice lines' writes.
 * SQLite locks no rows, so a write "meanwhile" is one that lands between the caller's read and its save: the comparison
 * is what is under test here, the row lock being PostgreSQL's and MySQL's (see `lockedForChange`).
 */

const TIMEOUT = 15 * 60 * 1000;

type Row = Record<string, any>;
type Orm = 'typeorm' | 'mikro-orm';

const ORMS: Orm[] = ['typeorm', 'mikro-orm'];

const TENANT = '53820000-0000-4000-8000-00000000a001';
const ORG = '53820000-0000-4000-8000-00000000b001';
const USER = '53820000-0000-4000-8000-00000000c001';
const EMPLOYEE = '53820000-0000-4000-8000-00000000d001';
const TIMESHEET = '53820000-0000-4000-8000-00000000e001';

const scope = { tenantId: TENANT, organizationId: ORG };

/** The entry's range: 2026-10-05, 09:00 to 10:00 UTC. */
const STARTED_AT = new Date('2026-10-05T09:00:00.000Z');
const STOPPED_AT = new Date('2026-10-05T10:00:00.000Z');

/** The `updatedAt` an entry was last written at, in the form TypeORM writes on SQLite. */
const WRITTEN = '2026-11-01 09:00:00.000';

/** A later `updatedAt` than any the cases read, in the form TypeORM writes on SQLite. */
const MEANWHILE = '2030-01-01 12:00:00.000';

/** An `updatedAt` the clock has not reached, in the form TypeORM writes on SQLite, and as the API answers it. */
const FUTURE = '2099-01-01 00:00:00.000';
const FUTURE_INSTANT = new Date('2099-01-01T00:00:00.000Z');

describe('Time entry edits under a precondition, on TypeORM and on MikroORM (#5382)', () => {
	const file = path.join(os.tmpdir(), `gauzy-time-log-conditional-${process.pid}-${Date.now()}.sqlite3`);

	let loaded: Row = {};
	let dataSource: any;
	let orm: any;
	let invoiceNumber = 0;

	/** A row with the columns given, and a placeholder in every other NOT NULL column without a default. */
	const insert = async (table: string, row: Row): Promise<void> => {
		const columns: Row[] = await dataSource.query(`PRAGMA table_info("${table}")`);
		const values: Row = { ...row };
		for (const column of columns) {
			const isGiven = column.name in values;
			const takesNoPlaceholder = !column.notnull || column.dflt_value !== null || column.pk;
			if (isGiven || takesNoPlaceholder) continue;
			values[column.name] = placeholderFor(String(column.type));
		}
		const keys = Object.keys(values);
		const names = keys.map((key) => `"${key}"`).join(', ');
		const marks = keys.map(() => '?').join(', ');
		await dataSource.query(
			`INSERT INTO "${table}" (${names}) VALUES (${marks})`,
			keys.map((key) => values[key])
		);
	};

	/** A stopped entry of the employee, last written at `updatedAt`. */
	const entry = async (row: Row = {}): Promise<string> => {
		const id = randomUUID();
		await insert('time_log', {
			id,
			...scope,
			employeeId: EMPLOYEE,
			timesheetId: TIMESHEET,
			source: 'DESKTOP',
			logType: 'TRACKED',
			startedAt: '2026-10-05 09:00:00.000',
			stoppedAt: '2026-10-05 10:00:00.000',
			isRunning: 0,
			isBillable: 0,
			description: 'as read',
			updatedAt: WRITTEN,
			...row
		});
		return id;
	};

	/**
	 * The `updatedAt` the API answers a read of the entry with, as a client sends it back: read through the CRUD base
	 * on the ORM named, as `TimeLogService.findOneByIdString` and the lists read it.
	 */
	const readVersion = async (ormType: Orm, timeLogId: string): Promise<string> => {
		const reader = new loaded.TimeLogReader(
			new loaded.TypeOrmTimeLogRepository(dataSource.getRepository(loaded.TimeLog)),
			new loaded.MikroOrmTimeLogRepository(orm.em.fork(), loaded.TimeLog)
		);
		Object.defineProperty(reader, 'ormType', { get: () => ormType });
		const timeLog = await reader.findOneByIdString(timeLogId);
		return new Date(timeLog.updatedAt).toISOString();
	};

	/** The edit's handler on the ORM named, with what the module graph would hand it, and the slots it gave out. */
	const editHandler = (ormType: Orm) => {
		const timeSlotRepository = dataSource.getRepository(loaded.TimeSlot);
		const typeOrmTimeSlotRepository = new loaded.TypeOrmTimeSlotRepository(timeSlotRepository);
		const mikroOrmTimeSlotRepository = new loaded.MikroOrmTimeSlotRepository(orm.em.fork(), loaded.TimeSlot);
		const ormEnum = ormType === 'mikro-orm' ? loaded.MultiORMEnum.MikroORM : loaded.MultiORMEnum.TypeORM;
		const slotDelete = new loaded.TimeSlotBulkDeleteHandler(typeOrmTimeSlotRepository, mikroOrmTimeSlotRepository);
		slotDelete.ormType = ormEnum;
		const commandBus = {
			execute: async (command: unknown) => {
				if (command instanceof loaded.TimesheetFirstOrCreateCommand) return { id: TIMESHEET };
				if (command instanceof loaded.TimeSlotBulkDeleteCommand) return slotDelete.execute(command);
				return undefined;
			}
		};
		// The slot insert: the slots missing at the starts asked, saved linked to the entry; it answers every slot of
		// the employee at those starts, as the merge does.
		const timeSlotService = {
			generateTimeSlots: loaded.generateTimeSlots,
			bulkCreate: async (requested: Array<{ startedAt: Date; timeLogId: string }>) => {
				const minuteOf = (slot: { startedAt: Date }) => new Date(slot.startedAt).toISOString().slice(0, 16);
				const all = await timeSlotRepository.find({ where: { employeeId: EMPLOYEE } });
				const existing = new Set(all.map(minuteOf));
				const missing = requested.filter((slot) => !existing.has(minuteOf(slot)));
				await timeSlotRepository.save(
					missing.map((slot) =>
						timeSlotRepository.create({
							...scope,
							employeeId: EMPLOYEE,
							id: randomUUID(),
							startedAt: new Date(slot.startedAt),
							duration: 600,
							keyboard: 0,
							mouse: 0,
							overall: 0,
							timeLogs: [{ id: slot.timeLogId }]
						})
					)
				);
				const starts = new Set(requested.map(minuteOf));
				const now = await timeSlotRepository.find({ where: { employeeId: EMPLOYEE } });
				return now.filter((slot: { startedAt: Date }) => starts.has(minuteOf(slot)));
			}
		};
		const handler = new loaded.TimeLogUpdateHandler(
			commandBus,
			new loaded.TypeOrmTimeLogRepository(dataSource.getRepository(loaded.TimeLog)),
			typeOrmTimeSlotRepository,
			mikroOrmTimeSlotRepository,
			timeSlotService,
			dataSource
		);
		handler.ormType = ormEnum;
		return handler;
	};

	/** An edit as `PUT /timesheet/time-log/:id` makes it: the body, with the history of a change made by a person. */
	const edit = (ormType: Orm, timeLogId: string, body: Row) =>
		editHandler(ormType).execute(
			new loaded.TimeLogUpdateCommand(
				{
					startedAt: STARTED_AT,
					stoppedAt: STOPPED_AT,
					employeeId: EMPLOYEE,
					...scope,
					editedAt: new Date(),
					...body
				},
				timeLogId,
				undefined,
				false,
				{ reason: null }
			)
		);

	/** Another request's change of the entry, saved between the caller's read and its save. */
	const changedMeanwhile = async (timeLogId: string): Promise<void> => {
		await dataSource.query(`UPDATE "time_log" SET "description" = ?, "updatedAt" = ? WHERE "id" = ?`, [
			'meanwhile',
			MEANWHILE,
			timeLogId
		]);
	};

	const stateOf = async (
		timeLogId: string
	): Promise<{ description: string; isBillable: boolean; updatedAt: Date }> => {
		const [row] = await dataSource.query(
			`SELECT "description", "isBillable", "updatedAt" FROM "time_log" WHERE "id" = ?`,
			[timeLogId]
		);
		return {
			description: row.description,
			isBillable: Boolean(row.isBillable),
			updatedAt: storedInstant(row.updatedAt)
		};
	};

	const updatedAtOf = async (timeLogId: string): Promise<Date> => (await stateOf(timeLogId)).updatedAt;

	const linkOf = async (timeLogId: string): Promise<string | null> => {
		const [row] = await dataSource.query(`SELECT "invoiceItemId" FROM "time_log" WHERE "id" = ?`, [timeLogId]);
		return row.invoiceItemId;
	};

	const historyCountOf = async (timeLogId: string): Promise<number> => {
		const [row] = await dataSource.query(`SELECT COUNT(*) AS "count" FROM "activity_log" WHERE "entityId" = ?`, [
			timeLogId
		]);
		return Number(row.count);
	};

	const slotCountOf = async (timeLogId: string): Promise<number> => {
		const [row] = await dataSource.query(
			`SELECT COUNT(*) AS "count" FROM "time_slot_time_logs" WHERE "timeLogId" = ?`,
			[timeLogId]
		);
		return Number(row.count);
	};

	/** The refusal of a save made on a stale read: 409, the entry as it is now, and both instants. */
	const expectChangedMeanwhile = async (save: Promise<unknown>, timeLogId: string, expected: string) => {
		const error: any = await save.then(
			() => null,
			(refusal) => refusal
		);
		expect(error).toBeInstanceOf(loaded.ApiException);
		expect(error.getStatus()).toBe(409);
		expect(error.code).toBe('CONCURRENT_MODIFICATION');
		expect(error.message).toMatch(/^TIME_LOG_CHANGED/);
		expect(error.details.expectedUpdatedAt).toBe(expected);
		expect(error.details.timeLog.id).toBe(timeLogId);
		const current = await stateOf(timeLogId);
		expect(error.details.actualUpdatedAt).toBe(current.updatedAt.toISOString());
		expect(error.details.timeLog.description).toBe(current.description);
	};

	/** The invoice line routes' service, on the ORM named. */
	const lines = (ormType: Orm) => {
		const service = new loaded.InvoiceItemService(
			new loaded.TypeOrmInvoiceItemRepository(dataSource.getRepository(loaded.InvoiceItem)),
			new loaded.MikroOrmInvoiceItemRepository(orm.em, loaded.InvoiceItem)
		);
		Object.defineProperty(service, 'ormType', { get: () => ormType });
		return service;
	};

	const draftInvoice = async (): Promise<string> => {
		invoiceNumber += 1;
		const invoiceId = randomUUID();
		await insert('invoice', {
			id: invoiceId,
			...scope,
			fromOrganizationId: ORG,
			invoiceNumber,
			currency: 'EUR',
			discountValue: 0,
			terms: 'draft',
			status: 'DRAFT'
		});
		return invoiceId;
	};

	/** A line as the web sends it; with `timeLogIds`, billing them. */
	const line = (invoiceId: string, description: string, timeLogIds?: string[]): Row => ({
		description,
		price: 50,
		quantity: 1,
		totalValue: 50,
		...scope,
		invoiceId,
		...(timeLogIds ? { timeLogIds } : {})
	});

	const lineIdOf = async (invoiceId: string, description: string): Promise<string> => {
		const [row] = await dataSource.query(
			`SELECT "id" FROM "invoice_item" WHERE "invoiceId" = ? AND "description" = ?`,
			[invoiceId, description]
		);
		return row?.id;
	};

	beforeAll(async () => {
		const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
		process.env.DB_ORM = 'mikro-orm';
		process.env.DB_TYPE = 'better-sqlite3';

		try {
			await jest.isolateModulesAsync(async () => {
				require('@mikro-orm/core').MetadataStorage.clear();

				// Must be first: loads the entity graph before a service pulls an entity.
				const entities = require('../../core/entities/internal');

				const { coreEntities } = require('../../core/entities');
				const { DataSource } = require('typeorm');
				const { MikroORM } = require('@mikro-orm/core');
				const { dbMikroOrmConnectionConfig, TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } = require('@gauzy/config');
				const { TenantAwareCrudService } = require('../../core/crud');

				/** The CRUD base's read, as `TimeLogService` inherits it. */
				class TimeLogReader extends TenantAwareCrudService {}

				loaded = {
					TimeLog: entities.TimeLog,
					TimeSlot: entities.TimeSlot,
					InvoiceItem: entities.InvoiceItem,
					TimeLogReader,
					PermissionsEnum: require('@gauzy/contracts').PermissionsEnum,
					RequestContext: require('../../core/context/request-context').RequestContext,
					ApiException: require('../../core/errors/api-exception').ApiException,
					MultiORMEnum: require('../../core/utils').MultiORMEnum,
					generateTimeSlots: require('../time-slot/utils').generateTimeSlots,
					TimesheetFirstOrCreateCommand: require('../timesheet/commands').TimesheetFirstOrCreateCommand,
					TimeSlotBulkDeleteCommand: require('../time-slot/commands').TimeSlotBulkDeleteCommand,
					TimeSlotBulkDeleteHandler: require('../time-slot/commands/handlers/time-slot-bulk-delete.handler')
						.TimeSlotBulkDeleteHandler,
					TypeOrmTimeSlotRepository: require('../time-slot/repository/type-orm-time-slot.repository')
						.TypeOrmTimeSlotRepository,
					MikroOrmTimeSlotRepository: require('../time-slot/repository/mikro-orm-time-slot.repository')
						.MikroOrmTimeSlotRepository,
					TypeOrmTimeLogRepository: require('./repository/type-orm-time-log.repository')
						.TypeOrmTimeLogRepository,
					MikroOrmTimeLogRepository: require('./repository/mikro-orm-time-log.repository')
						.MikroOrmTimeLogRepository,
					TimeLogUpdateCommand: require('./commands/time-log-update.command').TimeLogUpdateCommand,
					TimeLogUpdateHandler: require('./commands/handlers/time-log-update.handler').TimeLogUpdateHandler,
					InvoiceItemService: require('../../invoice-item/invoice-item.service').InvoiceItemService,
					TypeOrmInvoiceItemRepository:
						require('../../invoice-item/repository/type-orm-invoice-item.repository')
							.TypeOrmInvoiceItemRepository,
					MikroOrmInvoiceItemRepository:
						require('../../invoice-item/repository/mikro-orm-invoice-item.repository')
							.MikroOrmInvoiceItemRepository
				};

				dataSource = new DataSource({
					type: 'better-sqlite3',
					database: file,
					entities: coreEntities,
					synchronize: true,
					logging: false,
					invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
				});
				await dataSource.initialize();

				// The installation's own SQLite profile: it reads the text TypeORM writes as UTC, as a version read through
				// MikroORM must be the instant the edit's TypeORM write compares it with
				orm = await MikroORM.init({
					...dbMikroOrmConnectionConfig,
					dbName: file,
					entities: coreEntities,
					allowGlobalContext: true,
					colors: false,
					debug: false,
					discovery: { warnWhenNoEntities: false }
				});
			});
		} finally {
			for (const [key, value] of Object.entries(previous)) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
		}

		await dataSource.query('PRAGMA foreign_keys = OFF');
		await insert('tenant', { id: TENANT, name: 'tenant' });
		await insert('organization', { id: ORG, name: 'organization', tenantId: TENANT, currency: 'EUR' });
		await insert('user', { id: USER, tenantId: TENANT, firstName: 'Ada', lastName: 'Lovelace' });
		await insert('employee', { id: EMPLOYEE, ...scope, userId: USER });
		await insert('timesheet', { id: TIMESHEET, ...scope, employeeId: EMPLOYEE, status: 'PENDING' });
		await dataSource.query('PRAGMA foreign_keys = ON');
	}, TIMEOUT);

	afterAll(async () => {
		await orm?.close(true);
		await dataSource?.destroy();
		try {
			fs.unlinkSync(file);
		} catch {
			// The file is the operating system's temporary directory's to reclaim.
		}
	});

	beforeEach(() => {
		const granted = [loaded.PermissionsEnum.CHANGE_SELECTED_EMPLOYEE];
		const context = loaded.RequestContext;
		jest.spyOn(context, 'currentUser').mockReturnValue({
			id: USER,
			tenantId: TENANT,
			employeeId: EMPLOYEE,
			lastOrganizationId: ORG
		});
		jest.spyOn(context, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(context, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(context, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(context, 'currentEmployeeId').mockReturnValue(EMPLOYEE);
		jest.spyOn(context, 'hasPermission').mockImplementation((permission: string) => granted.includes(permission));
		jest.spyOn(context, 'hasRoles').mockReturnValue(false);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		orm.em.clear();
	});

	afterEach(() => jest.restoreAllMocks());

	describe.each(ORMS)('on %s', (ormType) => {
		describe('PUT /timesheet/time-log/:id', () => {
			it('saves an edit made on the version it read, moves updatedAt past it, and refuses a second save on that read', async () => {
				const timeLogId = await entry();
				const version = await readVersion(ormType, timeLogId);

				await edit(ormType, timeLogId, { isBillable: true, description: 'edited', expectedUpdatedAt: version });

				const saved = await stateOf(timeLogId);
				expect(saved).toMatchObject({ description: 'edited', isBillable: true });
				expect(saved.updatedAt.getTime()).toBeGreaterThan(new Date(version).getTime());
				expect(await historyCountOf(timeLogId)).toBe(1);

				// The version the save answered is the one a next edit is made on
				expect(await readVersion(ormType, timeLogId)).toBe(saved.updatedAt.toISOString());

				const second = edit(ormType, timeLogId, { description: 'second', expectedUpdatedAt: version });
				await expectChangedMeanwhile(second, timeLogId, version);
				expect((await stateOf(timeLogId)).description).toBe('edited');
			});

			it('refuses an edit made on a read the entry no longer holds: 409 with the entry as it is now, nothing written nor recorded', async () => {
				const timeLogId = await entry();
				const version = await readVersion(ormType, timeLogId);
				await changedMeanwhile(timeLogId);

				const save = edit(ormType, timeLogId, {
					isBillable: true,
					description: 'stale',
					expectedUpdatedAt: version
				});

				await expectChangedMeanwhile(save, timeLogId, version);
				const state = await stateOf(timeLogId);
				expect(state).toMatchObject({ description: 'meanwhile', isBillable: false });
				expect(state.updatedAt.toISOString()).toBe('2030-01-01T12:00:00.000Z');
				expect(await historyCountOf(timeLogId)).toBe(0);
			});

			it('refuses a stale edit of an entry that takes the slots of its range, and gives those slots back', async () => {
				const timeLogId = await entry({ source: 'BROWSER' });
				const version = await readVersion(ormType, timeLogId);
				await changedMeanwhile(timeLogId);

				const save = edit(ormType, timeLogId, { description: 'stale', expectedUpdatedAt: version });

				await expectChangedMeanwhile(save, timeLogId, version);
				expect((await stateOf(timeLogId)).description).toBe('meanwhile');
				expect(await slotCountOf(timeLogId)).toBe(0);
			});

			it('keeps updatedAt past the version read once an entry that takes the slots of its range is saved', async () => {
				const timeLogId = await entry({ source: 'BROWSER' });
				const version = await readVersion(ormType, timeLogId);

				await edit(ormType, timeLogId, { description: 'edited', expectedUpdatedAt: version });

				const saved = await stateOf(timeLogId);
				expect(saved.description).toBe('edited');
				expect(saved.updatedAt.getTime()).toBeGreaterThan(new Date(version).getTime());
				expect(await slotCountOf(timeLogId)).toBeGreaterThan(0);
				const second = edit(ormType, timeLogId, { description: 'second', expectedUpdatedAt: version });
				await expectChangedMeanwhile(second, timeLogId, version);
			});

			it.each(['DESKTOP', 'BROWSER'])(
				'moves updatedAt a millisecond past the value checked, even when the clock has not reached it (%s)',
				async (source) => {
					const timeLogId = await entry({ updatedAt: FUTURE, source });
					const version = await readVersion(ormType, timeLogId);
					expect(version).toBe(FUTURE_INSTANT.toISOString());

					await edit(ormType, timeLogId, { description: 'edited', expectedUpdatedAt: version });

					expect((await updatedAtOf(timeLogId)).getTime()).toBe(FUTURE_INSTANT.getTime() + 1);
				}
			);

			it('without a precondition, saves as before, and still moves updatedAt past what the entry held', async () => {
				const timeLogId = await entry({ updatedAt: FUTURE });
				await changedMeanwhile(timeLogId);
				await dataSource.query(`UPDATE "time_log" SET "updatedAt" = ? WHERE "id" = ?`, [FUTURE, timeLogId]);

				await edit(ormType, timeLogId, { isBillable: true, description: 'unconditional' });

				const saved = await stateOf(timeLogId);
				expect(saved).toMatchObject({ description: 'unconditional', isBillable: true });
				expect(saved.updatedAt.getTime()).toBe(FUTURE_INSTANT.getTime() + 1);
			});

			it('refuses a precondition that is no date and time with 400, writing nothing', async () => {
				const timeLogId = await entry();

				const save = edit(ormType, timeLogId, { description: 'malformed', expectedUpdatedAt: 'yesterday' });

				await expect(save).rejects.toMatchObject({ status: 400 });
				expect((await stateOf(timeLogId)).description).toBe('as read');
			});
		});

		describe('invoice lines that bill an entry', () => {
			it('billing an entry moves its updatedAt past what it held, so an edit made on an earlier read is refused', async () => {
				const timeLogId = await entry({ updatedAt: FUTURE, isBillable: 1 });
				const version = await readVersion(ormType, timeLogId);
				const invoiceId = await draftInvoice();

				await lines(ormType).createBulk(invoiceId, [line(invoiceId, 'design', [timeLogId])]);

				expect(await linkOf(timeLogId)).toBe(await lineIdOf(invoiceId, 'design'));
				expect((await updatedAtOf(timeLogId)).getTime()).toBe(FUTURE_INSTANT.getTime() + 1);
				const save = edit(ormType, timeLogId, { description: 'stale', expectedUpdatedAt: version });
				await expectChangedMeanwhile(save, timeLogId, version);
			});

			it('a replacement that keeps the time links it again, and one that drops it lets it go, each moving updatedAt', async () => {
				const timeLogId = await entry({ isBillable: 1 });
				const invoiceId = await draftInvoice();
				await lines(ormType).createBulk(invoiceId, [line(invoiceId, 'design', [timeLogId])]);
				const billed = await updatedAtOf(timeLogId);

				// The same line, naming no time: it keeps the time of the line it replaces
				await lines(ormType).createBulk(invoiceId, [line(invoiceId, 'design')]);
				const kept = await updatedAtOf(timeLogId);
				expect(await linkOf(timeLogId)).toBe(await lineIdOf(invoiceId, 'design'));
				expect(kept.getTime()).toBeGreaterThan(billed.getTime());

				// Another line: the time is let go
				await lines(ormType).createBulk(invoiceId, [line(invoiceId, 'fixed fee')]);
				expect(await linkOf(timeLogId)).toBeNull();
				expect((await updatedAtOf(timeLogId)).getTime()).toBeGreaterThan(kept.getTime());
			});

			it('deleting the line that bills an entry lets its time go and moves its updatedAt', async () => {
				const timeLogId = await entry({ isBillable: 1 });
				const invoiceId = await draftInvoice();
				await lines(ormType).createBulk(invoiceId, [line(invoiceId, 'design', [timeLogId])]);
				const billed = await updatedAtOf(timeLogId);
				const version = await readVersion(ormType, timeLogId);

				await lines(ormType).deleteLine(await lineIdOf(invoiceId, 'design'));

				expect(await linkOf(timeLogId)).toBeNull();
				expect((await updatedAtOf(timeLogId)).getTime()).toBeGreaterThan(billed.getTime());
				const save = edit(ormType, timeLogId, { description: 'stale', expectedUpdatedAt: version });
				await expectChangedMeanwhile(save, timeLogId, version);
			});
		});
	});
});

/**
 * An `updatedAt` as SQLite holds it: TypeORM writes UTC text without a zone, MikroORM may write a number of
 * milliseconds.
 */
function storedInstant(value: unknown): Date {
	if (typeof value === 'number') {
		return new Date(value);
	}
	const text = String(value);
	const hasZone = /(Z|[+-]\d\d:?\d\d)$/.test(text);
	return new Date(hasZone ? text : `${text.replace(' ', 'T')}Z`);
}

function placeholderFor(type: string): unknown {
	const lowerCaseType = type.toLowerCase();
	const isNumeric = /int|bool|numeric|decimal|real|float/.test(lowerCaseType);
	if (isNumeric) {
		return 0;
	}
	const isTemporal = /date|time/.test(lowerCaseType);
	if (isTemporal) {
		return '2026-01-01 00:00:00';
	}
	return 'x';
}

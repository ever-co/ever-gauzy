import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The time log read a client prepares an invoice from leaves out, when asked (`notInvoiced`), the time a live invoice
 * bills (#11854): a time log whose invoice line is not removed and belongs to an invoice that is neither removed nor
 * void. Without the parameter the read answers every log, as before. Voiding an invoice, or deleting it, through the
 * routes that do it shows its time again.
 *
 * Run on both ORMs over one better-sqlite3 file whose tables TypeORM created, with foreign keys enforced.
 */

const TIMEOUT = 15 * 60 * 1000;

type Row = Record<string, any>;
type Orm = 'typeorm' | 'mikro-orm';

const ORMS: Orm[] = ['typeorm', 'mikro-orm'];

const TENANT = '2c7d3f20-0000-4000-8000-00000000a001';
const ORG = '2c7d3f20-0000-4000-8000-00000000b001';
const USER = '2c7d3f20-0000-4000-8000-00000000c001';

const scope = { tenantId: TENANT, organizationId: ORG };

describe('The time not invoiced yet, read on TypeORM and on MikroORM', () => {
	const file = path.join(os.tmpdir(), `gauzy-time-not-invoiced-${process.pid}-${Date.now()}.sqlite3`);

	let loaded: Row = {};
	let dataSource: any;
	let orm: any;
	let invoiceNumber = 0;
	let slotMinutes = 0;

	/** The time log read, and the invoice routes that void and delete, on the ORM named. */
	const routes = (ormType: Orm) => {
		const timeLogService = new loaded.TimeLogService(
			new loaded.TypeOrmTimeLogRepository(dataSource.getRepository(loaded.TimeLog)),
			new loaded.MikroOrmTimeLogRepository(orm.em, loaded.TimeLog),
			{},
			{},
			{},
			{},
			{}
		);
		const invoiceService = new loaded.InvoiceService(
			new loaded.TypeOrmInvoiceRepository(dataSource.getRepository(loaded.Invoice)),
			new loaded.MikroOrmInvoiceRepository(orm.em, loaded.Invoice),
			{},
			{},
			{},
			{},
			{}
		);
		// The ORM is a module constant of the CRUD base, read when the registry loaded (MikroORM, here); each
		// instance states its own so one registry can run both halves over the same mapping.
		for (const service of [timeLogService, invoiceService]) {
			Object.defineProperty(service, 'ormType', { get: () => ormType });
		}
		return {
			readAll: (employeeId: string) =>
				timeLogService.getTimeLogs({ organizationId: ORG, employeeIds: [employeeId] }),
			readNotInvoiced: (employeeId: string) =>
				timeLogService.getTimeLogs({ organizationId: ORG, employeeIds: [employeeId], notInvoiced: true }),
			voidInvoice: (id: string) =>
				new loaded.InvoiceUpdateHandler(invoiceService).execute(
					new loaded.InvoiceUpdateCommand({ id, status: 'VOID' })
				),
			deleteInvoice: (id: string) =>
				new loaded.InvoiceDeleteHandler(invoiceService).execute(new loaded.InvoiceDeleteCommand(id))
		};
	};

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

	/** An employee of the organization, whose logs a case reads apart from every other case's. */
	const employee = async (): Promise<string> => {
		const id = randomUUID();
		await insert('employee', { id, ...scope, userId: USER });
		return id;
	};

	/** The start of a ten-minute slot no other log of the file starts in. */
	const nextSlotStart = (): string => {
		slotMinutes += 10;
		const start = new Date(Date.UTC(2026, 9, 1, 0, slotMinutes));
		return start.toISOString().replace('T', ' ').slice(0, 19);
	};

	/** A time log with one time slot, as the tracker leaves it: the list reads only logs that have a slot. */
	const timeLog = async (employeeId: string, description: string, row: Row = {}): Promise<string> => {
		const id = randomUUID();
		const startedAt = nextSlotStart();
		await insert('time_log', { id, ...scope, employeeId, description, startedAt, stoppedAt: startedAt, ...row });
		const slotId = randomUUID();
		await insert('time_slot', { id: slotId, ...scope, employeeId, startedAt });
		await insert('time_slot_time_logs', { timeSlotId: slotId, timeLogId: id });
		return id;
	};

	/** An invoice in the status given, with one line, and the line. */
	const invoice = async (status: string, row: Row = {}): Promise<{ invoiceId: string; lineId: string }> => {
		const invoiceId = randomUUID();
		invoiceNumber += 1;
		await insert('invoice', {
			id: invoiceId,
			...scope,
			fromOrganizationId: ORG,
			invoiceNumber,
			currency: 'EUR',
			discountValue: 0,
			terms: 'Billable time',
			status,
			...row
		});
		const lineId = randomUUID();
		await insert('invoice_item', { id: lineId, ...scope, invoiceId, price: 1, quantity: 1, totalValue: 1 });
		return { invoiceId, lineId };
	};

	/** A log the line of an invoice in the status given bills. */
	const billedLog = async (employeeId: string, description: string, status: string) => {
		const { invoiceId, lineId } = await invoice(status);
		const timeLogId = await timeLog(employeeId, description, { invoiceItemId: lineId });
		return { invoiceId, lineId, timeLogId };
	};

	const descriptionsOf = (logs: Row[]): string[] => logs.map((log) => log.description).sort();

	beforeAll(async () => {
		const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
		process.env.DB_ORM = 'mikro-orm';
		process.env.DB_TYPE = 'better-sqlite3';

		try {
			await jest.isolateModulesAsync(async () => {
				// MikroORM keeps decorator metadata in a process-wide store; this load's decorators write the
				// mapping under test into an empty one.
				require('@mikro-orm/core').MetadataStorage.clear();

				// Must be first: loads the entity graph before a service pulls an entity.
				const entities = require('../../core/entities/internal');

				const { coreEntities } = require('../../core/entities');
				const { DataSource } = require('typeorm');
				const { MikroORM, EntityCaseNamingStrategy } = require('@mikro-orm/core');
				const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');
				const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
				const {
					MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
					TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
				} = require('@gauzy/config');

				loaded = {
					TimeLog: entities.TimeLog,
					Invoice: entities.Invoice,
					PermissionsEnum: require('@gauzy/contracts').PermissionsEnum,
					RequestContext: require('../../core/context/request-context').RequestContext,
					TimeLogService: require('./time-log.service').TimeLogService,
					TypeOrmTimeLogRepository: require('./repository/type-orm-time-log.repository')
						.TypeOrmTimeLogRepository,
					MikroOrmTimeLogRepository: require('./repository/mikro-orm-time-log.repository')
						.MikroOrmTimeLogRepository,
					InvoiceService: require('../../invoice/invoice.service').InvoiceService,
					TypeOrmInvoiceRepository: require('../../invoice/repository/type-orm-invoice.repository')
						.TypeOrmInvoiceRepository,
					MikroOrmInvoiceRepository: require('../../invoice/repository/mikro-orm-invoice.repository')
						.MikroOrmInvoiceRepository,
					InvoiceUpdateHandler: require('../../invoice/commands/handlers/invoice.update.handler')
						.InvoiceUpdateHandler,
					InvoiceUpdateCommand: require('../../invoice/commands/invoice.update.command').InvoiceUpdateCommand,
					InvoiceDeleteHandler: require('../../invoice/commands/handlers/invoice.delete.handler')
						.InvoiceDeleteHandler,
					InvoiceDeleteCommand: require('../../invoice/commands/invoice.delete.command').InvoiceDeleteCommand
				};

				// TypeORM creates the tables, as the migrations do in an installation; both ORMs then read them.
				dataSource = new DataSource({
					type: 'better-sqlite3',
					database: file,
					entities: coreEntities,
					synchronize: true,
					logging: false,
					invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
				});
				await dataSource.initialize();

				orm = await MikroORM.init({
					driver: BetterSqliteDriver,
					dbName: file,
					entities: coreEntities,
					namingStrategy: EntityCaseNamingStrategy,
					extensions: [SoftDeleteHandler],
					autoJoinRefsForFilters: MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
					allowGlobalContext: true,
					discovery: { warnWhenNoEntities: false }
				});
			});
		} finally {
			for (const [key, value] of Object.entries(previous)) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
		}

		// The custom-fields placeholder column the migrations add, which synchronize leaves out: the MikroORM read
		// loads the log's employee, project, task and client, which map it.
		for (const table of ['employee', 'organization_team', 'organization_project', 'organization_contact', 'task']) {
			const columns: Row[] = await dataSource.query(`PRAGMA table_info("${table}")`);
			const hasPlaceholder = columns.some((column) => column.name === 'fix_relational_custom_fields');
			if (!hasPlaceholder) {
				await dataSource.query(`ALTER TABLE "${table}" ADD COLUMN "fix_relational_custom_fields" boolean`);
			}
		}

		await dataSource.query('PRAGMA foreign_keys = OFF');
		await insert('tenant', { id: TENANT, name: 'tenant' });
		await insert('organization', { id: ORG, name: 'organization', tenantId: TENANT, currency: 'EUR' });
		await insert('user', { id: USER, tenantId: TENANT, firstName: 'Ada', lastName: 'Lovelace' });
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
		const context = loaded.RequestContext;
		jest.spyOn(context, 'currentUser').mockReturnValue({ id: USER, tenantId: TENANT, lastOrganizationId: ORG });
		jest.spyOn(context, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(context, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(context, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(context, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(context, 'hasPermission').mockImplementation(
			(permission: string) => permission === loaded.PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
		jest.spyOn(context, 'hasRoles').mockReturnValue(false);
		orm.em.clear();
	});

	afterEach(() => jest.restoreAllMocks());

	describe.each(ORMS)('on %s', (ormType) => {
		it('leaves out the time a live invoice bills, and reads every log without the parameter', async () => {
			const member = await employee();
			await timeLog(member, 'free');
			await billedLog(member, 'draft', 'DRAFT');
			await billedLog(member, 'sent', 'SENT');
			await billedLog(member, 'paid', 'FULLY_PAID');
			await billedLog(member, 'void', 'VOID');
			const { invoiceId: removedInvoice } = await billedLog(member, 'invoice removed', 'SENT');
			await dataSource.query(`UPDATE "invoice" SET "deletedAt" = '2026-10-05 00:00:00' WHERE "id" = ?`, [
				removedInvoice
			]);
			const { lineId: removedLine } = await billedLog(member, 'line removed', 'SENT');
			await dataSource.query(`UPDATE "invoice_item" SET "deletedAt" = '2026-10-05 00:00:00' WHERE "id" = ?`, [
				removedLine
			]);
			const { invoiceId: deletedInvoice } = await billedLog(member, 'invoice deleted', 'SENT');
			await dataSource.query(`DELETE FROM "invoice" WHERE "id" = ?`, [deletedInvoice]);

			const notInvoiced = await routes(ormType).readNotInvoiced(member);
			const all = await routes(ormType).readAll(member);

			expect(descriptionsOf(notInvoiced)).toEqual([
				'free',
				'invoice deleted',
				'invoice removed',
				'line removed',
				'void'
			]);
			expect(descriptionsOf(all)).toEqual([
				'draft',
				'free',
				'invoice deleted',
				'invoice removed',
				'line removed',
				'paid',
				'sent',
				'void'
			]);
		});

		it('reads again the time of an invoice voided through the invoice routes', async () => {
			const member = await employee();
			const { invoiceId } = await billedLog(member, 'billed', 'SENT');
			const beforeVoid = await routes(ormType).readNotInvoiced(member);

			await routes(ormType).voidInvoice(invoiceId);

			const afterVoid = await routes(ormType).readNotInvoiced(member);
			expect(descriptionsOf(beforeVoid)).toEqual([]);
			expect(descriptionsOf(afterVoid)).toEqual(['billed']);
		});

		it('reads again the time of an invoice deleted through the invoice routes', async () => {
			const member = await employee();
			const { invoiceId } = await billedLog(member, 'billed', 'DRAFT');
			const beforeDelete = await routes(ormType).readNotInvoiced(member);

			await routes(ormType).deleteInvoice(invoiceId);

			const afterDelete = await routes(ormType).readNotInvoiced(member);
			expect(descriptionsOf(beforeDelete)).toEqual([]);
			expect(descriptionsOf(afterDelete)).toEqual(['billed']);
		});

		it('answers each log with the invoice line that bills it, if any', async () => {
			const member = await employee();
			const { lineId } = await billedLog(member, 'billed', 'SENT');
			await timeLog(member, 'free');

			const all = await routes(ormType).readAll(member);

			const lineByLog = Object.fromEntries(all.map((log: Row) => [log.description, log.invoiceItemId]));
			expect(lineByLog).toEqual({ billed: lineId, free: null });
		});
	});
});

/** A value for a NOT NULL column the case does not name, by the column's declared type. */
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

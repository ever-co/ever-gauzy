import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * An invoice, and a bulk save of its lines, records which time each line bills, on both ORMs, over one database whose
 * tables TypeORM created (#11854).
 *
 * A line names the time logs it bills in `timeLogIds`. The save writes the line on each of them in the transaction
 * that saves the lines, and refuses the whole save (400, nothing written) when one of them may not be billed there: a
 * time log of another organization or tenant, one a live invoice already bills, a removed one, a colleague's for a
 * caller who may only bill their own time, or one named twice. Time a void or deleted invoice billed is free again.
 *
 * Each case runs the real command handlers and services on both ORMs, against one better-sqlite3 file, with foreign
 * keys enforced, so the line a replacement deletes clears the link of the time it billed.
 */

const TIMEOUT = 15 * 60 * 1000;

type Row = Record<string, any>;
type Orm = 'typeorm' | 'mikro-orm';

const ORMS: Orm[] = ['typeorm', 'mikro-orm'];

const TENANT = '1b6c2e10-0000-4000-8000-00000000a001';
const ORG = '1b6c2e10-0000-4000-8000-00000000b001';
const OTHER_ORG = '1b6c2e10-0000-4000-8000-00000000b002';
const OTHER_TENANT = '1b6c2e10-0000-4000-8000-00000000a002';
const OTHER_TENANT_ORG = '1b6c2e10-0000-4000-8000-00000000b003';
const USER = '1b6c2e10-0000-4000-8000-00000000c001';
/** The caller's own employee. */
const OWN = '1b6c2e10-0000-4000-8000-00000000d001';
/** Another employee of the caller's organization. */
const COLLEAGUE = '1b6c2e10-0000-4000-8000-00000000d002';
/** An employee of another organization of the caller's tenant. */
const OUTSIDER = '1b6c2e10-0000-4000-8000-00000000d003';
/** An employee of another tenant. */
const STRANGER = '1b6c2e10-0000-4000-8000-00000000d004';

const scope = { tenantId: TENANT, organizationId: ORG };

describe('Invoices record the time their lines bill, on TypeORM and on MikroORM', () => {
	const file = path.join(os.tmpdir(), `gauzy-invoice-billed-time-${process.pid}-${Date.now()}.sqlite3`);

	let loaded: Row = {};
	let dataSource: any;
	let orm: any;
	let invoiceNumber = 0;
	let granted: string[] = [];

	/**
	 * The invoice create and the bulk save of lines, as the routes dispatch them, on the ORM named. The MikroORM
	 * repositories are on the ORM's own entity manager, as the modules inject them: that one follows a transaction,
	 * which a fork does not.
	 */
	const handlers = (ormType: Orm) => {
		const invoiceService = new loaded.InvoiceService(
			new loaded.TypeOrmInvoiceRepository(dataSource.getRepository(loaded.Invoice)),
			new loaded.MikroOrmInvoiceRepository(orm.em, loaded.Invoice),
			{},
			{},
			{},
			{},
			{}
		);
		const invoiceItemService = new loaded.InvoiceItemService(
			new loaded.TypeOrmInvoiceItemRepository(dataSource.getRepository(loaded.InvoiceItem)),
			new loaded.MikroOrmInvoiceItemRepository(orm.em, loaded.InvoiceItem)
		);
		// The ORM is a module constant of the CRUD base, read when the registry loaded (MikroORM, here); each
		// instance states its own so one registry can run both halves over the same mapping.
		for (const service of [invoiceService, invoiceItemService]) {
			Object.defineProperty(service, 'ormType', { get: () => ormType });
		}
		return {
			create: (input: Row) =>
				new loaded.InvoiceCreateHandler(invoiceService).execute(new loaded.InvoiceCreateCommand(input)),
			replaceLines: (invoiceId: string, lines: Row[]) =>
				new loaded.InvoiceItemBulkCreateHandler(invoiceItemService).execute(
					new loaded.InvoiceItemBulkCreateCommand(invoiceId, lines)
				)
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

	const nextInvoiceNumber = (): number => {
		invoiceNumber += 1;
		return invoiceNumber;
	};

	/** A time log of the caller's own employee in the caller's organization, unless the row says otherwise. */
	const timeLog = async (row: Row = {}): Promise<string> => {
		const id = randomUUID();
		await insert('time_log', {
			id,
			...scope,
			employeeId: OWN,
			startedAt: '2026-10-01 09:00:00',
			stoppedAt: '2026-10-01 10:00:00',
			isBillable: 1,
			...row
		});
		return id;
	};

	/** An invoice saved earlier, in the status given, with one line. */
	const earlierInvoice = async (status: string): Promise<{ invoiceId: string; lineId: string }> => {
		const invoiceId = randomUUID();
		await insert('invoice', {
			id: invoiceId,
			...scope,
			fromOrganizationId: ORG,
			invoiceNumber: nextInvoiceNumber(),
			currency: 'EUR',
			discountValue: 0,
			terms: 'earlier',
			status
		});
		const lineId = randomUUID();
		await insert('invoice_item', {
			id: lineId,
			...scope,
			invoiceId,
			description: 'earlier',
			price: 1,
			quantity: 1,
			totalValue: 1
		});
		return { invoiceId, lineId };
	};

	/** A time log the line of an earlier invoice, in the status given, bills. */
	const timeLogBilledBy = async (
		status: string
	): Promise<{ invoiceId: string; lineId: string; timeLogId: string }> => {
		const { invoiceId, lineId } = await earlierInvoice(status);
		const timeLogId = await timeLog({ invoiceItemId: lineId });
		return { invoiceId, lineId, timeLogId };
	};

	/** A line as the web sends it, billing the time logs given. */
	const lineBilling = (description: string, timeLogIds: string[]): Row => ({
		...lineNamingNoTime(description),
		timeLogIds
	});

	const lineNamingNoTime = (description: string): Row => ({
		description,
		price: 50,
		quantity: 1,
		totalValue: 50,
		...scope
	});

	/** An invoice as the web creates it: its id made by the client, each line carrying it. */
	const invoiceWith = (lines: Row[]): Row => {
		const id = randomUUID();
		return {
			id,
			...scope,
			fromOrganizationId: ORG,
			invoiceNumber: nextInvoiceNumber(),
			invoiceDate: new Date('2026-11-01T00:00:00.000Z'),
			dueDate: new Date('2026-11-30T00:00:00.000Z'),
			currency: 'EUR',
			discountValue: 0,
			terms: 'Billable time from 2026-10-01 to 2026-10-31',
			status: 'DRAFT',
			invoiceItems: lines.map((line) => ({ ...line, invoiceId: id }))
		};
	};

	const linkOf = async (timeLogId: string): Promise<string | null> => {
		const [row] = await dataSource.query(`SELECT "invoiceItemId" FROM "time_log" WHERE "id" = ?`, [timeLogId]);
		return row.invoiceItemId;
	};

	const lineOf = async (invoiceId: string, description: string): Promise<string | undefined> => {
		const [row] = await dataSource.query(
			`SELECT "id" FROM "invoice_item" WHERE "invoiceId" = ? AND "description" = ?`,
			[invoiceId, description]
		);
		return row?.id;
	};

	const count = async (table: string, column: string, value: string): Promise<number> => {
		const [row] = await dataSource.query(`SELECT COUNT(*) AS "n" FROM "${table}" WHERE "${column}" = ?`, [value]);
		return Number(row.n);
	};

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
				const entities = require('../core/entities/internal');

				const { coreEntities } = require('../core/entities');
				const { DataSource } = require('typeorm');
				const { MikroORM, EntityCaseNamingStrategy } = require('@mikro-orm/core');
				const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');
				const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
				const {
					MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
					TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
				} = require('@gauzy/config');

				loaded = {
					Invoice: entities.Invoice,
					InvoiceItem: entities.InvoiceItem,
					PermissionsEnum: require('@gauzy/contracts').PermissionsEnum,
					RequestContext: require('../core/context/request-context').RequestContext,
					InvoiceService: require('./invoice.service').InvoiceService,
					TypeOrmInvoiceRepository: require('./repository/type-orm-invoice.repository')
						.TypeOrmInvoiceRepository,
					MikroOrmInvoiceRepository: require('./repository/mikro-orm-invoice.repository')
						.MikroOrmInvoiceRepository,
					InvoiceCreateHandler: require('./commands/handlers/invoice.create.handler').InvoiceCreateHandler,
					InvoiceCreateCommand: require('./commands/invoice.create.command').InvoiceCreateCommand,
					InvoiceItemService: require('../invoice-item/invoice-item.service').InvoiceItemService,
					TypeOrmInvoiceItemRepository: require('../invoice-item/repository/type-orm-invoice-item.repository')
						.TypeOrmInvoiceItemRepository,
					MikroOrmInvoiceItemRepository:
						require('../invoice-item/repository/mikro-orm-invoice-item.repository')
							.MikroOrmInvoiceItemRepository,
					InvoiceItemBulkCreateHandler:
						require('../invoice-item/commands/handlers/invoice-item.bulk.create.handler')
							.InvoiceItemBulkCreateHandler,
					InvoiceItemBulkCreateCommand: require('../invoice-item/commands/invoice-item.bulk.create.command')
						.InvoiceItemBulkCreateCommand
				};

				// TypeORM creates the tables, as the migrations do in an installation; both ORMs then write them.
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

		// The rows the cases name, written without the users and records their base columns would point at; foreign
		// keys are enforced again before any case runs.
		await dataSource.query('PRAGMA foreign_keys = OFF');
		await insert('tenant', { id: TENANT, name: 'tenant' });
		await insert('tenant', { id: OTHER_TENANT, name: 'other tenant' });
		await insert('organization', { id: ORG, name: 'organization', tenantId: TENANT, currency: 'EUR' });
		await insert('organization', { id: OTHER_ORG, name: 'other organization', tenantId: TENANT, currency: 'EUR' });
		await insert('organization', {
			id: OTHER_TENANT_ORG,
			name: 'organization of another tenant',
			tenantId: OTHER_TENANT,
			currency: 'EUR'
		});
		await insert('user', { id: USER, tenantId: TENANT, firstName: 'Ada', lastName: 'Lovelace' });
		await insert('employee', { id: OWN, ...scope, userId: USER });
		await insert('employee', { id: COLLEAGUE, ...scope, userId: USER });
		await insert('employee', { id: OUTSIDER, tenantId: TENANT, organizationId: OTHER_ORG, userId: USER });
		await insert('employee', {
			id: STRANGER,
			tenantId: OTHER_TENANT,
			organizationId: OTHER_TENANT_ORG,
			userId: USER
		});
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
		granted = [loaded.PermissionsEnum.CHANGE_SELECTED_EMPLOYEE];
		const context = loaded.RequestContext;
		jest.spyOn(context, 'currentUser').mockReturnValue({
			id: USER,
			tenantId: TENANT,
			employeeId: OWN,
			lastOrganizationId: ORG
		});
		jest.spyOn(context, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(context, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(context, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(context, 'currentEmployeeId').mockReturnValue(OWN);
		jest.spyOn(context, 'hasPermission').mockImplementation((permission: string) => granted.includes(permission));
		jest.spyOn(context, 'hasRoles').mockReturnValue(false);
		orm.em.clear();
	});

	afterEach(() => jest.restoreAllMocks());

	describe.each(ORMS)('on %s', (ormType) => {
		it('marks the time logs each line bills, and leaves a line without time as it was', async () => {
			const design = await timeLog();
			const review = await timeLog();
			const colleagues = await timeLog({ employeeId: COLLEAGUE });
			const input = invoiceWith([
				lineBilling('design', [design, review, design]),
				lineBilling('colleague', [colleagues]),
				lineNamingNoTime('fixed fee')
			]);

			await handlers(ormType).create(input);

			const designLine = await lineOf(input.id, 'design');
			const colleagueLine = await lineOf(input.id, 'colleague');
			expect(designLine).toBeDefined();
			expect(await linkOf(design)).toBe(designLine);
			expect(await linkOf(review)).toBe(designLine);
			expect(await linkOf(colleagues)).toBe(colleagueLine);
			expect(await lineOf(input.id, 'fixed fee')).toBeDefined();
		});

		it('lets a caller who may only bill their own time bill it', async () => {
			granted = [];
			const own = await timeLog();
			const input = invoiceWith([lineBilling('own time', [own])]);

			await handlers(ormType).create(input);

			const ownLine = await lineOf(input.id, 'own time');
			expect(await linkOf(own)).toBe(ownLine);
		});

		it.each<[string, () => Promise<string>]>([
			[
				'of a void invoice',
				async () => {
					const { timeLogId } = await timeLogBilledBy('VOID');
					return timeLogId;
				}
			],
			[
				'of a deleted invoice',
				async () => {
					const { invoiceId, timeLogId } = await timeLogBilledBy('FULLY_PAID');
					await dataSource.query(`DELETE FROM "invoice" WHERE "id" = ?`, [invoiceId]);
					return timeLogId;
				}
			]
		])('bills again the time %s', async (_label, freedTimeLog) => {
			const freed = await freedTimeLog();
			const input = invoiceWith([lineBilling('billed again', [freed])]);

			await handlers(ormType).create(input);

			const newLine = await lineOf(input.id, 'billed again');
			expect(await linkOf(freed)).toBe(newLine);
		});

		it.each<[string, () => Promise<{ timeLogId: string; link: string | null }>]>([
			[
				'a time log of another organization',
				async () => {
					const timeLogId = await timeLog({ organizationId: OTHER_ORG, employeeId: OUTSIDER });
					return { timeLogId, link: null };
				}
			],
			[
				'a time log of another tenant',
				async () => {
					const timeLogId = await timeLog({
						tenantId: OTHER_TENANT,
						organizationId: OTHER_TENANT_ORG,
						employeeId: STRANGER
					});
					return { timeLogId, link: null };
				}
			],
			[
				'a time log a live invoice already bills',
				async () => {
					const { timeLogId, lineId } = await timeLogBilledBy('SENT');
					return { timeLogId, link: lineId };
				}
			],
			[
				'a removed time log',
				async () => {
					const timeLogId = await timeLog({ deletedAt: '2026-10-02 00:00:00' });
					return { timeLogId, link: null };
				}
			]
		])('refuses %s with a 400 and saves nothing', async (_label, unbillableTimeLog) => {
			const free = await timeLog();
			const unbillable = await unbillableTimeLog();
			const input = invoiceWith([lineBilling('free', [free]), lineBilling('unbillable', [unbillable.timeLogId])]);

			await expect(handlers(ormType).create(input)).rejects.toMatchObject({ status: 400 });

			expect(await count('invoice', 'id', input.id)).toBe(0);
			expect(await count('invoice_item', 'invoiceId', input.id)).toBe(0);
			expect(await linkOf(free)).toBeNull();
			expect(await linkOf(unbillable.timeLogId)).toBe(unbillable.link);
		});

		it('refuses a time log named by two lines', async () => {
			const twice = await timeLog();
			const input = invoiceWith([lineBilling('first', [twice]), lineBilling('second', [twice])]);

			await expect(handlers(ormType).create(input)).rejects.toMatchObject({ status: 400 });

			expect(await count('invoice', 'id', input.id)).toBe(0);
			expect(await linkOf(twice)).toBeNull();
		});

		it("refuses a colleague's time to a caller who may only bill their own", async () => {
			granted = [];
			const colleagues = await timeLog({ employeeId: COLLEAGUE });
			const input = invoiceWith([lineBilling('colleague', [colleagues])]);

			await expect(handlers(ormType).create(input)).rejects.toMatchObject({ status: 400 });

			expect(await count('invoice', 'id', input.id)).toBe(0);
			expect(await linkOf(colleagues)).toBeNull();
		});

		it('replaces the lines of an invoice: the old ones release their time, the new ones bill theirs', async () => {
			const { invoiceId, lineId } = await earlierInvoice('DRAFT');
			const released = await timeLog({ invoiceItemId: lineId });
			const billed = await timeLog();

			await handlers(ormType).replaceLines(invoiceId, [{ ...lineBilling('replacement', [billed]), invoiceId }]);

			const replacement = await lineOf(invoiceId, 'replacement');
			expect(await count('invoice_item', 'id', lineId)).toBe(0);
			expect(await linkOf(released)).toBeNull();
			expect(await linkOf(billed)).toBe(replacement);
		});

		it('keeps the old lines and their time when a replacement names a time log it may not bill', async () => {
			const { invoiceId, lineId } = await earlierInvoice('DRAFT');
			const kept = await timeLog({ invoiceItemId: lineId });
			const outsiders = await timeLog({ organizationId: OTHER_ORG, employeeId: OUTSIDER });

			await expect(
				handlers(ormType).replaceLines(invoiceId, [{ ...lineBilling('replacement', [outsiders]), invoiceId }])
			).rejects.toMatchObject({ status: 400 });

			expect(await count('invoice_item', 'id', lineId)).toBe(1);
			expect(await lineOf(invoiceId, 'replacement')).toBeUndefined();
			expect(await linkOf(kept)).toBe(lineId);
			expect(await linkOf(outsiders)).toBeNull();
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

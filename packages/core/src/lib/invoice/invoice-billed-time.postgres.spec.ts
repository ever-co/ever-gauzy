import { randomUUID } from 'node:crypto';

/**
 * Writes that race on billed time, on PostgreSQL (#11854). The SQLite specs cannot show them: SQLite runs one writer at
 * a time.
 *
 * Two saves that bill the same time log at the same moment: one bills it, the other is refused with a 400 and saves
 * nothing. The billing locks the time logs it names (`SELECT ... FOR UPDATE`) before its conditional update, because
 * that update's check reads other tables, which a row re-check does not read again. A third connection holds the time
 * log first, so both saves are seen waiting on it before it is released.
 *
 * A status change, or an answer to an estimate through its public link, while another request voids the invoice: the
 * change waits for the void and is refused, instead of writing over it. A third connection voids the invoice and
 * commits once the change is seen waiting.
 *
 * A replacement of an invoice's lines while another one is writing: it waits, then replaces the other's lines, so the
 * invoice keeps one set. A third connection plays the other replacement and commits once this one is seen waiting.
 *
 * Each ORM runs the invoice handlers as the routes dispatch them.
 *
 * Runs only when GAUZY_BILLED_TIME_SPEC_POSTGRES_URL names a PostgreSQL database that holds the migrated schema, such
 * as a throwaway copy of the demo data. The spec writes a tenant of its own and removes it afterwards; it refuses
 * `gauzy`, the database the API uses by default, so it never writes in a developer's own data.
 *
 *   GAUZY_BILLED_TIME_SPEC_POSTGRES_URL=postgres://user:password@host:port/database \
 *     node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/core/jest.config.ts <this file>
 */

const POSTGRES_URL = process.env.GAUZY_BILLED_TIME_SPEC_POSTGRES_URL;

const TIMEOUT = 15 * 60 * 1000;
const WAIT_TIMEOUT = 30 * 1000;
const WAIT_STEP = 50;

type Row = Record<string, any>;
type Orm = 'typeorm' | 'mikro-orm';

const ORMS: Orm[] = ['typeorm', 'mikro-orm'];

/** Rows of a tenant made for one run, removed with it. */
const TENANT = randomUUID();
const ORG = randomUUID();
const USER = randomUUID();
const EMPLOYEE = randomUUID();

const scope = { tenantId: TENANT, organizationId: ORG };

/** The tables the spec writes, in the order their rows are removed. */
const TABLES = ['time_log', 'invoice_item', 'estimate_email', 'invoice', 'employee', 'user', 'organization'];

const DAY = 24 * 60 * 60 * 1000;

(POSTGRES_URL ? describe : describe.skip)('Writes that race on billed time, on PostgreSQL', () => {
	let loaded: Row = {};
	let dataSource: any;
	let orm: any;
	let invoiceNumber = 0;

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
		// The ORM is a module constant of the CRUD base, read when the registry loaded; each run states its own.
		for (const service of [invoiceService, invoiceItemService]) {
			Object.defineProperty(service, 'ormType', { get: () => ormType });
		}
		return {
			create: (input: Row) =>
				new loaded.InvoiceCreateHandler(invoiceService).execute(new loaded.InvoiceCreateCommand(input)),
			update: (input: Row) =>
				new loaded.InvoiceUpdateHandler(invoiceService).execute(new loaded.InvoiceUpdateCommand(input)),
			replaceLines: (invoiceId: string, lines: Row[]) =>
				new loaded.InvoiceItemBulkCreateHandler(invoiceItemService).execute(
					new loaded.InvoiceItemBulkCreateCommand(invoiceId, lines)
				)
		};
	};

	/**
	 * A row with the columns given, and a placeholder in every other NOT NULL column without a default, written by the
	 * connection given (the spec's own by default).
	 */
	const insert = async (table: string, row: Row, connection: { query: Function } = dataSource): Promise<void> => {
		const required: Row[] = await dataSource.query(
			`SELECT "column_name", "data_type" FROM "information_schema"."columns" WHERE "table_schema" = current_schema() ` +
				`AND "table_name" = $1 AND "is_nullable" = 'NO' AND "column_default" IS NULL`,
			[table]
		);
		const values: Row = { ...row };
		for (const column of required) {
			const isGiven = column.column_name in values;
			if (isGiven) {
				continue;
			}
			values[column.column_name] = placeholderFor(String(column.data_type));
		}
		const keys = Object.keys(values);
		const names = keys.map((key) => `"${key}"`).join(', ');
		const marks = keys.map((_key, index) => `$${index + 1}`).join(', ');
		await connection.query(
			`INSERT INTO "${table}" (${names}) VALUES (${marks})`,
			keys.map((key) => values[key])
		);
	};

	const timeLog = async (): Promise<string> => {
		const id = randomUUID();
		await insert('time_log', {
			id,
			...scope,
			employeeId: EMPLOYEE,
			startedAt: '2026-10-01 09:00:00',
			stoppedAt: '2026-10-01 10:00:00',
			isBillable: true
		});
		return id;
	};

	/** An invoice as the web creates it, with one line billing the time logs given. */
	const invoiceBilling = (description: string, timeLogIds: string[]): Row => {
		const id = randomUUID();
		invoiceNumber += 1;
		return {
			id,
			...scope,
			fromOrganizationId: ORG,
			invoiceNumber,
			invoiceDate: new Date('2026-11-01T00:00:00.000Z'),
			dueDate: new Date('2026-11-30T00:00:00.000Z'),
			currency: 'EUR',
			discountValue: 0,
			terms: 'Billable time',
			status: 'DRAFT',
			invoiceItems: [{ description, price: 50, quantity: 1, totalValue: 50, ...scope, invoiceId: id, timeLogIds }]
		};
	};

	const linkOf = async (timeLogId: string): Promise<string | null> => {
		const [row] = await dataSource.query(`SELECT "invoiceItemId" FROM "time_log" WHERE "id" = $1`, [timeLogId]);
		return row.invoiceItemId;
	};

	const lineOf = async (invoiceId: string): Promise<string | undefined> => {
		const [row] = await dataSource.query(`SELECT "id" FROM "invoice_item" WHERE "invoiceId" = $1`, [invoiceId]);
		return row?.id;
	};

	/** An invoice saved earlier, in the status given, with no line; `row` makes it an estimate, for one. */
	const storedInvoice = async (status: string, row: Row = {}): Promise<string> => {
		const id = randomUUID();
		invoiceNumber += 1;
		await insert('invoice', {
			id,
			...scope,
			fromOrganizationId: ORG,
			invoiceNumber,
			currency: 'EUR',
			discountValue: 0,
			terms: 'Billable time',
			status,
			...row
		});
		return id;
	};

	/** A line of the invoice given, as an edit posts it. */
	const lineSaying = (invoiceId: string, description: string): Row => ({
		description,
		price: 1,
		quantity: 1,
		totalValue: 1,
		...scope,
		invoiceId
	});

	const descriptionsOf = async (invoiceId: string): Promise<string[]> => {
		const rows: Row[] = await dataSource.query(
			`SELECT "description" FROM "invoice_item" WHERE "invoiceId" = $1 ORDER BY "description"`,
			[invoiceId]
		);
		return rows.map((row) => row.description);
	};

	const statusOf = async (invoiceId: string): Promise<string> => {
		const [row] = await dataSource.query(`SELECT "status" FROM "invoice" WHERE "id" = $1`, [invoiceId]);
		return row.status;
	};

	const invoiceCount = async (invoiceId: string): Promise<number> => {
		const [row] = await dataSource.query(`SELECT COUNT(*)::int AS "count" FROM "invoice" WHERE "id" = $1`, [
			invoiceId
		]);
		return row.count;
	};

	/** How many connections wait for a lock while running a statement on the table named. */
	const waitingOnLocks = async (table: string): Promise<number> => {
		const [row] = await dataSource.query(
			`SELECT COUNT(*)::int AS "count" FROM "pg_stat_activity" WHERE "datname" = current_database() ` +
				`AND "wait_event_type" = 'Lock' AND "query" ILIKE $1`,
			[`%${table}%`]
		);
		return row.count;
	};

	const untilWaiting = async (expected: number, table: string): Promise<void> => {
		const deadline = Date.now() + WAIT_TIMEOUT;
		let waiting = await waitingOnLocks(table);
		while (waiting < expected) {
			if (Date.now() > deadline) {
				throw new Error(`${waiting} of ${expected} writes reached the lock on ${table}`);
			}
			await new Promise((resolve) => setTimeout(resolve, WAIT_STEP));
			waiting = await waitingOnLocks(table);
		}
	};

	/**
	 * Runs a write while a third connection voids the invoice and has not committed yet, and commits the void once the
	 * write waits on the invoice.
	 */
	/**
	 * Runs `write` while a third connection voids the invoice and, unless told otherwise, records that another invoice
	 * bills the time it released (what billing that time writes), committing once `write` is seen waiting.
	 */
	const whileVoiding = async <T>(
		invoiceId: string,
		write: () => Promise<T>,
		{ billedAgain }: { billedAgain: boolean } = { billedAgain: true }
	): Promise<PromiseSettledResult<T>> => {
		const voiding = dataSource.createQueryRunner();
		await voiding.connect();
		await voiding.startTransaction();
		await voiding.query(`UPDATE "invoice" SET "status" = 'VOID' WHERE "id" = $1`, [invoiceId]);
		if (billedAgain) {
			await voiding.query(`UPDATE "invoice" SET "releasedTimeBilledAt" = now() WHERE "id" = $1`, [invoiceId]);
		}

		const outcomes = Promise.allSettled([write()]);
		try {
			await untilWaiting(1, 'invoice');
		} finally {
			await voiding.commitTransaction();
			await voiding.release();
		}
		const [outcome] = await outcomes;
		return outcome;
	};

	const removeRunRows = async (): Promise<void> => {
		// MikroORM saves a nested line here without its tenant: the spec does not register the subscriber that sets it.
		await dataSource.query(
			`DELETE FROM "invoice_item" WHERE "invoiceId" IN (SELECT "id" FROM "invoice" WHERE "tenantId" = $1)`,
			[TENANT]
		);
		for (const table of TABLES) {
			await dataSource.query(`DELETE FROM "${table}" WHERE "tenantId" = $1`, [TENANT]);
		}
		await dataSource.query(`DELETE FROM "tenant" WHERE "id" = $1`, [TENANT]);
	};

	beforeAll(async () => {
		const { parse } = require('pg-connection-string');
		const connection = parse(POSTGRES_URL);
		if (connection.database === 'gauzy') {
			throw new Error('The spec writes rows: name a throwaway database, not `gauzy`.');
		}
		const statedPort = connection.port || '5432';
		const port = Number(statedPort);

		const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
		process.env.DB_ORM = 'mikro-orm';
		process.env.DB_TYPE = 'postgres';

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
				const { PostgreSqlDriver } = require('@mikro-orm/postgresql');
				const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
				const {
					MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
					TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
				} = require('@gauzy/config');

				loaded = {
					Invoice: entities.Invoice,
					PermissionsEnum: require('@gauzy/contracts').PermissionsEnum,
					RequestContext: require('../core/context/request-context').RequestContext,
					InvoiceService: require('./invoice.service').InvoiceService,
					TypeOrmInvoiceRepository: require('./repository/type-orm-invoice.repository')
						.TypeOrmInvoiceRepository,
					MikroOrmInvoiceRepository: require('./repository/mikro-orm-invoice.repository')
						.MikroOrmInvoiceRepository,
					InvoiceCreateHandler: require('./commands/handlers/invoice.create.handler').InvoiceCreateHandler,
					InvoiceCreateCommand: require('./commands/invoice.create.command').InvoiceCreateCommand,
					InvoiceUpdateHandler: require('./commands/handlers/invoice.update.handler').InvoiceUpdateHandler,
					InvoiceUpdateCommand: require('./commands/invoice.update.command').InvoiceUpdateCommand,
					INVOICE_VOID_IS_FINAL: require('./invoice-final-status').INVOICE_VOID_IS_FINAL,
					InvoiceItem: entities.InvoiceItem,
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
						.InvoiceItemBulkCreateCommand,
					EstimateEmail: entities.EstimateEmail,
					PublicInvoiceService: require('../public-share/invoice/public-invoice.service')
						.PublicInvoiceService,
					signPurposeToken: require('../auth/purpose-token').signPurposeToken,
					TokenPurposeEnum: require('../auth/purpose-token').TokenPurposeEnum
				};

				// The schema is the migrations': nothing is synchronized.
				dataSource = new DataSource({
					type: 'postgres',
					host: connection.host,
					port,
					username: connection.user,
					password: connection.password,
					database: connection.database,
					entities: coreEntities,
					synchronize: false,
					logging: false,
					invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
				});
				await dataSource.initialize();

				orm = await MikroORM.init({
					driver: PostgreSqlDriver,
					host: connection.host,
					port,
					user: connection.user,
					password: connection.password,
					dbName: connection.database,
					entities: coreEntities,
					namingStrategy: EntityCaseNamingStrategy,
					extensions: [SoftDeleteHandler],
					autoJoinRefsForFilters: MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
					persistOnCreate: true,
					allowGlobalContext: true,
					discovery: { warnWhenNoEntities: false }
				});
			});
		} finally {
			for (const [key, value] of Object.entries(previous)) {
				if (value === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = value;
				}
			}
		}

		await insert('tenant', { id: TENANT, name: 'Billed time concurrency spec' });
		await insert('organization', {
			id: ORG,
			tenantId: TENANT,
			name: 'Billed time concurrency spec',
			currency: 'EUR'
		});
		await insert('user', { id: USER, tenantId: TENANT, firstName: 'Ada', lastName: 'Lovelace' });
		await insert('employee', { id: EMPLOYEE, ...scope, userId: USER });
	}, TIMEOUT);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await removeRunRows();
		}
		await orm?.close(true);
		await dataSource?.destroy();
	}, TIMEOUT);

	beforeEach(() => {
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
		jest.spyOn(context, 'hasPermission').mockImplementation(
			(permission: string) => permission === loaded.PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
		jest.spyOn(context, 'hasRoles').mockReturnValue(false);
		orm.em.clear();
	});

	afterEach(() => jest.restoreAllMocks());

	describe.each(ORMS)('on %s', (ormType) => {
		it(
			'bills the time once: one save wins, the other is refused with a 400 and saves nothing',
			async () => {
				const contested = await timeLog();
				const first = invoiceBilling('first', [contested]);
				const second = invoiceBilling('second', [contested]);
				const holder = dataSource.createQueryRunner();
				await holder.connect();
				await holder.startTransaction();
				await holder.query(`SELECT "id" FROM "time_log" WHERE "id" = $1 FOR UPDATE`, [contested]);

				const saves = Promise.allSettled([handlers(ormType).create(first), handlers(ormType).create(second)]);
				try {
					await untilWaiting(2, 'time_log');
				} finally {
					await holder.commitTransaction();
					await holder.release();
				}
				const [firstOutcome, secondOutcome] = await saves;

				const results = [
					{ invoice: first, outcome: firstOutcome },
					{ invoice: second, outcome: secondOutcome }
				];
				const won = results.filter((result) => result.outcome.status === 'fulfilled');
				const lost = results.filter((result) => result.outcome.status === 'rejected');
				expect(won).toHaveLength(1);
				expect(lost).toHaveLength(1);
				const [{ invoice: winner }] = won;
				const [{ invoice: loser, outcome: refusal }] = lost;
				expect((refusal as PromiseRejectedResult).reason).toMatchObject({ status: 400 });
				expect(await linkOf(contested)).toBe(await lineOf(winner.id));
				expect(await invoiceCount(loser.id)).toBe(0);
			},
			TIMEOUT
		);

		it(
			'refuses a status change that a void and a billing of its released time overtake, and keeps it void',
			async () => {
				const invoiceId = await storedInvoice('DRAFT');

				const sending = await whileVoiding(invoiceId, () =>
					handlers(ormType).update({ id: invoiceId, status: 'SENT' })
				);

				expect(sending).toMatchObject({
					status: 'rejected',
					reason: { status: 400, message: loaded.INVOICE_VOID_IS_FINAL }
				});
				expect(await statusOf(invoiceId)).toBe('VOID');
			},
			TIMEOUT
		);

		it(
			'lets a status change go through after a void whose released time nobody billed again',
			async () => {
				const invoiceId = await storedInvoice('DRAFT');

				const sending = await whileVoiding(
					invoiceId,
					() => handlers(ormType).update({ id: invoiceId, status: 'SENT' }),
					{ billedAgain: false }
				);

				expect(sending.status).toBe('fulfilled');
				expect(await statusOf(invoiceId)).toBe('SENT');
			},
			TIMEOUT
		);

		it(
			"keeps one set of lines when a replacement runs while another one is writing the invoice's lines",
			async () => {
				const invoiceId = await storedInvoice('DRAFT');
				await insert('invoice_item', { id: randomUUID(), ...lineSaying(invoiceId, 'old') });
				// The other replacement, as far as it went: the invoice locked, the old line deleted, its own line saved.
				const other = dataSource.createQueryRunner();
				await other.connect();
				await other.startTransaction();
				await other.query(`SELECT "id" FROM "invoice" WHERE "id" = $1 FOR UPDATE`, [invoiceId]);
				await other.query(`DELETE FROM "invoice_item" WHERE "invoiceId" = $1`, [invoiceId]);
				await insert('invoice_item', { id: randomUUID(), ...lineSaying(invoiceId, 'first') }, other);

				const replacing = Promise.allSettled([
					handlers(ormType).replaceLines(invoiceId, [lineSaying(invoiceId, 'second')])
				]);
				try {
					await untilWaiting(1, 'invoice');
				} finally {
					await other.commitTransaction();
					await other.release();
				}
				const [replaced] = await replacing;

				expect(replaced.status).toBe('fulfilled');
				expect(await descriptionsOf(invoiceId)).toEqual(['second']);
			},
			TIMEOUT
		);
	});

	it(
		"refuses an answer to an estimate that a void and a billing of its time overtake, on the link's TypeORM",
		async () => {
			const invoiceId = await storedInvoice('SENT', { isEstimate: true });
			const email = 'customer@example.com';
			const claims = { invoiceId, organizationId: ORG, tenantId: TENANT, email };
			const token = loaded.signPurposeToken(loaded.TokenPurposeEnum.ESTIMATE, claims, { expiresIn: '7d' });
			const expireDate = new Date(Date.now() + 7 * DAY);
			await insert('estimate_email', { id: randomUUID(), ...scope, token, email, expireDate });
			const answers = new loaded.PublicInvoiceService(
				dataSource.getRepository(loaded.Invoice),
				dataSource.getRepository(loaded.EstimateEmail)
			);

			const accepting = await whileVoiding(invoiceId, () =>
				answers.updateInvoice({ id: invoiceId, token }, { status: 'ACCEPTED' })
			);

			expect(accepting).toMatchObject({
				status: 'rejected',
				reason: { status: 400, message: loaded.INVOICE_VOID_IS_FINAL }
			});
			expect(await statusOf(invoiceId)).toBe('VOID');
		},
		TIMEOUT
	);
});

/** A value for a NOT NULL column the spec does not name, by the column's data type. */
function placeholderFor(type: string): unknown {
	const lowerCaseType = type.toLowerCase();
	const isNumeric = /int|numeric|decimal|real|double/.test(lowerCaseType);
	if (isNumeric) {
		return 0;
	}
	const isBoolean = /bool/.test(lowerCaseType);
	if (isBoolean) {
		return false;
	}
	const isTemporal = /date|time/.test(lowerCaseType);
	if (isTemporal) {
		return '2026-01-01 00:00:00';
	}
	return 'x';
}

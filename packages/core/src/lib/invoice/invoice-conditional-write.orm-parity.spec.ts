import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Conditional invoice writes (ever-co/ever-teams#5243), on both ORMs, over one database whose tables TypeORM created.
 *
 * An edit is saved under the `updatedAt` the caller read (`expectedUpdatedAt`): `PUT /invoices/:id` for the fields,
 * `POST /invoice-item/bulk/:invoiceId?expectedUpdatedAt=` for the lines, and `PUT /invoices/:id/with-items` for both in
 * one transaction. A write saved meanwhile refuses the edit with 409, nothing written, and the 409 carries the invoice
 * as it is now. Without the precondition, every route writes as it did before.
 *
 * Each case runs the real command handlers and services against one better-sqlite3 file. SQLite locks no rows, so a
 * write "meanwhile" is one that lands between the caller's read and its save: the comparison is what is under test
 * here, the row lock being PostgreSQL's and MySQL's (see `lockInvoice`).
 */

const TIMEOUT = 15 * 60 * 1000;

type Row = Record<string, any>;
type Orm = 'typeorm' | 'mikro-orm';

const ORMS: Orm[] = ['typeorm', 'mikro-orm'];

const TENANT = '5243c0de-0000-4000-8000-00000000a001';
const ORG = '5243c0de-0000-4000-8000-00000000b001';
const OTHER_ORG = '5243c0de-0000-4000-8000-00000000b002';
const USER = '5243c0de-0000-4000-8000-00000000c001';
const OWN = '5243c0de-0000-4000-8000-00000000d001';
const OUTSIDER = '5243c0de-0000-4000-8000-00000000d002';

const scope = { tenantId: TENANT, organizationId: ORG };

/** A later `updatedAt` than any the cases read, in the form TypeORM writes on SQLite. */
const MEANWHILE = '2030-01-01 12:00:00.000';

describe('Invoice edits under a precondition, on TypeORM and on MikroORM (#5243)', () => {
	const file = path.join(os.tmpdir(), `gauzy-invoice-conditional-${process.pid}-${Date.now()}.sqlite3`);

	let loaded: Row = {};
	let dataSource: any;
	let orm: any;
	let invoiceNumber = 0;

	/** The routes' command handlers on the ORM named, with the services the module graph would hand them. */
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
		for (const service of [invoiceService, invoiceItemService]) {
			Object.defineProperty(service, 'ormType', { get: () => ormType });
		}
		// What `ModuleRef.get(…, { strict: false })` answers across the two modules
		const moduleRef = {
			get: (token: unknown) => (token === loaded.InvoiceService ? invoiceService : invoiceItemService)
		};
		return {
			read: (invoiceId: string) => invoiceService.findOneByIdString(invoiceId),
			update: (input: Row) =>
				new loaded.InvoiceUpdateHandler(invoiceService).execute(new loaded.InvoiceUpdateCommand(input)),
			replaceLines: (invoiceId: string, lines: Row[], expectedUpdatedAt: Date | null = null) =>
				new loaded.InvoiceItemBulkCreateHandler(invoiceItemService, moduleRef).execute(
					new loaded.InvoiceItemBulkCreateCommand(invoiceId, lines, expectedUpdatedAt)
				),
			updateWithItems: (input: Row) =>
				new loaded.InvoiceUpdateWithItemsHandler(invoiceService, moduleRef).execute(
					new loaded.InvoiceUpdateWithItemsCommand(input)
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

	/** A draft invoice with one line, `held`, as an edit opens it. */
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
			terms: 'as read',
			status: 'DRAFT',
			updatedAt: '2026-11-01 09:00:00.000'
		});
		await insert('invoice_item', {
			id: randomUUID(),
			...scope,
			invoiceId,
			description: 'held',
			price: 1,
			quantity: 1,
			totalValue: 1
		});
		return invoiceId;
	};

	/** The `updatedAt` the API answers a read with, as a client sends it back. */
	const readVersion = async (ormType: Orm, invoiceId: string): Promise<string> => {
		const invoice = await handlers(ormType).read(invoiceId);
		return new Date(invoice.updatedAt).toISOString();
	};

	/** Another request's change, saved between the caller's read and its save. */
	const changedMeanwhile = async (invoiceId: string): Promise<void> => {
		await dataSource.query(`UPDATE "invoice" SET "terms" = ?, "updatedAt" = ? WHERE "id" = ?`, [
			'meanwhile',
			MEANWHILE,
			invoiceId
		]);
		orm.em.clear();
	};

	const termsOf = async (invoiceId: string): Promise<string> => {
		const [row] = await dataSource.query(`SELECT "terms" FROM "invoice" WHERE "id" = ?`, [invoiceId]);
		return row.terms;
	};

	const updatedAtOf = async (invoiceId: string): Promise<unknown> => {
		const [row] = await dataSource.query(`SELECT "updatedAt" FROM "invoice" WHERE "id" = ?`, [invoiceId]);
		return row.updatedAt;
	};

	const lineIdsOf = async (invoiceId: string): Promise<string[]> => {
		const rows: Row[] = await dataSource.query(`SELECT "id" FROM "invoice_item" WHERE "invoiceId" = ?`, [
			invoiceId
		]);
		return rows.map((row) => row.id);
	};

	const linesOf = async (invoiceId: string): Promise<string[]> => {
		const rows: Row[] = await dataSource.query(
			`SELECT "description" FROM "invoice_item" WHERE "invoiceId" = ? ORDER BY "description"`,
			[invoiceId]
		);
		return rows.map((row) => row.description);
	};

	const line = (invoiceId: string, description: string, row: Row = {}): Row => ({
		description,
		price: 50,
		quantity: 1,
		totalValue: 50,
		...scope,
		invoiceId,
		...row
	});

	const fields = (invoiceId: string, row: Row = {}): Row => ({ id: invoiceId, ...scope, terms: 'edited', ...row });

	beforeAll(async () => {
		const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
		process.env.DB_ORM = 'mikro-orm';
		process.env.DB_TYPE = 'better-sqlite3';

		try {
			await jest.isolateModulesAsync(async () => {
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
					ApiException: require('../core/errors/api-exception').ApiException,
					InvoiceService: require('./invoice.service').InvoiceService,
					TypeOrmInvoiceRepository: require('./repository/type-orm-invoice.repository')
						.TypeOrmInvoiceRepository,
					MikroOrmInvoiceRepository: require('./repository/mikro-orm-invoice.repository')
						.MikroOrmInvoiceRepository,
					InvoiceUpdateHandler: require('./commands/handlers/invoice.update.handler').InvoiceUpdateHandler,
					InvoiceUpdateCommand: require('./commands/invoice.update.command').InvoiceUpdateCommand,
					InvoiceUpdateWithItemsHandler: require('./commands/handlers/invoice.update-with-items.handler')
						.InvoiceUpdateWithItemsHandler,
					InvoiceUpdateWithItemsCommand: require('./commands/invoice.update-with-items.command')
						.InvoiceUpdateWithItemsCommand,
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

		await dataSource.query('PRAGMA foreign_keys = OFF');
		await insert('tenant', { id: TENANT, name: 'tenant' });
		await insert('organization', { id: ORG, name: 'organization', tenantId: TENANT, currency: 'EUR' });
		await insert('organization', { id: OTHER_ORG, name: 'other organization', tenantId: TENANT, currency: 'EUR' });
		await insert('user', { id: USER, tenantId: TENANT, firstName: 'Ada', lastName: 'Lovelace' });
		await insert('employee', { id: OWN, ...scope, userId: USER });
		await insert('employee', { id: OUTSIDER, tenantId: TENANT, organizationId: OTHER_ORG, userId: USER });
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

	/** The refusal of a save made on a stale read: 409, the invoice as it is now, and both instants. */
	const expectChangedMeanwhile = async (save: Promise<unknown>, invoiceId: string, expected: string) => {
		const error: any = await save.then(
			() => null,
			(refusal) => refusal
		);
		expect(error).toBeInstanceOf(loaded.ApiException);
		expect(error.getStatus()).toBe(409);
		expect(error.code).toBe('CONCURRENT_MODIFICATION');
		expect(error.details.expectedUpdatedAt).toBe(expected);
		expect(error.details.actualUpdatedAt).not.toBe(expected);
		expect(error.details.invoice).toMatchObject({ id: invoiceId, terms: 'meanwhile' });
		expect(error.details.invoice.invoiceItems.map((item: Row) => item.description)).toEqual(['held']);
	};

	describe.each(ORMS)('on %s', (ormType) => {
		describe('PUT /invoices/:id', () => {
			it('saves the fields while the invoice still holds the updatedAt read', async () => {
				const invoiceId = await draftInvoice();
				const expectedUpdatedAt = await readVersion(ormType, invoiceId);

				await handlers(ormType).update(fields(invoiceId, { expectedUpdatedAt }));

				expect(await termsOf(invoiceId)).toBe('edited');
			});

			it('saves nothing, and answers 409 with the invoice as it is now, once it changed meanwhile', async () => {
				const invoiceId = await draftInvoice();
				const expectedUpdatedAt = await readVersion(ormType, invoiceId);
				await changedMeanwhile(invoiceId);

				const save = handlers(ormType).update(fields(invoiceId, { expectedUpdatedAt }));

				await expectChangedMeanwhile(save, invoiceId, expectedUpdatedAt);
				expect(await termsOf(invoiceId)).toBe('meanwhile');
			});

			it('refuses a second save made on the same read: the first one moved the updatedAt read', async () => {
				const invoiceId = await draftInvoice();
				const expectedUpdatedAt = await readVersion(ormType, invoiceId);
				const saved = await handlers(ormType).update(fields(invoiceId, { expectedUpdatedAt }));
				orm.em.clear();
				expect(new Date(saved.updatedAt).toISOString()).toBe(await readVersion(ormType, invoiceId));

				const second = handlers(ormType).update(fields(invoiceId, { expectedUpdatedAt, terms: 'second' }));

				await expect(second).rejects.toMatchObject({ status: 409, code: 'CONCURRENT_MODIFICATION' });
				expect(await termsOf(invoiceId)).toBe('edited');
			});

			it('saves the fields as it always did when no precondition is stated', async () => {
				const invoiceId = await draftInvoice();
				await changedMeanwhile(invoiceId);

				await handlers(ormType).update(fields(invoiceId));

				expect(await termsOf(invoiceId)).toBe('edited');
			});

			it('refuses a precondition that is no date and time, saving nothing', async () => {
				const invoiceId = await draftInvoice();

				const save = handlers(ormType).update(fields(invoiceId, { expectedUpdatedAt: 'yesterday' }));

				await expect(save).rejects.toMatchObject({ status: 400 });
				expect(await termsOf(invoiceId)).toBe('as read');
			});

			it("answers 404 for an invoice the caller's tenant does not have, saving nothing", async () => {
				const missing = randomUUID();

				const save = handlers(ormType).update(fields(missing, { expectedUpdatedAt: new Date().toISOString() }));

				await expect(save).rejects.toMatchObject({ status: 404 });
				const [row] = await dataSource.query(`SELECT COUNT(*) AS "n" FROM "invoice" WHERE "id" = ?`, [missing]);
				expect(Number(row.n)).toBe(0);
			});
		});

		describe('POST /invoice-item/bulk/:invoiceId', () => {
			it("replaces the lines while the invoice still holds the updatedAt read, and moves the invoice's", async () => {
				const invoiceId = await draftInvoice();
				const expectedUpdatedAt = await readVersion(ormType, invoiceId);
				const before = await updatedAtOf(invoiceId);

				await handlers(ormType).replaceLines(
					invoiceId,
					[line(invoiceId, 'replacement')],
					new Date(expectedUpdatedAt)
				);

				expect(await linesOf(invoiceId)).toEqual(['replacement']);
				expect(await updatedAtOf(invoiceId)).not.toEqual(before);
				orm.em.clear();
				expect(await readVersion(ormType, invoiceId)).not.toBe(expectedUpdatedAt);
			});

			it('replaces nothing, and answers 409 with the invoice as it is now, once it changed meanwhile', async () => {
				const invoiceId = await draftInvoice();
				const expectedUpdatedAt = await readVersion(ormType, invoiceId);
				await changedMeanwhile(invoiceId);

				const save = handlers(ormType).replaceLines(
					invoiceId,
					[line(invoiceId, 'replacement')],
					new Date(expectedUpdatedAt)
				);

				await expectChangedMeanwhile(save, invoiceId, expectedUpdatedAt);
				expect(await linesOf(invoiceId)).toEqual(['held']);
			});

			it("replaces the lines as it always did when no precondition is stated, leaving the invoice's row alone", async () => {
				const invoiceId = await draftInvoice();
				const before = await updatedAtOf(invoiceId);

				await handlers(ormType).replaceLines(invoiceId, [line(invoiceId, 'replacement')]);

				expect(await linesOf(invoiceId)).toEqual(['replacement']);
				expect(await updatedAtOf(invoiceId)).toEqual(before);
			});
		});

		describe('POST /invoice-item/bulk/:invoiceId, conditional', () => {
			it('refuses a second replacement made on the same read', async () => {
				const invoiceId = await draftInvoice();
				const expectedUpdatedAt = new Date(await readVersion(ormType, invoiceId));
				await handlers(ormType).replaceLines(invoiceId, [line(invoiceId, 'first')], expectedUpdatedAt);

				const second = handlers(ormType).replaceLines(
					invoiceId,
					[line(invoiceId, 'second')],
					expectedUpdatedAt
				);

				await expect(second).rejects.toMatchObject({ status: 409 });
				expect(await linesOf(invoiceId)).toEqual(['first']);
			});

			it('saves every line on the invoice whose precondition it checked, whichever invoice a line states', async () => {
				const invoiceId = await draftInvoice();
				const otherInvoiceId = await draftInvoice();
				const expectedUpdatedAt = new Date(await readVersion(ormType, invoiceId));

				await handlers(ormType).replaceLines(invoiceId, [line(otherInvoiceId, 'bound')], expectedUpdatedAt);

				expect(await linesOf(invoiceId)).toEqual(['bound']);
				expect(await linesOf(otherInvoiceId)).toEqual(['held']);
			});
		});

		describe('PUT /invoices/:id/with-items', () => {
			it('saves the fields and the lines together while the invoice still holds the updatedAt read', async () => {
				const invoiceId = await draftInvoice();
				const expectedUpdatedAt = await readVersion(ormType, invoiceId);

				const saved = await handlers(ormType).updateWithItems({
					...fields(invoiceId, { expectedUpdatedAt }),
					invoiceItems: [line(invoiceId, 'first'), line(invoiceId, 'second')]
				});

				expect(await termsOf(invoiceId)).toBe('edited');
				expect(await linesOf(invoiceId)).toEqual(['first', 'second']);
				// The answer states the version the next save is made under
				expect(saved.invoiceItems).toHaveLength(2);
				orm.em.clear();
				expect(new Date(saved.updatedAt).toISOString()).toBe(await readVersion(ormType, invoiceId));
				expect(new Date(saved.updatedAt).toISOString()).not.toBe(expectedUpdatedAt);
			});

			it('saves neither, and answers 409 with the invoice as it is now, once it changed meanwhile', async () => {
				const invoiceId = await draftInvoice();
				const expectedUpdatedAt = await readVersion(ormType, invoiceId);
				await changedMeanwhile(invoiceId);

				const save = handlers(ormType).updateWithItems({
					...fields(invoiceId, { expectedUpdatedAt }),
					invoiceItems: [line(invoiceId, 'first')]
				});

				await expectChangedMeanwhile(save, invoiceId, expectedUpdatedAt);
				expect(await termsOf(invoiceId)).toBe('meanwhile');
				expect(await linesOf(invoiceId)).toEqual(['held']);
			});

			it('saves both when no precondition is stated', async () => {
				const invoiceId = await draftInvoice();

				await handlers(ormType).updateWithItems({
					...fields(invoiceId),
					invoiceItems: [line(invoiceId, 'first')]
				});

				expect(await termsOf(invoiceId)).toBe('edited');
				expect(await linesOf(invoiceId)).toEqual(['first']);
			});

			it('keeps the fields as they were when the lines are refused: an edit is never half saved', async () => {
				const invoiceId = await draftInvoice();
				const expectedUpdatedAt = await readVersion(ormType, invoiceId);
				// Time of another organization: the lines that bill it are refused, after the fields were written
				const foreignTime = randomUUID();
				await insert('time_log', {
					id: foreignTime,
					tenantId: TENANT,
					organizationId: OTHER_ORG,
					employeeId: OUTSIDER,
					startedAt: '2026-10-01 09:00:00',
					stoppedAt: '2026-10-01 10:00:00',
					isBillable: 1
				});

				const save = handlers(ormType).updateWithItems({
					...fields(invoiceId, { expectedUpdatedAt }),
					invoiceItems: [line(invoiceId, 'billing', { timeLogIds: [foreignTime] })]
				});

				await expect(save).rejects.toMatchObject({ status: 400 });
				expect(await termsOf(invoiceId)).toBe('as read');
				expect(await linesOf(invoiceId)).toEqual(['held']);
			});

			it('refuses a second save made on the same read', async () => {
				const invoiceId = await draftInvoice();
				const expectedUpdatedAt = await readVersion(ormType, invoiceId);
				await handlers(ormType).updateWithItems({
					...fields(invoiceId, { expectedUpdatedAt }),
					invoiceItems: [line(invoiceId, 'first')]
				});

				const second = handlers(ormType).updateWithItems({
					...fields(invoiceId, { expectedUpdatedAt, terms: 'second' }),
					invoiceItems: [line(invoiceId, 'second')]
				});

				await expect(second).rejects.toMatchObject({ status: 409 });
				expect(await termsOf(invoiceId)).toBe('edited');
				expect(await linesOf(invoiceId)).toEqual(['first']);
			});

			it("refuses a line that names another invoice's line, saving nothing on either invoice", async () => {
				const invoiceId = await draftInvoice();
				const otherInvoiceId = await draftInvoice();
				const [otherLineId] = await lineIdsOf(otherInvoiceId);

				const save = handlers(ormType).updateWithItems({
					...fields(invoiceId),
					invoiceItems: [line(invoiceId, 'taken', { id: otherLineId })]
				});

				await expect(save).rejects.toMatchObject({ status: 400 });
				expect(await termsOf(invoiceId)).toBe('as read');
				expect(await linesOf(invoiceId)).toEqual(['held']);
				expect(await lineIdsOf(otherInvoiceId)).toEqual([otherLineId]);
				expect(await linesOf(otherInvoiceId)).toEqual(['held']);
			});

			it('keeps a line that names, by its id, a line of the invoice itself', async () => {
				const invoiceId = await draftInvoice();
				const [lineId] = await lineIdsOf(invoiceId);

				await handlers(ormType).updateWithItems({
					...fields(invoiceId),
					invoiceItems: [line(invoiceId, 'rewritten', { id: lineId })]
				});

				expect(await linesOf(invoiceId)).toEqual(['rewritten']);
			});

			it('refuses to move the invoice to another organization with its lines, saving nothing', async () => {
				const invoiceId = await draftInvoice();

				const save = handlers(ormType).updateWithItems({
					...fields(invoiceId, { organizationId: OTHER_ORG }),
					invoiceItems: [line(invoiceId, 'first')]
				});

				await expect(save).rejects.toMatchObject({ status: 400 });
				expect(await termsOf(invoiceId)).toBe('as read');
				expect(await linesOf(invoiceId)).toEqual(['held']);
			});

			it('writes every line on the invoice the route names, whichever invoice a line states', async () => {
				const invoiceId = await draftInvoice();
				const otherInvoiceId = await draftInvoice();

				await handlers(ormType).updateWithItems({
					...fields(invoiceId),
					invoiceItems: [line(otherInvoiceId, 'moved')]
				});

				expect(await linesOf(invoiceId)).toEqual(['moved']);
				expect(await linesOf(otherInvoiceId)).toEqual(['held']);
			});
		});
	});
});

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

import { randomUUID } from 'node:crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * `InvoiceService.duplicate` (`POST /invoices/:id/duplicate`) on both ORMs, against one better-sqlite3 file whose
 * tables TypeORM created, with foreign keys enforced.
 *
 * What the unit spec cannot see is what the copy is actually saved with: the number after the tenant's highest, a
 * reset draft, the same contact, payment term and tags, and lines that keep their employee, project, task and product.
 * On MikroORM a nested line's `employeeId` (and the others) is the unpersisted mirror of its relation, so a copy built
 * from mirrors alone saved those links as NULL. A source outside the caller's tenant, or outside their organization
 * boundary, is not found, and nothing is written.
 */

const TIMEOUT = 15 * 60 * 1000;

type Row = Record<string, any>;
type Orm = 'typeorm' | 'mikro-orm';

const ORMS: Orm[] = ['typeorm', 'mikro-orm'];

const TENANT = '3c7d3f20-0000-4000-8000-00000000a001';
const ORG = '3c7d3f20-0000-4000-8000-00000000b001';
const OTHER_ORG = '3c7d3f20-0000-4000-8000-00000000b002';
const OTHER_TENANT = '3c7d3f20-0000-4000-8000-00000000a002';
const OTHER_TENANT_ORG = '3c7d3f20-0000-4000-8000-00000000b003';
const USER = '3c7d3f20-0000-4000-8000-00000000c001';
const EMPLOYEE = '3c7d3f20-0000-4000-8000-00000000d001';
const CONTACT = '3c7d3f20-0000-4000-8000-00000000e001';
const TAG = '3c7d3f20-0000-4000-8000-00000000f001';
const PROJECT = '3c7d3f20-0000-4000-8000-00000000f002';
const TASK = '3c7d3f20-0000-4000-8000-00000000f003';
const PRODUCT = '3c7d3f20-0000-4000-8000-00000000f004';
/** A payment term: the column carries no foreign key (the kernel migration adds it), so no term row is needed. */
const TERM = '3c7d3f20-0000-4000-8000-00000000f005';

const scope = { tenantId: TENANT, organizationId: ORG };

describe('Duplicating an invoice, on TypeORM and on MikroORM', () => {
	const file = path.join(os.tmpdir(), `gauzy-invoice-duplicate-${process.pid}-${Date.now()}.sqlite3`);

	let loaded: Row = {};
	let dataSource: any;
	let orm: any;
	let invoiceNumber = 100;

	/** The invoice service on the ORM named, its MikroORM repository on the ORM's own entity manager. */
	const serviceOn = (ormType: Orm) => {
		const service = new loaded.InvoiceService(
			new loaded.TypeOrmInvoiceRepository(dataSource.getRepository(loaded.Invoice)),
			new loaded.MikroOrmInvoiceRepository(orm.em, loaded.Invoice),
			{},
			{},
			{},
			{},
			{}
		);
		// The ORM is a module constant of the CRUD base, read when the registry loaded (MikroORM, here); the instance
		// states its own so one registry runs both halves over the same mapping.
		Object.defineProperty(service, 'ormType', { get: () => ormType });
		return service;
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

	/**
	 * A paid invoice with one line linked to an employee, a project, a task and a product, one tag, a contact, a payment
	 * term, a recipient and a public link; `row` moves it to another tenant or organization.
	 */
	const sourceInvoice = async (row: Row = {}): Promise<string> => {
		const id = randomUUID();
		// Ten apart: the copy of one source takes the number after the tenant's highest, never the next source's.
		invoiceNumber += 10;
		await dataSource.query('PRAGMA foreign_keys = OFF');
		await insert('invoice', {
			id,
			...scope,
			fromOrganizationId: ORG,
			toContactId: CONTACT,
			organizationContactId: CONTACT,
			invoiceNumber,
			invoiceDate: '2026-10-01 00:00:00.000',
			dueDate: '2026-10-31 00:00:00.000',
			currency: 'EUR',
			discountValue: 0,
			// As an order invoice states it: the schedule is the payment term, the text column is empty
			terms: '',
			paymentTermId: TERM,
			status: 'FULLY_PAID',
			paid: 1,
			alreadyPaid: 100,
			amountDue: 0,
			totalValue: 100,
			token: 'secret-token',
			sentTo: 'client@acme.test',
			isEstimate: 0,
			...row
		});
		await insert('invoice_item', {
			id: randomUUID(),
			tenantId: row.tenantId ?? TENANT,
			organizationId: row.organizationId ?? ORG,
			invoiceId: id,
			description: 'design',
			price: 100,
			quantity: 1,
			totalValue: 100,
			employeeId: EMPLOYEE,
			projectId: PROJECT,
			taskId: TASK,
			productId: PRODUCT
		});
		await dataSource.query(`INSERT INTO "tag_invoice" ("invoiceId", "tagId") VALUES (?, ?)`, [id, TAG]);
		await dataSource.query('PRAGMA foreign_keys = ON');
		return id;
	};

	const count = async (table: string): Promise<number> => {
		const [row] = await dataSource.query(`SELECT COUNT(*) AS "n" FROM "${table}"`);
		return Number(row.n);
	};

	/** The HTTP status a rejected call answers with. */
	const statusOfRejection = async (call: Promise<unknown>): Promise<number | undefined> => {
		try {
			await call;
		} catch (error) {
			return (error as { getStatus?: () => number })?.getStatus?.();
		}
		throw new Error('the call was not rejected');
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
					RequestContext: require('../core/context/request-context').RequestContext,
					InvoiceService: require('./invoice.service').InvoiceService,
					TypeOrmInvoiceRepository: require('./repository/type-orm-invoice.repository')
						.TypeOrmInvoiceRepository,
					MikroOrmInvoiceRepository: require('./repository/mikro-orm-invoice.repository')
						.MikroOrmInvoiceRepository
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

		// The placeholder column of the custom-fields embeddables, which MikroORM selects whenever it joins an entity
		// that has custom fields (the copy's read joins its tags, and the lines' employee, project, task and product).
		// An installation has it from the custom-fields migrations; `synchronize` does not create it, because TypeORM's
		// embeddable gets it at bootstrap, when the application registers its custom fields (as in
		// invoice.service.mikro-orm-pdf.spec.ts).
		for (const table of ['employee', 'organization_project', 'task', 'product', 'tag', 'organization_contact']) {
			const columns: Row[] = await dataSource.query(`PRAGMA table_info("${table}")`);
			if (!columns.some((column) => column.name === 'fix_relational_custom_fields')) {
				await dataSource.query(`ALTER TABLE "${table}" ADD COLUMN "fix_relational_custom_fields" boolean`);
			}
		}

		// The rows the cases name, written without the records their base columns would point at; foreign keys are
		// enforced again before any case runs.
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
		await insert('employee', { id: EMPLOYEE, ...scope, userId: USER });
		await insert('organization_contact', { id: CONTACT, ...scope, name: 'Acme' });
		await insert('tag', { id: TAG, ...scope, name: 'retainer', color: '#ffffff' });
		await insert('organization_project', { id: PROJECT, ...scope, name: 'project' });
		await insert('task', { id: TASK, ...scope, title: 'task', projectId: PROJECT });
		await insert('product', { id: PRODUCT, ...scope, code: 'P-1' });
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
		// A member of the organization, not a tenant admin: kept inside the organization boundary.
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
		jest.spyOn(context, 'hasPermission').mockReturnValue(false);
		jest.spyOn(context, 'hasRoles').mockReturnValue(false);
		orm.em.clear();
	});

	afterEach(() => jest.restoreAllMocks());

	describe.each(ORMS)('on %s', (ormType) => {
		it(
			'saves a reset draft of the next number that keeps the contact, payment term, tags and line links',
			async () => {
				const sourceId = await sourceInvoice();
				const [{ max }] = await dataSource.query(
					`SELECT MAX("invoiceNumber") AS "max" FROM "invoice" WHERE "tenantId" = ?`,
					[TENANT]
				);

				const copy = await serviceOn(ormType).duplicate(sourceId);

				const [saved] = await dataSource.query(`SELECT * FROM "invoice" WHERE "id" = ?`, [copy.id]);
				expect(saved).toMatchObject({
					tenantId: TENANT,
					organizationId: ORG,
					status: 'DRAFT',
					paid: 0,
					alreadyPaid: 0,
					amountDue: 100,
					token: null,
					sentTo: null,
					fromOrganizationId: ORG,
					toContactId: CONTACT,
					organizationContactId: CONTACT,
					paymentTermId: TERM
				});
				expect(Number(saved.invoiceNumber)).toBe(Number(max) + 1);

				const tags = await dataSource.query(`SELECT "tagId" FROM "tag_invoice" WHERE "invoiceId" = ?`, [
					copy.id
				]);
				expect(tags).toEqual([{ tagId: TAG }]);

				const lines = await dataSource.query(
					`SELECT "tenantId", "organizationId", "employeeId", "projectId", "taskId", "productId", "expenseId"
				 FROM "invoice_item" WHERE "invoiceId" = ?`,
					[copy.id]
				);
				expect(lines).toEqual([
					{
						tenantId: TENANT,
						organizationId: ORG,
						employeeId: EMPLOYEE,
						projectId: PROJECT,
						taskId: TASK,
						productId: PRODUCT,
						expenseId: null
					}
				]);
				// The links are references to the rows that exist, not new rows
				expect(await count('employee')).toBe(1);
				expect(await count('product')).toBe(1);

				const [source] = await dataSource.query(
					`SELECT "status", "paid", "token", "sentTo", "paymentTermId" FROM "invoice" WHERE "id" = ?`,
					[sourceId]
				);
				expect(source).toEqual({
					status: 'FULLY_PAID',
					paid: 1,
					token: 'secret-token',
					sentTo: 'client@acme.test',
					paymentTermId: TERM
				});
			},
			TIMEOUT
		);

		it(
			'does not find an invoice of another tenant, and writes nothing',
			async () => {
				const sourceId = await sourceInvoice({
					tenantId: OTHER_TENANT,
					organizationId: OTHER_TENANT_ORG,
					fromOrganizationId: OTHER_TENANT_ORG
				});
				const [invoices, lines] = [await count('invoice'), await count('invoice_item')];

				expect(await statusOfRejection(serviceOn(ormType).duplicate(sourceId))).toBe(404);

				expect(await count('invoice')).toBe(invoices);
				expect(await count('invoice_item')).toBe(lines);
			},
			TIMEOUT
		);

		it(
			'does not find an invoice of another organization of the tenant for a non-admin, and writes nothing',
			async () => {
				const sourceId = await sourceInvoice({ organizationId: OTHER_ORG, fromOrganizationId: OTHER_ORG });
				const [invoices, lines] = [await count('invoice'), await count('invoice_item')];

				expect(await statusOfRejection(serviceOn(ormType).duplicate(sourceId))).toBe(404);

				expect(await count('invoice')).toBe(invoices);
				expect(await count('invoice_item')).toBe(lines);
			},
			TIMEOUT
		);
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

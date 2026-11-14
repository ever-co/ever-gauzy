import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The two reads of `EstimateAnswerNotifier`, on a real SQLite database:
 * - who hears of a client's answer: the active employees of the estimate's organization, in its tenant, whose active
 *   user holds a role that grants INVOICES_EDIT (an enabled permission row), through the same nested relation filter as
 *   rate change requests (employee, user, role, role permissions);
 * - the answered document, in the answer's tenant only and whatever it has become since, with its client, its
 *   organization and the few fields of its creator the email needs.
 */

const TIMEOUT = 10 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT = '11111111-1111-4111-8111-111111111112';
const ORGANIZATION = '22222222-2222-4222-8222-222222222221';
const OTHER_ORGANIZATION = '22222222-2222-4222-8222-222222222222';

const ROLE = {
	/** Grants INVOICES_EDIT. */
	accountant: '33333333-3333-4333-8333-333333333331',
	/** Holds INVOICES_EDIT switched off. */
	disabled: '33333333-3333-4333-8333-333333333332',
	/** Has no INVOICES_EDIT row at all, only INVOICES_VIEW. */
	viewer: '33333333-3333-4333-8333-333333333333',
	/** Grants INVOICES_EDIT, in the other tenant. */
	otherTenant: '33333333-3333-4333-8333-333333333334'
};

/** The employees of the database, by why each one is or is not told. */
const EMPLOYEE = {
	told: '55555555-5555-4555-8555-555555555551',
	inactiveUser: '55555555-5555-4555-8555-555555555552',
	inactiveEmployee: '55555555-5555-4555-8555-555555555553',
	archived: '55555555-5555-4555-8555-555555555554',
	permissionOff: '55555555-5555-4555-8555-555555555555',
	viewerOnly: '55555555-5555-4555-8555-555555555556',
	otherOrganization: '55555555-5555-4555-8555-555555555557',
	otherTenant: '55555555-5555-4555-8555-555555555558'
};

const userOf = (employeeId: string) => `44444444${employeeId.slice(8)}`;

const CONTACT = '77777777-7777-4777-8777-777777777771';
const ESTIMATE = '88888888-8888-4888-8888-888888888881';
const INVOICE = '88888888-8888-4888-8888-888888888882';

interface IReads {
	handlers: { id: string; userId: string }[];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	estimate: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	estimateInOtherTenant: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	convertedInvoice: any;
}

async function read(): Promise<IReads> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'typeorm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-invoice-handlers-${process.pid}-${Date.now()}.sqlite3`);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let dataSource: any;
	const reads = {} as IReads;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../core/entities');
			const { DataSource } = require('typeorm');
			const { Invoice } = require('../invoice.entity');
			const { EstimateAnswerNotifier } = require('./estimate-answer-notifier.service');

			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true
			});
			await dataSource.initialize();
			// Placeholders fill the NOT NULL references this read does not follow
			await dataSource.query('PRAGMA foreign_keys = OFF');

			// A row with the columns given, and a placeholder in every other NOT NULL column without a default.
			const insert = async (table: string, row: Record<string, unknown>) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
				const values: Record<string, unknown> = { ...row };
				for (const column of columns) {
					if (column.name in values || !column.notnull || column.dflt_value !== null || column.pk) continue;
					const type = String(column.type).toLowerCase();
					values[column.name] = /int|bool|numeric|decimal|real|float/.test(type)
						? 0
						: /date|time/.test(type)
							? '2026-01-01 00:00:00'
							: `x-${table}-${Object.keys(values).length}-${Math.random()}`;
				}
				const keys = Object.keys(values);
				await dataSource.query(
					`INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(', ')}) VALUES (${keys
						.map(() => '?')
						.join(', ')})`,
					keys.map((key) => values[key])
				);
			};

			await insert('tenant', { id: TENANT, name: 'Tenant' });
			await insert('tenant', { id: OTHER_TENANT, name: 'Other tenant' });
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			await insert('organization', { id: OTHER_ORGANIZATION, tenantId: TENANT, name: 'Other organization' });

			const roles: [string, string, string, string, boolean][] = [
				[ROLE.accountant, TENANT, 'ACCOUNTANT', 'INVOICES_EDIT', true],
				[ROLE.disabled, TENANT, 'DISABLED', 'INVOICES_EDIT', false],
				[ROLE.viewer, TENANT, 'VIEWER', 'INVOICES_VIEW', true],
				[ROLE.otherTenant, OTHER_TENANT, 'ACCOUNTANT', 'INVOICES_EDIT', true]
			];
			for (const [id, tenantId, name, permission, enabled] of roles) {
				await insert('role', { id, tenantId, name });
				// The application generates the ids: the table has no default for them
				await insert('role_permission', {
					id: `66666666${id.slice(8)}`,
					tenantId,
					roleId: id,
					permission,
					enabled: enabled ? 1 : 0
				});
			}

			const people: [
				string,
				{
					role: string;
					userActive?: boolean;
					tenantId?: string;
					organizationId?: string;
					isActive?: boolean;
					isArchived?: boolean;
				}
			][] = [
				[EMPLOYEE.told, { role: ROLE.accountant }],
				[EMPLOYEE.inactiveUser, { role: ROLE.accountant, userActive: false }],
				[EMPLOYEE.inactiveEmployee, { role: ROLE.accountant, isActive: false }],
				[EMPLOYEE.archived, { role: ROLE.accountant, isArchived: true }],
				[EMPLOYEE.permissionOff, { role: ROLE.disabled }],
				[EMPLOYEE.viewerOnly, { role: ROLE.viewer }],
				[EMPLOYEE.otherOrganization, { role: ROLE.accountant, organizationId: OTHER_ORGANIZATION }],
				[EMPLOYEE.otherTenant, { role: ROLE.otherTenant, tenantId: OTHER_TENANT }]
			];
			for (const [employeeId, person] of people) {
				const tenantId = person.tenantId ?? TENANT;
				const userId = userOf(employeeId);
				await insert('user', {
					id: userId,
					tenantId,
					roleId: person.role,
					email: `${employeeId}@org.test`,
					preferredLanguage: 'bg',
					isActive: person.userActive === false ? 0 : 1
				});
				await insert('employee', {
					id: employeeId,
					tenantId,
					organizationId: person.organizationId ?? ORGANIZATION,
					userId,
					isActive: person.isActive === false ? 0 : 1,
					isArchived: person.isArchived ? 1 : 0
				});
			}

			// An estimate created by the employee told above, for a client, and an invoice beside it
			await insert('organization_contact', {
				id: CONTACT,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				name: 'Acme Corp'
			});
			const document = (id: string, invoiceNumber: number, isEstimate: boolean) => ({
				id,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				invoiceNumber,
				currency: 'EUR',
				totalValue: 1250,
				isEstimate: isEstimate ? 1 : 0,
				toContactId: CONTACT,
				createdByUserId: userOf(EMPLOYEE.told)
			});
			await insert('invoice', document(ESTIMATE, 12, true));
			await insert('invoice', document(INVOICE, 13, false));

			const notifier = new EstimateAnswerNotifier(dataSource.getRepository(Invoice), {} as never, {} as never);
			reads.handlers = await notifier['findInvoiceHandlers'](ORGANIZATION, TENANT);
			reads.estimate = await notifier['findEstimate']({ invoiceId: ESTIMATE, tenantId: TENANT });
			reads.estimateInOtherTenant = await notifier['findEstimate']({
				invoiceId: ESTIMATE,
				tenantId: OTHER_TENANT
			});
			// An answer whose estimate is an invoice by the time the team is told: converted by that answer, or since
			reads.convertedInvoice = await notifier['findEstimate']({ invoiceId: INVOICE, tenantId: TENANT });
		});
	} finally {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		for (const [name, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
		fs.rmSync(file, { force: true });
	}
	return reads;
}

describe('EstimateAnswerNotifier, who handles invoices in an organization (SQLite)', () => {
	let reads: IReads;

	beforeAll(async () => {
		reads = await read();
	}, TIMEOUT);

	it('finds the active employee whose active user holds a role granting INVOICES_EDIT, with their user', () => {
		expect(reads.handlers).toEqual([{ id: EMPLOYEE.told, userId: userOf(EMPLOYEE.told) }]);
	});

	it('leaves out an inactive user or employee, an archived one, a permission switched off or missing, and other organizations and tenants', () => {
		const found = reads.handlers.map((employee) => employee.id);
		for (const left of Object.values(EMPLOYEE).filter((id) => id !== EMPLOYEE.told)) {
			expect(found).not.toContain(left);
		}
	});

	it('reads the estimate with its client, its organization and only what the email needs of its creator', () => {
		expect(reads.estimate).toMatchObject({
			id: ESTIMATE,
			invoiceNumber: 12,
			currency: 'EUR',
			isEstimate: true,
			organizationId: ORGANIZATION,
			tenantId: TENANT,
			toContact: { id: CONTACT, name: 'Acme Corp' },
			organization: { id: ORGANIZATION, name: 'Organization' },
			createdByUser: {
				id: userOf(EMPLOYEE.told),
				email: `${EMPLOYEE.told}@org.test`,
				isActive: true,
				preferredLanguage: 'bg'
			}
		});
		expect(Number(reads.estimate.totalValue)).toBe(1250);
		// Nothing secret of the creator: no password hash, no token, no sign-in code
		for (const secret of ['hash', 'refreshToken', 'emailToken', 'code', 'codeExpireAt']) {
			expect(reads.estimate.createdByUser[secret]).toBeUndefined();
		}
	});

	it('reads the answered document as it is when the team is told, an invoice by then too', () => {
		expect(reads.convertedInvoice).toMatchObject({ id: INVOICE, invoiceNumber: 13, isEstimate: false });
	});

	it('reads no document of another tenant', () => {
		expect(reads.estimateInOtherTenant).toBeNull();
	});
});

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { DataSource } from 'typeorm';
import type { EmbedCredentialService } from './embed-credential.service';
import type { EmbedMemberService, IEmbedMemberScope } from './embed-member.service';

/**
 * The person an embed exchange adds, through the platform's own creation commands (`UserCreateCommand`,
 * `EmployeeCreateCommand`) and services, on one SQLite database with the tables TypeORM creates for every entity and
 * the employee subscriber the application registers: a new account with the employee role and no password, or the
 * tenant's existing account with that role, filed in the credential's organization with tracking on and nothing sent
 * to the person; never an account with any other role, one that is off, or someone the organization archived,
 * deactivated or removed.
 */
const TIMEOUT = 10 * 60 * 1000;

const TENANT = '7d000000-0000-4000-8000-00000000000a';
const ROLELESS_TENANT = '7d000000-0000-4000-8000-00000000000b';
const ORGANIZATION = '7d000000-0000-4000-8000-0000000000f1';
const SISTER_ORGANIZATION = '7d000000-0000-4000-8000-0000000000f2';
const ROLELESS_ORGANIZATION = '7d000000-0000-4000-8000-0000000000f3';

const EMPLOYEE_ROLE = '7d000000-0000-4000-8000-0000000000b1';
const ADMIN_ROLE = '7d000000-0000-4000-8000-0000000000b2';
const SUPER_ADMIN_ROLE = '7d000000-0000-4000-8000-0000000000b3';
const MANAGER_ROLE = '7d000000-0000-4000-8000-0000000000b4';
const VIEWER_ROLE = '7d000000-0000-4000-8000-0000000000b5';
const CUSTOM_ROLE = '7d000000-0000-4000-8000-0000000000b6';

const SCOPE: IEmbedMemberScope = { tenantId: TENANT, organizationId: ORGANIZATION };

/** The secrets of two credentials of the organization: one that may add members, one that may not. */
const ADDING_SECRET = `gze_${'A'.repeat(43)}`;
const PLAIN_SECRET = `gze_${'B'.repeat(43)}`;
const PORTAL = { origin: 'https://portal.fabrikam.example' };

/** The tenant's accounts, by address: each case below reads one of them. */
const ACCOUNTS: Record<string, { id: string; roleId: string; values?: Record<string, unknown> }> = {
	'lina@northwind.example': { id: '7d000000-0000-4000-8000-000000000001', roleId: EMPLOYEE_ROLE },
	'ada@northwind.example': { id: '7d000000-0000-4000-8000-000000000002', roleId: ADMIN_ROLE },
	'sam@northwind.example': { id: '7d000000-0000-4000-8000-000000000003', roleId: SUPER_ADMIN_ROLE },
	'max@northwind.example': { id: '7d000000-0000-4000-8000-00000000000e', roleId: MANAGER_ROLE },
	'val@northwind.example': { id: '7d000000-0000-4000-8000-00000000000f', roleId: VIEWER_ROLE },
	'cleo@northwind.example': { id: '7d000000-0000-4000-8000-000000000010', roleId: CUSTOM_ROLE },
	'omar@northwind.example': { id: '7d000000-0000-4000-8000-000000000004', roleId: EMPLOYEE_ROLE },
	'ines@northwind.example': { id: '7d000000-0000-4000-8000-000000000005', roleId: EMPLOYEE_ROLE },
	'ravi@northwind.example': { id: '7d000000-0000-4000-8000-000000000006', roleId: EMPLOYEE_ROLE },
	'yuki@northwind.example': { id: '7d000000-0000-4000-8000-000000000007', roleId: EMPLOYEE_ROLE },
	'kim@northwind.example': {
		id: '7d000000-0000-4000-8000-000000000008',
		roleId: EMPLOYEE_ROLE,
		values: { isActive: 0 }
	},
	'lee@northwind.example': {
		id: '7d000000-0000-4000-8000-000000000009',
		roleId: EMPLOYEE_ROLE,
		values: { deletedAt: '2026-10-01 09:00:00' }
	},
	'agent-7@northwind.example': { id: '7d000000-0000-4000-8000-00000000000c', roleId: EMPLOYEE_ROLE },
	'nia@northwind.example': { id: '7d000000-0000-4000-8000-000000000011', roleId: EMPLOYEE_ROLE },
	'Mara@Northwind.example': { id: '7d000000-0000-4000-8000-00000000000d', roleId: EMPLOYEE_ROLE }
};

const idOf = (email: string) => ACCOUNTS[email].id;

/** A row with the columns given, and a placeholder in every other NOT NULL column without a default. */
async function insert(dataSource: DataSource, table: string, row: Record<string, unknown>): Promise<void> {
	const columns = (await dataSource.query(`PRAGMA table_info("${table}")`)) as Array<{
		name: string;
		type: string;
		notnull: number;
		dflt_value: string | null;
		pk: number;
	}>;
	const values: Record<string, unknown> = { ...row };
	for (const column of columns) {
		const isFilled = column.name in values;
		const isOptional = !column.notnull || column.dflt_value !== null || column.pk === 1;
		if (isFilled || isOptional) {
			continue;
		}
		values[column.name] = placeholderOf(column.type);
	}
	const keys = Object.keys(values);
	const names = keys.map((key) => `"${key}"`).join(', ');
	const marks = keys.map(() => '?').join(', ');
	await dataSource.query(
		`INSERT INTO "${table}" (${names}) VALUES (${marks})`,
		keys.map((key) => values[key])
	);
}

function placeholderOf(type: string): unknown {
	const lower = type.toLowerCase();
	if (/int|bool|numeric|decimal|real|float/.test(lower)) {
		return 0;
	}
	if (/date|time/.test(lower)) {
		return '2026-01-01 00:00:00';
	}
	return 'x';
}

let employeeCount = 0;

/** An employee of an account, in the organization unless it says otherwise. */
async function insertEmployee(dataSource: DataSource, email: string, row: Record<string, unknown> = {}) {
	employeeCount += 1;
	await insert(dataSource, 'employee', {
		id: `7d000000-0000-4000-8000-0000000e${String(employeeCount).padStart(4, '0')}`,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		userId: idOf(email),
		isActive: 1,
		isArchived: 0,
		...row
	});
}

/** A membership of an account, in the organization unless it says otherwise. */
async function insertMembership(dataSource: DataSource, email: string, row: Record<string, unknown> = {}) {
	await insert(dataSource, 'user_organization', {
		id: `7d000000-0000-4000-8000-00000000${idOf(email).slice(-4)}`,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		userId: idOf(email),
		isActive: 1,
		isArchived: 0,
		...row
	});
}

/** The tenants, organizations, roles and accounts every case reads, and what each account left where. */
async function seed(dataSource: DataSource): Promise<void> {
	await dataSource.query('PRAGMA foreign_keys = OFF');
	await insert(dataSource, 'tenant', { id: TENANT, name: 'Northwind Studio' });
	await insert(dataSource, 'tenant', { id: ROLELESS_TENANT, name: 'Contoso' });
	for (const [id, tenantId, name] of [
		[ORGANIZATION, TENANT, 'Fabrikam Outdoor'],
		[SISTER_ORGANIZATION, TENANT, 'Northwind Studio'],
		[ROLELESS_ORGANIZATION, ROLELESS_TENANT, 'Contoso']
	]) {
		await insert(dataSource, 'organization', { id, tenantId, name, currency: 'EUR' });
	}
	for (const [id, name] of [
		[EMPLOYEE_ROLE, 'EMPLOYEE'],
		[ADMIN_ROLE, 'ADMIN'],
		[SUPER_ADMIN_ROLE, 'SUPER_ADMIN'],
		[MANAGER_ROLE, 'MANAGER'],
		[VIEWER_ROLE, 'VIEWER'],
		[CUSTOM_ROLE, 'PORTAL_REVIEWER']
	]) {
		await insert(dataSource, 'role', { id, tenantId: TENANT, name });
	}
	for (const [email, account] of Object.entries(ACCOUNTS)) {
		await insert(dataSource, 'user', {
			id: account.id,
			tenantId: TENANT,
			email,
			firstName: email.split('@')[0],
			roleId: account.roleId,
			isActive: 1,
			isArchived: 0,
			...account.values
		});
	}
	// Lina works in the sister organization only.
	await insertEmployee(dataSource, 'lina@northwind.example', { organizationId: SISTER_ORGANIZATION });
	await insertMembership(dataSource, 'lina@northwind.example', { organizationId: SISTER_ORGANIZATION });
	// Omar was archived, Ines deactivated, Ravi's employee deleted, and Yuki's membership ended without an employee.
	await insertEmployee(dataSource, 'omar@northwind.example', { isArchived: 1 });
	await insertEmployee(dataSource, 'ines@northwind.example', { isActive: 0 });
	await insertEmployee(dataSource, 'ravi@northwind.example', { deletedAt: '2026-10-01 09:00:00' });
	await insertMembership(dataSource, 'yuki@northwind.example', { isActive: 0 });
	// Nia's addition was cut after her membership was written, before her employee.
	await insertMembership(dataSource, 'nia@northwind.example');
	// The account behind an agent of the sister organization.
	await insertEmployee(dataSource, 'agent-7@northwind.example', {
		organizationId: SISTER_ORGANIZATION,
		kind: 'agent'
	});
}

describe('EmbedMemberService on SQLite, through the platform commands', () => {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	const file = path.join(os.tmpdir(), `gauzy-embed-member-${process.pid}-${Date.now()}.sqlite3`);
	let dataSource: DataSource;
	let service: EmbedMemberService;
	/** The service on another command bus, to cut an addition short. */
	let serviceOnBus: (bus: { execute: (command: object) => Promise<unknown> }) => EmbedMemberService;
	let commandBus: { execute: (command: object) => Promise<unknown> };
	/** `BadRequestException`, as the modules under test load it. */
	let BadRequest: typeof import('@nestjs/common').BadRequestException;
	let currentTenantId: () => string | null;
	let credentialService: EmbedCredentialService;
	const welcomeUser = jest.fn();
	const getPasswordHash = jest.fn();
	const issueEmbedSession = jest.fn(async (_input: { employeeId: string }) => 'an-embed-token');

	beforeAll(async () => {
		process.env.DB_ORM = 'typeorm';
		process.env.DB_TYPE = 'better-sqlite3';
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../core/entities') as typeof import('../core/entities');
			const typeorm = require('typeorm') as typeof import('typeorm');
			const { ClsService } = require('nestjs-cls') as typeof import('nestjs-cls');
			const { RequestContext } =
				require('../core/context/request-context') as typeof import('../core/context/request-context');
			const entities = require('../core/entities/internal') as typeof import('../core/entities/internal');
			const { EmployeeSubscriber } =
				require('../employee/employee.subscriber') as typeof import('../employee/employee.subscriber');
			const { EmployeeService } =
				require('../employee/employee.service') as typeof import('../employee/employee.service');
			const { UserService } = require('../user/user.service') as typeof import('../user/user.service');
			const { UserOrganizationService } =
				require('../user-organization/user-organization.services') as typeof import('../user-organization/user-organization.services');
			const { TypeOrmEmployeeRepository } =
				require('../employee/repository/type-orm-employee.repository') as typeof import('../employee/repository/type-orm-employee.repository');
			const { TypeOrmUserRepository } =
				require('../user/repository/type-orm-user.repository') as typeof import('../user/repository/type-orm-user.repository');
			const { TypeOrmUserOrganizationRepository } =
				require('../user-organization/repository/type-orm-user-organization.repository') as typeof import('../user-organization/repository/type-orm-user-organization.repository');
			const { TypeOrmOrganizationRepository } =
				require('../organization/repository/type-orm-organization.repository') as typeof import('../organization/repository/type-orm-organization.repository');
			const { UserCreateCommand } =
				require('../user/commands/user.create.command') as typeof import('../user/commands/user.create.command');
			const { UserCreateHandler } =
				require('../user/commands/handlers/user.create.handler') as typeof import('../user/commands/handlers/user.create.handler');
			const { EmployeeCreateCommand } =
				require('../employee/commands/employee.create.command') as typeof import('../employee/commands/employee.create.command');
			const { EmployeeCreateHandler } =
				require('../employee/commands/handlers/employee.create.handler') as typeof import('../employee/commands/handlers/employee.create.handler');
			const members = require('./embed-member.service') as typeof import('./embed-member.service');
			BadRequest = (require('@nestjs/common') as typeof import('@nestjs/common')).BadRequestException;

			RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
			currentTenantId = () => RequestContext.currentTenantId();
			dataSource = new typeorm.DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				subscribers: [EmployeeSubscriber],
				synchronize: true,
				// As the application configures it (TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR)
				invalidWhereValuesBehavior: { null: 'sql-null', undefined: 'ignore' }
			});
			await dataSource.initialize();
			await seed(dataSource);

			const employeeService = new EmployeeService(
				new TypeOrmEmployeeRepository(dataSource.getRepository(entities.Employee)),
				{} as never
			);
			const userService = new UserService(
				new TypeOrmUserRepository(dataSource.getRepository(entities.User)),
				{} as never,
				employeeService,
				{} as never,
				{} as never
			);
			const userOrganizationService = new UserOrganizationService(
				new TypeOrmUserOrganizationRepository(dataSource.getRepository(entities.UserOrganization)),
				{} as never,
				new TypeOrmOrganizationRepository(dataSource.getRepository(entities.Organization)),
				employeeService
			);
			// The command bus, with the two handlers the additions run; any other command fails the case.
			const handlers = new Map<unknown, { execute: (command: never) => Promise<unknown> }>();
			commandBus = {
				execute: async (command: object) => {
					const handler = handlers.get(command.constructor);
					if (!handler) {
						throw new Error(`No handler for ${command.constructor.name}`);
					}
					return await handler.execute(command as never);
				}
			};
			handlers.set(UserCreateCommand, new UserCreateHandler(userService));
			handlers.set(
				EmployeeCreateCommand,
				new EmployeeCreateHandler(
					commandBus as never,
					employeeService,
					userOrganizationService,
					{ getPasswordHash } as never,
					{ welcomeUser } as never,
					{} as never,
					userService
				)
			);
			service = new members.EmbedMemberService(dataSource, commandBus as never);
			serviceOnBus = (bus) => new members.EmbedMemberService(dataSource, bus as never);

			const credentials = require('./embed-credential.service') as typeof import('./embed-credential.service');
			const { TypeOrmEmbedCredentialRepository } =
				require('./repository/type-orm-embed-credential.repository') as typeof import('./repository/type-orm-embed-credential.repository');
			const utils = require('./embed.utils') as typeof import('./embed.utils');
			credentialService = new credentials.EmbedCredentialService(
				new TypeOrmEmbedCredentialRepository(dataSource.getRepository(entities.EmbedCredential)),
				{} as never,
				new TypeOrmEmployeeRepository(dataSource.getRepository(entities.Employee)),
				{} as never,
				new TypeOrmUserRepository(dataSource.getRepository(entities.User)),
				{} as never,
				new TypeOrmUserOrganizationRepository(dataSource.getRepository(entities.UserOrganization)),
				{} as never,
				{ issueEmbedSession } as never,
				{ isAllowed: async () => true } as never,
				{} as never,
				service,
				// The employee role holds the time tracker permission, as the defaults give it (ever-co/ever-gauzy#12134).
				{ checkRolePermission: async (_tenantId: string, roleId: string) => roleId === EMPLOYEE_ROLE } as never
			);
			for (const [secret, canAddMembers] of [
				[ADDING_SECRET, 1],
				[PLAIN_SECRET, 0]
			] as const) {
				await insert(dataSource, 'embed_credential', {
					id: `7d000000-0000-4000-8000-0000000c000${canAddMembers}`,
					...SCOPE,
					name: 'Fabrikam portal',
					keyHash: utils.hashEmbedCredential(secret),
					prefix: secret.slice(0, 12),
					canAddMembers
				});
			}
		});
	}, TIMEOUT);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(file, { force: true });
		process.env.DB_ORM = previous.DB_ORM;
		process.env.DB_TYPE = previous.DB_TYPE;
	});

	beforeEach(() => {
		welcomeUser.mockClear();
		getPasswordHash.mockClear();
		issueEmbedSession.mockClear();
	});

	/** How many accounts, employees and memberships the database holds. */
	const counts = async () => {
		const [row] = await dataSource.query(
			`SELECT (SELECT COUNT(*) FROM "user") AS "users", (SELECT COUNT(*) FROM "employee") AS "employees", (SELECT COUNT(*) FROM "user_organization") AS "memberships"`
		);
		return { users: Number(row.users), employees: Number(row.employees), memberships: Number(row.memberships) };
	};

	const userByEmail = async (email: string) => {
		const [row] = await dataSource.query(`SELECT * FROM "user" WHERE "email" = ?`, [email]);
		return row;
	};

	const employeeById = async (id: string) => {
		const [row] = await dataSource.query(`SELECT * FROM "employee" WHERE "id" = ?`, [id]);
		return row;
	};

	const membershipsOf = async (userId: string) =>
		await dataSource.query(`SELECT * FROM "user_organization" WHERE "userId" = ?`, [userId]);

	it(
		'adds a new address as an employee of the organization: an account with the employee role and no password, tracking on, nothing sent',
		async () => {
			const before = await counts();

			const addition = await service.add(SCOPE, {
				email: 'Noor.Haddad@Fabrikam.example',
				firstName: 'Noor',
				lastName: 'Haddad'
			});

			expect(addition).toEqual({ employeeId: expect.any(String) });
			const employeeId = (addition as { employeeId: string }).employeeId;
			const account = await userByEmail('noor.haddad@fabrikam.example');
			expect(account).toMatchObject({
				tenantId: TENANT,
				roleId: EMPLOYEE_ROLE,
				hash: null,
				firstName: 'Noor',
				lastName: 'Haddad'
			});
			expect(await employeeById(employeeId)).toMatchObject({
				userId: account.id,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				isActive: 1,
				isArchived: 0,
				isTrackingEnabled: 1,
				kind: 'human'
			});
			expect(await membershipsOf(account.id)).toEqual([
				expect.objectContaining({ tenantId: TENANT, organizationId: ORGANIZATION, isActive: 1 })
			]);
			expect(await counts()).toEqual({
				users: before.users + 1,
				employees: before.employees + 1,
				memberships: before.memberships + 1
			});
			expect(welcomeUser).not.toHaveBeenCalled();
			expect(getPasswordHash).not.toHaveBeenCalled();
			// The context the commands ran in ended with them.
			expect(currentTenantId()).toBeNull();
		},
		TIMEOUT
	);

	it('names a new account after its address when the exchange gives no name', async () => {
		await service.add(SCOPE, { email: 'amir@fabrikam.example' });

		expect(await userByEmail('amir@fabrikam.example')).toMatchObject({ firstName: 'Amir', lastName: null });
	});

	it("adds the tenant's existing account, which keeps its name and role, without a second account", async () => {
		const before = await counts();

		const addition = await service.add(SCOPE, { email: 'lina@northwind.example', firstName: 'Someone else' });

		const employeeId = (addition as { employeeId: string }).employeeId;
		expect(await employeeById(employeeId)).toMatchObject({
			userId: idOf('lina@northwind.example'),
			organizationId: ORGANIZATION,
			isTrackingEnabled: 1
		});
		expect(await userByEmail('lina@northwind.example')).toMatchObject({ firstName: 'lina', roleId: EMPLOYEE_ROLE });
		expect(await counts()).toEqual({
			users: before.users,
			employees: before.employees + 1,
			memberships: before.memberships + 1
		});
		expect(welcomeUser).not.toHaveBeenCalled();
	});

	it('refuses an account with any role but employee, administrators included, and writes nothing', async () => {
		const before = await counts();

		for (const email of [
			'ada@northwind.example',
			'sam@northwind.example',
			'max@northwind.example',
			'val@northwind.example',
			'cleo@northwind.example'
		]) {
			await expect(service.add(SCOPE, { email })).resolves.toEqual({
				refused: 'the account has a role other than employee'
			});
		}
		expect(await counts()).toEqual(before);
	});

	it('refuses someone the organization archived, deactivated or removed, and writes nothing', async () => {
		const before = await counts();

		for (const email of [
			'omar@northwind.example',
			'ines@northwind.example',
			'ravi@northwind.example',
			'yuki@northwind.example'
		]) {
			await expect(service.add(SCOPE, { email })).resolves.toEqual({
				refused: 'archived, deactivated or removed in the organization'
			});
		}
		expect(await counts()).toEqual(before);
	});

	it('refuses an account that is inactive or deleted in the tenant, and creates no other one', async () => {
		const before = await counts();

		for (const email of ['kim@northwind.example', 'lee@northwind.example']) {
			await expect(service.add(SCOPE, { email })).resolves.toEqual({
				refused: 'the account is inactive, archived or deleted'
			});
		}
		expect(await counts()).toEqual(before);
	});

	it('refuses an address whose account is stored in another case, and creates no second account', async () => {
		const before = await counts();

		await expect(service.add(SCOPE, { email: 'mara@northwind.example' })).resolves.toEqual({
			refused: 'the address has an account in another case'
		});
		expect(await counts()).toEqual(before);
	});

	it('refuses what the platform refuses, the account behind an agent, before it writes anything', async () => {
		const before = await counts();

		await expect(service.add(SCOPE, { email: 'agent-7@northwind.example' })).resolves.toEqual({
			refused: 'the account stands behind an agent or a member without an account'
		});
		expect(await counts()).toEqual(before);
	});

	it('writes the membership before the employee: an addition cut between them is completed by the next one', async () => {
		const before = await counts();
		const cut = serviceOnBus({
			execute: async (command: object) => {
				if (command.constructor.name === 'EmployeeCreateCommand') {
					throw new Error('the connection was lost');
				}
				return await commandBus.execute(command);
			}
		});

		await expect(cut.add(SCOPE, { email: 'tara@fabrikam.example' })).rejects.toThrow('the connection was lost');

		const account = await userByEmail('tara@fabrikam.example');
		expect(await membershipsOf(account.id)).toEqual([
			expect.objectContaining({ organizationId: ORGANIZATION, isActive: 1 })
		]);
		expect(await counts()).toEqual({
			users: before.users + 1,
			employees: before.employees,
			memberships: before.memberships + 1
		});

		const addition = await service.add(SCOPE, { email: 'tara@fabrikam.example' });

		const employeeId = (addition as { employeeId: string }).employeeId;
		expect(await employeeById(employeeId)).toMatchObject({ userId: account.id, organizationId: ORGANIZATION });
		expect(await counts()).toEqual({
			users: before.users + 1,
			employees: before.employees + 1,
			memberships: before.memberships + 1
		});
	});

	it('throws a failed write the platform wraps in a 400, never a refusal of the person', async () => {
		const failingWith = (failure: Error) =>
			serviceOnBus({
				execute: async (command: object) => {
					if (command.constructor.name === 'EmployeeCreateCommand') {
						throw new BadRequest(failure);
					}
					return await commandBus.execute(command);
				}
			});
		const lost = new Error('Connection terminated unexpectedly');

		const constraint = new Error('NOT NULL constraint failed: employee.organizationId');

		// A database out of reach is thrown as itself (the exchange answers 503), any other failed write as the 400.
		await expect(failingWith(lost).add(SCOPE, { email: 'una@fabrikam.example' })).rejects.toBe(lost);
		await expect(failingWith(constraint).add(SCOPE, { email: 'una@fabrikam.example' })).rejects.toBeInstanceOf(
			BadRequest
		);
	});

	it('adds the employee of an account whose membership has none, and keeps the membership', async () => {
		const before = await counts();

		const addition = await service.add(SCOPE, { email: 'nia@northwind.example' });

		const employeeId = (addition as { employeeId: string }).employeeId;
		expect(await employeeById(employeeId)).toMatchObject({
			userId: idOf('nia@northwind.example'),
			organizationId: ORGANIZATION,
			isTrackingEnabled: 1
		});
		expect(await membershipsOf(idOf('nia@northwind.example'))).toHaveLength(1);
		expect(await counts()).toEqual({ ...before, employees: before.employees + 1 });
	});

	it('refuses a new address in a tenant without an employee role, and creates nothing', async () => {
		const before = await counts();

		await expect(
			service.add(
				{ tenantId: ROLELESS_TENANT, organizationId: ROLELESS_ORGANIZATION },
				{ email: 'pat@contoso.example' }
			)
		).resolves.toEqual({ refused: 'the platform refused to add the account (404)' });
		expect(await counts()).toEqual(before);
	});

	it('answers two exchanges of the same new address at once with the token of one new member', async () => {
		const before = await counts();

		const answers = await Promise.all([
			credentialService.exchange({ credential: ADDING_SECRET, email: 'Zoe@Fabrikam.example', ...PORTAL }),
			credentialService.exchange({ credential: ADDING_SECRET, email: 'zoe@fabrikam.example', ...PORTAL })
		]);

		expect(answers.map((answer) => answer.token)).toEqual(['an-embed-token', 'an-embed-token']);
		expect(await counts()).toEqual({
			users: before.users + 1,
			employees: before.employees + 1,
			memberships: before.memberships + 1
		});
		const account = await userByEmail('zoe@fabrikam.example');
		const [employee] = await dataSource.query(`SELECT "id" FROM "employee" WHERE "userId" = ?`, [account.id]);
		const minted = issueEmbedSession.mock.calls.map(([input]) => input.employeeId);
		expect(minted).toEqual([employee.id, employee.id]);
		expect(welcomeUser).not.toHaveBeenCalled();
	});

	it("answers today's 403 for a new address to a credential that does not add members, and writes nothing", async () => {
		const before = await counts();

		await expect(
			credentialService.exchange({ credential: PLAIN_SECRET, email: 'uma@fabrikam.example', ...PORTAL })
		).rejects.toMatchObject({ status: 403, response: { code: 'EMBED_MEMBER_NOT_ALLOWED' } });

		expect(issueEmbedSession).not.toHaveBeenCalled();
		expect(await counts()).toEqual(before);
	});
});

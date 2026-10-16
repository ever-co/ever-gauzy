import '../core/entities/internal';

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EmployeeAgentSourceEnum, EmployeeKindEnum, RolesEnum } from '@gauzy/contracts';
import { EmployeeAgentProfile, Organization, Role, User } from '../core/entities/internal';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import { DEFAULT_AGENT_EMAIL_DOMAIN, isAgentEmail } from './agent-employee';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const OTHER_TENANT = 'a0000000-0000-4000-8000-000000000002';
const ORGANIZATION = 'b0000000-0000-4000-8000-000000000001';
const OTHER_ORGANIZATION = 'b0000000-0000-4000-8000-000000000002';
const ROLE = 'c0000000-0000-4000-8000-000000000001';

type Row = Record<string, any>;

/**
 * A stand-in for the TypeORM transaction manager `createAgentEmployee` writes through: tables keyed by
 * entity class, `findOne`/`find` by exact `where` match, `save` assigning an id. Every read and write yields
 * to the event loop, so two overlapping calls interleave the way two transactions do. A `findOne` with a
 * `pessimistic_write` lock (what `findOneForUpdate` asks for on Postgres and MySQL) holds the row until the
 * transaction ends, like `SELECT … FOR UPDATE`.
 */
function fakeDatabase(type: string = 'postgres') {
	const tables = new Map<unknown, Row[]>([
		[
			Organization,
			[
				{ id: ORGANIZATION, tenantId: TENANT },
				{ id: OTHER_ORGANIZATION, tenantId: TENANT }
			]
		],
		[Role, [{ id: ROLE, tenantId: TENANT, name: RolesEnum.EMPLOYEE }]],
		[User, []],
		[Employee, []],
		[EmployeeAgentProfile, []]
	]);
	const locks = new Map<string, Promise<void>>();
	const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
	let sequence = 0;
	const matches = (row: Row, where: Row) => Object.entries(where).every(([key, value]) => row[key] === value);
	const lockRequests: string[] = [];
	/** Locked reads that would join eager relations: Postgres refuses FOR UPDATE on those outer joins. */
	const eagerLocks: string[] = [];

	const managerFor = (held: Array<() => void>) => ({
		connection: { options: { type } },
		findOne: jest.fn(
			async (
				entity: unknown,
				{
					where,
					lock,
					loadEagerRelations
				}: { where: Row; lock?: { mode: string }; loadEagerRelations?: boolean }
			) => {
				if (lock?.mode === 'pessimistic_write') {
					const key = `${(entity as { name?: string }).name}:${where.id}`;
					lockRequests.push(key);
					if (loadEagerRelations !== false) eagerLocks.push(key);
					while (locks.has(key)) await locks.get(key);
					let release: () => void;
					locks.set(key, new Promise<void>((resolve) => (release = resolve)));
					held.push(() => {
						locks.delete(key);
						release();
					});
				}
				await tick();
				return (tables.get(entity) ?? []).find((row) => matches(row, where)) ?? null;
			}
		),
		find: jest.fn(async (entity: unknown, { where }: { where: Row }) => {
			await tick();
			return (tables.get(entity) ?? []).filter((row) => matches(row, where));
		}),
		create: jest.fn((_entity: unknown, values: Row) => ({ ...values })),
		merge: jest.fn((_entity: unknown, target: Row, values: Row) => Object.assign(target, values)),
		save: jest.fn(async (entity: unknown, value: Row) => {
			await tick();
			const rows = tables.get(entity);
			const stored = {
				id: value.id ?? `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
				...value
			};
			const index = rows.findIndex((row) => row.id === stored.id);
			if (index >= 0) rows[index] = stored;
			else rows.push(stored);
			return stored;
		})
	});

	const repository = {
		manager: {
			transaction: jest.fn(async (work: (m: ReturnType<typeof managerFor>) => unknown) => {
				const held: Array<() => void> = [];
				try {
					return await work(managerFor(held));
				} finally {
					held.forEach((release) => release()); // commit or rollback releases the row locks
				}
			})
		}
	};
	return { tables, repository, lockRequests, eagerLocks };
}

describe('EmployeeService.createAgentEmployee', () => {
	let db: ReturnType<typeof fakeDatabase>;
	let service: EmployeeService;

	beforeEach(() => {
		db = fakeDatabase();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service = new EmployeeService(db.repository as any, {} as any);
	});

	it('creates a password-less user under .invalid and an agent employee with tracking off', async () => {
		const result = await service.createAgentEmployee({
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			name: '  Ada Agent  ',
			shortDescription: 'Backend engineer'
		});

		expect(result.created).toBe(true);
		expect(result.profile).toBeNull();

		const [user] = db.tables.get(User);
		expect(user.hash).toBeNull();
		expect(user.firstName).toBe('Ada Agent');
		expect(user.lastName).toBe('');
		expect(user.email.endsWith(`@${DEFAULT_AGENT_EMAIL_DOMAIN}`)).toBe(true);
		expect(isAgentEmail(user.email)).toBe(true);
		expect(user.roleId).toBe(ROLE);
		expect(user.tenantId).toBe(TENANT);

		const [employee] = db.tables.get(Employee);
		expect(employee).toMatchObject({
			kind: EmployeeKindEnum.AGENT,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			userId: user.id,
			isTrackingEnabled: false,
			allowScreenshotCapture: false,
			short_description: 'Backend engineer'
		});
		// No pay fields are set for an agent.
		expect(employee.billRateValue).toBeUndefined();
		expect(employee.payPeriod).toBeUndefined();
		expect(result.employee).toBe(employee);
	});

	it('has no dependency that could send a welcome email or an invite', () => {
		// The service is constructed from its two repositories only: there is no mail or invite service to
		// call, which is what "no welcome email, no invite" means for this path.
		expect(EmployeeService.length).toBe(2);
	});

	it('creates the agent profile in the same transaction, scoped by the employee row', async () => {
		const result = await service.createAgentEmployee({
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			name: 'Bot',
			email: 'agent-ew-42@agents.invalid',
			profile: {
				source: EmployeeAgentSourceEnum.EVER_WORKS,
				externalId: 'ew-42',
				capabilities: ['code', 'review'],
				managedExternally: true,
				// Scoping members in the input are ignored: they come from the employee row.
				...({ tenantId: OTHER_TENANT, organizationId: 'nope', employeeId: 'nope', id: 'nope' } as object)
			}
		});

		expect(db.repository.manager.transaction).toHaveBeenCalledTimes(1);
		const [profile] = db.tables.get(EmployeeAgentProfile);
		expect(profile).toMatchObject({
			source: 'ever_works',
			externalId: 'ew-42',
			capabilities: ['code', 'review'],
			managedExternally: true,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			employeeId: result.employee.id
		});
		expect(profile.id).not.toBe('nope');
		expect(result.profile).toBe(profile);
	});

	it('is idempotent on the email: a second call returns the existing agent', async () => {
		const input = { tenantId: TENANT, organizationId: ORGANIZATION, name: 'Bot', email: 'Agent-1@Agents.Invalid' };
		const first = await service.createAgentEmployee(input);
		const second = await service.createAgentEmployee(input);

		expect(second.created).toBe(false);
		expect(second.employee.id).toBe(first.employee.id);
		expect(db.tables.get(User)).toHaveLength(1);
		expect(db.tables.get(Employee)).toHaveLength(1);
		expect(db.tables.get(User)[0].email).toBe('agent-1@agents.invalid');
	});

	it('refuses a deliverable email', async () => {
		await expect(
			service.createAgentEmployee({
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				name: 'Bot',
				email: 'bot@example.com'
			})
		).rejects.toBeInstanceOf(BadRequestException);
		expect(db.tables.get(User)).toHaveLength(0);
	});

	it('refuses a missing name, tenant or organization', async () => {
		await expect(
			service.createAgentEmployee({ tenantId: TENANT, organizationId: ORGANIZATION, name: '   ' })
		).rejects.toBeInstanceOf(BadRequestException);
		await expect(
			service.createAgentEmployee({ tenantId: undefined, organizationId: ORGANIZATION, name: 'Bot' })
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('refuses an organization of another tenant', async () => {
		await expect(
			service.createAgentEmployee({ tenantId: OTHER_TENANT, organizationId: ORGANIZATION, name: 'Bot' })
		).rejects.toBeInstanceOf(NotFoundException);
		expect(db.tables.get(Employee)).toHaveLength(0);
	});

	it('never turns a person into an agent', async () => {
		db.tables.get(User).push({ id: 'u-1', tenantId: TENANT, email: 'person@team.invalid', hash: null });
		db.tables.get(Employee).push({
			id: 'e-1',
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			userId: 'u-1',
			kind: EmployeeKindEnum.HUMAN
		});

		await expect(
			service.createAgentEmployee({
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				name: 'Bot',
				email: 'person@team.invalid'
			})
		).rejects.toBeInstanceOf(ConflictException);
	});

	it('creates an agent once when two calls for it overlap (the organization row is locked)', async () => {
		const input = { tenantId: TENANT, organizationId: ORGANIZATION, name: 'Bot', email: 'agent-7@agents.invalid' };

		const results = await Promise.all([service.createAgentEmployee(input), service.createAgentEmployee(input)]);

		expect(results.map((result) => result.created).sort()).toEqual([false, true]);
		expect(results[0].employee.id).toBe(results[1].employee.id);
		expect(db.tables.get(User)).toHaveLength(1);
		expect(db.tables.get(Employee)).toHaveLength(1);
		expect(db.lockRequests).toEqual([`Organization:${ORGANIZATION}`, `Organization:${ORGANIZATION}`]);
	});

	it('control: without the row lock the same overlap creates the agent twice', async () => {
		// SQLite takes no row lock (one writer at a time is the database's own rule): this fake does not
		// serialize, which shows the race the lock closes on Postgres and MySQL.
		db = fakeDatabase('better-sqlite3');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service = new EmployeeService(db.repository as any, {} as any);
		const input = { tenantId: TENANT, organizationId: ORGANIZATION, name: 'Bot', email: 'agent-8@agents.invalid' };

		await Promise.all([service.createAgentEmployee(input), service.createAgentEmployee(input)]);

		expect(db.lockRequests).toEqual([]);
		expect(db.tables.get(User)).toHaveLength(2);
	});

	it('reuses the account of the same agent mapped into another organization, with the EMPLOYEE role', async () => {
		db.tables
			.get(User)
			.push({ id: 'u-9', tenantId: TENANT, email: 'agent-9@agents.invalid', hash: null, roleId: null });
		db.tables.get(Employee).push({
			id: 'e-9',
			tenantId: TENANT,
			organizationId: OTHER_ORGANIZATION,
			userId: 'u-9',
			kind: EmployeeKindEnum.AGENT
		});

		const result = await service.createAgentEmployee({
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			name: 'Bot',
			email: 'agent-9@agents.invalid'
		});

		expect(result.created).toBe(true);
		expect(result.employee).toMatchObject({
			userId: 'u-9',
			organizationId: ORGANIZATION,
			kind: EmployeeKindEnum.AGENT
		});
		expect(db.tables.get(User)).toHaveLength(1);
		expect(db.tables.get(User)[0].roleId).toBe(ROLE);
	});

	it('never reuses the password-less account of a person employed in another organization', async () => {
		db.tables
			.get(User)
			.push({ id: 'u-3', tenantId: TENANT, email: 'invited@team.invalid', hash: null, roleId: ROLE });
		db.tables.get(Employee).push({
			id: 'e-3',
			tenantId: TENANT,
			organizationId: OTHER_ORGANIZATION,
			userId: 'u-3',
			kind: EmployeeKindEnum.HUMAN
		});

		await expect(
			service.createAgentEmployee({
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				name: 'Bot',
				email: 'invited@team.invalid'
			})
		).rejects.toBeInstanceOf(ConflictException);
		expect(db.tables.get(Employee)).toHaveLength(1);
	});

	it('refuses a deleted agent rather than handing it back as provisioned', async () => {
		db.tables
			.get(User)
			.push({ id: 'u-5', tenantId: TENANT, email: 'agent-5@agents.invalid', hash: null, roleId: ROLE });
		db.tables.get(Employee).push({
			id: 'e-5',
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			userId: 'u-5',
			kind: EmployeeKindEnum.AGENT,
			deletedAt: new Date('2026-10-01T00:00:00Z')
		});

		await expect(
			service.createAgentEmployee({
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				name: 'Bot',
				email: 'agent-5@agents.invalid'
			})
		).rejects.toBeInstanceOf(ConflictException);
	});

	it('takes the organization lock without eager joins (Postgres refuses FOR UPDATE on an outer join)', async () => {
		await service.createAgentEmployee({
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			name: 'Bot',
			profile: { source: 'ever_works' }
		});
		// The organization row and, for the profile write, the employee row: both locked, neither with eager joins.
		expect(db.lockRequests).toHaveLength(2);
		expect(db.eagerLocks).toEqual([]);
	});

	it('never reuses an account that stands behind no agent', async () => {
		db.tables
			.get(User)
			.push({ id: 'u-4', tenantId: TENANT, email: 'orphan@team.invalid', hash: null, roleId: null });

		await expect(
			service.createAgentEmployee({
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				name: 'Bot',
				email: 'orphan@team.invalid'
			})
		).rejects.toBeInstanceOf(ConflictException);
		expect(db.tables.get(Employee)).toHaveLength(0);
	});

	it('never reuses a user that has a password', async () => {
		db.tables.get(User).push({ id: 'u-2', tenantId: TENANT, email: 'login@team.invalid', hash: '$2b$10$x' });

		await expect(
			service.createAgentEmployee({
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				name: 'Bot',
				email: 'login@team.invalid'
			})
		).rejects.toBeInstanceOf(ConflictException);
		expect(db.tables.get(Employee)).toHaveLength(0);
	});
});

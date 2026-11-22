import { InviteAcceptEmployeeCommand } from '../invite.accept-employee.command';
import { InviteAcceptEmployeeHandler } from './invite.accept-employee.handler';

/**
 * A member invitation accepted by an address that already has an account in the tenant joins with that account,
 * whatever its role: its employee in the invitation's organization, or a new one, and the invitation's teams. One
 * address keeps one account (ever-co/ever-gauzy#12143). An address with an Employee account and its employee, and an
 * address without an account, are accepted as before.
 */
const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';
const OTHER_ORGANIZATION = 'organization-2';
const PLATFORM = { id: 'team-platform', name: 'Platform', members: [] as unknown[] };

type Account = {
	id: string;
	email: string;
	tenantId: string;
	role: { name: string };
	createdAt: Date;
	isActive?: boolean;
	isArchived?: boolean;
};
type EmployeeRow = { id: string; userId: string; organizationId: string };

const account = (id: string, role: string, overrides: Partial<Account> = {}): Account => ({
	id,
	email: 'thomas.walker@example.com',
	tenantId: TENANT,
	role: { name: role },
	createdAt: new Date('2026-11-21T09:17:28.000Z'),
	...overrides
});

function build(options: { accounts?: Account[]; employees?: EmployeeRow[] } = {}) {
	const invite = {
		id: 'invite-1',
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		email: 'thomas.walker@example.com',
		placeholderEmployeeId: null,
		actionDate: null,
		organization: { id: ORGANIZATION, tenantId: TENANT, invitesAllowed: true },
		projects: [],
		departments: [],
		organizationContacts: [],
		teams: [PLATFORM]
	};
	const inviteService = {
		findOneByIdString: jest.fn(async () => invite),
		claimInvite: jest.fn(async () => true),
		releaseInvite: jest.fn(async () => undefined),
		update: jest.fn(async () => undefined)
	};
	const accounts: Account[] = [...(options.accounts ?? [])];
	const authService = {
		register: jest.fn(async () => {
			const registered = account('user-new', 'EMPLOYEE', { createdAt: new Date() });
			accounts.push(registered);
			return registered;
		})
	};
	const emailOf = (where: { email?: unknown }): string => {
		const raw = where.email as { objectLiteralParameters?: { email: string } } | string;
		const email = typeof raw === 'string' ? raw : raw?.objectLiteralParameters?.email;
		return String(email).toLowerCase();
	};
	const userRepository = {
		// The ordinary acceptance's first lookup: an account with the EMPLOYEE role, same address.
		findOneOrFail: jest.fn(async ({ where }) => {
			const found = accounts.find(
				(row) =>
					row.email === where.email && row.role.name === where.role?.name && row.tenantId === where.tenantId
			);
			if (!found) throw new Error('EntityNotFound');
			return found;
		}),
		// The accounts of the address in the tenant, whatever their role, without regard to case.
		find: jest.fn(async ({ where }) => accounts.filter((row) => row.email.toLowerCase() === emailOf(where))),
		findOne: jest.fn(async ({ where }) => accounts.find((row) => row.id === where.id) ?? null)
	};
	const employees: EmployeeRow[] = [...(options.employees ?? [])];
	const employeeRepository = {
		findOneOrFail: jest.fn(async ({ where }) => {
			const found = employees.find((row) => row.userId === where.userId);
			if (!found) throw new Error('EntityNotFound');
			return found;
		}),
		findOne: jest.fn(
			async ({ where }) =>
				employees.find((row) => row.userId === where.userId && row.organizationId === where.organizationId) ??
				null
		),
		create: jest.fn((row) => ({ ...row })),
		save: jest.fn(async (row) => {
			const saved = {
				id: `employee-of-${row.user.id}`,
				userId: row.user.id,
				organizationId: row.organization.id
			};
			employees.push(saved);
			return saved;
		})
	};
	const teamMembers: { teamId: string; employeeId: string }[] = [];
	const teamRepository = {
		create: jest.fn((row) => ({ ...row })),
		save: jest.fn(async (team) => {
			for (const member of team.members) {
				teamMembers.push({ teamId: team.id, employeeId: member.employee.id });
			}
			return team;
		})
	};
	const userOrganizationService = { addUserToOrganization: jest.fn(async () => undefined) };

	const handler = new InviteAcceptEmployeeHandler(
		inviteService as never,
		authService as never,
		userRepository as never,
		employeeRepository as never,
		undefined as never,
		undefined as never,
		undefined as never,
		teamRepository as never,
		undefined as never,
		userOrganizationService as never
	);
	const accept = () =>
		handler.execute(new InviteAcceptEmployeeCommand({ inviteId: invite.id, user: {} } as never, 'en' as never));
	return {
		accept,
		accounts,
		employees,
		teamMembers,
		authService,
		employeeRepository,
		inviteService,
		userOrganizationService
	};
}

describe('InviteAcceptEmployeeHandler with an address that already has an account', () => {
	it.each(['MANAGER', 'ADMIN'])(
		'joins with the %s account and a new employee, never a second account',
		async (role) => {
			const { accept, accounts, employees, teamMembers, authService, inviteService } = build({
				accounts: [account('user-thomas', role)]
			});

			await expect(accept()).resolves.toMatchObject({ id: 'user-thomas', role: { name: role } });

			expect(authService.register).not.toHaveBeenCalled();
			expect(accounts).toHaveLength(1);
			expect(employees).toEqual([
				{ id: 'employee-of-user-thomas', userId: 'user-thomas', organizationId: ORGANIZATION }
			]);
			expect(teamMembers).toEqual([{ teamId: PLATFORM.id, employeeId: 'employee-of-user-thomas' }]);
			expect(inviteService.update).toHaveBeenCalledWith('invite-1', { userId: 'user-thomas' });
		}
	);

	it("reuses the employee the account already has in the invitation's organization", async () => {
		const { accept, employeeRepository, teamMembers } = build({
			accounts: [account('user-thomas', 'ADMIN')],
			employees: [{ id: 'employee-thomas', userId: 'user-thomas', organizationId: ORGANIZATION }]
		});

		await accept();

		expect(employeeRepository.save).not.toHaveBeenCalled();
		expect(teamMembers).toEqual([{ teamId: PLATFORM.id, employeeId: 'employee-thomas' }]);
	});

	it("links an account employed only in another organization to the invitation's, with a new employee there", async () => {
		const { accept, employees, userOrganizationService } = build({
			accounts: [account('user-thomas', 'MANAGER')],
			employees: [{ id: 'employee-elsewhere', userId: 'user-thomas', organizationId: OTHER_ORGANIZATION }]
		});

		await accept();

		expect(employees).toContainEqual({
			id: 'employee-of-user-thomas',
			userId: 'user-thomas',
			organizationId: ORGANIZATION
		});
		expect(userOrganizationService.addUserToOrganization).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'user-thomas', role: { name: 'MANAGER' } }),
			ORGANIZATION
		);
	});

	it('matches the address without regard to case', async () => {
		const { accept, authService } = build({
			accounts: [account('user-thomas', 'MANAGER', { email: 'Thomas.Walker@Example.com' })]
		});

		await expect(accept()).resolves.toMatchObject({ id: 'user-thomas' });

		expect(authService.register).not.toHaveBeenCalled();
	});

	it('gives an Employee account without an employee one, never a second account', async () => {
		const { accept, accounts, authService, teamMembers } = build({
			accounts: [account('user-thomas', 'EMPLOYEE')]
		});

		await expect(accept()).resolves.toMatchObject({ id: 'user-thomas' });

		expect(authService.register).not.toHaveBeenCalled();
		expect(accounts).toHaveLength(1);
		expect(teamMembers).toEqual([{ teamId: PLATFORM.id, employeeId: 'employee-of-user-thomas' }]);
	});

	it('accepts an Employee account that has an employee as before', async () => {
		const { accept, authService, employeeRepository, userOrganizationService, teamMembers } = build({
			accounts: [account('user-thomas', 'EMPLOYEE')],
			employees: [{ id: 'employee-thomas', userId: 'user-thomas', organizationId: ORGANIZATION }]
		});

		await expect(accept()).resolves.toMatchObject({ id: 'user-thomas' });

		expect(authService.register).not.toHaveBeenCalled();
		expect(employeeRepository.save).not.toHaveBeenCalled();
		expect(userOrganizationService.addUserToOrganization).not.toHaveBeenCalled();
		expect(teamMembers).toEqual([{ teamId: PLATFORM.id, employeeId: 'employee-thomas' }]);
	});

	it('registers an account and its employee for a new address, as before', async () => {
		const { accept, authService, employees, userOrganizationService } = build();

		await expect(accept()).resolves.toMatchObject({ id: 'user-new' });

		expect(authService.register).toHaveBeenCalledTimes(1);
		expect(employees).toEqual([{ id: 'employee-of-user-new', userId: 'user-new', organizationId: ORGANIZATION }]);
		expect(userOrganizationService.addUserToOrganization).not.toHaveBeenCalled();
	});

	it('leaves a deactivated or archived account alone and registers one, as before', async () => {
		const { accept, authService } = build({
			accounts: [
				account('user-deactivated', 'MANAGER', { isActive: false }),
				account('user-archived', 'ADMIN', { isArchived: true })
			]
		});

		await expect(accept()).resolves.toMatchObject({ id: 'user-new' });

		expect(authService.register).toHaveBeenCalledTimes(1);
	});

	it('joins with the newest of several accounts of the address', async () => {
		const { accept } = build({
			accounts: [
				account('user-older', 'ADMIN', { createdAt: new Date('2026-11-01T00:00:00.000Z') }),
				account('user-newer', 'MANAGER', { createdAt: new Date('2026-11-20T00:00:00.000Z') })
			]
		});

		await expect(accept()).resolves.toMatchObject({ id: 'user-newer' });
	});
});

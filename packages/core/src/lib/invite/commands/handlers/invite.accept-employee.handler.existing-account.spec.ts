import { RequestContext } from '../../../core/context';
import { EndedEmployeeException } from '../../invited-employee';
import { ExistingAccountSignInRequiredException } from '../../existing-account-sign-in-required';
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
type EmployeeRow = { id: string; userId: string; organizationId: string; isActive?: boolean; isArchived?: boolean };
type MembershipRow = { employeeId: string; isActive?: boolean };
type Joinable = { id: string; name: string; members: MembershipRow[] };

const account = (id: string, role: string, overrides: Partial<Account> = {}): Account => ({
	id,
	email: 'thomas.walker@example.com',
	tenantId: TENANT,
	role: { name: role },
	createdAt: new Date('2026-11-21T09:17:28.000Z'),
	...overrides
});

function build(
	options: {
		accounts?: Account[];
		employees?: EmployeeRow[];
		teams?: Joinable[];
		projects?: Joinable[];
		sessionUserId?: string;
	} = {}
) {
	// The session the request carries: none unless a test signs in.
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(options.sessionUserId ?? null);

	const invite = {
		id: 'invite-1',
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		email: 'thomas.walker@example.com',
		placeholderEmployeeId: null,
		actionDate: null,
		organization: { id: ORGANIZATION, tenantId: TENANT, invitesAllowed: true },
		departments: [],
		organizationContacts: [],
		teams: options.teams ?? [PLATFORM],
		projects: options.projects ?? []
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
		// The ordinary acceptance's first lookup: an account with the EMPLOYEE role, same address, the newest first
		// when the query orders by creation.
		findOneOrFail: jest.fn(async ({ where, order }) => {
			const newestFirst = order?.createdAt === 'DESC';
			const ordered = newestFirst
				? [...accounts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
				: accounts;
			const found = ordered.find(
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
			// Only the rows this acceptance adds carry the employee; the team's earlier members name it by id.
			for (const member of team.members) {
				if (member.employee) teamMembers.push({ teamId: team.id, employeeId: member.employee.id });
			}
			return team;
		})
	};
	const projectMembers: { projectId: string; employeeId: string }[] = [];
	const projectRepository = {
		create: jest.fn((row) => ({ ...row })),
		save: jest.fn(async (project) => {
			for (const member of project.members) {
				if (member.employee) projectMembers.push({ projectId: project.id, employeeId: member.employee.id });
			}
			return project;
		})
	};
	const userOrganizationService = { addUserToOrganization: jest.fn(async () => undefined) };

	const handler = new InviteAcceptEmployeeHandler(
		inviteService as never,
		authService as never,
		userRepository as never,
		employeeRepository as never,
		projectRepository as never,
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
		projectMembers,
		teamRepository,
		projectRepository,
		authService,
		employeeRepository,
		inviteService,
		userOrganizationService
	};
}

describe('InviteAcceptEmployeeHandler with an address that already has an account', () => {
	afterEach(() => jest.restoreAllMocks());

	it.each(['MANAGER', 'ADMIN'])(
		'joins with the %s account and a new employee, never a second account',
		async (role) => {
			const { accept, accounts, employees, teamMembers, authService, inviteService } = build({
				accounts: [account('user-thomas', role)],
				sessionUserId: 'user-thomas'
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
			employees: [{ id: 'employee-thomas', userId: 'user-thomas', organizationId: ORGANIZATION }],
			sessionUserId: 'user-thomas'
		});

		await accept();

		expect(employeeRepository.save).not.toHaveBeenCalled();
		expect(teamMembers).toEqual([{ teamId: PLATFORM.id, employeeId: 'employee-thomas' }]);
	});

	it("links an account employed only in another organization to the invitation's, with a new employee there", async () => {
		const { accept, employees, userOrganizationService } = build({
			accounts: [account('user-thomas', 'MANAGER')],
			employees: [{ id: 'employee-elsewhere', userId: 'user-thomas', organizationId: OTHER_ORGANIZATION }],
			sessionUserId: 'user-thomas'
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
			accounts: [account('user-thomas', 'MANAGER', { email: 'Thomas.Walker@Example.com' })],
			sessionUserId: 'user-thomas'
		});

		await expect(accept()).resolves.toMatchObject({ id: 'user-thomas' });

		expect(authService.register).not.toHaveBeenCalled();
	});

	it('gives an Employee account without an employee one, never a second account', async () => {
		const { accept, accounts, authService, teamMembers } = build({
			accounts: [account('user-thomas', 'EMPLOYEE')],
			sessionUserId: 'user-thomas'
		});

		await expect(accept()).resolves.toMatchObject({ id: 'user-thomas' });

		expect(authService.register).not.toHaveBeenCalled();
		expect(accounts).toHaveLength(1);
		expect(teamMembers).toEqual([{ teamId: PLATFORM.id, employeeId: 'employee-of-user-thomas' }]);
	});

	it('accepts an Employee account that has an employee from its session, with that employee', async () => {
		const { accept, authService, employeeRepository, teamMembers } = build({
			accounts: [account('user-thomas', 'EMPLOYEE')],
			employees: [{ id: 'employee-thomas', userId: 'user-thomas', organizationId: ORGANIZATION }],
			sessionUserId: 'user-thomas'
		});

		await expect(accept()).resolves.toMatchObject({ id: 'user-thomas' });

		expect(authService.register).not.toHaveBeenCalled();
		expect(employeeRepository.save).not.toHaveBeenCalled();
		expect(teamMembers).toEqual([{ teamId: PLATFORM.id, employeeId: 'employee-thomas' }]);
	});

	it.each(['EMPLOYEE', 'MANAGER', 'ADMIN'])(
		'refuses, without its session, an address whose %s account can sign in, before anything is written',
		async (role) => {
			// The InviteAcceptHandler refuses this first; an account created after its check is refused here.
			const { accept, authService, employeeRepository, inviteService, teamMembers, userOrganizationService } =
				build({ accounts: [account('user-thomas', role)] });

			await expect(accept()).rejects.toBeInstanceOf(ExistingAccountSignInRequiredException);

			expect(authService.register).not.toHaveBeenCalled();
			expect(employeeRepository.save).not.toHaveBeenCalled();
			expect(userOrganizationService.addUserToOrganization).not.toHaveBeenCalled();
			expect(teamMembers).toEqual([]);
			expect(inviteService.releaseInvite).toHaveBeenCalledWith('invite-1');
			expect(inviteService.update).not.toHaveBeenCalled();
		}
	);

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

	it("joins with the session's own account when the address has several, never another one", async () => {
		const { accept, userOrganizationService } = build({
			accounts: [
				account('user-older', 'MANAGER', { createdAt: new Date('2026-11-01T00:00:00.000Z') }),
				account('user-newer', 'ADMIN', { createdAt: new Date('2026-11-20T00:00:00.000Z') })
			],
			sessionUserId: 'user-older'
		});

		await expect(accept()).resolves.toMatchObject({ id: 'user-older', role: { name: 'MANAGER' } });

		expect(userOrganizationService.addUserToOrganization).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'user-older' }),
			ORGANIZATION
		);
	});

	it("joins with the session's Employee account even when the address has a newer Employee account", async () => {
		const { accept, teamMembers } = build({
			accounts: [
				account('user-older', 'EMPLOYEE', { createdAt: new Date('2026-11-01T00:00:00.000Z') }),
				account('user-newer', 'EMPLOYEE', { createdAt: new Date('2026-11-20T00:00:00.000Z') })
			],
			employees: [
				{ id: 'employee-older', userId: 'user-older', organizationId: ORGANIZATION },
				{ id: 'employee-newer', userId: 'user-newer', organizationId: ORGANIZATION }
			],
			sessionUserId: 'user-older'
		});

		await expect(accept()).resolves.toMatchObject({ id: 'user-older' });

		expect(teamMembers).toEqual([{ teamId: PLATFORM.id, employeeId: 'employee-older' }]);
	});

	it("refuses the session of another account than the address's", async () => {
		const { accept, userOrganizationService } = build({
			accounts: [account('user-thomas', 'MANAGER')],
			sessionUserId: 'user-someone-else'
		});

		await expect(accept()).rejects.toBeInstanceOf(ExistingAccountSignInRequiredException);
		expect(userOrganizationService.addUserToOrganization).not.toHaveBeenCalled();
	});

	it.each([{ isActive: false }, { isArchived: true }])(
		"refuses an ended employee in the invitation's organization before anything is written (%o)",
		async (ended) => {
			const { accept, employeeRepository, inviteService, teamMembers, userOrganizationService } = build({
				accounts: [account('user-thomas', 'MANAGER')],
				employees: [{ id: 'employee-thomas', userId: 'user-thomas', organizationId: ORGANIZATION, ...ended }],
				sessionUserId: 'user-thomas'
			});

			await expect(accept()).rejects.toBeInstanceOf(EndedEmployeeException);

			expect(userOrganizationService.addUserToOrganization).not.toHaveBeenCalled();
			expect(employeeRepository.save).not.toHaveBeenCalled();
			expect(teamMembers).toEqual([]);
			expect(inviteService.releaseInvite).toHaveBeenCalledWith('invite-1');
			expect(inviteService.update).not.toHaveBeenCalled();
		}
	);

	it("refuses the ended employee of a deactivated Employee account's old lookup too, before anything is written", async () => {
		const { accept, inviteService, teamMembers } = build({
			accounts: [account('user-thomas', 'EMPLOYEE', { isActive: false })],
			employees: [{ id: 'employee-thomas', userId: 'user-thomas', organizationId: ORGANIZATION, isActive: false }]
		});

		await expect(accept()).rejects.toBeInstanceOf(EndedEmployeeException);

		expect(teamMembers).toEqual([]);
		expect(inviteService.releaseInvite).toHaveBeenCalledWith('invite-1');
		expect(inviteService.update).not.toHaveBeenCalled();
	});

	it('adds no second membership to a team or project the employee is already an active member of', async () => {
		const { accept, teamRepository, projectRepository, teamMembers, projectMembers } = build({
			accounts: [account('user-thomas', 'ADMIN')],
			employees: [{ id: 'employee-thomas', userId: 'user-thomas', organizationId: ORGANIZATION }],
			teams: [
				{ id: 'team-platform', name: 'Platform', members: [{ employeeId: 'employee-thomas' }] },
				{ id: 'team-design', name: 'Design', members: [] }
			],
			projects: [
				{ id: 'project-gauzy', name: 'Gauzy', members: [{ employeeId: 'employee-thomas' }] },
				{ id: 'project-teams', name: 'Teams', members: [] }
			],
			sessionUserId: 'user-thomas'
		});

		await accept();

		expect(teamRepository.save).toHaveBeenCalledTimes(1);
		expect(teamMembers).toEqual([{ teamId: 'team-design', employeeId: 'employee-thomas' }]);
		expect(projectRepository.save).toHaveBeenCalledTimes(1);
		expect(projectMembers).toEqual([{ projectId: 'project-teams', employeeId: 'employee-thomas' }]);
	});

	it('adds the membership again to a team the employee left (an inactive membership)', async () => {
		const { accept, teamMembers } = build({
			accounts: [account('user-thomas', 'ADMIN')],
			employees: [{ id: 'employee-thomas', userId: 'user-thomas', organizationId: ORGANIZATION }],
			teams: [
				{ id: 'team-platform', name: 'Platform', members: [{ employeeId: 'employee-thomas', isActive: false }] }
			],
			sessionUserId: 'user-thomas'
		});

		await accept();

		expect(teamMembers).toEqual([{ teamId: 'team-platform', employeeId: 'employee-thomas' }]);
	});
});

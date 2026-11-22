import { InviteAcceptUserCommand } from '../invite.accept-user.command';
import { InviteAcceptUserHandler } from './invite.accept-user.handler';

/**
 * The invitations of every role other than Employee and Candidate are accepted here. One that names teams, as an Admin
 * or Manager invited to a team from Ever Teams, makes its invitee a member of those teams: an employee in the
 * invitation's organization and the membership of each team, as an Employee invitee gets (ever-co/ever-gauzy#12128).
 * One that names no team, as the user invitations of Gauzy's own Users page, gives an account only, as before.
 */
const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';
const OTHER_ORGANIZATION = 'organization-2';
const PLATFORM = { id: 'team-platform', name: 'Platform' };
const DESIGN = { id: 'team-design', name: 'Design' };

type EmployeeRow = { id: string; userId: string; organizationId: string };
type MemberRow = { employeeId: string; organizationTeamId: string; organizationId?: string; tenantId?: string };

function build(options: {
	teams: { id: string; name: string }[];
	existingAccount?: boolean;
	employees?: EmployeeRow[];
	members?: MemberRow[];
}) {
	const invite = {
		id: 'invite-1',
		email: 'ines.okoro@example.com',
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		actionDate: new Date('2026-11-21T00:00:00.000Z'),
		teams: options.teams
	};
	const inviteService = {
		findOneByIdString: jest.fn(async () => invite),
		claimInvite: jest.fn(async () => true),
		releaseInvite: jest.fn(async () => undefined),
		update: jest.fn(async () => undefined)
	};
	const organizationService = {
		findOneByIdString: jest.fn(async () => ({ id: ORGANIZATION, tenantId: TENANT, invitesAllowed: true }))
	};
	// By address: any account of the address in the tenant, whatever its role. By id: the account with its role.
	const userRepository = {
		findOneOrFail: jest.fn(async ({ where }) => {
			if (where.id) return { id: where.id, email: invite.email, tenantId: TENANT, role: { name: 'ADMIN' } };
			if (!options.existingAccount) throw new Error('EntityNotFound');
			return { id: 'user-ines', email: invite.email, tenantId: TENANT };
		})
	};
	const userOrganizationService = { addUserToOrganization: jest.fn(async () => undefined) };
	const authService = {
		register: jest.fn(async () => ({ id: 'user-new', email: invite.email, tenantId: TENANT }))
	};
	const employees: EmployeeRow[] = [...(options.employees ?? [])];
	const employeeRepository = {
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
	const members: MemberRow[] = [...(options.members ?? [])];
	const teamEmployeeRepository = {
		find: jest.fn(async ({ where }) => members.filter((row) => row.employeeId === where.employeeId)),
		create: jest.fn((row) => ({ ...row })),
		save: jest.fn(async (rows: MemberRow[]) => {
			members.push(...rows);
			return rows;
		})
	};

	const handler = new InviteAcceptUserHandler(
		userRepository as never,
		inviteService as never,
		authService as never,
		organizationService as never,
		employeeRepository as never,
		teamEmployeeRepository as never,
		userOrganizationService as never
	);
	const accept = () =>
		handler.execute(
			new InviteAcceptUserCommand({ inviteId: invite.id, user: { firstName: 'Ines' } } as never, 'en' as never)
		);
	return {
		accept,
		inviteService,
		authService,
		employeeRepository,
		teamEmployeeRepository,
		userOrganizationService,
		employees,
		members
	};
}

describe('InviteAcceptUserHandler', () => {
	it('gives the invitee of a team invitation an employee in its organization and the membership of its team', async () => {
		const { accept, employees, members } = build({ teams: [PLATFORM] });

		await expect(accept()).resolves.toMatchObject({ id: 'user-new' });

		expect(employees).toEqual([{ id: 'employee-of-user-new', userId: 'user-new', organizationId: ORGANIZATION }]);
		expect(members).toEqual([
			{
				employeeId: 'employee-of-user-new',
				organizationTeamId: PLATFORM.id,
				organizationId: ORGANIZATION,
				tenantId: TENANT
			}
		]);
	});

	it('starts the employee on the date of the invitation, active, as an Employee invitee', async () => {
		const { accept, employeeRepository } = build({ teams: [PLATFORM] });

		await accept();

		expect(employeeRepository.create).toHaveBeenCalledWith(
			expect.objectContaining({
				user: expect.objectContaining({ id: 'user-new' }),
				organization: expect.objectContaining({ id: ORGANIZATION }),
				tenantId: TENANT,
				startedWorkOn: new Date('2026-11-21T00:00:00.000Z'),
				isActive: true,
				isArchived: false
			})
		);
	});

	it('joins every team the invitation names', async () => {
		const { accept, members } = build({ teams: [PLATFORM, DESIGN] });

		await accept();

		expect(members.map((row) => row.organizationTeamId).sort()).toEqual([DESIGN.id, PLATFORM.id].sort());
	});

	it('gives an account only for an invitation that names no team, as before', async () => {
		const {
			accept,
			authService,
			inviteService,
			employeeRepository,
			teamEmployeeRepository,
			userOrganizationService
		} = build({ teams: [] });

		await expect(accept()).resolves.toMatchObject({ id: 'user-new' });

		expect(authService.register).toHaveBeenCalledTimes(1);
		expect(inviteService.update).toHaveBeenCalledWith('invite-1', { userId: 'user-new' });
		expect(employeeRepository.findOne).not.toHaveBeenCalled();
		expect(employeeRepository.save).not.toHaveBeenCalled();
		expect(teamEmployeeRepository.save).not.toHaveBeenCalled();
		expect(userOrganizationService.addUserToOrganization).not.toHaveBeenCalled();
	});

	it('joins the team with the employee an existing account already has in the organization, never a second one', async () => {
		const { accept, authService, employeeRepository, members } = build({
			teams: [PLATFORM],
			existingAccount: true,
			employees: [{ id: 'employee-ines', userId: 'user-ines', organizationId: ORGANIZATION }]
		});

		await expect(accept()).resolves.toMatchObject({ id: 'user-ines' });

		expect(authService.register).not.toHaveBeenCalled();
		expect(employeeRepository.save).not.toHaveBeenCalled();
		expect(members).toEqual([
			expect.objectContaining({ employeeId: 'employee-ines', organizationTeamId: PLATFORM.id })
		]);
	});

	it("gives an existing account employed in another organization an employee in the invitation's", async () => {
		const { accept, employees, members } = build({
			teams: [PLATFORM],
			existingAccount: true,
			employees: [{ id: 'employee-ines-elsewhere', userId: 'user-ines', organizationId: OTHER_ORGANIZATION }]
		});

		await accept();

		expect(employees).toContainEqual({
			id: 'employee-of-user-ines',
			userId: 'user-ines',
			organizationId: ORGANIZATION
		});
		expect(members).toEqual([
			expect.objectContaining({ employeeId: 'employee-of-user-ines', organizationTeamId: PLATFORM.id })
		]);
	});

	it("links an existing account of another organization to the invitation's, so that it can switch to it", async () => {
		const { accept, userOrganizationService } = build({
			teams: [PLATFORM],
			existingAccount: true,
			employees: [{ id: 'employee-ines-elsewhere', userId: 'user-ines', organizationId: OTHER_ORGANIZATION }]
		});

		await accept();

		expect(userOrganizationService.addUserToOrganization).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'user-ines', role: { name: 'ADMIN' } }),
			ORGANIZATION
		);
	});

	it('never adds a membership the employee already holds', async () => {
		const { accept, members } = build({
			teams: [PLATFORM, DESIGN],
			existingAccount: true,
			employees: [{ id: 'employee-ines', userId: 'user-ines', organizationId: ORGANIZATION }],
			members: [{ employeeId: 'employee-ines', organizationTeamId: PLATFORM.id }]
		});

		await accept();

		expect(members.filter((row) => row.organizationTeamId === PLATFORM.id)).toHaveLength(1);
		expect(members.filter((row) => row.organizationTeamId === DESIGN.id)).toHaveLength(1);
	});

	it('gives the invitation back when joining the team fails', async () => {
		const { accept, inviteService, teamEmployeeRepository } = build({ teams: [PLATFORM] });
		teamEmployeeRepository.save.mockRejectedValueOnce(new Error('database unavailable'));

		await expect(accept()).rejects.toThrow('database unavailable');

		expect(inviteService.releaseInvite).toHaveBeenCalledWith('invite-1');
		expect(inviteService.update).not.toHaveBeenCalled();
	});
});

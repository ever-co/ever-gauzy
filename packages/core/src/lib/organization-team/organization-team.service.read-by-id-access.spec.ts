import '../core/entities/internal';

import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { GetOrganizationTeamStatisticQuery } from './queries';
import { OrganizationTeamService } from './organization-team.service';

/**
 * #11460: reading one team by id (`GET /organization-team/:id` and the `organizationTeam` GraphQL field, both
 * through `getOrganizationTeamStatistic`) answered any team of the organization with its members, their timers
 * and last worked tasks, while the team list answers a regular employee only their own teams. A caller without
 * CHANGE_SELECTED_EMPLOYEE or ALL_ORG_VIEW now reads a team only as an active member or as its creator, and gets
 * the answer of an unknown id otherwise.
 */
describe('OrganizationTeamService.getOrganizationTeamStatistic read access', () => {
	const ORGANIZATION = '72000000-0000-4000-8000-0000000000a1';
	const TEAM = '72000000-0000-4000-8000-000000000001';
	/** No team has this id. */
	const UNKNOWN_TEAM = '72000000-0000-4000-8000-000000000009';
	/** The member relations Ever Teams asks for when it reads one team. */
	const RELATIONS = ['members', 'members.role', 'members.employee', 'members.employee.user'];
	const NOT_FOUND = 'The requested record was not found';

	const USER = {
		/** Created TEAM, and has no employee record. */
		creator: '72000000-0000-4000-8000-0000000000d1',
		/** The user of EMPLOYEE.member. */
		member: '72000000-0000-4000-8000-0000000000d2',
		/** Neither created TEAM nor is on it. */
		outsider: '72000000-0000-4000-8000-0000000000d3',
		/** May read every team. */
		admin: '72000000-0000-4000-8000-0000000000d4'
	};

	const EMPLOYEE = {
		member: '72000000-0000-4000-8000-0000000000e1',
		colleague: '72000000-0000-4000-8000-0000000000e2',
		outsider: '72000000-0000-4000-8000-0000000000e3'
	};

	/** TEAM as the store holds it, with both its members. */
	const STORED_TEAM: Record<string, unknown> = {
		id: TEAM,
		createdByUserId: USER.creator,
		members: [{ employeeId: EMPLOYEE.member }, { employeeId: EMPLOYEE.colleague }]
	};

	let memberships: Record<string, unknown>[];
	let findOneByIdString: jest.SpyInstance;
	let organizationTeamEmployeeService: { find: jest.Mock };
	let service: OrganizationTeamService;

	/** Whether a stored row holds every value of a `where`, as an equality read answers it. */
	const matchesWhere = (row: Record<string, unknown>, where: Record<string, unknown> = {}): boolean => {
		const conditions = Object.entries(where);
		return conditions.every(([column, value]) => row[column] === value);
	};

	/** The base read by id over the stored team: an unknown id, or a `where` the team does not match, is not found. */
	const readStoredTeam = async (id: string, options?: { where?: Record<string, unknown> }) => {
		const isStoredTeam = id === TEAM;
		const isMatch = matchesWhere(STORED_TEAM, options?.where);
		const isFound = isStoredTeam && isMatch;
		if (!isFound) {
			throw new NotFoundException(NOT_FOUND);
		}
		return STORED_TEAM;
	};

	/** The membership read over the stored rows. */
	const findMemberships = async (options: { where: Record<string, unknown> }) => {
		return memberships.filter((row) => matchesWhere(row, options.where));
	};

	/** One membership row of TEAM. */
	const membershipOf = (employeeId: string, flags: Record<string, unknown>) => {
		return { organizationTeamId: TEAM, employeeId, ...flags };
	};

	/**
	 * Signs the caller in as the platform does: their user, their employee record (none for a user without one)
	 * and their role's permissions. The context's own helpers read them, so a CHANGE_SELECTED_EMPLOYEE holder has
	 * no current employee id, as in production.
	 */
	const signInAs = (
		userId: string,
		employeeId: string | null,
		permissions: PermissionsEnum[] = [PermissionsEnum.ORG_TEAM_VIEW]
	) => {
		const user = { id: userId, employeeId, permissions };
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as never);
	};

	/** The by-id read both surfaces send. */
	const readTeam = (organizationTeamId: string) => {
		const query = { organizationId: ORGANIZATION, relations: RELATIONS } as never;
		const input = new GetOrganizationTeamStatisticQuery(organizationTeamId, query);
		return service.getOrganizationTeamStatistic(input);
	};

	/** The exception reading a team was refused with. A read that answered fails the case. */
	const refusalOf = async (organizationTeamId: string): Promise<HttpException> => {
		try {
			await readTeam(organizationTeamId);
		} catch (error) {
			return error as HttpException;
		}
		throw new Error(`Reading ${organizationTeamId} answered instead of being refused`);
	};

	/** What a refused read answers the caller: its status and the error it carries. */
	const answerOf = (refusal: HttpException) => {
		const carried = refusal.getResponse() as Error;
		return {
			status: refusal.getStatus(),
			carried: carried.constructor.name,
			message: carried.message
		};
	};

	beforeEach(() => {
		memberships = [
			membershipOf(EMPLOYEE.member, { isActive: true, isArchived: false }),
			membershipOf(EMPLOYEE.colleague, { isActive: true, isArchived: false })
		];
		findOneByIdString = jest
			.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString')
			.mockImplementation(readStoredTeam as never);
		organizationTeamEmployeeService = { find: jest.fn(findMemberships) };

		// Only the collaborator the check reads; the rest of the constructor graph is irrelevant here.
		service = Object.create(OrganizationTeamService.prototype);
		Object.assign(service, { organizationTeamEmployeeService });
	});

	afterEach(() => jest.restoreAllMocks());

	it('answers an employee who is not on the team as if it did not exist, without loading its members', async () => {
		signInAs(USER.outsider, EMPLOYEE.outsider);

		const refusal = await refusalOf(TEAM);

		expect(refusal).toBeInstanceOf(BadRequestException);
		expect(refusal.getResponse()).toBeInstanceOf(NotFoundException);
		// Only the creator check ran: the read that loads the members never did.
		expect(findOneByIdString.mock.calls).toEqual([[TEAM, { where: { createdByUserId: USER.outsider } }]]);
	});

	it('answers a team the caller may not read exactly as a team that does not exist', async () => {
		signInAs(USER.outsider, EMPLOYEE.outsider);
		const denied = await refusalOf(TEAM);

		// A caller who may read every team reaches the read itself, which refuses an unknown id.
		signInAs(USER.admin, null, [PermissionsEnum.ORG_TEAM_VIEW, PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);
		const missing = await refusalOf(UNKNOWN_TEAM);

		expect(answerOf(denied)).toEqual(answerOf(missing));
		expect(answerOf(missing)).toEqual({ status: 400, carried: 'NotFoundException', message: NOT_FOUND });
	});

	it.each([
		['deactivated', { isActive: false, isArchived: false }],
		['archived', { isActive: true, isArchived: true }]
	])('refuses an employee whose only membership of the team is %s', async (_, flags) => {
		memberships = [membershipOf(EMPLOYEE.member, flags)];
		signInAs(USER.member, EMPLOYEE.member);

		const refusal = await refusalOf(TEAM);

		expect(refusal.getResponse()).toBeInstanceOf(NotFoundException);
		expect(findOneByIdString).not.toHaveBeenCalledWith(TEAM, { relations: RELATIONS });
	});

	it('lets an active member read the team with every member and relation it asks for', async () => {
		signInAs(USER.member, EMPLOYEE.member);

		await expect(readTeam(TEAM)).resolves.toEqual(STORED_TEAM);

		// The check reads the caller's own membership rows, and the read after it is the request's own, not narrowed.
		expect(organizationTeamEmployeeService.find).toHaveBeenCalledWith({
			where: { organizationTeamId: TEAM, employeeId: EMPLOYEE.member }
		});
		expect(findOneByIdString).toHaveBeenLastCalledWith(TEAM, { relations: RELATIONS });
	});

	it.each([
		['null', { isActive: null, isArchived: null }],
		['not stored', {}]
	])('counts a membership whose flags are %s as active', async (_, flags) => {
		memberships = [membershipOf(EMPLOYEE.member, flags)];
		signInAs(USER.member, EMPLOYEE.member);

		await expect(readTeam(TEAM)).resolves.toEqual(STORED_TEAM);
	});

	it('lets an employee read the team when one of their memberships of it is still active', async () => {
		memberships = [
			membershipOf(EMPLOYEE.member, { isActive: true, isArchived: true }),
			membershipOf(EMPLOYEE.member, { isActive: true, isArchived: false })
		];
		signInAs(USER.member, EMPLOYEE.member);

		await expect(readTeam(TEAM)).resolves.toEqual(STORED_TEAM);
	});

	it('lets the creator of the team read it, even without an employee record', async () => {
		signInAs(USER.creator, null);

		await expect(readTeam(TEAM)).resolves.toEqual(STORED_TEAM);

		expect(organizationTeamEmployeeService.find).not.toHaveBeenCalled();
		expect(findOneByIdString.mock.calls).toEqual([
			[TEAM, { where: { createdByUserId: USER.creator } }],
			[TEAM, { relations: RELATIONS }]
		]);
	});

	it('refuses a caller without an employee record who did not create the team, without reading memberships', async () => {
		signInAs(USER.outsider, null);

		const refusal = await refusalOf(TEAM);

		expect(refusal.getResponse()).toBeInstanceOf(NotFoundException);
		// A missing employee id would be dropped from the membership query and match any member.
		expect(organizationTeamEmployeeService.find).not.toHaveBeenCalled();
	});

	it.each([PermissionsEnum.CHANGE_SELECTED_EMPLOYEE, PermissionsEnum.ALL_ORG_VIEW])(
		'lets a holder of %s read any team, without the membership check',
		async (permission) => {
			signInAs(USER.outsider, EMPLOYEE.outsider, [PermissionsEnum.ORG_TEAM_VIEW, permission]);

			await expect(readTeam(TEAM)).resolves.toEqual(STORED_TEAM);

			expect(organizationTeamEmployeeService.find).not.toHaveBeenCalled();
			expect(findOneByIdString.mock.calls).toEqual([[TEAM, { relations: RELATIONS }]]);
		}
	);

	it('reads the team as before outside a signed-in request', async () => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(null);

		await expect(readTeam(TEAM)).resolves.toEqual(STORED_TEAM);

		expect(organizationTeamEmployeeService.find).not.toHaveBeenCalled();
	});
});

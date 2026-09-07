import '../core/entities/internal';

import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { ManagedEmployeeService } from './managed-employee.service';

const TENANT_ID = '9d347c5c-5b96-4ef3-9799-b5fa0ca09111';
const OTHER_TENANT_ID = '695e9021-a731-4b9f-a86a-20ed7ff6591c';
const ORGANIZATION_ID = '619ec3c7-498d-4c28-8b74-48da57cc5564';
const OTHER_ORGANIZATION_ID = 'ff74185b-821e-4ef5-b750-e1b7ed96018e';
const TEAM_ID = '66ba5d6e-a3c6-4be8-b74d-fb8aece4bd58';
const OTHER_TEAM_ID = 'c5fc5345-c47b-4b08-b63c-f17c88679aca';
const ACTOR_ID = '7f0d2585-296f-49cc-a229-210f5f11e372';
const TARGET_ID = '12128029-8b07-45a0-9690-181a66a660fc';

type TeamOverrides = Partial<{
	id: string;
	tenantId: string;
	organizationId: string;
	isActive: boolean;
	isArchived: boolean;
	deletedAt: Date | null;
	shareProfileView: boolean | null;
}>;

type MembershipOverrides = Partial<{
	employeeId: string;
	organizationTeamId: string;
	tenantId: string;
	organizationId: string;
	isActive: boolean;
	isArchived: boolean;
	deletedAt: Date | null;
	isManager: boolean;
	organizationTeam: ReturnType<typeof team>;
}>;

function team(overrides: TeamOverrides = {}) {
	return {
		id: TEAM_ID,
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		isActive: true,
		isArchived: false,
		deletedAt: null,
		shareProfileView: true,
		...overrides
	};
}

function membership(employeeId: string, overrides: MembershipOverrides = {}) {
	return {
		employeeId,
		organizationTeamId: TEAM_ID,
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		isActive: true,
		isArchived: false,
		deletedAt: null,
		isManager: false,
		organizationTeam: team(),
		...overrides
	};
}

describe('ManagedEmployeeService.canViewEmployeeProfile', () => {
	let service: ManagedEmployeeService;
	let rows: any[];
	let trace: Array<[string, unknown[]]>;
	let queryBuilder: Record<string, jest.Mock>;
	let teamEmployeeRepository: { createQueryBuilder: jest.Mock };
	let hasPermission: jest.SpyInstance;
	let currentTenantId: jest.SpyInstance;
	let currentUser: jest.SpyInstance;

	beforeEach(() => {
		rows = [];
		trace = [];
		queryBuilder = {};

		for (const method of ['innerJoinAndSelect', 'where', 'andWhere']) {
			queryBuilder[method] = jest.fn((...args: unknown[]) => {
				trace.push([method, args]);
				return queryBuilder;
			});
		}

		queryBuilder.getMany = jest.fn(async () => {
			trace.push(['getMany', []]);
			return rows;
		});

		teamEmployeeRepository = {
			createQueryBuilder: jest.fn((...args: unknown[]) => {
				trace.push(['createQueryBuilder', args]);
				return queryBuilder;
			})
		};

		service = new ManagedEmployeeService(teamEmployeeRepository as any, {} as any);
		hasPermission = jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		currentTenantId = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		currentUser = jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ employeeId: ACTOR_ID } as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('denies before checking permissions when the context has no tenant', async () => {
		currentTenantId.mockReturnValue(null);
		hasPermission.mockReturnValue(true);

		await expect(service.canViewEmployeeProfile(TARGET_ID, ORGANIZATION_ID, TEAM_ID)).resolves.toBe(false);

		expect(hasPermission).not.toHaveBeenCalled();
		expect(currentUser).not.toHaveBeenCalled();
		expect(teamEmployeeRepository.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('allows the global selected-employee permission after tenant validation without a membership query', async () => {
		hasPermission.mockImplementation((permission) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		currentUser.mockReturnValue(undefined);

		await expect(service.canViewEmployeeProfile(TARGET_ID, ORGANIZATION_ID)).resolves.toBe(true);

		expect(currentTenantId).toHaveBeenCalledTimes(1);
		expect(hasPermission).toHaveBeenCalledWith(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		expect(teamEmployeeRepository.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('allows self access after tenant validation without a membership query', async () => {
		await expect(service.canViewEmployeeProfile(ACTOR_ID, ORGANIZATION_ID)).resolves.toBe(true);

		expect(currentTenantId).toHaveBeenCalledTimes(1);
		expect(teamEmployeeRepository.createQueryBuilder).not.toHaveBeenCalled();
	});

	it.each([
		['no current employee', undefined, TEAM_ID],
		['no team context', { employeeId: ACTOR_ID }, undefined]
	])('denies team access with %s without querying memberships', async (_label, user, organizationTeamId) => {
		currentUser.mockReturnValue(user as any);

		await expect(service.canViewEmployeeProfile(TARGET_ID, ORGANIZATION_ID, organizationTeamId)).resolves.toBe(
			false
		);

		expect(teamEmployeeRepository.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('queries the exact active team and both employees once, then allows an active manager with an active target', async () => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockImplementation(() => {
			throw new Error('profile policy must use currentUser().employeeId');
		});
		rows = [membership(ACTOR_ID, { isManager: true }), membership(TARGET_ID)];

		await expect(service.canViewEmployeeProfile(TARGET_ID, ORGANIZATION_ID, TEAM_ID)).resolves.toBe(true);

		expect(trace).toEqual([
			['createQueryBuilder', ['member']],
			['innerJoinAndSelect', ['member.organizationTeam', 'team']],
			['where', ['member.employeeId IN (:...employeeIds)', { employeeIds: [ACTOR_ID, TARGET_ID] }]],
			['andWhere', ['member.organizationTeamId = :organizationTeamId', { organizationTeamId: TEAM_ID }]],
			['andWhere', ['member.tenantId = :tenantId', { tenantId: TENANT_ID }]],
			['andWhere', ['member.organizationId = :organizationId', { organizationId: ORGANIZATION_ID }]],
			['andWhere', ['member.isActive = :memberIsActive', { memberIsActive: true }]],
			['andWhere', ['member.isArchived = :memberIsArchived', { memberIsArchived: false }]],
			['andWhere', ['member.deletedAt IS NULL']],
			['andWhere', ['team.id = :organizationTeamId', { organizationTeamId: TEAM_ID }]],
			['andWhere', ['team.tenantId = :tenantId', { tenantId: TENANT_ID }]],
			['andWhere', ['team.organizationId = :organizationId', { organizationId: ORGANIZATION_ID }]],
			['andWhere', ['team.isActive = :teamIsActive', { teamIsActive: true }]],
			['andWhere', ['team.isArchived = :teamIsArchived', { teamIsArchived: false }]],
			['andWhere', ['team.deletedAt IS NULL']],
			['getMany', []]
		]);
		expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);
	});

	it('requires the target membership even when the actor is a manager', async () => {
		rows = [membership(ACTOR_ID, { isManager: true })];

		await expect(service.canViewEmployeeProfile(TARGET_ID, ORGANIZATION_ID, TEAM_ID)).resolves.toBe(false);
	});

	it('allows non-manager teammates only when profile sharing is exactly true', async () => {
		rows = [membership(ACTOR_ID), membership(TARGET_ID)];

		await expect(service.canViewEmployeeProfile(TARGET_ID, ORGANIZATION_ID, TEAM_ID)).resolves.toBe(true);
	});

	it.each([false, null])('denies a non-manager when profile sharing is %s', async (shareProfileView) => {
		const organizationTeam = team({ shareProfileView });
		rows = [membership(ACTOR_ID, { organizationTeam }), membership(TARGET_ID, { organizationTeam })];

		await expect(service.canViewEmployeeProfile(TARGET_ID, ORGANIZATION_ID, TEAM_ID)).resolves.toBe(false);
	});

	it('accepts duplicate hydrated memberships while still requiring both employees', async () => {
		rows = [membership(ACTOR_ID), membership(ACTOR_ID), membership(TARGET_ID)];

		await expect(service.canViewEmployeeProfile(TARGET_ID, ORGANIZATION_ID, TEAM_ID)).resolves.toBe(true);
	});

	it.each([
		['inactive actor membership', membership(ACTOR_ID, { isActive: false }), membership(TARGET_ID)],
		['archived actor membership', membership(ACTOR_ID, { isArchived: true }), membership(TARGET_ID)],
		['deleted actor membership', membership(ACTOR_ID, { deletedAt: new Date() }), membership(TARGET_ID)],
		['cross-tenant actor membership', membership(ACTOR_ID, { tenantId: OTHER_TENANT_ID }), membership(TARGET_ID)],
		[
			'cross-organization actor membership',
			membership(ACTOR_ID, { organizationId: OTHER_ORGANIZATION_ID }),
			membership(TARGET_ID)
		],
		[
			'cross-team actor membership',
			membership(ACTOR_ID, { organizationTeamId: OTHER_TEAM_ID }),
			membership(TARGET_ID)
		],
		['inactive target membership', membership(ACTOR_ID), membership(TARGET_ID, { isActive: false })],
		['archived target membership', membership(ACTOR_ID), membership(TARGET_ID, { isArchived: true })],
		['deleted target membership', membership(ACTOR_ID), membership(TARGET_ID, { deletedAt: new Date() })],
		['cross-tenant target membership', membership(ACTOR_ID), membership(TARGET_ID, { tenantId: OTHER_TENANT_ID })],
		[
			'cross-organization target membership',
			membership(ACTOR_ID),
			membership(TARGET_ID, { organizationId: OTHER_ORGANIZATION_ID })
		],
		[
			'cross-team target membership',
			membership(ACTOR_ID),
			membership(TARGET_ID, { organizationTeamId: OTHER_TEAM_ID })
		]
	])('denies %s returned by a malformed repository double', async (_label, actor, target) => {
		rows = [actor, target];

		await expect(service.canViewEmployeeProfile(TARGET_ID, ORGANIZATION_ID, TEAM_ID)).resolves.toBe(false);
	});

	it.each([
		['wrong team id', { id: OTHER_TEAM_ID }],
		['wrong team tenant', { tenantId: OTHER_TENANT_ID }],
		['wrong team organization', { organizationId: OTHER_ORGANIZATION_ID }],
		['inactive team', { isActive: false }],
		['archived team', { isArchived: true }],
		['deleted team', { deletedAt: new Date() }]
	])('denies an otherwise valid membership pair joined to a %s', async (_label, overrides) => {
		const organizationTeam = team(overrides);
		rows = [
			membership(ACTOR_ID, { isManager: true, organizationTeam }),
			membership(TARGET_ID, { organizationTeam })
		];

		await expect(service.canViewEmployeeProfile(TARGET_ID, ORGANIZATION_ID, TEAM_ID)).resolves.toBe(false);
	});

	it('propagates membership query failures unchanged', async () => {
		const failure = new Error('membership database unavailable');
		queryBuilder.getMany.mockRejectedValue(failure);

		await expect(service.canViewEmployeeProfile(TARGET_ID, ORGANIZATION_ID, TEAM_ID)).rejects.toBe(failure);
	});
});
